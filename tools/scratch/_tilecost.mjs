// _tilecost.mjs - what the CPU ground tiles cost in a race: tiles painted (new / stale wear repaints),
// paint ms, the frames they land in, per 10 s and per lap; plus an inclusive CPU profile of the tile
// painters. node tools/scratch/_tilecost.mjs [level] [seconds] [extra query]
import { startServer, launchBrowser } from '../lib/browser.mjs';
const level = process.argv[2] || 'brands-snatch';
const seconds = +(process.argv[3] || 90);
const extra = process.argv[4] || '';
const srv = await startServer();
let browser;
try {
  browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(srv.url + '/?menu=0&guide=0&rules=0&level=' + level + '&ai=4&autopilot=1' + extra);
  await page.waitForFunction(() => window.__game && window.__game.renderer, null, { timeout: 60000 });
  await page.touchscreen.tap(400, 200);
  await page.waitForTimeout(6000);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  const log = await page.evaluate((runSeconds) => new Promise((resolve) => {
    const game = window.__game, rend = game.renderer;
    const rows = [];
    let last = performance.now(), lastPainted = rend.tileStats.tilesPainted;
    let lastStale = rend.tileStats.staleRepaints, lastMs = rend.tileStats.tileMs;
    const t0 = last;
    const tick = () => {
      const now = performance.now(), st = rend.tileStats;
      rows.push({
        t: (now - t0) / 1000, dt: now - last, painted: st.tilesPainted - lastPainted,
        stale: st.staleRepaints - lastStale, ms: st.tileMs - lastMs, count: rend.tileCount,
        lap: game.car && game.car.lap != null ? game.car.lap : (game.session && game.session.lap),
        kmh: game.car ? Math.hypot(game.car.vx, game.car.vy) * 3.6 : 0,
      });
      last = now; lastPainted = st.tilesPainted; lastStale = st.staleRepaints; lastMs = st.tileMs;
      if (now - t0 < runSeconds * 1000) requestAnimationFrame(tick);
      else resolve(rows);
    };
    requestAnimationFrame(tick);
  }), seconds);
  const { profile } = await cdp.send('Profiler.stop');
  // inclusive time per function name
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const parent = new Map();
  for (const node of profile.nodes) for (const child of node.children || []) parent.set(child, node.id);
  const selfTime = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    selfTime.set(profile.samples[i], (selfTime.get(profile.samples[i]) || 0) + (profile.timeDeltas[i] || 0));
  }
  const inclusive = {};
  let total = 0;
  for (const [id, us] of selfTime) {
    total += us;
    const seen = new Set();
    for (let cur = id; cur != null; cur = parent.get(cur)) {
      const fn = byId.get(cur).callFrame.functionName || '(anon)';
      if (seen.has(fn)) continue;
      seen.add(fn);
      inclusive[fn] = (inclusive[fn] || 0) + us;
    }
  }
  const idle = (inclusive['(idle)'] || 0);
  const want = ['drawFrame', 'stepTile', 'layersInto', 'paintTileInner', 'finishTile', 'drawLayerCalls',
    'drawFloor', 'drawZones', 'drawLanes', 'drawTrackRibbon', 'drawLaneDashes', 'drawPatches', 'drawWear',
    'drawCovers', 'drawCurvedKerbs', 'getImageData', 'paletteSnap', 'blitStep', 'prefetchWide', 'uploadTile',
    'drawKerb', 'drawRoad', 'drawMarks'];
  console.log('profile: total', (total / 1e6).toFixed(1), 's, idle', (idle / 1e6).toFixed(1), 's');
  for (const name of want) if (inclusive[name]) console.log('  ' + name.padEnd(18), (inclusive[name] / 1e6).toFixed(2), 's');
  const top = Object.entries(inclusive).filter(([k]) => /tile|Tile|draw|paint|upload|texImage/i.test(k))
    .sort((a, b) => b[1] - a[1]).slice(0, 25);
  console.log('top drawing/tile functions (inclusive s):');
  for (const [k, v] of top) console.log('  ' + k.padEnd(28), (v / 1e6).toFixed(2));
  // per 10 s
  console.log('\n  t     frames  slow>25  painted  stale  tileMs  maxTileMsFrame  cache  kmh  lap');
  for (let b = 0; b < seconds; b += 10) {
    const r = log.filter((row) => row.t >= b && row.t < b + 10);
    if (!r.length) continue;
    const sum = (f) => r.reduce((a, row) => a + f(row), 0);
    console.log(String(b).padStart(4), String(r.length).padStart(8), String(r.filter((x) => x.dt > 25).length).padStart(8),
      String(sum((x) => x.painted)).padStart(8), String(sum((x) => x.stale)).padStart(6),
      sum((x) => x.ms).toFixed(0).padStart(7), Math.max(...r.map((x) => x.ms)).toFixed(1).padStart(14),
      String(r[r.length - 1].count).padStart(6), r[r.length - 1].kmh.toFixed(0).padStart(5), String(r[r.length - 1].lap));
  }
  const slow = log.filter((x) => x.dt > 25);
  const slowWithTiles = slow.filter((x) => x.painted > 0 || x.ms > 2);
  const paintFrames = log.filter((x) => x.painted > 0);
  console.log('\nframes', log.length, 'slow(>25ms)', slow.length, 'of which tile frames', slowWithTiles.length,
    '| frames that painted', paintFrames.length, 'mean tile ms in them',
    (paintFrames.reduce((a, x) => a + x.ms, 0) / Math.max(1, paintFrames.length)).toFixed(1));
  const dts = log.map((x) => x.dt).sort((a, b) => a - b);
  console.log('dt median', dts[dts.length >> 1].toFixed(1), 'p95', dts[Math.floor(dts.length * 0.95)].toFixed(1));
  console.log('tile side px', await page.evaluate(() => Math.round(256 * window.__game.renderer.dpr)));
  if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 5));
} finally {
  await browser?.close();
  srv.stop();
}
