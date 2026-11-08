// _lines.mjs - LINES OF THEIR OWN (?ailines; owner 11-04: AI should not all follow the same line;
// it may vary lap to lap, more for weak drivers). A field of N laps LAPS times (full contact); at
// every corner's apex each car's place off the racing line is noted. Per driver (by skill): its
// mean place off the line at the apexes, how much that varies lap to lap at the same apex, its
// best and mean laps (from lap 2), seconds off the road; and the field's spread between drivers at
// the same apex. node tools/scratch/_lines.mjs [level] [car] [diff] [n] [seed] [laps]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContact } from '../../src/contact.ts';
const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const { racingLine } = await import('../../src/ai/line.ts');
const [lv = 'thruston', carId = 'hatch-rwd', d = '2', nArg = '6', seedArg = '7', lapsArg = '4'] = process.argv.slice(2);
const N = +nArg, seed = +seedArg, LAPS = +lapsArg;
L.setLevel(lv); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist, sp = L.LEVEL.spawn, line = racingLine(L.LEVEL);
const d0 = L.querySubtrack(sub, sp.x, sp.y).trackDist;
// where each car is noted: 15 m before and after every apex (the line is the racing line AT the apex)
const apexes = line.corners.flatMap((c) => [(c.apex - Math.round(15 / line.sp) + line.n) % line.n, (c.apex + Math.round(15 / line.sp)) % line.n]);
const field = [];
for (let i = 0; i < N; i++) {
  const car = makeCar(carId); car.spec = { ...car.spec, id: carId + '#' + (i + 1) };
  const lat = Math.max(1.6, Math.min(3.2, sub.width / 2 - 1.8)), back = 4 + i * 7;
  const p = L.onTrack(sub, ((d0 - back) % total + total) % total, i % 2 ? lat : -lat, {});
  reset(car, p.x, p.y, p.rot);
  const drv = createAIDriver(L.LEVEL, aiTraits(+d, i, N, seed));
  car.mods.power *= drv.traits.power ?? 1;
  field.push({ car, drv, prog: null, lastQ: 0, laps: [], tl: 0, off: 0, at: apexes.map(() => []), lastI: null });
}
for (let t = 0; t < 600 && field.some((f) => f.laps.length < LAPS); t += DT) {
  for (const f of field) {
    const c = f.car;
    L.applyGround(c, DT);
    step(c, f.drv.drive(c, DT, { cars: process.env.GHOST ? [] : field.filter((o) => o !== f).map((o) => o.car), lap: 1 + f.laps.length, laps: 9 }), DT);
    L.barrierClamp(c); L.solidClamp(c);
    const q = L.querySubtrack(sub, c.x, c.y);
    if (f.prog === null) { f.prog = 0; f.lastQ = q.trackDist; }
    let dq = q.trackDist - f.lastQ; if (dq > total / 2) dq -= total; if (dq < -total / 2) dq += total;
    const before = Math.floor(f.prog / total); f.prog += dq; f.lastQ = q.trackDist;
    if (Math.floor(f.prog / total) > before && f.prog > 0) { f.laps.push(+(t - f.tl).toFixed(1)); f.tl = t; }
    if (q.dist > sub.width / 2 + 0.5) f.off += DT;
    // passing an apex (after the first lap): its place off the racing line there
    const i = f.drv.state.i;
    if (f.laps.length >= 1 && f.drv.state.path === line && i != null && f.lastI != null && i !== f.lastI) {
      apexes.forEach((apex, k) => {
        const crossed = f.lastI < i ? f.lastI < apex && apex <= i : apex > f.lastI || apex <= i;
        if (crossed && Math.abs(i - f.lastI) < 20) {
          const pt = line.pts[apex];
          f.at[k].push((c.x - pt.x) * -Math.sin(pt.h) + (c.y - pt.y) * Math.cos(pt.h));
        }
      });
    }
    f.lastI = i;
  }
  if (!process.env.GHOST) for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
    const A = field[a].car, B = field[b].car; if (Math.hypot(A.x - B.x, A.y - B.y) < 7) carContact(A, B);
  }
}
const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
console.log(`${lv} ${carId} diff ${d} x${N} seed ${seed}: ${apexes.length} corners`);
for (const f of field) {
  const offs = f.at.flat(), lapVar = mean(f.at.filter((a) => a.length > 1).map(sd));
  const race = f.laps.slice(1);
  console.log(`  ${f.drv.traits.persona.padEnd(10)} skill ${f.drv.traits.skill.toFixed(2)} | off the line at apexes ${mean(offs.map(Math.abs)).toFixed(2)} m, lap-to-lap ${lapVar.toFixed(2)} m | best ${Math.min(...race).toFixed(1)} mean ${mean(race).toFixed(1)} | off-road ${f.off.toFixed(1)} s`);
}
const between = mean(apexes.map((_, k) => sd(field.map((f) => mean(f.at[k])).filter((v) => !Number.isNaN(v)))));
console.log(`  between drivers at the same apex: ${between.toFixed(2)} m`);
