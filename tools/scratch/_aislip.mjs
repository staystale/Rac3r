// _aislip.mjs - BUG 9 (measure only): IS THE RACING AI SLOW ON SLIPPERY GROUND, AND WHERE? Node, no
// browser, one AI car alone (top difficulty), no contact. The level's tarmac (tarmac and race
// tarmac) is given the grip numbers of another surface (mu, peakK, longK, plough; its id, and so
// the tyre's own per-surface factor, stays tarmac's - Pre-Spun is 1.0 everywhere), so one track is
// laid in wet tarmac, gravel, grass, mud, snow, ice or sand; the AI's line reads the same ground,
// so it plans with that grip. A level that is loose already: SURF=native.
// The FAIR REFERENCE: the same AI, same car, same ground, with its speed plan's corner and brake
// factors (ai/line.ts K_CORNER 0.88, K_BRAKE 0.70, read through __AI_K / __AI_KB) scaled by KMUL:
// the quickest scale that stays on the road says how much grip the plan leaves unused there.
// Per run (one line, JSON): the flying lap (lap 2), seconds off the road, the share of the lap
// braking / full throttle / part throttle / coasting, the time BELOW its own target by > 1.5 m/s
// and why (full throttle = the physics; part throttle: understeer lift, oversteer catch, slip
// feel, ramp), mean front / rear slip in corners, and the speed at each corner's apex vs its plan.
// JOB 1b: PACE=0..1 sets the AI DRIVERS PACE dial (ai/tune.ts paceOf); each run also
// counts the mistakes meant to spin (spinMists) and the most the car turned while one ran.
// BUG 9 additions (the slide work is the game's default since 11-15):
// DIFF (difficulty 0-4, default 4), SEAT (place in the field: the persona, default 0) and TSEED
// (the traits' seed, default 3) pick the driver; LAPS (default 1) flying laps are tallied (laps
// 2..LAPS+1). Per run also: each lap's time, SLIDING (s with the rear past its tyre's peak slip
// angle, car.t.aPeakR), SPINS (the car turned over 70 deg from where it is going at over 3 m/s,
// once per spin) and OFFS (times it left the road), the driver's skill and persona.
// node tools/scratch/_aislip.mjs <level> <car> <surface|native> <kMul>        one run
// node tools/scratch/_aislip.mjs --all <levels> <cars> <surfaces> <kMuls>      every run, one
//   process each (comma lists), a table on stdout; OUT=<file.json> keeps every run
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);

/** One run in this process. */
async function runOne([level, carId, surfId, kMulText]) {
  // (kMul 'auto': the game's scripted driver, ai/autodrive.ts - the demo lap and the bench)
  const isAuto = kMulText === 'auto', kMul = isAuto ? 1 : Number(kMulText);
  const { SURFACES } = await import('../../src/world/surfaces.ts');
  if (surfId !== 'native') {
    const from = SURFACES[surfId];
    for (const id of ['tarmac', 'racetarmac']) {
      Object.assign(SURFACES[id], { mu: from.mu, peakK: from.peakK, longK: from.longK,
        plough: from.plough });
    }
  }
  // (HOLDK / HOLDMAX: the slide hold's angle dials, ai/driverSlide.ts)
  if (process.env.HOLDK) globalThis.__AI_HOLDK = Number(process.env.HOLDK);
  if (process.env.HOLDMAX) globalThis.__AI_HOLDMAX = Number(process.env.HOLDMAX);
  globalThis.__AI_K = 0.88 * kMul;
  globalThis.__AI_KB = 0.70 * kMul;
  const { makeCar, step, reset, PHYSICS_STEP_SECONDS: dt } = await import('../../src/vehicle.ts');
  const L = await import('../../src/lab.ts');
  const { addStageLevels } = await import('../../src/stagegen.ts');
  addStageLevels();
  const { createAIDriver } = await import('../../src/ai/circuit.ts');
  const { aiTraits } = await import('../../src/ai/traits.ts');
  const { racingLine } = await import('../../src/ai/line.ts');
  const { querySubtrack } = await import('../../src/world/tyrewall.ts');
  L.setLevel(level);
  L.clearWear();
  const line = racingLine(L.LEVEL), sub = L.LEVEL.subtrack, car = makeCar(carId);
  reset(car, line.pts[0].x, line.pts[0].y, line.pts[0].h);
  // (JOB 1b: PACE=0..1 the AI DRIVERS PACE dial - ai/tune.ts)
  const { tuneOf } = await import('../../src/ai/tune.ts');
  const diff = Number(process.env.DIFF ?? 4);
  const tune = process.env.PACE ? { ...tuneOf(diff), pace: Number(process.env.PACE) } : undefined;
  const traits = aiTraits(diff, Number(process.env.SEAT ?? 0), 1, Number(process.env.TSEED ?? 3),
    tune);
  const ai = createAIDriver(L.LEVEL, traits);
  const LAPS = Number(process.env.LAPS ?? 1);
  const { createAutoDriver } = await import('../../src/ai/autodrive.ts');
  const auto = isAuto ? createAutoDriver(sub) : null;
  const drv = isAuto ? autoShim(auto, ai, sub, querySubtrack) : ai;
  const lapStarts = [];
  let time = 0, lastLap = drv.state.lap;
  const acc = { n: 0, off: 0, brake: 0, full: 0, part: 0, coast: 0, below: 0, bFull: 0, bBrake: 0,
    under: 0, over: 0, feel: 0, ramp: 0, slipF: 0, slipR: 0, cornerN: 0, vSum: 0, vtSum: 0,
    slide: 0, peakF: 0, peakR: 0, spins: 0, spun: false, offs: 0, wasOff: false,
    mist: null, mists: {}, mistOut: { slid: 0, spun: 0, off: 0 }, mistSeen: null };
  const apex = new Map();
  while (time < 420 * LAPS && lapStarts.length < LAPS + 2) {
    L.applyGround(car, dt);
    const input = noFeel(drv.drive(car, dt, { cars: [], lap: 2, laps: 5 }), car, drv);
    step(car, input, dt);
    time += dt;
    if (drv.state.lap !== lastLap) {
      lastLap = drv.state.lap;
      lapStarts.push(time);
    }
    if (lapStarts.length < 1 || lapStarts.length > LAPS) continue;
    noteStep(acc, apex, car, drv, input, sub, querySubtrack, dt);
  }
  const laps = lapStarts.slice(1, LAPS + 1).map((end, i) => +(end - lapStarts[i]).toFixed(2));
  const lapS = laps.length === LAPS ? laps.reduce((sum, lap) => sum + lap, 0) / LAPS : null;
  const out = summarise({ level, carId, surfId, kMul: isAuto ? 'auto' : kMul, lapS, acc, apex,
    dt });
  return { ...out, laps, slide: +acc.slide.toFixed(1),
    peakF: +(acc.peakF / Math.max(1e-6, acc.cornerN)).toFixed(3),
    peakR: +(acc.peakR / Math.max(1e-6, acc.cornerN)).toFixed(3), spins: acc.spins, offs: acc.offs, mists: acc.mists,
    mistOut: acc.mistOut, spinMists: acc.spinMists || 0, spinDrift: +(acc.spinDrift || 0).toFixed(2),
    skill: +traits.skill.toFixed(2), persona: traits.persona };
}

/**
 * The scripted driver dressed as the AI for the tally: its laps counted from the line, and the
 * AI's own plan (stepped alongside, its controls thrown away) as the target it is measured against.
 */
function autoShim(auto, ai, sub, querySubtrack) {
  let lastAlong = null;
  const state = { lap: 0, vT: 95, i: 0, path: null };
  return { state, drive(car, dt, ctx) {
    ai.drive(car, dt, ctx);
    Object.assign(state, { vT: ai.state.vT, i: ai.state.i, path: ai.state.path });
    const along = querySubtrack(sub, car.x, car.y).trackDist;
    if (lastAlong !== null && lastAlong > sub.totalDist * 0.8 && along < sub.totalDist * 0.2) {
      state.lap++;
    }
    lastAlong = along;
    return auto.drive(car, dt);
  } };
}

// NOFEEL=1: a what-if in this tool only - below its target, not braking, not catching a slide
// (rear slip <= 0.18 rad) and not understeering (front <= 0.14 rad), the AI's part throttle is
// made full: what its slip-feel lifts cost
const NOFEEL = process.env.NOFEEL === '1';

/** The AI's controls, its slip-feel lift taken out when NOFEEL is set. */
function noFeel(input, car, drv) {
  if (!NOFEEL || input.brake > 0.05 || input.throttle >= 0.95 || input.reverse) return input;
  const speed = Math.hypot(car.vx, car.vy), target = Math.min(drv.state.vT ?? 95, 95);
  const slipF = Math.abs(car.t.slipF || 0), slipR = Math.abs(car.t.slipR || 0);
  if (target <= speed + 1.5 || slipR > 0.18 || slipF > 0.14) return input;
  return { ...input, throttle: 1 };
}

/** One step of lap 2's tally. */
function noteStep(acc, apex, car, drv, input, sub, querySubtrack, dt) {
  const speed = Math.hypot(car.vx, car.vy), target = Math.min(drv.state.vT ?? 95, 95);
  const near = querySubtrack(sub, car.x, car.y);
  acc.n += dt;
  acc.vSum += speed * dt;
  acc.vtSum += target * dt;
  const isOff = near.dist > sub.width / 2 + 1;
  if (isOff) acc.off += dt;
  if (isOff && !acc.wasOff) acc.offs++;
  acc.wasOff = isOff;
  if (Math.abs(car.t.slipR || 0) > (car.t.aPeakR ?? 0.1)) acc.slide += dt;
  // a SPIN: the car turned over 70 deg from where it is going (re-armed under 30 deg)
  const drift = Math.abs(Math.atan2(Math.sin(Math.atan2(car.vy, car.vx) - car.heading),
    Math.cos(Math.atan2(car.vy, car.vx) - car.heading)));
  if (speed > 3 && drift > 1.22 && !acc.spun) { acc.spins++; acc.spun = true; }
  if (drift < 0.52) acc.spun = false;
  // MISTAKES (ai/driverLane.ts): each one drawn, by kind, and whether it slid (rear past its peak
  // over 0.3 s), spun or left the road before it ended
  const mist = drv.state.mist;
  // (JOB 1b: the mistakes meant to spin, ai/driverSlide.ts spinChance, and the most the car turned
  // from where it went while one ran, rad)
  if (mist && mist !== acc.mist && mist.spin) acc.spinMists = (acc.spinMists || 0) + 1;
  if (drv.state.spinUntil > drv.state.t) acc.spinDrift = Math.max(acc.spinDrift || 0, drift);
  if (mist && mist !== acc.mist) {
    acc.mists[mist.kind] = (acc.mists[mist.kind] || 0) + 1;
    acc.mistSeen = { slideT: 0, spun: false, off: false };
  }
  if (mist && acc.mistSeen) {
    if (Math.abs(car.t.slipR || 0) > (car.t.aPeakR ?? 0.1)) acc.mistSeen.slideT += dt;
    if (acc.spun) acc.mistSeen.spun = true;
    if (isOff) acc.mistSeen.off = true;
  }
  if (!mist && acc.mist && acc.mistSeen) {
    if (acc.mistSeen.slideT > 0.3) acc.mistOut.slid++;
    if (acc.mistSeen.spun) acc.mistOut.spun++;
    if (acc.mistSeen.off) acc.mistOut.off++;
    acc.mistSeen = null;
  }
  acc.mist = mist;
  if (input.brake > 0.05) acc.brake += dt;
  else if (input.throttle >= 0.95) acc.full += dt;
  else if (input.throttle > 0.05) acc.part += dt;
  else acc.coast += dt;
  const slipF = Math.abs(car.t.slipF || 0), slipR = Math.abs(car.t.slipR || 0);
  const nearIdx = drv.state.i ?? 0, point = drv.state.path?.pts?.[nearIdx];
  if (point && point.R < 120) {
    acc.cornerN += dt;
    acc.slipF += slipF * dt;
    acc.slipR += slipR * dt;
    acc.peakF += (car.t.aPeakF ?? 0) * dt;
    acc.peakR += (car.t.aPeakR ?? 0) * dt;
  }
  if (target > speed + 1.5) {
    acc.below += dt;
    if (input.brake > 0.05) acc.bBrake += dt;
    else if (input.throttle >= 0.95) acc.bFull += dt;
    else if (slipR > 0.18) acc.over += dt;
    else if (slipF > 0.14) acc.under += dt;
    else if (slipR > 0.07 || car.t.spinR || car.t.spinF) acc.feel += dt;
    else acc.ramp += dt;
  }
  const line = drv.state.path;
  if (line && line.corners && line.cid) {
    const corner = line.corners[line.cid[nearIdx]];
    if (corner && Math.abs(nearIdx - corner.apex) <= 1) {
      const was = apex.get(corner.apex);
      if (!was || speed < was.v) apex.set(corner.apex, { v: speed, plan: target });
    }
  }
}

/** The run's line. */
function summarise({ level, carId, surfId, kMul, lapS, acc, apex }) {
  const share = (value) => +(value / Math.max(1e-6, acc.n)).toFixed(3);
  const apexes = [...apex.values()];
  const apexRatio = apexes.length ? apexes.reduce((sum, item) => sum + item.v / Math.max(1,
    item.plan), 0) / apexes.length : null;
  return { level, car: carId, surf: surfId, kMul, noFeel: NOFEEL, lapS: lapS && +lapS.toFixed(2),
    off: +acc.off.toFixed(1), brake: share(acc.brake), full: share(acc.full),
    part: share(acc.part), coast: share(acc.coast), below: +acc.below.toFixed(1),
    bFull: +acc.bFull.toFixed(1), bBrake: +acc.bBrake.toFixed(1), under: +acc.under.toFixed(1),
    over: +acc.over.toFixed(1), feel: +acc.feel.toFixed(1), ramp: +acc.ramp.toFixed(1),
    slipF: +(acc.slipF / Math.max(1e-6, acc.cornerN)).toFixed(3),
    slipR: +(acc.slipR / Math.max(1e-6, acc.cornerN)).toFixed(3),
    v: +(acc.vSum / Math.max(1e-6, acc.n)).toFixed(1),
    vPlan: +(acc.vtSum / Math.max(1e-6, acc.n)).toFixed(1),
    apexVsPlan: apexRatio && +apexRatio.toFixed(3), apexes: apexes.length };
}

if (process.argv[2] === '--all') {
  const [levels, cars, surfs, kMuls] = process.argv.slice(3).map((list) => list.split(','));
  const rows = [];
  for (const level of levels) for (const carId of cars) for (const surf of surfs) {
    for (const kMul of kMuls) {
      const out = spawnSync(process.execPath, [SELF, level, carId, surf, kMul],
        { encoding: 'utf8', timeout: 240000 });
      const last = (out.stdout || '').trim().split('\n').pop();
      let row;
      try {
        row = JSON.parse(last);
      } catch {
        row = { level, car: carId, surf, kMul: +kMul, error: (out.stderr || '').slice(-200) };
      }
      rows.push(row);
      console.log(JSON.stringify(row));
    }
  }
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(rows, null, 1));
} else {
  console.log(JSON.stringify(await runOne(process.argv.slice(2))));
}
