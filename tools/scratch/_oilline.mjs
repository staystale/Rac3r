// _oilline.mjs - A LINE ROUND FRESH OIL (?ailook). An oil patch (wear cells, cover 'oil', as a
// crash spills it) lies on the racing line for LEN m from AT m (default: just past the tightest
// corner's apex), a wheel's width either side; a field of N laps LAPS times (ghosts: no car
// contact, so the oil is the only thing in the way). Per driver (by skill): seconds its middle was
// on oil, seconds off the road, spins, laps. COVER=glass lays glass instead.
// node tools/scratch/_oilline.mjs [level] [car] [diff] [n] [seed] [laps]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const { racingLine } = await import('../../src/ai/line.ts');
const [lv = 'thruston', carId = 'hatch-rwd', d = '2', nArg = '6', seedArg = '7', lapsArg = '3'] = process.argv.slice(2);
const N = +nArg, seed = +seedArg, LAPS = +lapsArg, COVER = process.env.COVER || 'oil', LEN = 8;
L.setLevel(lv); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist, sp = L.LEVEL.spawn, line = racingLine(L.LEVEL);
let worst = 0, worstR = Infinity;
for (const corner of line.corners) if (line.pts[corner.apex].R < worstR) { worstR = line.pts[corner.apex].R; worst = corner.apex; }
const from = worst + Math.round(8 / line.sp);
let laid = 0;
for (let along = 0; along <= LEN; along += 0.75) {
  const p = line.pts[(from + Math.round(along / line.sp)) % line.n];
  for (const side of [-1.2, -0.4, 0.4, 1.2]) {
    const x = p.x - Math.sin(p.h) * side, y = p.y + Math.cos(p.h) * side;
    const cell = L.getCell(Math.floor(x / L.WEAR_CELL), Math.floor(y / L.WEAR_CELL), true);
    if (cell && !cell.fixed && cell.cover !== COVER) {
      Object.assign(cell, { cover: COVER, standing: true, dry: 0, scrub: 0, passes: 0, current: COVER, oilGen: 1 });
      laid++;
    }
  }
}
const d0 = L.querySubtrack(sub, sp.x, sp.y).trackDist, field = [];
for (let i = 0; i < N; i++) {
  const car = makeCar(carId); car.spec = { ...car.spec, id: carId + '#' + (i + 1) };
  const lat = Math.max(1.6, Math.min(3.2, sub.width / 2 - 1.8)), back = 4 + i * 7;
  const p = L.onTrack(sub, ((d0 - back) % total + total) % total, i % 2 ? lat : -lat, {});
  reset(car, p.x, p.y, p.rot);
  const drv = createAIDriver(L.LEVEL, aiTraits(+d, i, N, seed));
  car.mods.power *= drv.traits.power ?? 1;
  field.push({ car, drv, prog: null, lastQ: 0, laps: [], tl: 0, off: 0, on: 0, spins: 0, spinT: -9 });
}
for (let t = 0; t < 600 && field.some((f) => f.laps.length < LAPS); t += DT) {
  for (const f of field) {
    const c = f.car;
    L.applyGround(c, DT);
    step(c, f.drv.drive(c, DT, { cars: [], lap: 1 + f.laps.length, laps: 9 }), DT);
    L.barrierClamp(c); L.solidClamp(c);
    const q = L.querySubtrack(sub, c.x, c.y);
    if (f.prog === null) { f.prog = 0; f.lastQ = q.trackDist; }
    let dq = q.trackDist - f.lastQ; if (dq > total / 2) dq -= total; if (dq < -total / 2) dq += total;
    const before = Math.floor(f.prog / total); f.prog += dq; f.lastQ = q.trackDist;
    if (Math.floor(f.prog / total) > before && f.prog > 0) { f.laps.push(+(t - f.tl).toFixed(1)); f.tl = t; }
    if (q.dist > sub.width / 2 + 0.5) f.off += DT;
    const cell = L.wearMap.get(L.wearKey(Math.floor(c.x / L.WEAR_CELL), Math.floor(c.y / L.WEAR_CELL)));
    if (cell && cell.cover === COVER) f.on += DT;
    const v = Math.hypot(c.vx, c.vy); let a = Math.atan2(c.vy, c.vx) - c.heading; a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    if (v > 5 && a > 1.0 && t - f.spinT > 3) { f.spins++; f.spinT = t; }
  }
}
console.log(`${lv} ${carId} diff ${d} x${N}: ${COVER} ${laid} cells on the line ${LEN} m past the tightest apex (R ${worstR.toFixed(0)} m)`);
let on = 0, off = 0, spins = 0;
for (const f of field) {
  on += f.on; off += f.off; spins += f.spins;
  console.log(`  ${f.drv.traits.persona.padEnd(10)} skill ${f.drv.traits.skill.toFixed(2)} | on ${COVER} ${f.on.toFixed(2)} s | off-road ${f.off.toFixed(1)} s | spins ${f.spins} | laps ${f.laps.slice(1).join(', ')}`);
}
console.log(`  TOTAL on ${COVER} ${on.toFixed(1)} s | off-road ${off.toFixed(1)} s | spins ${spins}`);
