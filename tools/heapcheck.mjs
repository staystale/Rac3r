// heapcheck.mjs - leak and per-km allocation check for the judder hunt (task 126).
// The game is driven by ?autopilot=1 with a virtual clock: requestAnimationFrame is captured and
// pumped by hand at 60 Hz, so a km costs a few seconds of real time. Distance = the highway's
// game.hwDist, or on a circuit an odometer summed from the car's movement.
//   node tools/heapcheck.mjs snap  <level> <kmA> <kmB>   2 heap snapshots (after a forced GC) + diff
//   node tools/heapcheck.mjs alloc <level> <warm km>     sampling heap profiler over the next 1 km
// level: highway | brands-snatch (any level id). Snapshots go to the OS temp dir and are deleted.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, launchBrowser } from './lib/browser.mjs';

const [cmd = 'snap', level = 'highway', argA = '2', argB = '10'] = process.argv.slice(2);
const TYPES = new Set(['object', 'array', 'closure', 'native', 'hidden']);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'heapcheck-'));
const query = level === 'highway' ? '&traffic=0' : '';
const url = (base) => `${base}/?touch=1&guide=0&menu=0&rules=0&level=${level}&autopilot=1${query}`;

async function open(srv, b) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const cbs = []; let now = 1000;
    window.requestAnimationFrame = (cb) => { cbs.push(cb); return cbs.length; };
    window.__odo = 0; let px = null, py = null;
    // pump n frames of 1/60 s; returns the metres driven (hwDist on the highway, else the odometer)
    window.__pump = (n) => {
      for (let i = 0; i < n; i++) {
        const run = cbs.splice(0); now += 1000 / 60;
        for (const f of run) f(now);
        const c = window.__game.car;
        if (px !== null) window.__odo += Math.hypot(c.x - px, c.y - py);
        px = c.x; py = c.y;
      }
      const g = window.__game;
      return g.hwDist > 0 ? g.hwDist : window.__odo;
    };
  });
  await page.goto(url(srv.url));
  await page.evaluate(() => window.__pump(5));
  await page.touchscreen.tap(400, 200);
  await page.evaluate(() => window.__pump(120));
  const cdp = await ctx.newCDPSession(page);
  return { page, cdp };
}

// drive until the distance reaches km (metres = km * 1000); returns the distance
async function driveTo(page, km) {
  let dist = 0;
  while (dist < km * 1000) dist = await page.evaluate(() => window.__pump(120));
  return dist;
}

async function snapshot(cdp, file) {
  await cdp.send('HeapProfiler.collectGarbage');
  const out = fs.openSync(file, 'w');
  const onChunk = (ev) => fs.writeSync(out, ev.chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
  fs.closeSync(out);
}

// Parse a .heapsnapshot: totals by "type name" for the wanted types, plus the retained total.
function parse(file) {
  const snap = JSON.parse(fs.readFileSync(file, 'utf8'));
  const f = snap.snapshot.meta.node_fields, nf = f.length, ef = snap.snapshot.meta.edge_fields.length;
  const iType = f.indexOf('type'), iName = f.indexOf('name'), iSize = f.indexOf('self_size');
  const iEdges = f.indexOf('edge_count');
  const types = snap.snapshot.meta.node_types[0], etypes = snap.snapshot.meta.edge_types[0];
  const { nodes, edges, strings } = snap;
  const agg = new Map(), first = new Map();   // first: key -> node offset of one example
  let total = 0, count = 0;
  for (let i = 0; i < nodes.length; i += nf) {
    const t = types[nodes[i + iType]], size = nodes[i + iSize];
    total += size; count++;
    if (!TYPES.has(t)) continue;
    const key = `${t} ${strings[nodes[i + iName]]}`;
    const a = agg.get(key) || { count: 0, bytes: 0 };
    a.count++; a.bytes += size; agg.set(key, a);
    if (!first.has(key)) first.set(key, i);
  }
  return { agg, total, count, nodes, edges, strings, nf, ef, iName, iEdges, etypes, first };
}

// retainer path of the node at offset idx: BFS from the root over strong edges (shortest path)
function pathTo(s, idx) {
  const { nodes, edges, strings, nf, ef, iName, iEdges, etypes } = s;
  const parent = new Map([[0, null]]), queue = [0];
  const firstEdge = new Int32Array(nodes.length / nf + 1);
  let e = 0;
  for (let n = 0; n < nodes.length / nf; n++) { firstEdge[n] = e; e += nodes[n * nf + iEdges]; }
  for (let q = 0; q < queue.length && !parent.has(idx); q++) {
    const n = queue[q], ei = firstEdge[n / nf] * ef, cnt = nodes[n + iEdges];
    for (let k = 0; k < cnt; k++) {
      const o = ei + k * ef, et = etypes[edges[o]];
      if (et === 'weak' || et === 'shortcut') continue;
      const to = edges[o + 2];
      if (parent.has(to)) continue;
      const num = et === 'element' || et === 'hidden';
      parent.set(to, { from: n, label: num ? `[${edges[o + 1]}]` : strings[edges[o + 1]] });
      queue.push(to);
    }
  }
  const steps = []; let cur = idx;
  while (parent.get(cur)) {
    const p = parent.get(cur);
    steps.push(`${strings[nodes[p.from + iName]].slice(0, 40)}.${p.label}`); cur = p.from;
  }
  return steps.reverse().slice(-7).join(' > ');
}

async function runSnap(srv, b) {
  const { page, cdp } = await open(srv, b);
  const kms = [+argA, +argB], files = [];
  for (const km of kms) {
    const t0 = Date.now(), dist = await driveTo(page, km);
    const file = path.join(tmp, `${level}-${km}.heapsnapshot`);
    await snapshot(cdp, file); files.push(file);
    console.log(`${level}: ${(dist / 1000).toFixed(2)} km driven, snapshot in ${Date.now() - t0} ms`);
  }
  const A = parse(files[0]), B = parse(files[1]);
  console.log(`${level}: retained heap ${(A.total / 1e6).toFixed(2)} MB (${A.count} nodes) at ${argA} km` +
    `, ${(B.total / 1e6).toFixed(2)} MB (${B.count} nodes) at ${argB} km`);
  const rows = [];
  for (const [key, now] of B.agg) {
    const a = A.agg.get(key) || { count: 0, bytes: 0 };
    rows.push({ key, dc: now.count - a.count, db: now.bytes - a.bytes, c: now.count,
      idx: B.first.get(key) });
  }
  for (const [name, field] of [['COUNT', 'dc'], ['BYTES', 'db']]) {
    rows.sort((x, y) => y[field] - x[field]);
    console.log(`top 30 by growth in ${name}: key | +count | +bytes | count now`);
    for (const r of rows.slice(0, 30)) console.log(`${r.key.slice(0, 60)} | ${r.dc} | ${r.db} | ${r.c}`);
  }
  rows.sort((x, y) => y.dc - x.dc);
  for (const r of rows.slice(0, 8)) console.log(`path ${r.key.slice(0, 40)}: ${pathTo(B, r.idx)}`);
}

async function runAlloc(page, cdp) {
  await driveTo(page, +argA);
  await cdp.send('HeapProfiler.collectGarbage');
  const d0 = await page.evaluate(() => window.__pump(0));
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 4096,
    includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  const d1 = await driveTo(page, (d0 + 1000) / 1000);
  const { profile } = await cdp.send('HeapProfiler.stopSampling');
  const km = (d1 - d0) / 1000, by = new Map();
  const walk = (n) => {
    const cf = n.callFrame, file = cf.url.split('/').slice(-2).join('/');
    const key = `${cf.functionName || '(anon)'} ${file}:${cf.lineNumber + 1}`;
    by.set(key, (by.get(key) || 0) + n.selfSize);
    n.children.forEach(walk);
  };
  walk(profile.head);
  const rows = [...by].sort((x, y) => y[1] - x[1]).slice(0, 25);
  console.log(`${level}: sampled ${km.toFixed(2)} km; top 25 allocating functions, KB per km`);
  for (const [key, bytes] of rows) console.log(`${(bytes / 1024 / km).toFixed(1)} KB/km | ${key}`);
  const sum = [...by.values()].reduce((x, y) => x + y, 0);
  console.log(`total ${(sum / 1024 / km).toFixed(0)} KB/km`);
}

const srv = await startServer();
let b;
try {
  b = await launchBrowser();
  if (cmd === 'snap') await runSnap(srv, b);
  else { const { page, cdp } = await open(srv, b); await runAlloc(page, cdp); }
} finally {
  await b?.close();
  srv.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
}

