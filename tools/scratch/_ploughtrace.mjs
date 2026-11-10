// _ploughtrace.mjs - WHY AI PLOUGH INTO CARS INSTEAD OF GOING ROUND (owner 11-10: "still alot of
// mad pile ups at the start - ai need to be more willing to drive around stuff ahah they seem to
// want to plough into it always"): a field from the game's grid, released at the green; for every
// hard hit (closing over HARD m/s) the car that ran into the other - its speed and the speed it
// wanted, how long it had the other in its way (ahead within 40 m, overlapping its width), how hard
// it braked and how far it moved across in the 1.5 s before, and the room the road had beside the
// other car each side at the moment it hit.
// [SECONDS=20] [HARD=5] node tools/scratch/_ploughtrace.mjs [level] [car] [diff] [seed] [n]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContact } from '../../src/contact.ts';
import { wakeStep } from '../../src/physics/wake.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';

const [lv = 'spa', carId = 'saloon-rwd', diff = '2', seedArg = '7', nArg = '20'] =
  process.argv.slice(2);
const N = +nArg, SECONDS = +(process.env.SECONDS || 20), HARD = +(process.env.HARD || 5);
let dice = +seedArg * 7919 + 1;
Math.random = () => { dice = (Math.imul(dice, 1664525) + 1013904223) >>> 0; return dice / 4294967296; };
L.setLevel(lv); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist, spawn = L.LEVEL.spawn;
const spawnDist = L.querySubtrack(sub, spawn.x, spawn.y).trackDist;
const lat = Math.max(1.6, Math.min(3.2, sub.width / 2 - 1.8));
// along the lap from the start, and across the road (+ the road's +normal side)
const frame = (x, y) => {
  const q = L.querySubtrack(sub, x, y), p = L.onTrack(sub, q.trackDist, 0, {});
  return { at: ((q.trackDist - spawnDist) % total + total) % total,
    side: (x - p.x) * Math.cos(p.rot + Math.PI / 2) + (y - p.y) * Math.sin(p.rot + Math.PI / 2) };
};
const field = [];
for (let slot = 0; slot < N; slot++) {
  const car = makeCar(carId);
  car.spec = { ...car.spec, id: carId + '#' + (slot + 1) };
  const pos = L.onTrack(sub, ((spawnDist - slot * 7) % total + total) % total, slot % 2 ? lat : -lat,
    {});
  reset(car, pos.x, pos.y, pos.rot);
  const drv = createAIDriver(L.LEVEL, aiTraits(+diff, slot, N, +seedArg));
  car.mods.power *= drv.traits.power ?? 1;
  field.push({ car, drv, slot, hist: [], inWay: new Map() });
}
const hits = [];
let touching = new Set();
for (let tick = 0; tick * DT < SECONDS; tick++) {
  const t = tick * DT;
  for (const f of field) {
    const car = f.car;
    L.barrierClamp(car); L.solidClamp(car); L.applyGround(car, DT);
    const input = f.drv.drive(car, DT, { cars: field.filter((o) => o !== f).map((o) => o.car),
      lap: 1, laps: 3 });
    step(car, input, DT);
    const here = frame(car.x, car.y);
    f.hist.push({ t, brake: input.brake || 0, side: here.side, v: Math.hypot(car.vx, car.vy),
      vT: f.drv.state.vT });
    if (f.hist.length > 240) f.hist.shift();
    // the cars in my way: ahead within 40 m, overlapping my width (my heading's frame)
    const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
    for (const o of field) {
      if (o === f) continue;
      const dx = o.car.x - car.x, dy = o.car.y - car.y, fwd = dx * cos + dy * sin,
        across = -dx * sin + dy * cos;
      if (fwd > 0 && fwd < 40 && Math.abs(across) < car.spec.wid) {
        if (!f.inWay.has(o.slot)) f.inWay.set(o.slot, t);
      } else f.inWay.delete(o.slot);
    }
  }
  wakeStep(field.map((f) => f.car));
  const now = new Set();
  for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
    const A = field[a], B = field[b];
    if (Math.hypot(A.car.x - B.car.x, A.car.y - B.car.y) > 7) continue;
    const before = [A.car.vx, A.car.vy, B.car.vx, B.car.vy];
    carContact(A.car, B.car);
    if (A.car.vx === before[0] && A.car.vy === before[1]) continue;
    const key = a + ':' + b;
    now.add(key);
    const closing = Math.hypot(before[0] - before[2], before[1] - before[3]);
    if (touching.has(key) || closing < HARD) continue;
    // the one that ran in: the one moving toward the other faster
    const toward = (P, Q, vx, vy) => {
      const dx = Q.car.x - P.car.x, dy = Q.car.y - P.car.y, d = Math.hypot(dx, dy) || 1;
      return (vx * dx + vy * dy) / d;
    };
    const aIn = toward(A, B, before[0], before[1]) - toward(A, B, before[2], before[3]) * 0;
    const bIn = toward(B, A, before[2], before[3]);
    const [hitter, hit] = aIn >= bIn ? [A, B] : [B, A];
    const back = hitter.hist.filter((h) => t - h.t <= 1.5), first = back[0], last = back[back.length - 1];
    const otherSide = frame(hit.car.x, hit.car.y).side, half = sub.width / 2;
    hits.push({ t, hitter: hitter.slot, hit: hit.slot, closing, at: frame(hitter.car.x,
      hitter.car.y).at, inWayFor: hitter.inWay.has(hit.slot) ? t - hitter.inWay.get(hit.slot) : 0,
      brake: back.reduce((sum, h) => sum + h.brake, 0) / back.length,
      moved: Math.abs(last.side - first.side), v: last.v, vT: last.vT,
      roomL: half + otherSide - hit.car.spec.wid / 2, roomR: half - otherSide - hit.car.spec.wid / 2 });
  }
  touching = now;
}
const fmt = (n, d = 1) => n.toFixed(d);
console.log(`${lv}, ${N} x ${carId}, diff ${diff}, seed ${seedArg}, ${SECONDS} s: ${hits.length} hits`
  + ` closing over ${HARD} m/s`);
for (const hit of hits) console.log(`  t ${fmt(hit.t)} @${hit.at.toFixed(0)} m: #${hit.hitter} into #${hit.hit}`
  + ` at ${fmt(hit.closing)} m/s | in its way ${fmt(hit.inWayFor)} s, braked ${fmt(hit.brake * 100, 0)}%`
  + ` (1.5 s), moved across ${fmt(hit.moved)} m | ${(hit.v * 3.6).toFixed(0)} km/h wanting`
  + ` ${(hit.vT * 3.6).toFixed(0)} | room beside it ${fmt(hit.roomL)} / ${fmt(hit.roomR)} m`);
const seen = hits.filter((hit) => hit.inWayFor > 0.6);
console.log(`in its way over 0.6 s before: ${seen.length} of ${hits.length}; of those braking under 30%:`
  + ` ${seen.filter((hit) => hit.brake < 0.3).length}, moving across under 1 m:`
  + ` ${seen.filter((hit) => hit.moved < 1).length}, with a car's width of room beside it:`
  + ` ${seen.filter((hit) => Math.max(hit.roomL, hit.roomR) > 2.2).length}`);
