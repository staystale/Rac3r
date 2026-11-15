// _hwoffroad.mjs - THE HIGHWAY OFF-ROAD JERK (scratch): the player's car driven OFF the motorway
// (OUT m past its edge, in the fields, the guard's resets left to the game) or ON it (OUT=0: the
// inside lane), zoomed out by its speed, at the owner's phone size (440x738, dpr 3), CPU throttled.
// Per frame: the gap, our rAF work, tiles painted (new / stale wear repaints / prefetch), GPU
// uploads; and the collector's time (CDP trace, V8 GC events). Prints the frame-work spread, the
// frames over the budget and what they had, and the GC.
// [CPU=4] [OUT=25] [SEC=40] [SPEED=38] [CHECK_PORT=8092] node tools/scratch/_hwoffroad.mjs [query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const CPU = Number(process.env.CPU || 4), OUT = Number(process.env.OUT ?? 25);
const SEC = Number(process.env.SEC || 40), SPEED = Number(process.env.SPEED || 38);
const extra = process.argv[2] || '';
const srv = await startServer();
// a run that hangs (a page that never starts) ends here, not never
const HARD_STOP_MS = (SEC + 120) * 1000;
setTimeout(() => {
  console.log('HARD STOP: the run took too long');
  srv.stop();
  process.exit(2);
}, HARD_STOP_MS).unref();
let browser;
try {
  browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 440, height: 738 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__work = { last: 0 };
    window.requestAnimationFrame = (cb) => raf((t) => {
      const t0 = performance.now();
      try { cb(t); } finally { window.__work.last = performance.now() - t0; }
    });
  });
  await gotoGame(page, `${srv.url}/?touch=1&guide=0&level=highway&car=saloon-rwd${extra}`);
  await page.touchscreen.tap(220, 370);
  await page.waitForTimeout(4000);
  // the race started by a key press (as tools/framecheck.mjs)
  await page.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'x' })));
  // the driver: aim 25 m up the road at OUT m past the road's left edge (the edge read from the
  // lane points' spread: road half-width = the outermost lane's offset + half a lane)
  await page.evaluate(({ out, speed }) => {
    const g = window.__game;
    const state = { i: 0, side: 1 };
    window.__drive = state;
    const steerFor = () => {
      const level = g.level, pts = level._hw && level._hw.pts, car = g.car;
      if (!pts) return { steer: 0, throttle: 0, brake: 0, handbrake: 0 };
      let best = Infinity;
      const from = Math.max(0, Math.min(pts.length - 1, state.i) - 40);
      for (let i = from; i < Math.min(pts.length, from + 400); i++) {
        const d2 = (pts[i].x - car.x) ** 2 + (pts[i].y - car.y) ** 2;
        if (d2 < best) { best = d2; state.i = i; }
      }
      // all lanes' outer offset: the road's half-width (the highway's geometry)
      const halfWidth = level._hw.geo ? level._hw.geo.hw : 16;
      const here = pts[state.i], ahead = pts[Math.min(pts.length - 1, state.i + 6)] || here;
      const heading = Math.atan2(ahead.y - here.y, ahead.x - here.x);
      // (the player's carriageway is left of the centre line: lateral < 0)
      const offWanted = -(out > 0 ? halfWidth + out : halfWidth - 4);
      const aimS = here.s + 25;
      const k = Math.max(0, Math.min(pts.length - 2, state.i + Math.round(25 / Math.max(1,
        (pts[Math.min(pts.length - 1, state.i + 1)].s - here.s) || 5))));
      const aimPt = pts[k], aimH = Math.atan2(pts[k + 1].y - aimPt.y, pts[k + 1].x - aimPt.x);
      const aimX = aimPt.x - Math.sin(aimH) * offWanted, aimY = aimPt.y + Math.cos(aimH) * offWanted;
      let err = Math.atan2(aimY - car.y, aimX - car.x) - car.heading;
      err = Math.atan2(Math.sin(err), Math.cos(err));
      const carSpeed = Math.hypot(car.vx, car.vy);
      state.lateral = (car.x - here.x) * -Math.sin(heading) + (car.y - here.y) * Math.cos(heading);
      state.out = Math.abs(state.lateral) - halfWidth;
      state.speed = carSpeed;
      state.aimS = aimS;
      return { steer: Math.max(-1, Math.min(1, err * 2.2)),
        throttle: carSpeed < speed ? 1 : 0, brake: carSpeed > speed + 3 ? 0.4 : 0, handbrake: 0,
        reverse: 0, shiftUp: false, shiftDown: false };
    };
    g.input.update = () => {
      state.calls = (state.calls || 0) + 1;
      try {
        return steerFor();
      } catch (err) {
        state.error = String(err && err.stack);
        return { steer: 0, throttle: 0, brake: 1, handbrake: 0 };
      }
    };
  }, { out: OUT, speed: SPEED });
  // the start lights, then up to speed
  await page.waitForTimeout(12000);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const gcEvents = [];
  cdp.on('Tracing.dataCollected', ({ value }) => {
    for (const ev of value) {
      if (ev.ph === 'X' && /^(MinorGC|MajorGC|V8\.GC_MC_BACKGROUND|V8\.GCScavenger|V8\.GCCompactor|V8\.GCFinalizeMC|BlinkGC\.\w+)$/.test(ev.name)) {
        gcEvents.push({ name: ev.name, ms: (ev.dur || 0) / 1000, ts: ev.ts / 1000, tid: ev.tid });
      }
    }
  });
  const traceDone = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.start', { categories: 'disabled-by-default-v8.gc,v8',
    transferMode: 'ReportEvents' });
  const frames = await page.evaluate((sec) => new Promise((resolve) => {
    const g = window.__game, rows = [];
    let prevT = 0;
    const stats = () => {
      const tile = g.renderer.tileStats, gpu = g.renderer.gpuCounts || { uploads: 0, mipmaps: 0 };
      return [tile.tilesPainted, tile.newTiles, tile.staleRepaints, tile.prefetched, gpu.uploads,
        gpu.mipmaps, tile.tileMs, tile.uploadedAhead || 0];
    };
    let prev = stats();
    const end = performance.now() + sec * 1000;
    const tick = (t) => {
      const now = stats(), drive = window.__drive;
      if (prevT) rows.push([+(t - prevT).toFixed(1), +window.__work.last.toFixed(2),
        ...now.slice(0, 7).map((value, i) => +(value - prev[i]).toFixed(2)), +(drive.out || 0).toFixed(1),
        +(drive.speed || 0).toFixed(1), performance.timeOrigin + t, +g.renderer.PPM.toFixed(2),
        now[7] - prev[7]]);
      prev = now;
      prevT = t;
      if (performance.now() < end) requestAnimationFrame(tick);
      else resolve(rows);
    };
    requestAnimationFrame(tick);
  }), SEC);
  await cdp.send('Tracing.end');
  await traceDone;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const driveError = await page.evaluate(() => window.__drive.error);
  if (driveError) console.log('DRIVER ERROR', driveError);
  console.log('driver', JSON.stringify(await page.evaluate(() => window.__drive)));
  const km = await page.evaluate(() => (window.__game.hwDist || 0) / 1000);
  report(frames, gcEvents, km);
  if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 5));
} finally {
  if (browser) await browser.close();
  srv.stop();
}

/**
 * Prints the run.
 * @param {number[][]} frames [gap, work, painted, new, stale, prefetched, uploads, mipmaps,
 *   tileMs, out, speed, wall ms, css px a metre, uploaded ahead]
 * @param {{name: string, ms: number}[]} gcEvents the collector's events
 * @param {number} km driven
 */
function report(frames, gcEvents, km) {
  const quant = (list, q) => {
    const sorted = [...list].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  };
  const work = frames.map((row) => row[1]), gaps = frames.map((row) => row[0]);
  const sum = (index) => frames.reduce((total, row) => total + row[index], 0);
  const offShare = frames.filter((row) => row[9] > 3).length / Math.max(1, frames.length);
  console.log(`CPU x${CPU} OUT ${OUT} m, ${SEC} s, ${km.toFixed(2)} km, ${frames.length} frames, `
    + `${(100 * offShare).toFixed(0)} % of frames off the road (>3 m), speed median `
    + `${quant(frames.map((row) => row[10]), 0.5).toFixed(1)} m/s, css px a metre median `
    + `${quant(frames.map((row) => row[12]), 0.5).toFixed(1)} (zoomed out < 9: `
    + `${(100 * frames.filter((row) => row[12] < 9).length / frames.length).toFixed(0)} %)`);
  console.log(`gap ms: median ${quant(gaps, 0.5)} p95 ${quant(gaps, 0.95)} p99 ${quant(gaps, 0.99)} `
    + `max ${Math.max(...gaps)}; over 20 ms ${gaps.filter((gap) => gap > 20).length} `
    + `(${(gaps.filter((gap) => gap > 20).length / SEC * 60).toFixed(0)} a minute), over 25 ms `
    + `${gaps.filter((gap) => gap > 25).length}`);
  console.log(`work ms: median ${quant(work, 0.5).toFixed(1)} p95 ${quant(work, 0.95).toFixed(1)} `
    + `p99 ${quant(work, 0.99).toFixed(1)} max ${Math.max(...work).toFixed(1)}`);
  console.log(`tiles painted ${sum(2)} (new ${sum(3)}, stale wear ${sum(4)}, prefetch ${sum(5)}), `
    + `tile ms ${sum(8).toFixed(0)}, uploads ${sum(6)}, mipmaps ${sum(7)}; a second: painted `
    + `${(sum(2) / SEC).toFixed(1)}, uploads ${(sum(6) / SEC).toFixed(1)}`);
  const bursts = (index, least) => frames.filter((row) => row[index] >= least).length;
  console.log(`bursts: frames with 3+ uploads ${bursts(6, 3)}, 6+ uploads ${bursts(6, 6)}, `
    + `most uploads in a frame ${Math.max(...frames.map((row) => row[6]))}; frames painting 2+ `
    + `tiles ${bursts(2, 2)}, 4+ ${bursts(2, 4)}; uploaded ahead ${sum(13)}`);
  const median = quant(work, 0.5);
  for (const over of [2, 3]) {
    const heavy = frames.filter((row) => row[1] > median * over);
    const share = (test) => heavy.filter(test).length;
    console.log(`frames with work > ${over}x median (${(median * over).toFixed(1)} ms): `
      + `${heavy.length} (${(100 * heavy.length / frames.length).toFixed(2)} %) - with a tile `
      + `${share((row) => row[2] > 0)}, an upload ${share((row) => row[6] > 0)}, neither `
      + `${share((row) => !row[2] && !row[6])}`);
  }
  const byName = {};
  for (const ev of gcEvents) byName[ev.name] = (byName[ev.name] || 0) + ev.ms;
  console.log('GC ms by event:', Object.entries(byName).map(([name, ms]) => `${name} `
    + `${ms.toFixed(0)}`).join(', ') || 'none');
  const majors = gcEvents.filter((ev) => ev.name === 'MajorGC' || ev.name === 'V8.GCFinalizeMC');
  console.log(`major GCs ${majors.length}, longest ${Math.max(0, ...majors.map((ev) => ev.ms))
    .toFixed(1)} ms; minor GCs ${gcEvents.filter((ev) => ev.name === 'MinorGC').length}`);
}
