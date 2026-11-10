// _startflow.mjs - DOES THE RACE FLOW THROUGH THE FIRST CORNER (owner 11-10: "Hits is ok if the race
// flows", "crashes are ok jsut no blocking the track every race", "First corner is always a hot
// spot for crashes but it shouldn't be a grid lock", "the dodging is the thing to improve"): a
// field from the game's grid, released at the green, for SECONDS; per start: when the LAST car got
// CLEAR m along the lap (the field through the first corner), the car-seconds spent nearly stopped
// (under 10 km/h, after the first 4 s), and the car-seconds STUCK BEHIND a slow car with room to go
// round it (under 25 km/h, a car within 10 m ahead in its way, the road 3 m clear beside that car
// on one side) - not dodging. Over SEEDS, summed.
// [SECONDS=40] [CLEAR=300] node tools/scratch/_startflow.mjs [level] [car] [diff] [seeds] [n]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContact } from '../../src/contact.ts';
import { wakeStep } from '../../src/physics/wake.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';

const [lv = 'spa', carId = 'saloon-rwd', diff = '2', seedsArg = '7,8,9,10,11,12', nArg = '20'] =
  process.argv.slice(2);
const N = +nArg, SECONDS = +(process.env.SECONDS || 40), CLEAR = +(process.env.CLEAR || 300);

/**
 * One start: when the field cleared, the stopped and stuck car-seconds.
 * @param seed the race's dice
 * @returns the start's numbers
 */
function start(seed) {
  let dice = seed * 7919 + 1;
  Math.random = () => { dice = (Math.imul(dice, 1664525) + 1013904223) >>> 0; return dice / 4294967296; };
  L.setLevel(lv); L.clearWear();
  const sub = L.LEVEL.subtrack, total = sub.totalDist, spawn = L.LEVEL.spawn, half = sub.width / 2;
  const spawnDist = L.querySubtrack(sub, spawn.x, spawn.y).trackDist;
  const lat = Math.max(1.6, Math.min(3.2, half - 1.8));
  const frame = (x, y) => {
    const q = L.querySubtrack(sub, x, y), p = L.onTrack(sub, q.trackDist, 0, {});
    return { at: ((q.trackDist - spawnDist) % total + total) % total, side: (x - p.x)
      * Math.cos(p.rot + Math.PI / 2) + (y - p.y) * Math.sin(p.rot + Math.PI / 2) };
  };
  const field = [];
  for (let slot = 0; slot < N; slot++) {
    const car = makeCar(carId);
    car.spec = { ...car.spec, id: carId + '#' + (slot + 1) };
    const pos = L.onTrack(sub, ((spawnDist - slot * 7) % total + total) % total,
      slot % 2 ? lat : -lat, {});
    reset(car, pos.x, pos.y, pos.rot);
    const drv = createAIDriver(L.LEVEL, aiTraits(+diff, slot, N, seed));
    car.mods.power *= drv.traits.power ?? 1;
    // (the grid is behind the start line: "along" starts near the lap's end - counted as negative)
    field.push({ car, drv, slot, clearT: null, best: -Infinity });
  }
  let stopped = 0, stuck = 0, hits = 0, touching = new Set();
  for (let tick = 0; tick * DT < SECONDS; tick++) {
    const t = tick * DT;
    for (const f of field) {
      const car = f.car;
      L.barrierClamp(car); L.solidClamp(car); L.applyGround(car, DT);
      step(car, f.drv.drive(car, DT, { cars: field.filter((o) => o !== f).map((o) => o.car),
        lap: 1, laps: 3 }), DT);
      const here = frame(car.x, car.y), at = here.at > total / 2 ? here.at - total : here.at;
      f.best = Math.max(f.best, at);
      if (f.clearT === null && f.best >= CLEAR) f.clearT = t;
      const v = Math.hypot(car.vx, car.vy);
      if (t > 4 && f.clearT === null && v < 10 / 3.6) stopped += DT;
      if (t > 4 && f.clearT === null && v < 25 / 3.6) {
        const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
        const ahead = field.find((o) => {
          if (o === f) return false;
          const dx = o.car.x - car.x, dy = o.car.y - car.y, fwd = dx * cos + dy * sin;
          return fwd > 0 && fwd < 10 && Math.abs(-dx * sin + dy * cos) < car.spec.wid;
        });
        if (ahead) {
          const side = frame(ahead.car.x, ahead.car.y).side, w = ahead.car.spec.wid / 2;
          // the road clear beside it: no other car within its length there
          const clearAt = (lane) => Math.abs(lane) < half - 1 && !field.some((o) => o !== f
            && o !== ahead && Math.hypot(o.car.x - ahead.car.x, o.car.y - ahead.car.y) < 8
            && Math.abs(frame(o.car.x, o.car.y).side - lane) < 2);
          if (clearAt(side + w + 2.2) || clearAt(side - w - 2.2)) stuck += DT;
        }
      }
    }
    wakeStep(field.map((f) => f.car));
    const now = new Set();
    for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
      const A = field[a].car, B = field[b].car;
      if (Math.hypot(A.x - B.x, A.y - B.y) > 7) continue;
      const before = [A.vx, A.vy, B.vx, B.vy];
      carContact(A, B);
      if (A.vx === before[0] && A.vy === before[1]) continue;
      now.add(a + ':' + b);
      if (!touching.has(a + ':' + b) && Math.hypot(before[0] - before[2], before[1] - before[3]) > 6)
        hits++;
    }
    touching = now;
  }
  const notClear = field.filter((f) => f.clearT === null).length;
  return { cleared: notClear ? null : Math.max(...field.map((f) => f.clearT)), notClear, stopped,
    stuck, hits };
}
const seeds = seedsArg.split(',').map(Number), sum = { stopped: 0, stuck: 0, hits: 0, notClear: 0 };
const clears = [];
for (const seed of seeds) {
  const res = start(seed);
  sum.stopped += res.stopped; sum.stuck += res.stuck; sum.hits += res.hits;
  sum.notClear += res.notClear;
  if (res.cleared !== null) clears.push(res.cleared);
  console.log(`  ${lv} seed ${seed}: field clear of ${CLEAR} m at ${res.cleared === null ? 'NEVER ('
    + res.notClear + ' short)' : res.cleared.toFixed(1) + ' s'} | stopped ${res.stopped.toFixed(1)}`
    + ` car-s, stuck behind with room ${res.stuck.toFixed(1)} car-s | hard hits ${res.hits}`);
}
clears.sort((a, b) => a - b);
console.log(`${lv} x${N}, ${seeds.length} starts: field clear median ${clears.length
  ? clears[Math.floor(clears.length / 2)].toFixed(1) + ' s' : '-'} (worst ${clears.length
  ? clears[clears.length - 1].toFixed(1) : '-'}, never ${sum.notClear} cars) | stopped`
  + ` ${sum.stopped.toFixed(0)} car-s, stuck with room ${sum.stuck.toFixed(0)} car-s | hard hits ${sum.hits}`);
