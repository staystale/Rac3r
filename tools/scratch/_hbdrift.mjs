// _hbdrift.mjs - THE AI's HANDBRAKE AND DRIFTING TODAY (the owner's 11-21 item 11, read only): one AI
// car alone, headless, the game's own steps and driver, LAPS laps; per level and car, over SEEDS
// (each seed two drivers of the field's spread: aiTraits slots 0 and 3 of 6, realish) - handbrake
// PULLS a lap (a pull: the driver's handbrake going on), the s a lap it held a DRIFT (the drift hold
// or a slippery-ground slide held: state.driftT), the lap time and the s a lap off the road. Nothing
// in the game is changed. LEVELS=sweaty-lamb,croughedrx,knobhill,thruston,moanaco
// CARS=hatch-fwd,hatch-rwd,rally-4x4,track-rwd SEEDS=1,2,3,4 LAPS=3 node tools/scratch/_hbdrift.mjs
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as dt } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';

const LEVELS = (process.env.LEVELS || 'sweaty-lamb,croughedrx,knobhill,thruston,moanaco')
  .split(',');
const CARS = (process.env.CARS || 'hatch-fwd,hatch-rwd,rally-4x4,track-rwd').split(',');
const SEEDS = (process.env.SEEDS || '1,2,3,4').split(',').map(Number);
const LAPS = Number(process.env.LAPS || 3), DIFF = 2, SLOTS = [0, 3], FIELD = 6;

/** One driver's laps: pulls, drift s, lap s and off s, over its flying laps (after lap 1). */
function runDriver(levelId, carId, seed, slot) {
  L.setLevel(levelId);
  L.clearWear();
  const sub = L.LEVEL.subtrack, total = sub.totalDist, spawn = L.LEVEL.spawn;
  const car = makeCar(carId);
  reset(car, spawn.x, spawn.y, spawn.heading);
  const driver = createAIDriver(L.LEVEL, aiTraits(DIFF, slot, FIELD, seed));
  car.mods.power *= driver.traits.power ?? 1;
  let prog = null, lastQ = null, time = 0, lapStart = 0, wasPulled = false;
  const out = { laps: [], pulls: 0, driftS: 0, offS: 0 };
  let driftAt = 0;
  while (time < 200 + LAPS * 200) {
    const lap = prog == null ? 1 : Math.max(1, Math.floor(prog / total) + 1);
    L.barrierClamp(car);
    L.solidClamp(car);
    L.applyGround(car, dt);
    const pedals = driver.drive(car, dt, { cars: [], lap, laps: LAPS + 1 });
    step(car, pedals, dt);
    time += dt;
    const query = L.querySubtrack(sub, car.x, car.y);
    if (!Number.isFinite(query.trackDist) || !Number.isFinite(query.dist)) continue;
    if (prog == null) prog = query.trackDist > total / 2 ? query.trackDist - total : query.trackDist;
    else {
      let delta = query.trackDist - lastQ;
      if (delta > total / 2) delta -= total;
      if (delta < -total / 2) delta += total;
      const before = Math.floor(prog / total);
      prog += delta;
      if (Math.floor(prog / total) > before && prog > 0) {
        if (before >= 1) out.laps.push(time - lapStart);
        if (before === 0) driftAt = driver.state.driftT || 0;
        lapStart = time;
      }
    }
    lastQ = query.trackDist;
    const flying = prog != null && prog >= total;
    const pulled = !!pedals.handbrake;
    if (flying && pulled && !wasPulled) out.pulls++;
    wasPulled = pulled;
    if (flying && query.dist > sub.width / 2 + 0.5) out.offS += dt;
    if (prog != null && prog >= total * (LAPS + 1)) break;
  }
  out.driftS = (driver.state.driftT || 0) - driftAt;
  return out;
}

for (const levelId of LEVELS) {
  for (const carId of CARS) {
    let laps = [], pulls = 0, driftS = 0, offS = 0;
    for (const seed of SEEDS) {
      for (const slot of SLOTS) {
        const out = runDriver(levelId, carId, seed, slot);
        laps = laps.concat(out.laps);
        pulls += out.pulls;
        driftS += out.driftS;
        offS += out.offS;
      }
    }
    const count = Math.max(1, laps.length);
    const mean = laps.length ? laps.reduce((sum, lap) => sum + lap, 0) / laps.length : NaN;
    console.log(`${levelId.padEnd(12)} ${carId.padEnd(10)} ${laps.length} flying laps, mean`
      + ` ${mean.toFixed(1)} s | handbrake pulls ${(pulls / count).toFixed(2)} a lap | drift`
      + ` ${(driftS / count).toFixed(1)} s a lap (${(100 * driftS / Math.max(1, mean * count))
        .toFixed(1)} %) | off ${(offS / count).toFixed(1)} s a lap`);
  }
}
