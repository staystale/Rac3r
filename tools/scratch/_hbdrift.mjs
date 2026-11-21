// _hbdrift.mjs - THE AI's HANDBRAKE AND DRIFTING TODAY (the owner's 11-21 item 11, read only): one AI
// car alone, headless, the game's own steps and driver, LAPS laps; per level and car, over SEEDS
// (each seed two drivers of the field's spread: aiTraits slots 0 and 3 of 6, realish) - handbrake
// PULLS a lap (a pull: the driver's handbrake going on), the s a lap it held a DRIFT (the drift hold
// or a slippery-ground slide held: state.driftT), the lap time and the s a lap off the road. Nothing
// in the game is changed (laps by the game's own race order, game/order.ts progressOf; a car stuck
// 3 s is put back as the game puts an AI back, and counted). LEVELS=sweaty-lamb,croughedrx,knobhill,thruston,moanaco
// CARS=hatch-fwd,hatch-rwd,rally-4x4,track-rwd SEEDS=1,2,3,4 LAPS=3 node tools/scratch/_hbdrift.mjs
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as dt } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';
import { progressOf } from '../../src/game/order.ts';
import { stuckWatchFires } from '../../src/game/aistuck.ts';
import { aiReset } from '../../src/game/ai.ts';
import { game } from '../../src/game/state.ts';

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
  let prog = null, time = 0, lapStart = 0, wasPulled = false;
  const out = { laps: [], pulls: 0, driftS: 0, offS: 0, resets: 0, stuckAt: [] };
  const entry = { car, drv: driver };
  // (the game's watch reads the other cars: none here - your car parked far off the map)
  const parked = makeCar('hatch-fwd');
  reset(parked, 1e5, 1e5, 0);
  game.car = parked;
  game.ai = [];
  game.traffic = { cars: [], ourSide: [] };
  let driftAt = 0;
  while (time < 200 + LAPS * 200) {
    const lap = prog == null ? 1 : Math.max(1, Math.floor(prog / total) + 1);
    L.barrierClamp(car);
    L.solidClamp(car);
    L.applyGround(car, dt);
    const pedals = driver.drive(car, dt, { cars: [], lap, laps: LAPS + 1 });
    step(car, pedals, dt);
    time += dt;
    // (stuck, or no progress: the game's own watch and put-back for an AI - game/aistuck.ts,
    // game/ai.ts aiReset)
    if (stuckWatchFires(entry, false, dt)) {
      out.stuckAt.push(Math.round(L.querySubtrack(sub, car.x, car.y).trackDist));
      aiReset(entry, true);
      out.resets++;
    }
    // (the lap by the game's own race order - game/order.ts progressOf: it holds the progress
    // on a bridge or in a tunnel, where the nearest centreline point is the road above or below)
    const query = L.querySubtrack(sub, car.x, car.y);
    const now = progressOf(car);
    if (now === undefined) continue;
    const before = prog == null ? null : Math.floor(prog / total);
    prog = now;
    if (before != null && Math.floor(prog / total) > before && prog > 0) {
      if (before >= 1) out.laps.push(time - lapStart);
      if (before === 0) driftAt = driver.state.driftT || 0;
      lapStart = time;
    }
    const flying = prog != null && prog >= total;
    const pulled = !!pedals.handbrake;
    if (flying && pulled && !wasPulled) out.pulls++;
    wasPulled = pulled;
    if (flying && Number.isFinite(query.dist) && query.dist > sub.width / 2 + 0.5) out.offS += dt;
    if (prog != null && prog >= total * (LAPS + 1)) break;
  }
  out.driftS = (driver.state.driftT || 0) - driftAt;
  return out;
}

for (const levelId of LEVELS) {
  for (const carId of CARS) {
    let laps = [], pulls = 0, driftS = 0, offS = 0, resets = 0;
    const stuckAt = [];
    for (const seed of SEEDS) {
      for (const slot of SLOTS) {
        const out = runDriver(levelId, carId, seed, slot);
        laps = laps.concat(out.laps);
        pulls += out.pulls;
        driftS += out.driftS;
        offS += out.offS;
        resets += out.resets;
        stuckAt.push(...out.stuckAt);
      }
    }
    const count = Math.max(1, laps.length);
    const mean = laps.length ? laps.reduce((sum, lap) => sum + lap, 0) / laps.length : NaN;
    console.log(`${levelId.padEnd(12)} ${carId.padEnd(10)} ${laps.length} flying laps, mean`
      + ` ${mean.toFixed(1)} s | handbrake pulls ${(pulls / count).toFixed(2)} a lap | drift`
      + ` ${(driftS / count).toFixed(1)} s a lap (${(100 * driftS / Math.max(1, mean * count))
        .toFixed(1)} %) | off ${(offS / count).toFixed(1)} s a lap | stuck put-backs ${resets}`
      + `${stuckAt.length ? ' at lap m ' + [...new Set(stuckAt.map((at) => Math.round(at / 10) * 10))]
        .slice(0, 6).join(', ') : ''}`);
  }
}
