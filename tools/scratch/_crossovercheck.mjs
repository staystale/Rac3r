// _crossovercheck.mjs - A ROAD THAT CROSSES ITSELF (Snoozuka's crossover, world/trackunder.ts):
// does every car stay on its own level? Node, the game's own steps (world/crossings.ts clampWorld,
// contact.ts carContacts by level, game/order.ts progressOf), an AI field started spread round the
// lap so cars pass under and over the crossover together, for SECONDS:
//  - each car's race progress per step (a jump onto the other road shows as hundreds of m),
//  - each pass under (in the track's underpass) and over (on the ground over it), and any car
//    found on the wrong level there (in the underpass on the road over it, or the reverse),
//  - the AI's place on its line (state.i) - a jump to the other road is a jump in index,
//  - barrier hits within 40 m of the crossover;
// then the resets and the AI's re-place by the crossover (world/trackunder.ts trackSpotOf, the
// driver's relocate) for a car in the underpass and one on the road over it.
// SUZUKA=1 [SECONDS=120] node tools/scratch/_crossovercheck.mjs [level] [n] [car]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContacts } from '../../src/contact.ts';
import { clampWorld } from '../../src/world/crossings.ts';
import { crossingOf } from '../../src/world/crossinggeo.ts';
import { progressOf } from '../../src/game/order.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';
import { trackSpotOf, inTrackUnderpass } from '../../src/world/trackunder.ts';

const [lv = 'suzuka', nArg = '12', carId = 'hatch-rwd'] = process.argv.slice(2);
const N = +nArg, SECONDS = +(process.env.SECONDS || 120), DT = PHYSICS_STEP_SECONDS;
let dice = 12345;
Math.random = () => { dice = (Math.imul(dice, 1664525) + 1013904223) >>> 0; return dice / 4294967296; };
L.setLevel(lv); L.clearWear();
const level = L.LEVEL, sub = level.subtrack, total = sub.totalDist;
const span = sub.under && sub.under[0];
if (!span) throw new Error(`${lv}: no crossover`);
const P = L.onTrack(sub, (span.d0 + span.d1) / 2, 0, {});
console.log(`${lv}: lap ${total.toFixed(0)} m; underpass ${span.d0.toFixed(0)}-${span.d1.toFixed(0)} m`
  + ` along, the road over it at ${span.over.toFixed(0)} m; the crossover at ${P.x.toFixed(0)},`
  + `${P.y.toFixed(0)}`);
const field = [];
for (let k = 0; k < N; k++) {
  const car = makeCar(carId);
  car.spec = { ...car.spec, id: `${carId}#${k + 1}` };
  // spread round the lap, a few just before each leg of the crossover
  const at = (k % 2 ? span.d0 - 60 - 25 * (k >> 1) : span.over - 60 - 25 * (k >> 1) + total) % total;
  const p = L.onTrack(sub, at, 0, {});
  reset(car, p.x, p.y, p.rot);
  const drv = createAIDriver(level, aiTraits(2, k, N, 7));
  field.push({ car, drv, k, prog: [], under: 0, over: 0, wrong: 0, idxJump: 0, lastI: null,
    jump: 0, wall: 0, wasUnder: false, wasOver: false, loadUnder: 9, loadOver: 9, airUnder: 0, airOver: 0 });
}
const nearCross = (car) => Math.hypot(car.x - P.x, car.y - P.y) < 40;
for (let tick = 0; tick * DT < SECONDS; tick++) {
  for (const f of field) {
    const car = f.car, vx0 = car.vx, vy0 = car.vy;
    clampWorld(car, DT);
    if (Math.hypot(car.vx - vx0, car.vy - vy0) > 1 && nearCross(car)) f.wall++;
    L.applyGround(car, DT);
    const others = field.filter((o) => o !== f).map((o) => o.car);
    step(car, f.drv.drive(car, DT, { cars: others, lap: 1, laps: 99 }), DT);
    const before = car._prog;
    progressOf(car);
    if (before !== undefined && car._prog !== undefined) {
      const moved = Math.abs(car._prog - before), fair = Math.hypot(car.vx, car.vy) * DT + 5;
      if (moved > fair) f.jump = Math.max(f.jump, moved);
    }
    const i = f.drv.state.i, n = f.drv.state.path.n;
    if (f.lastI !== null && i !== null) {
      const di = Math.min(Math.abs(i - f.lastI), n - Math.abs(i - f.lastI));
      f.idxJump = Math.max(f.idxJump, di);
    }
    f.lastI = i;
    // its level by the crossover: under (in the track's underpass) or over (on the ground there)
    const under = inTrackUnderpass(car), close = Math.hypot(car.x - P.x, car.y - P.y) < 6;
    if (under && !f.wasUnder) f.under++;
    f.wasUnder = under;
    const over = close && !crossingOf(car);
    // how light it goes through the underpass's dip and over the bridge (the crest rule)
    if (under) { f.loadUnder = Math.min(f.loadUnder, car.loadK); if (car.air > 0) f.airUnder += DT; }
    if (Math.hypot(car.x - P.x, car.y - P.y) < 25 && !crossingOf(car)) {
      f.loadOver = Math.min(f.loadOver, car.loadK); if (car.air > 0) f.airOver += DT; }
    if (over && !f.wasOver) f.over++;
    f.wasOver = over;
    // the wrong level: on the ground at the crossover but heading along the road below, or in the
    // underpass heading along the road over it
    if (close) {
      const q = L.onGroundQuery(() => L.querySubtrack(sub, car.x, car.y));
      const lowerHere = Math.abs(q.trackDist - (span.d0 + span.d1) / 2) < 20;
      if (!under && lowerHere) f.wrong++;
    }
  }
  carContacts(field.map((f) => f.car));
}
let bad = 0;
for (const f of field) {
  const flag = f.jump > 0 || f.wrong > 0 || f.idxJump > 40;
  if (flag) bad++;
  console.log(`car ${String(f.k + 1).padStart(2)}: under ${f.under}x, over ${f.over}x, wrong level ${
    f.wrong}, progress jump ${f.jump.toFixed(1)} m, line index jump ${f.idxJump}, wall hits by the`
    + ` crossover ${f.wall}, lowest load under ${f.loadUnder.toFixed(2)} / over ${f.loadOver.toFixed(2)}, air ${(f.airUnder + f.airOver).toFixed(2)} s, laps ${((f.car._prog || 0) / total).toFixed(2)}${flag ? '  <-- BAD' : ''}`);
}
const unders = field.reduce((s, f) => s + f.under, 0), overs = field.reduce((s, f) => s + f.over, 0);
console.log(`passes: ${unders} under, ${overs} over; ${bad} cars with a problem`);
// the lookups on the bridge: every point of the road over the cut, the plain lookup against the
// ground's (the plain one may take the road below)
let plainBelow = 0, groundBelow = 0, points = 0;
for (let along = -12; along <= 12; along += 1) for (let off = -6; off <= 6; off += 1) {
  const p = L.onTrack(sub, span.over + along, off, {});
  const below = (q) => Math.abs(q.trackDist - (span.d0 + span.d1) / 2) < 30;
  points++;
  if (below(L.querySubtrack(sub, p.x, p.y))) plainBelow++;
  if (below(L.onGroundQuery(() => L.querySubtrack(sub, p.x, p.y)))) groundBelow++;
}
console.log(`on the bridge: the plain lookup took the road below for ${plainBelow} of ${points} points,`
  + ` the ground lookup for ${groundBelow}`);
// resets and the AI's re-place, a car in the underpass and one on the road over it
const probe = field[0];
const way = level.crossings.findIndex((c) => c.track);
const lowerMid = L.onTrack(sub, (span.d0 + span.d1) / 2, 0, {});
probe.car.crossing = way;
reset(probe.car, lowerMid.x, lowerMid.y, lowerMid.rot);
probe.car.crossing = way;
const spotUnder = trackSpotOf(sub, probe.car.x, probe.car.y, probe.car);
probe.car.crossing = -1;
const upperMid = L.onTrack(sub, span.over, 0, {});
reset(probe.car, upperMid.x, upperMid.y, upperMid.rot);
probe.car.crossing = -1;
const spotOver = trackSpotOf(sub, probe.car.x, probe.car.y, probe.car);
const raw = L.findNearestSubtrackPoint(sub, upperMid.x, upperMid.y);
probe.drv.relocate();
probe.drv.drive(probe.car, DT, { cars: [], lap: 1, laps: 99 });
const linePoint = probe.drv.state.path.pts[probe.drv.state.i];
console.log(`reset in the underpass -> ${spotUnder.dist.toFixed(0)} m along (the underpass starts at `
  + `${span.d0.toFixed(0)}): ${spotUnder.dist < span.d0 && spotUnder.dist > span.d0 - 20 ? 'OK' : 'BAD'}`);
console.log(`reset over the crossover -> ${spotOver.dist.toFixed(0)} m along (the road over it at `
  + `${span.over.toFixed(0)}; the plain nearest point: ${raw.dist.toFixed(0)}): ${
    Math.abs(spotOver.dist - span.over) < 10 ? 'OK' : 'BAD'}`);
console.log(`the AI re-placed over the crossover -> its line at ${linePoint.dist.toFixed(0)} m along: ${
  Math.abs(linePoint.dist - span.over) < 15 ? 'OK' : 'BAD'}`);
