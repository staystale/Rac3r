// _framecheckat.mjs - tools/framecheck.mjs from a place on the lap: the same CPU x4 phone-ish page
// and demo driver, the car set down at each lap distance in turn (where the scenery is thickest -
// Spa's forest), FRAMES frames driven from each. Prints frame and work ms per spot and over all.
// node tools/scratch/_framecheckat.mjs <level> "<lap m>,<lap m>,..." [extra query]
// (env FRAMES, default 600; CHECK_PORT as the other browser tools)
import { startServer, launchBrowser } from '../lib/browser.mjs';
const [level = 'spa', spotList = '0', extra = ''] = process.argv.slice(2);
const FRAMES = +(process.env.FRAMES || 600);
const srv = await startServer();
let browser;
const pct = (list, share) => list[Math.floor(share * (list.length - 1))];
try {
  browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__raf = raf;
    window.__work = [];
    window.requestAnimationFrame = (cb) => raf((stamp) => {
      const t0 = performance.now();
      try { cb(stamp); } finally { window.__work.push(performance.now() - t0); }
    });
  });
  await page.goto(`${srv.url}/?touch=1&guide=0&level=${level}&car=track-rwd${extra}`);
  await page.touchscreen.tap(400, 200);
  await page.waitForTimeout(4000);
  const all = { frames: [], work: [] };
  for (const spot of spotList.split(',').map(Number)) {
    const res = await page.evaluate(([at, frames]) => new Promise(async (done) => {
      const game = window.__game, sub = game.level.subtrack;
      let best = sub.pts[0];
      for (const point of sub.pts) if (point.dist <= at) best = point;
      Object.assign(game.car, { x: best.x, y: best.y, heading: best.heading, vx: 0, vy: 0 });
      const auto = await import('/src/ai/autodrive.ts');
      const driver = auto.createAutoDriver(sub);
      game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false,
        shiftDown: false });
      const w0 = window.__work.length, times = [];
      let last = performance.now(), count = 0;
      const tick = (now) => {
        times.push(now - last);
        last = now;
        if (++count < frames) window.__raf(tick);
        else done({ times, work: window.__work.slice(w0) });
      };
      window.__raf(tick);
    }), [spot, FRAMES]);
    const frames = res.times.slice(30), work = res.work.slice(30);
    all.frames.push(...frames);
    all.work.push(...work);
    const sortedF = frames.slice().sort((a, b) => a - b), sortedW = work.slice().sort((a, b) => a - b);
    console.log(`${level} from ${spot} m: frame median ${pct(sortedF, 0.5).toFixed(1)} p95 `
      + `${pct(sortedF, 0.95).toFixed(1)} | work median ${pct(sortedW, 0.5).toFixed(1)} p95 `
      + `${pct(sortedW, 0.95).toFixed(1)} worst ${sortedW[sortedW.length - 1].toFixed(1)} ms`);
  }
  const sortedF = all.frames.sort((a, b) => a - b), sortedW = all.work.sort((a, b) => a - b);
  console.log(`${level} ALL: frame median ${pct(sortedF, 0.5).toFixed(1)} p95 `
    + `${pct(sortedF, 0.95).toFixed(1)} over 33 ms ${sortedF.filter((v) => v > 33).length} of `
    + `${sortedF.length} | work median ${pct(sortedW, 0.5).toFixed(1)} p95 `
    + `${pct(sortedW, 0.95).toFixed(1)} ms`);
} finally {
  await browser?.close();
  srv.stop();
}
