// _startcrash.mjs - AI CRASHING AT THE START (owner 11-08: "cars crash on start too much their
// [line] seems to take them wide close to the pit wall / dirt ... the same on the old track").
// Node, full contact, a 20-car field on the game's grid (game/grid.ts gridPos: 7 m a slot, the
// columns 3.2 m either side of the centreline, back from the spawn), released at once (the green).
// Over the first SECONDS: every barrier hit (its kind, where along the lap, how hard), every hard
// car-to-car hit (closing > 6 m/s), every trip off the road; and the field's spread across the road
// by 50 m of lap - where the cars are against where the barriers are.
// [CASTLECUMVENUE=1] [SECONDS=20] node tools/scratch/_startcrash.mjs [level] [car] [diff] [seed] [n]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContact } from '../../src/contact.ts';
import { wakeStep } from '../../src/physics/wake.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';

const [lv = 'castle-cum', carId = 'hatch-rwd', diff = '2', seedArg = '7', nArg = '20'] =
  process.argv.slice(2);
const N = +nArg, SECONDS = +(process.env.SECONDS || 20), DT = PHYSICS_STEP_SECONDS;
// the dice of the race (spins, punctures) the same per seed
let dice = +seedArg * 7919 + 1;
Math.random = () => { dice = (Math.imul(dice, 1664525) + 1013904223) >>> 0; return dice / 4294967296; };
L.setLevel(lv); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist, spawn = L.LEVEL.spawn;
const spawnDist = L.querySubtrack(sub, spawn.x, spawn.y).trackDist;
const lat = Math.max(1.6, Math.min(3.2, sub.width / 2 - 1.8));
const field = [];
for (let slot = 0; slot < N; slot++) {
  const car = makeCar(carId);
  car.spec = { ...car.spec, id: carId + '#' + (slot + 1) };
  const p = L.onTrack(sub, ((spawnDist - slot * 7) % total + total) % total, slot % 2 ? lat : -lat, {});
  reset(car, p.x, p.y, p.rot);
  const drv = createAIDriver(L.LEVEL, aiTraits(+diff, slot, N, +seedArg));
  car.mods.power *= drv.traits.power ?? 1;
  field.push({ car, drv, slot });
}
// along the lap from the start line (wraps), and the signed offset across the road (+ = the
// road's +normal side)
const along = (x, y) => {
  const q = L.querySubtrack(sub, x, y);
  return ((q.trackDist - spawnDist) % total + total) % total;
};
const across = (x, y) => {
  const q = L.querySubtrack(sub, x, y), p = L.onTrack(sub, q.trackDist, 0, {});
  return (x - p.x) * Math.cos(p.rot + Math.PI / 2) + (y - p.y) * Math.sin(p.rot + Math.PI / 2);
};
// the barrier nearest a point, and which side of the road it is on
const nearestBarrier = (x, y) => {
  let best = { kind: '-', dist: Infinity };
  for (const barrier of L.LEVEL.barriers || []) for (let i = 0; i < barrier.pts.length - 1; i++) {
    const [ax, ay] = barrier.pts[i], [bx, by] = barrier.pts[i + 1], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const dist = Math.hypot(x - ax - dx * t, y - ay - dy * t);
    if (dist < best.dist) best = { kind: barrier.kind, dist };
  }
  return best;
};
const wallHits = [], carHits = [], offs = [], spread = new Map();
let touching = new Set();
for (let tick = 0; tick * DT < SECONDS; tick++) {
  const t = tick * DT;
  for (const f of field) {
    const car = f.car, vx0 = car.vx, vy0 = car.vy;
    L.barrierClamp(car); L.solidClamp(car);
    const dv = Math.hypot(car.vx - vx0, car.vy - vy0);
    if (dv > 1 && t - (f.wallT ?? -9) > 0.5) {
      f.wallT = t;
      const near = nearestBarrier(car.x, car.y);
      wallHits.push({ t, slot: f.slot, dv, kind: near.kind, at: along(car.x, car.y),
        side: across(car.x, car.y) });
    }
    L.applyGround(car, DT);
    const others = field.filter((o) => o !== f).map((o) => o.car);
    step(car, f.drv.drive(car, DT, { cars: others, lap: 1, laps: 3 }), DT);
    const q = L.querySubtrack(sub, car.x, car.y), off = q.dist > sub.width / 2 + 0.5;
    if (off && !f.off) offs.push({ t, slot: f.slot, at: along(car.x, car.y),
      side: across(car.x, car.y), v: Math.hypot(car.vx, car.vy) });
    f.off = off;
    const bin = Math.floor(along(car.x, car.y) / 50) * 50;
    if (bin < 800 && t < SECONDS) {
      const row = spread.get(bin) || { min: Infinity, max: -Infinity, n: 0 };
      const side = across(car.x, car.y);
      row.min = Math.min(row.min, side); row.max = Math.max(row.max, side); row.n++;
      spread.set(bin, row);
    }
  }
  wakeStep(field.map((f) => f.car));
  const now = new Set();
  for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
    const A = field[a].car, B = field[b].car;
    if (Math.hypot(A.x - B.x, A.y - B.y) > 7) continue;
    const before = [A.vx, A.vy, B.vx, B.vy];
    carContact(A, B);
    if (A.vx !== before[0] || A.vy !== before[1]) {
      const key = a + ':' + b;
      now.add(key);
      const closing = Math.hypot(before[0] - before[2], before[1] - before[3]);
      if (!touching.has(key) && closing > 6) carHits.push({ t, a: field[a].slot, b: field[b].slot,
        closing, at: along(A.x, A.y), side: across(A.x, A.y) });
    }
  }
  touching = now;
}
const fmt = (n) => n.toFixed(1);
console.log(`${lv}${process.env.CASTLECUMVENUE ? ' (venue)' : ''}, ${N} x ${carId}, diff ${diff},`
  + ` seed ${seedArg}, ${SECONDS} s: road ${sub.width} m wide, lap ${total.toFixed(0)} m`);
console.log(`barrier hits ${wallHits.length}, hard car hits ${carHits.length}, off the road`
  + ` ${offs.length}`);
const byKind = {};
for (const hit of wallHits) byKind[hit.kind] = (byKind[hit.kind] || 0) + 1;
console.log('  barrier hits by kind:', JSON.stringify(byKind));
for (const hit of wallHits.slice(0, 25)) console.log(`  WALL t ${fmt(hit.t)} slot ${hit.slot}`
  + ` ${hit.kind} at ${hit.at.toFixed(0)} m, side ${fmt(hit.side)} m, dv ${fmt(hit.dv)}`);
for (const hit of carHits.slice(0, 15)) console.log(`  CARS t ${fmt(hit.t)} slots ${hit.a}+${hit.b}`
  + ` at ${hit.at.toFixed(0)} m, side ${fmt(hit.side)}, closing ${fmt(hit.closing)} m/s`);
for (const off of offs.slice(0, 20)) console.log(`  OFF t ${fmt(off.t)} slot ${off.slot} at`
  + ` ${off.at.toFixed(0)} m, side ${fmt(off.side)} m, ${fmt(off.v)} m/s`);
console.log('  the field across the road (m from the centreline) by 50 m of lap:');
for (const [bin, row] of [...spread].sort((a, b) => a[0] - b[0])) {
  const left = nearestSide(bin, -1), right = nearestSide(bin, 1);
  console.log(`   ${String(bin).padStart(4)} m: ${fmt(row.min)} .. ${fmt(row.max)}  (barriers`
    + ` ${left} | ${right})`);
}

/**
 * The nearest barrier on one side of the road at a distance along the lap from the start.
 * @param from metres along the lap from the start line
 * @param sign -1 or 1, the side
 * @returns "kind at m"
 */
function nearestSide(from, sign) {
  const dist = (spawnDist + from + 25) % total;
  for (let off = sub.width / 2; off < 40; off += 0.5) {
    const p = L.onTrack(sub, dist, sign * off, {}), near = nearestBarrier(p.x, p.y);
    if (near.dist < 0.6) return `${near.kind} ${(sign * off).toFixed(1)}`;
  }
  return '-';
}
