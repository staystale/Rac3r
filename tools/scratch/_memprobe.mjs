// _memprobe.mjs - what a session holds in memory (the owner's phone reloaded the page on Knobhill
// after 3.5 min of 20 AI on Thruston, 11-03): every live canvas / OffscreenCanvas / ImageBitmap
// backing store (w x h x 4 bytes, after a forced GC) plus the JS heap, at a phone's size (440 x 751,
// dpr 3). Runs thruston then knobhill (as the owner did) with N AI.
// node tools/scratch/_memprobe.mjs [n] [secs per level]   (env LEVELS=a,b the levels in turn,
// QUERY=&x=1 switches on the page)
import { startServer, launchBrowser } from '../lib/browser.mjs';
const n = +(process.argv[2] || 20), secs = +(process.argv[3] || 40);
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 751 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('console', (m) => { if (m.text().startsWith('AIBROKE')) console.log(m.text().slice(0, 700)); });
  page.on('pageerror', (e) => {
    errs.push(e.message);
    if (errs.length <= 2) console.log('PAGE ERROR', (e.stack || '').split('\n').slice(0, 8).join(' | '));
  });
  await page.addInitScript(() => {
    const refs = []; window.__mem = refs;
    const track = (obj, kind) => { refs.push([new WeakRef(obj), kind]); return obj; };
    // WHERE a canvas gets a watched width (WATCH: 192, 73): the call site, counted
    window.__sites = {};
    const wDesc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
    Object.defineProperty(HTMLCanvasElement.prototype, 'width', { get: wDesc.get, configurable: true,
      set(v) {
        if (v === 192 || v === 73) {
          const site = (new Error().stack || '').split('\n').slice(2, 5).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '')).join(' < ');
          const k = v + ' ' + site; window.__sites[k] = (window.__sites[k] || 0) + 1;
        }
        wDesc.set.call(this, v);
      } });
    const make = Document.prototype.createElement;
    Document.prototype.createElement = function (tag, ...rest) {
      const el = make.call(this, tag, ...rest);
      if (String(tag).toLowerCase() === 'canvas') track(el, 'canvas');
      return el;
    };
    if (window.OffscreenCanvas) {
      const Off = window.OffscreenCanvas;
      window.OffscreenCanvas = function (w, h) { return track(new Off(w, h), 'offscreen'); };
      window.OffscreenCanvas.prototype = Off.prototype;
    }
    const cib = window.createImageBitmap;
    window.createImageBitmap = (...args) => cib(...args).then((bm) => track(bm, 'bitmap'));
  });
  const cdp = await ctx.newCDPSession(page);
  const snap = async (label) => {
    await cdp.send('HeapProfiler.collectGarbage');
    const r = await page.evaluate(() => {
      const by = {}; let biggest = [];
      for (const [ref, kind] of window.__mem) {
        const o = ref.deref(); if (!o) continue;
        const bytes = (o.width || 0) * (o.height || 0) * 4;
        by[kind] = by[kind] || { n: 0, mb: 0 }; by[kind].n++; by[kind].mb += bytes / 1048576;
        biggest.push([bytes / 1048576, kind, o.width, o.height]);
      }
      const sizes = {};
      for (const x of biggest) { const k = `${x[1]} ${x[2]}x${x[3]}`; sizes[k] = sizes[k] || [0, 0]; sizes[k][0]++; sizes[k][1] += x[0]; }
      biggest = Object.entries(sizes).sort((a, b) => b[1][1] - a[1][1]).slice(0, 8).map(([k, v]) => `${v[0]} x ${k} = ${v[1].toFixed(1)}MB`);
      const heap = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0;
      return { by, biggest, heap, ai: window.__game && window.__game.ai ? window.__game.ai.length : 0 };
    });
    const total = Object.values(r.by).reduce((a, x) => a + x.mb, 0);
    console.log(`${label}: canvases+bitmaps ${total.toFixed(0)} MB ${JSON.stringify(Object.fromEntries(Object.entries(r.by).map(([k, v]) => [k, `${v.n} / ${v.mb.toFixed(0)}MB`])))}, JS heap ${r.heap.toFixed(0)} MB, ${r.ai} AI`);
    console.log('   biggest: ' + r.biggest.join(', '));
    const own = await page.evaluate(async () => {
      const budget = await import('/src/core/memorybudget.ts');
      return { held: budget.heldMb(), drops: budget.DROPS.splice(0) };
    });
    console.log(`   the game's count ${own.held.toFixed(0)} MB; dropped: ${own.drops.join(', ') || '-'}`);
  };
  await page.goto(srv.url + '/?touch=1&guide=0&menu=0&rules=0&drycover=1&rimsoft=1&bushmark=1&leafpop=1&level=thruston' + (process.env.QUERY || ''));
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await snap('loaded');
  // (env CPU: a throttle for the launches' times; env REVISIT=1: the first level played again at
  // the end - a level the memory budget dropped is built again; the game's own count and drops
  // are printed when ?perfpass=1 is on)
  if (process.env.CPU) await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.CPU });
  const visits = (process.env.LEVELS || 'thruston,knobhill').split(',');
  if (process.env.REVISIT) visits.push(visits[0]);
  for (const lv of visits) {
    const launch = await page.evaluate(async ([l, c]) => {
      const level = (await import('/src/lab.ts')).LEVELS.find((entry) => entry.id === l);
      const unbuilt = !!(level && level._build), began = performance.now();
      window.__game.launch(l, 'hatch-fwd', { ai: c, laps: 9 });
      return { ms: performance.now() - began, unbuilt };
    }, [lv, n]);
    console.log(`${lv} launch ${launch.ms.toFixed(0)} ms (${launch.unbuilt ? 'built now' : 'already built'})`);
    await page.waitForTimeout(1500); await page.touchscreen.tap(220, 375); await page.waitForTimeout(500);
    await page.evaluate(async () => {
      const game = window.__game, auto = await import('/src/ai/autodrive.ts');
      const driver = auto.createAutoDriver(game.level.subtrack);
      game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false, shiftDown: false });
    });
    await snap(`${lv} start`);
    await page.waitForTimeout(secs * 1000);
    await snap(`${lv} +${secs}s`);
  }
  if (errs.length) console.log('page errors:', errs.slice(0, 3));
  const sites = await page.evaluate(() => window.__sites);
  for (const [k, v] of Object.entries(sites).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${v} x  ${k}`);
} finally { await browser.close(); srv.stop(); }
