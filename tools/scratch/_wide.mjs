// _wide.mjs - AI DRIVING WIDE (owner 11-04: "some ai seem to drive very wide around the outside of
// the track? especially noticeable on stockcar track but I think it happens everywhere"). A field
// (node, full contact, as aifieldcheck) on a level; per car the share of time it is > 2 m / > 4 m
// off its racing line (toward the outside or the inside) and, for those moments, what the driver
// was doing: gap picking (state.gapBase set), going wide round a car (state.wideUntil), attacking,
// covering, at the track's edge, or none of these.
// node tools/scratch/_wide.mjs [level] [diff] [n] [laps] [seed]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContacts } from '../../src/contact.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';
import { lateralOf } from '../../src/ai/rejoin.ts';

const [lv = 'stock-car', d = '4', nArg = '6', lapsArg = '3', seedArg = '7'] = process.argv.slice(2);
const N = +nArg, LAPS = +lapsArg, seed = +seedArg, carId = 'hatch-rwd';
L.setLevel(lv); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist;
const field = [];
for (let i = 0; i < N; i++) {
  const car = makeCar(carId); car.spec = { ...car.spec, id: carId + '#' + (i + 1) };
  const row = Math.floor(i / 2), side = i % 2 ? 3 : -3;
  const p = L.onTrack(sub, ((total - 15 - row * 9 - (i % 2 ? 4.5 : 0)) % total + total) % total, side, {});
  reset(car, p.x, p.y, p.rot);
  const drv = createAIDriver(L.LEVEL, aiTraits(+d, i, N, seed)); car.mods.power *= drv.traits.power ?? 1;
  field.push({ car, drv, n: 0, w2: 0, w4: 0, w8: 0, why: {}, offSum: 0 });
}
const all = field.map((f) => f.car);
// a car alongside (-4 .. 2.5 m along my heading, < 3 m across): its side of me
const nearBy = (me) => { const c = Math.cos(me.heading), sn = Math.sin(me.heading);
  for (const o of all) { if (o === me) continue; const dx = o.x - me.x, dy = o.y - me.y, fwd = dx * c + dy * sn, lat = -dx * sn + dy * c;
    if (fwd > -4 && fwd < 2.5 && Math.abs(lat) < 3.2) return fwd >= 2.1 ? 'alongside-it-leads' : fwd <= -2.1 ? 'alongside-I-lead' : 'side-by-side'; }
  return null; };
let t = 0;
while (t < 30 + LAPS * 70) {
  for (const f of field) {
    L.applyGround(f.car, PHYSICS_STEP_SECONDS);
    step(f.car, f.drv.drive(f.car, PHYSICS_STEP_SECONDS, { cars: all.filter((o) => o !== f.car), lap: 1, laps: 5 }),
      PHYSICS_STEP_SECONDS);
    const s = f.drv.state;
    if (t < 10 || s.i == null || !s.path) continue;
    const path = s.path, pt = path.pts[s.i];
    // + = toward the outside of the bend here (the line's turn sign), else signed left
    const lat = lateralOf(f.car, path, s.i), turn = Math.sign(pt.turn || 0) || 1, out = -lat * turn;
    f.n++; f.offSum += out;
    if (Math.abs(lat) > 2) {
      f.w2++;
      const hw = f.drv.line?.hw ?? sub.width / 2, lineOff = pt.off || 0;
      const why = s.atk ? 'attack' : s.cover ? 'cover' : t < (s.wideUntil || 0) ? 'wide-round-car'
        : s.gapBase != null ? 'gap-pick' : Math.abs(lineOff + lat) > hw - 0.3 ? 'at-edge' : nearBy(f.car) || (s.follow ? 'following' : 'rejoining');
      const k = (out > 0 ? 'OUT ' : 'IN ') + why;
      if (process.env.TRACE && +process.env.TRACE === +f.car.spec.id.split('#')[1] && Math.round(t / PHYSICS_STEP_SECONDS) % 15 === 0)
        console.log('    t ' + t.toFixed(1) + ' lat ' + lat.toFixed(2) + ' dodge ' + (s.dodge ?? 0).toFixed(2) + ' ' + why + ' v ' + Math.hypot(f.car.vx, f.car.vy).toFixed(1) + ' turn ' + (pt.turn || 0).toFixed(3) + ' lineOff ' + lineOff.toFixed(1) + ' hw ' + hw.toFixed(1) + ' mist ' + JSON.stringify(s.mist ? { k: s.mist.kind, lat: s.mist.lat } : null) + ' wide ' + (s.wide ?? '-') + ' clC ' + (s.clCorner ?? '-'));
      f.why[k] = (f.why[k] || 0) + 1;
    }
    if (Math.abs(lat) > 4) f.w4++;
    if (Math.abs(lat) > 8) f.w8++;
  }
  carContacts(all);
  t += PHYSICS_STEP_SECONDS;
}
const sum = (k) => field.reduce((a, f) => a + f[k] / f.n, 0) / N * 100;
console.log(`${lv} diff ${d} x${N} seed ${seed}, ${t.toFixed(0)} s: FIELD > 2 m ${sum('w2').toFixed(1)}% | > 4 m ${sum('w4').toFixed(1)}% | > 8 m ${sum('w8').toFixed(1)}%`);
for (const f of field) {
  const top = Object.entries(f.why).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([k, v]) => `${k} ${(100 * v / f.n).toFixed(0)}%`).join(', ');
  console.log(`  #${f.car.spec.id.split('#')[1]} skill ${f.drv.traits.skill.toFixed(2)}: > 2 m off ${(100 * f.w2 / f.n).toFixed(0)}% | > 4 m ${(100 * f.w4 / f.n).toFixed(0)}% | mean toward outside ${(f.offSum / f.n).toFixed(1)} m | ${top}`);
}
