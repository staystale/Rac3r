// _perfspikes.mjs (from _perfscenes.mjs) - WHAT A SLOW FRAME IS: per frame the game's work, its sim
// steps, its sim ms (from game.simMs' smoothing) and the ground tiles painted; the slow frames
// listed with those, and the means for slow vs normal frames.
// _perfscenes.mjs - LOADING + PERFORMANCE, measure only (owner: a steady 60 fps): three heavy scenes
// in the real game on the laptop's browser at full CPU (no throttle) - a full F1 field at Moanaco,
// GETAWAY STOCKHOLM's motorway with traffic, a rally stage with 5 AI. Per scene: the launch's time
// to the first frame you can drive (the race no longer held: loading screen and fly-in done), then
// 600 frames driven by the demo driver - the frame-to-frame time's median, 99th percentile and
// worst, the game's own work per frame, and the top self-time functions in that window (the CDP
// sampling profiler). node tools/scratch/_perfscenes.mjs [scene ...]
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';

const SCENES = {
  moanaco: { level: 'moanaco', car: 'track-rwd', opts: { ai: 19 } },
  stockholm: { level: 'highway', car: 'hatch-rwd',
    opts: { ai: 0, road: 'motorway', scenery: 'stockholm', traffic: 1 } },
  stage: { level: 'sweaty-lamb', car: 'hatch-rwd', opts: { ai: 5 } },
};
const FRAMES = 600;
const pct = (list, share) => [...list].sort((a, b) => a - b)[Math.floor(share * (list.length - 1))];

/**
 * The profile's self time per function (ms), the top N.
 * @param {object} profile the CDP profile
 * @param {number} top how many
 * @returns {string[]} lines
 */
function topSelf(profile, top) {
  const byNode = new Map(profile.nodes.map((node) => [node.id, node]));
  const self = new Map();
  const deltas = profile.timeDeltas;
  profile.samples.forEach((id, i) => {
    const node = byNode.get(id), frame = node.callFrame;
    const where = (frame.url || '').split('/src/')[1] || frame.url || '';
    const key = `${frame.functionName || '(anon)'} ${where ? where + ':' + (frame.lineNumber + 1) : ''}`;
    self.set(key, (self.get(key) || 0) + (deltas[i] || 0) / 1000);
  });
  const total = [...self.values()].reduce((all, ms) => all + ms, 0);
  return [...self].sort((a, b) => b[1] - a[1]).slice(0, top)
    .map(([key, ms]) => `${(ms / FRAMES).toFixed(2)} ms/frame (${(ms / total * 100).toFixed(1)} %)  ${key}`);
}

/**
 * The profile's self time per source file (ms a frame), the top N.
 * @param {object} profile the CDP profile
 * @param {number} top how many
 * @returns {string[]} lines
 */
function byFile(profile, top) {
  const byNode = new Map(profile.nodes.map((node) => [node.id, node]));
  const self = new Map();
  profile.samples.forEach((id, i) => {
    const frame = byNode.get(id).callFrame;
    const key = ((frame.url || '').split('/src/')[1] || frame.functionName || '(native)');
    self.set(key, (self.get(key) || 0) + (profile.timeDeltas[i] || 0) / 1000);
  });
  return [...self].sort((a, b) => b[1] - a[1]).slice(0, top)
    .map(([key, ms]) => `${(ms / FRAMES).toFixed(2)} ms/frame  ${key}`);
}

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const id of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES)) {
    const scene = SCENES[id];
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3,
      isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.__raf = raf;
      window.__work = [];
      window.requestAnimationFrame = (cb) => raf((t) => {
        const t0 = performance.now();
        try { cb(t); } finally { window.__work.push(performance.now() - t0); }
      });
    });
    const opened = Date.now();
    await page.goto(`${server.url}/?touch=1&guide=0&menu=0&rules=0&level=${scene.level}${extraQuery()}`);
    await page.waitForFunction(() => window.__game && window.__game.level && window.__game.launch,
      null, { timeout: 120000 });
    const builtMs = Date.now() - opened;
    await page.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'x' })));
    const launchMs = await page.evaluate(([level, car, opts]) => new Promise((done) => {
      const t0 = performance.now();
      window.__game.launch(level, car, opts);
      const check = () => {
        const game = window.__game;
        if (game.car && !game.raceHeld && performance.now() - t0 > 200) done(performance.now() - t0);
        else window.__raf(check);
      };
      window.__raf(check);
    }), [scene.level, scene.car, scene.opts]);
    await page.waitForTimeout(2000);
    await page.evaluate(async () => {
      const game = window.__game;
      const auto = await import('/src/ai/autodrive.ts');
      const driver = auto.createAutoDriver(game.level.subtrack);
      game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false,
        shiftDown: false });
    }).catch(() => {});
    await page.waitForTimeout(1500);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
    await cdp.send('Profiler.start');
    const run = await page.evaluate((count) => new Promise((done) => {
      const times = [], w0 = window.__work.length;
      let last = performance.now(), n = 0;
      const simClock = () => window.__game.flow?.t ?? window.__game.lap.lapTime;
      const sim0 = simClock(), wall0 = performance.now();
      const per = [];
      let simWas = window.__game.simMs || 0, tilesWas = window.__game.renderer?.groundRenders || 0;
      const tick = (now) => {
        const game = window.__game, simNow = game.simMs || 0;
        const tilesNow = game.renderer?.groundRenders || 0;
        per.push({ work: window.__work[window.__work.length - 1] || 0, steps: game.stepsLastFrame || 0,
          sim: (simNow - 0.9 * simWas) / 0.1, tiles: tilesNow - tilesWas });
        simWas = simNow;
        tilesWas = tilesNow;
        times.push(now - last);
        last = now;
        if (++n < count) window.__raf(tick);
        else {
          const game = window.__game;
          done({ simS: simClock() - sim0, wallS: (performance.now() - wall0) / 1000,
            times, per, work: window.__work.slice(w0), ai: (game.ai || []).length,
            traffic: game.traffic ? game.traffic.cars.length : 0,
            kmh: Math.hypot(game.car.vx, game.car.vy) * 3.6 });
        }
      };
      window.__raf(tick);
    }), FRAMES);
    const { profile } = await cdp.send('Profiler.stop');
    const times = run.times.slice(1), work = run.work;
    console.log(`== ${id}: ${scene.level} (${run.ai} AI, ${run.traffic} traffic, car ${run.kmh.toFixed(0)} km/h)`);
    console.log(`  load: page open to the level built ${(builtMs / 1000).toFixed(1)} s; launch to the`
      + ` first drivable frame ${(launchMs / 1000).toFixed(1)} s`);
    console.log(`  frame time: median ${pct(times, 0.5).toFixed(1)} ms, p99 ${pct(times, 0.99).toFixed(1)}`
      + ` ms, worst ${Math.max(...times).toFixed(1)} ms; over 20 ms ${times.filter((t) => t > 20).length}`
      + ` of ${times.length} | the game's work median ${pct(work, 0.5).toFixed(1)} ms, p99`
      + ` ${pct(work, 0.99).toFixed(1)} ms`);
    console.log(`  sim time ${run.simS.toFixed(2)} s in ${run.wallS.toFixed(2)} s of wall time`);
    const slow = run.per.filter((frame) => frame.work > 33), fine = run.per.filter((frame) => frame.work <= 20);
    const mean = (list, key) => list.length ? list.reduce((all, frame) => all + frame[key], 0) / list.length : 0;
    console.log(`  frames with work over 33 ms: ${slow.length}; their mean steps ${mean(slow, 'steps').toFixed(1)}, sim ${mean(slow, 'sim').toFixed(1)} ms, tiles ${mean(slow, 'tiles').toFixed(1)} | normal frames: steps ${mean(fine, 'steps').toFixed(1)}, sim ${mean(fine, 'sim').toFixed(1)} ms, tiles ${mean(fine, 'tiles').toFixed(2)}`);
    for (const frame of slow.slice(0, 14)) console.log(`    slow: work ${frame.work.toFixed(1)} ms, steps ${frame.steps}, sim ${frame.sim.toFixed(1)} ms, tiles ${frame.tiles}`);
    for (const line of topSelf(profile, 14)) console.log('    ' + line);
    console.log('  by file:');
    for (const line of byFile(profile, 12)) console.log('    ' + line);
    console.log(`  page errors: ${errors.length ? errors.slice(0, 2).join(' | ') : 'none'}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.stop();
}
