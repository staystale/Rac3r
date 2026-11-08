// _stopcar.mjs - DODGING (the AI rework R5; owner: "maybe more skilled drivers can avoid collisions
// even more"; "AI should try to avoid crashing, especially high skilled"). A car sits STOPPED on the
// racing line at AT m round the lap (a crash, a spin; nose across the road) while a field of N
// laps LAPS times past it. Per driver (by skill): hits on the stopped car and the closing speed of
// the worst, the closest it came (centre to centre), and the time it lost going by (its lap times).
// Full contact (contact.ts), so a hit shoves the stopped car. node tools/scratch/_stopcar.mjs
// [level] [car] [diff] [n] [at m] [seed] [laps]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContact } from '../../src/contact.ts';
const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const { racingLine } = await import('../../src/ai/line.ts');
const [lv = 'thruston', carId = 'hatch-rwd', d = '2', nArg = '6', atArg = '-1', seedArg = '7',
  lapsArg = '3'] = process.argv.slice(2);
const N = +nArg, seed = +seedArg, LAPS = +lapsArg;
L.setLevel(lv); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist, sp = L.LEVEL.spawn;
const d0 = L.querySubtrack(sub, sp.x, sp.y).trackDist;
// where it stops: AT m from the start line, or (-1) just past the lap's tightest corner exit
const line = racingLine(L.LEVEL);
let at = +atArg;
if (at < 0) {
  let worst = 0, worstR = Infinity;
  for (const corner of line.corners) if (line.pts[corner.apex].R < worstR) { worstR = line.pts[corner.apex].R; worst = corner.apex; }
  at = ((worst + Math.round(30 / line.sp)) % line.n) * line.sp;
}
const linePt = line.pts[Math.round(at / line.sp) % line.n];
const parked = makeCar(carId); parked.spec = { ...parked.spec, id: carId + '#stopped' };
reset(parked, linePt.x, linePt.y, linePt.h + Math.PI / 2);   // across the road
const field = [];
for (let i = 0; i < N; i++) {
  const car = makeCar(carId); car.spec = { ...car.spec, id: carId + '#' + (i + 1) };
  const lat = Math.max(1.6, Math.min(3.2, sub.width / 2 - 1.8)), back = 4 + i * 7;
  const p = L.onTrack(sub, ((d0 - back) % total + total) % total, i % 2 ? lat : -lat, {});
  reset(car, p.x, p.y, p.rot);
  const drv = createAIDriver(L.LEVEL, aiTraits(+d, i, N, seed));
  car.mods.power *= drv.traits.power ?? 1;
  field.push({ car, drv, hits: 0, worst: 0, closest: Infinity, touching: false, prog: null, lastQ: 0, laps: [], tl: 0 });
}
const all = () => [...field.map((f) => f.car), parked];
for (let t = 0; t < 400 && field.some((f) => f.laps.length < LAPS); t += DT) {
  for (const f of field) {
    const c = f.car;
    L.applyGround(c, DT);
    const u = f.drv.drive(c, DT, { cars: all().filter((o) => o !== c), lap: 1 + f.laps.length, laps: 9 });
    step(c, u, DT); L.barrierClamp(c); L.solidClamp(c);
    if (process.env.TRACE && f === field[+process.env.TRACE] && f.laps.length < 1) {
      const dx = parked.x - c.x, dy = parked.y - c.y, fwd = dx * Math.cos(c.heading) + dy * Math.sin(c.heading), lat = -dx * Math.sin(c.heading) + dy * Math.cos(c.heading);
      if (fwd > -3 && fwd < 70 && Math.abs(lat) < 10 && Math.round(t / DT) % 12 === 0) { const st = f.drv.state; console.log(`    t ${t.toFixed(2)} fwd ${fwd.toFixed(1)} lat ${lat.toFixed(1)} v ${Math.hypot(c.vx, c.vy).toFixed(1)} vT ${st.vT.toFixed(1)} steer ${u.steer.toFixed(2)} brk ${u.brake.toFixed(2)} dodge ${st.dodge.toFixed(2)} atk ${st.atk ? st.atk.side : '-'} cover ${st.cover ? 'y' : '-'} follow ${st.follow}`); }
    }
    const q = L.querySubtrack(sub, c.x, c.y);
    if (f.prog === null) { f.prog = 0; f.lastQ = q.trackDist; }
    let dq = q.trackDist - f.lastQ; if (dq > total / 2) dq -= total; if (dq < -total / 2) dq += total;
    const before = Math.floor(f.prog / total); f.prog += dq; f.lastQ = q.trackDist;
    if (Math.floor(f.prog / total) > before && f.prog > 0) { f.laps.push(+(t - f.tl).toFixed(1)); f.tl = t; }
    f.closest = Math.min(f.closest, Math.hypot(c.x - parked.x, c.y - parked.y));
  }
  // the stopped car only moves when it is hit (rolls to a stop)
  L.applyGround(parked, DT);
  step(parked, { steer: 0, throttle: 0, brake: 1, handbrake: 1, reverse: 0 }, DT);
  for (let a = 0; a < N; a++) {
    const A = field[a].car;
    for (let b = a + 1; b < N; b++) { const B = field[b].car; if (Math.hypot(A.x - B.x, A.y - B.y) < 7) carContact(A, B); }
    if (Math.hypot(A.x - parked.x, A.y - parked.y) > 7) { field[a].touching = false; continue; }
    const closing = Math.hypot(A.vx - parked.vx, A.vy - parked.vy);
    if (carContact(A, parked)) {
      if (!field[a].touching) { field[a].hits++; field[a].worst = Math.max(field[a].worst, closing); }
      field[a].touching = true;
    } else field[a].touching = false;
  }
}
const lapsOf = (f) => f.laps.slice(1).join(', ');
console.log(`${lv} ${carId} diff ${d} x${N}: a car stopped across the line at ${at.toFixed(0)} m (R ${line.pts[Math.round(at / line.sp) % line.n].R.toFixed(0)} m there)`);
let hits = 0;
for (const f of field) {
  hits += f.hits;
  console.log(`  ${f.drv.traits.persona.padEnd(10)} skill ${f.drv.traits.skill.toFixed(2)} | hits ${f.hits}${f.hits ? ' (worst ' + (f.worst * 3.6).toFixed(0) + ' km/h)' : ''} | closest ${f.closest.toFixed(1)} m | laps ${lapsOf(f)}`);
}
console.log(`  TOTAL hits ${hits}; the stopped car moved ${Math.hypot(parked.x - linePt.x, parked.y - linePt.y).toFixed(1)} m`);
