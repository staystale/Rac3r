// _groundlookup.mjs - does ?groundlookup=1 (fewer ground lookups under the wheels, wear.ts) drive the
// same? Per level the racing AI (difficulty 4) laps twice with the old lookups and twice with the
// new, same seed; prints the 2nd lap time, how far the racing lines differ (signed offset from the
// centreline per 5 m) and the ms spent in applyGround. node tools/scratch/_groundlookup.mjs [level ...]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.js';
import { setGroundLookup } from '../../src/world/wear.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';

const LEVELS = process.argv.length > 2 ? process.argv.slice(2)
  : ['test-track', 'brands-snatch', 'knobhill', 'slidden-hill', 'sweaty-lamb', 'castle-cum', 'thruston'];
const BIN = 5;

/** A seeded Math.random, so both runs see the same random numbers. */
function seedRandom(seed) {
  let state = seed >>> 0;
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function run(level, fewer) {
  setGroundLookup(fewer);
  seedRandom(1234);
  L.setLevel(level); L.clearWear();
  const sub = L.LEVEL.subtrack;
  const car = makeCar('hatch-rwd');
  const start = L.onTrack(sub, sub.totalDist - 30, 0, {});
  reset(car, start.x, start.y, start.rot);
  const driver = createAIDriver(L.LEVEL, aiTraits(4, 0, 1));
  let time = 0, prev = null, laps = 0, lapStart = 0, lapTime = 0, groundMs = 0;
  const offsets = new Map();
  while (time < 400 && laps < 3) {
    const t0 = performance.now();
    L.applyGround(car, PHYSICS_STEP_SECONDS);
    groundMs += performance.now() - t0;
    step(car, driver.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS);
    time += PHYSICS_STEP_SECONDS;
    const hit = L.querySubtrack(sub, car.x, car.y);
    if (prev !== null && prev > sub.totalDist - 60 && hit.trackDist < 60) {
      laps++;
      if (laps === 2) lapTime = time - lapStart;
      lapStart = time;
    }
    if (laps === 1 && isFinite(hit.dist)) {
      offsets.set(Math.floor(hit.trackDist / BIN), (hit.side === 'left' ? 1 : -1) * hit.dist);
    }
    prev = hit.trackDist;
  }
  return { lapTime, offsets, groundMs, steps: Math.round(time / PHYSICS_STEP_SECONDS) };
}

console.log('level            lap old  lap new   diff   line diff max / mean (m)   ground ms old -> new');
for (const level of LEVELS) {
  const old = run(level, false), fewer = run(level, true);
  let max = 0, sum = 0, count = 0;
  for (const [bin, off] of old.offsets) {
    if (!fewer.offsets.has(bin)) continue;
    const diff = Math.abs(off - fewer.offsets.get(bin));
    max = Math.max(max, diff); sum += diff; count++;
  }
  console.log(level.padEnd(16), old.lapTime.toFixed(2).padStart(7), fewer.lapTime.toFixed(2).padStart(8),
    (fewer.lapTime - old.lapTime).toFixed(2).padStart(6), (max.toFixed(2) + ' / ' + (sum / (count || 1)).toFixed(2)).padStart(18),
    '        ', (old.groundMs / old.steps * 1000).toFixed(0) + ' -> ' + (fewer.groundMs / fewer.steps * 1000).toFixed(0) + ' us/step');
}
setGroundLookup(false);
