// _hjrace.mjs - HOLY JEEZ WITH A FULL FIELD (scratch): a real race in the game (?holyjeez=1), the
// player and AI cars all driven by the racing AI (as racecheck4 drives them), from the real grid on
// the start lane. Per car: laps done, finished or not, seconds off the road (centre past the lap's
// edge + 1.5 m and off every lane), resets (a jump of over 8 m in one frame), rolls; and every pass
// over THE CREST JUMP (lap 80-140 m): speed going up it, seconds in the air, the landing's angle to
// the road, the hardest load in the 0.5 s after touchdown and seconds off the road in the 3 s
// after; the first place each car sat under 4 km/h for 5 s after the green. Nothing in the game
// is changed: it only reads each frame.
// [RAC3R_QUERY=...] node tools/scratch/_hjrace.mjs [ai n] [laps] [seed] [car]
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';

const [aiArg = '20', lapsArg = '4', seedArg = '1', carId = 'rx-super'] = process.argv.slice(2);
// s: the most the run may take (inside the 10-minute tool limit)
const DEADLINE_S = 540;
const srv = await startServer();
let browser;
try {
  browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(`${srv.url}/?menu=1&guide=0&rules=0&holyjeez=1&seed=${seedArg}${extraQuery()}`);
  await page.waitForTimeout(3000);
  await page.evaluate(startRace, [+aiArg, +lapsArg, carId]);
  const started = Date.now();
  let state = null;
  while (Date.now() - started < DEADLINE_S * 1000) {
    await page.waitForTimeout(1000);
    state = await page.evaluate(() => {
      const flow = window.__game.flow;
      return flow && { state: flow.state, shown: !!window.__game.flowShown, t: flow.t };
    });
    if (!state || state.shown) break;
  }
  const report = await page.evaluate(readReport);
  printReport(report, state, errors, { ai: +aiArg, laps: +lapsArg, seed: seedArg, carId });
} finally {
  await browser?.close();
  srv.stop();
}

/**
 * In the page: launches the race, every car driven by the racing AI, and starts the per-frame
 * reader.
 * @param {[number, number, string]} args AI count, laps, car
 */
async function startRace([aiCount, laps, car]) {
  const game = window.__game;
  const circuit = await import('/src/ai/circuit.ts'), traits = await import('/src/ai/traits.ts');
  const lab = await import('/src/lab.ts');
  game.menu.hide();
  game.launch('holyjeez', car, { ai: aiCount, diff: 2, laps, rx: true });
  const driver = circuit.createAIDriver(lab.LEVEL, traits.aiTraits(2, 0, 1, 99));
  game.input.update = () => ({ ...driver.drive(game.car, 1 / 60, { cars: game.ai.map((entry) =>
    entry.car), lap: 1, laps }), reverse: 0, shiftUp: false, shiftDown: false });
  const sub = lab.LEVEL.subtrack, lanes = lab.LEVEL.lanes;
  const half = sub.width / 2;
  const rec = window.__hjrec = { cars: [], lastT: performance.now(), offBins: {}, resetAt: [] };
  const flowT = () => (game.flow ? game.flow.t : 0);
  const onAnyLane = (x, y) => lanes.some((lane) => {
    for (let i = 1; i < lane.pts.length; i++) {
      const [ax, ay] = lane.pts[i - 1], [bx, by] = lane.pts[i];
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
      const along = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
      if (Math.hypot(ax + along * dx - x, ay + along * dy - y) < lane.width / 2 + 1.5) return true;
    }
    return false;
  });
  const sample = (car, slot, dt) => {
    const own = rec.cars[slot] ??= { off: 0, resets: 0, passes: [], pass: null, x: car.x, y: car.y };
    const hit = lab.querySubtrack(sub, car.x, car.y);
    if (Math.hypot(car.x - own.x, car.y - own.y) > 8) {
      own.resets++;
      const was = lab.querySubtrack(sub, own.x, own.y);
      rec.resetAt.push(`${slot}@${was.trackDist.toFixed(0)}m(${was.dist.toFixed(0)} off)`);
    }
    own.x = car.x;
    own.y = car.y;
    const off = hit.dist > half + 1.5 && !onAnyLane(car.x, car.y);
    if (off) {
      own.off += dt;
      // (the first seconds after the green apart: the grid stands back down the start lane)
      const key = (flowT() < 12 ? 'start ' : '') + String(Math.floor(hit.trackDist / 50) * 50);
      rec.offBins[key] = (rec.offBins[key] || 0) + dt;
    }
    const speed = Math.hypot(car.vx, car.vy) * 3.6;
    // (the first place, after the green, where it sat under 4 km/h for 5 s)
    own.slowS = flowT() > 8 && speed < 4 ? (own.slowS || 0) + dt : 0;
    if (own.slowS > 5 && !own.stuckAt) own.stuckAt = `(${car.x.toFixed(0)},${car.y.toFixed(0)}) lap `
      + `${hit.trackDist.toFixed(0)} m, ${hit.dist.toFixed(1)} m off its centre at ${flowT().toFixed(0)} s`;
    const inWindow = hit.dist < 12 && hit.trackDist >= 80 && hit.trackDist <= 140;
    let pass = own.pass;
    if (inWindow && !pass) pass = own.pass = { up: 0, air: 0, land: null, load: 0, offAfter: 0,
      since: -1, wasAir: false };
    if (!pass) return;
    if (hit.trackDist < 100) pass.up = Math.max(pass.up, speed);
    pass.air = Math.max(pass.air, car.air || 0);
    const airborne = (car.air || 0) > 0;
    if (pass.wasAir && !airborne && pass.land == null && pass.air > 0.05) {
      const road = lab.onTrack(sub, hit.trackDist, 0, {}).rot;
      const err = Math.atan2(Math.sin(car.heading - road), Math.cos(car.heading - road));
      pass.land = Math.abs(err) * 180 / Math.PI;
      pass.since = 0;
    }
    pass.wasAir = airborne;
    if (pass.since >= 0) {
      pass.since += dt;
      if (pass.since < 0.5) pass.load = Math.max(pass.load, car.loadK);
      if (off) pass.offAfter += dt;
    }
    const done = pass.since >= 3 || (!inWindow && pass.since < 0 && hit.trackDist > 140);
    if (done || (!inWindow && pass.since < 0)) {
      own.passes.push(pass);
      own.pass = null;
    }
  };
  const tick = () => {
    const now = performance.now(), dt = Math.min(0.1, (now - rec.lastT) / 1000);
    rec.lastT = now;
    const flow = game.flow;
    if (flow && (flow.state === 'racing' || flow.state === 'grace')) {
      sample(game.car, 0, dt);
      game.ai.forEach((entry, i) => sample(entry.car, i + 1, dt));
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * In the page: the race's results and the per-car record.
 * @returns {object} the report
 */
function readReport() {
  const game = window.__game, flow = game.flow, rec = window.__hjrec;
  const cars = [game.car, ...game.ai.map((entry) => entry.car)];
  const entries = flow ? flow.entries : [];
  return {
    flowState: flow && flow.state,
    offBins: rec.offBins,
    resetAt: rec.resetAt,
    raceT: flow && flow.t,
    cars: cars.map((car, slot) => {
      const entry = entries.find((one) => one.car === car) || {};
      const own = rec.cars[slot] || { off: 0, resets: 0, passes: [] };
      return { slot, laps: entry.lapDone ?? null, finished: entry.finish != null,
        rolls: car._rolls || 0, dmgResets: car._dmgResets || 0, off: own.off,
        resets: own.resets, passes: own.passes, stuckAt: own.stuckAt || null };
    }),
  };
}

/**
 * Prints the report.
 * @param {object} report the page's report
 * @param {object} state the last flow state read
 * @param {string[]} errors page errors
 * @param {object} run the run's settings
 */
function printReport(report, state, errors, run) {
  console.log(`holyjeez ${run.carId} ai ${run.ai} laps ${run.laps} seed ${run.seed}: flow`
    + ` ${report.flowState}, race ${(report.raceT ?? 0).toFixed(0)} s, shown ${!!state?.shown}`);
  let finished = 0, allPasses = [];
  for (const car of report.cars) {
    if (car.finished) finished++;
    allPasses = allPasses.concat(car.passes);
    const crest = car.passes.map((pass) => `${pass.up.toFixed(0)}km/h air ${pass.air.toFixed(2)}`
      + (pass.land == null ? '' : ` land ${pass.land.toFixed(0)}deg load ${pass.load.toFixed(2)}`
      + ` off ${pass.offAfter.toFixed(1)}`)).join('; ');
    console.log(`  ${car.slot ? `AI ${String(car.slot).padStart(2)}` : 'YOU  '} laps ${car.laps}`
      + ` ${car.finished ? 'finished' : 'NOT FINISHED'} off ${car.off.toFixed(1)} s resets`
      + ` ${car.resets} (damage ${car.dmgResets}) rolls ${car.rolls}`
      + `${car.stuckAt ? ` | STOPPED 5 s at ${car.stuckAt}` : ''} | crest: ${crest}`);
  }
  const flown = allPasses.filter((pass) => pass.air > 0.05);
  const landed = flown.filter((pass) => pass.land != null);
  const worstLand = Math.max(0, ...landed.map((pass) => pass.land));
  const offAfter = landed.filter((pass) => pass.offAfter > 0).length;
  console.log(`finished ${finished} of ${report.cars.length}; crest passes ${allPasses.length},`
    + ` airborne ${flown.length} (most ${Math.max(0, ...flown.map((pass) => pass.air)).toFixed(2)}`
    + ` s), landed ${landed.length}, worst landing angle ${worstLand.toFixed(0)} deg, off the road`
    + ` after a landing ${offAfter}`);
  const bins = Object.entries(report.offBins).sort((one, two) => two[1] - one[1]);
  console.log('seconds off the road by lap metre (all cars):', bins.map(([key, secs]) =>
    `${key}: ${secs.toFixed(1)}`).join(', '));
  console.log('resets (car@lap m, m off the centreline before):', report.resetAt.join(' '));
  console.log(errors.length ? `PAGE ERRORS ${errors.slice(0, 3).join(' | ')}` : 'no page errors');
}
