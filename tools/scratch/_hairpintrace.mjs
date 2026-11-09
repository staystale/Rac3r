// _hairpintrace.mjs - WHY A BIG FIELD GOES OFF AT THE FIRST CORNER (owner 11-09, Spa: "lots of
// crashes with big grids", "I think it's the hair pin first corner"): a FIELD of AI from the game's
// grid, released at the green, and a LONE car the same; every car's way into the first big bend
// after the start - its place against its own racing line (+ inside the bend, - outside), its
// speed against the speed it wants (state.vT) and against the lone car's at the same place - and,
// for each one that goes off the road there, what it was doing: off the line which way, too fast,
// and whether another car touched it in the 0.7 s before.
// [SECONDS=20] [FROM=40] [TO=220] node tools/scratch/_hairpintrace.mjs [level] [car] [diff] [seed] [n]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContact } from '../../src/contact.ts';
import { wakeStep } from '../../src/physics/wake.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';

const [lv = 'spa', carId = 'saloon-rwd', diff = '2', seedArg = '7', nArg = '20'] =
  process.argv.slice(2);
const SECONDS = +(process.env.SECONDS || 20), DT = PHYSICS_STEP_SECONDS;
const FROM = +(process.env.FROM || 40), TO = +(process.env.TO || 220);

/**
 * One start: N cars from the grid for SECONDS; per car its samples (along, inside m, speed, vT),
 * its first trip off the road in [FROM, TO] and the contacts it had.
 * @param count the cars
 * @returns the field
 */
function run(count) {
  let dice = +seedArg * 7919 + 1;
  Math.random = () => { dice = (Math.imul(dice, 1664525) + 1013904223) >>> 0; return dice / 4294967296; };
  L.setLevel(lv); L.clearWear();
  const sub = L.LEVEL.subtrack, total = sub.totalDist, spawn = L.LEVEL.spawn;
  const spawnDist = L.querySubtrack(sub, spawn.x, spawn.y).trackDist;
  const lat = Math.max(1.6, Math.min(3.2, sub.width / 2 - 1.8));
  const along = (x, y) => ((L.querySubtrack(sub, x, y).trackDist - spawnDist) % total + total)
    % total;
  const field = [];
  for (let slot = 0; slot < count; slot++) {
    const car = makeCar(carId);
    car.spec = { ...car.spec, id: carId + '#' + (slot + 1) };
    const pos = L.onTrack(sub, ((spawnDist - slot * 7) % total + total) % total,
      slot % 2 ? lat : -lat, {});
    reset(car, pos.x, pos.y, pos.rot);
    const drv = createAIDriver(L.LEVEL, aiTraits(+diff, slot, count, +seedArg));
    car.mods.power *= drv.traits.power ?? 1;
    field.push({ car, drv, slot, samples: [], off: null, touched: [] });
  }
  const line = L.LEVEL._line, pts = line.pts;
  // the line point nearest a car (searched near its last one)
  const nearest = (f) => {
    let best = f.li ?? 0, bestD = Infinity;
    const from = f.li == null ? 0 : f.li - 15, to = f.li == null ? pts.length : f.li + 40;
    for (let k = from; k < to; k++) {
      const p = pts[(k % pts.length + pts.length) % pts.length];
      const dist = (p.x - f.car.x) ** 2 + (p.y - f.car.y) ** 2;
      if (dist < bestD) { bestD = dist; best = (k % pts.length + pts.length) % pts.length; }
    }
    f.li = best;
    return pts[best];
  };
  for (let tick = 0; tick * DT < SECONDS; tick++) {
    const t = tick * DT;
    for (const f of field) {
      const car = f.car;
      L.barrierClamp(car);
      L.solidClamp(car);
      L.applyGround(car, DT);
      const others = field.filter((o) => o !== f).map((o) => o.car);
      step(car, f.drv.drive(car, DT, { cars: others, lap: 1, laps: 3 }), DT);
      const at = along(car.x, car.y), p = nearest(f);
      // the car's place against the line, + toward the line point's +normal
      const fromLine = (car.x - p.x) * p.nx + (car.y - p.y) * p.ny;
      if (at >= FROM && at <= TO) f.samples.push({ t, at, fromLine, turn: p.turn, R: p.R,
        v: Math.hypot(car.vx, car.vy), vT: f.drv.state.vT });
      const q = L.querySubtrack(sub, car.x, car.y), off = q.dist > sub.width / 2 + 0.5;
      if (off && !f.off && at >= FROM && at <= TO) f.off = { t, at, v: Math.hypot(car.vx, car.vy),
        fromLine, turn: p.turn, touchedBy: f.touched.filter((hit) => t - hit.t < 0.7)
          .map((hit) => hit.by) };
    }
    wakeStep(field.map((f) => f.car));
    for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) {
      const A = field[a].car, B = field[b].car;
      if (Math.hypot(A.x - B.x, A.y - B.y) > 7) continue;
      const before = [A.vx, A.vy];
      carContact(A, B);
      if (A.vx !== before[0] || A.vy !== before[1]) {
        field[a].touched.push({ t, by: b });
        field[b].touched.push({ t, by: a });
      }
    }
  }
  return field;
}
const lone = run(1)[0], field = run(+nArg);
// the lone car's speed by 5 m of the way in
const loneV = new Map();
for (const s of lone.samples) loneV.set(Math.round(s.at / 5) * 5, s.v);
// the first big bend: where the line turns hardest in [FROM, TO] (its sign: which way it turns)
const bend = lone.samples.reduce((best, s) => (s.R < best.R ? s : best), lone.samples[0]);
const turn = Math.sign(bend.turn) || 1;
console.log(`${lv}, ${nArg} x ${carId}, diff ${diff}, seed ${seedArg}: the first big bend at`
  + ` ${bend.at.toFixed(0)} m (R ${bend.R.toFixed(0)} m); the lone car: off ${lone.off ? 'YES' : 'no'},`
  + ` ${(bend.v * 3.6).toFixed(0)} km/h there`);
const inside = (s) => s.fromLine * turn;
const at = (f, where) => f.samples.find((s) => s.at >= where) || f.samples[f.samples.length - 1];
let rows = [], tally = { off: 0, touched: 0, outside: 0, inside: 0, fast: 0 };
for (const f of field) {
  const turnIn = at(f, bend.at - 25), apex = at(f, bend.at);
  if (!turnIn) continue;
  const lv0 = loneV.get(Math.round(turnIn.at / 5) * 5) || turnIn.v;
  const row = `  #${String(f.slot).padStart(2)}: 25 m before, ${inside(turnIn) >= 0 ? '+' : ''}`
    + `${inside(turnIn).toFixed(1)} m off its line, ${(turnIn.v * 3.6).toFixed(0)} km/h (wants`
    + ` ${(turnIn.vT * 3.6).toFixed(0)}, lone ${(lv0 * 3.6).toFixed(0)})`
    + (apex ? ` | at the bend ${inside(apex) >= 0 ? '+' : ''}${inside(apex).toFixed(1)} m,`
      + ` ${(apex.v * 3.6).toFixed(0)} km/h` : '')
    + (f.off ? ` | OFF at ${f.off.at.toFixed(0)} m ${(f.off.v * 3.6).toFixed(0)} km/h, ${inside(f.off)
      >= 0 ? '+' : ''}${inside(f.off).toFixed(1)} m off its line${f.off.touchedBy.length
      ? ', touched by #' + [...new Set(f.off.touchedBy.map((b) => field[b].slot))].join(' #')
      : ', no touch'}` : '');
  rows.push(row);
  if (f.off) {
    tally.off++;
    if (f.off.touchedBy.length) tally.touched++;
    if (inside(turnIn) < -1) tally.outside++;
    if (inside(turnIn) > 1) tally.inside++;
    if (turnIn.v > lv0 * 1.05) tally.fast++;
  }
}
console.log(rows.join('\n'));
// (WATCH=slot: that car's way in every 10 m against the lone car's)
if (process.env.WATCH) {
  const f = field.find((one) => one.slot === +process.env.WATCH);
  for (let where = FROM; where <= TO; where += 10) {
    const mine = at(f, where), solo = at(lone, where);
    if (!mine || mine.at > where + 6) continue;
    console.log(`  #${f.slot} @${where}: ${(mine.v * 3.6).toFixed(0)} km/h wants ${(mine.vT * 3.6)
      .toFixed(0)}, ${inside(mine).toFixed(1)} m in, R ${mine.R.toFixed(0)} | lone ${(solo.v
      * 3.6).toFixed(0)} wants ${(solo.vT * 3.6).toFixed(0)}, ${inside(solo).toFixed(1)} m in`);
  }
}
console.log(`OFF ${tally.off}: touched just before ${tally.touched}; came in more than 1 m outside`
  + ` its line ${tally.outside}, inside ${tally.inside}; faster than the lone car 25 m before`
  + ` ${tally.fast}`);
