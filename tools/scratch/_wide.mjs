// _wide.mjs - AI DRIVING WIDE (owner 11-04: "some ai seem to drive very wide around the outside of
// the track? especially noticeable on stockcar track but I think it happens everywhere"). A field
// (node, full contact, as aifieldcheck) on a level; per car the share of time it is > 2 m / > 4 m
// off its racing line (toward the outside or the inside) and, for those moments, what the driver
// was doing: gap picking (state.gapBase set), going wide round a car (state.wideUntil), attacking,
// covering, at the track's edge, or none of these.
// node tools/scratch/_wide.mjs [level] [diff] [n] [laps] [seed]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContacts, carContact } from '../../src/contact.ts';
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
  // ROLL=1: the rolling start's formation at the green (game/grid.ts: slot i 7 m behind the last,
  // columns +-3.2 m alternating, every car at the formation's 16 m/s); else a standing 2-wide grid
  const ROLL = !!process.env.ROLL, row = Math.floor(i / 2), side = ROLL ? (i % 2 ? 3.2 : -3.2) : i % 2 ? 3 : -3;
  const back = ROLL ? 10 + i * 7 : 15 + row * 9 + (i % 2 ? 4.5 : 0);
  const p = L.onTrack(sub, ((total - back) % total + total) % total, side, {});
  reset(car, p.x, p.y, p.rot);
  if (ROLL) { car.vx = Math.cos(p.rot) * 16; car.vy = Math.sin(p.rot) * 16; }
  const drv = createAIDriver(L.LEVEL, aiTraits(+d, i, N, seed)); car.mods.power *= drv.traits.power ?? 1;
  field.push({ car, drv, n: 0, w2: 0, w4: 0, w8: 0, offT: 0, offWhy: {}, why: {}, offSum: 0 });
}
const all = field.map((f) => f.car);
// a car alongside (-4 .. 2.5 m along my heading, < 3 m across): its side of me
const nearBy = (me) => { const c = Math.cos(me.heading), sn = Math.sin(me.heading);
  for (const o of all) { if (o === me) continue; const dx = o.x - me.x, dy = o.y - me.y, fwd = dx * c + dy * sn, lat = -dx * sn + dy * c;
    if (fwd > -4 && fwd < 2.5 && Math.abs(lat) < 3.2) return fwd >= 2.1 ? 'alongside-it-leads' : fwd <= -2.1 ? 'alongside-I-lead' : 'side-by-side'; }
  return null; };
let t = 0; const OFFD = {}, OFFT = {};
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
    { const q = L.querySubtrack(sub, f.car.x, f.car.y); if (q.dist > sub.width / 2 + 0.5) { f.offT++;
      const why2 = s.atk ? 'attack' : s.cover ? 'cover' : t < (s.wideUntil || 0) ? 'wide-round-car' : s.gapBase != null ? 'gap-pick' : s.mist ? 'mistake' : nearBy(f.car) || (s.follow ? 'following' : 'free');
      const touched = t - (f.touchT ?? -99) < 1.5 ? 'TOUCHED ' : '';
      f.offWhy[touched + why2] = (f.offWhy[touched + why2] || 0) + 1;
      if (process.env.FREELOG && why2 === process.env.FREELOG && Math.round(t / PHYSICS_STEP_SECONDS) % 60 === 0) { let sa = Math.atan2(f.car.vy, f.car.vx) - f.car.heading; sa = Math.atan2(Math.sin(sa), Math.cos(sa)); let he = f.car.heading - pt.h; he = Math.atan2(Math.sin(he), Math.cos(he)); console.log('  FREE #' + f.car.spec.id.split('#')[1] + ' t ' + t.toFixed(1) + ' v ' + Math.hypot(f.car.vx, f.car.vy).toFixed(1) + ' off ' + (q.dist - sub.width / 2).toFixed(1) + ' m past | lat ' + lat.toFixed(1) + ' dodge ' + (s.dodge ?? 0).toFixed(1) + ' | slip ' + sa.toFixed(2) + ' head-err ' + he.toFixed(2) + ' | vT ' + (s.vT ?? 0).toFixed(1) + ' slowT ' + (s.slowT ?? 0).toFixed(1) + ' rev ' + (t < (s.revUntil || 0) ? 1 : 0) + ' gapBase ' + (s.gapBase ?? NaN).toFixed(1) + ' lineOff ' + (pt.off || 0).toFixed(1) + ' turn ' + (pt.turn || 0).toFixed(2)); } OFFT[Math.floor(t / 20) * 20] = (OFFT[Math.floor(t / 20) * 20] || 0) + 1; OFFD[Math.floor(q.trackDist / 25)] = (OFFD[Math.floor(q.trackDist / 25)] || 0) + 1; } }
  }
  for (const fa of field) for (const fb of field) if (fa !== fb && Math.hypot(fa.car.x - fb.car.x, fa.car.y - fb.car.y) < 6 && carContact(fa.car, fb.car)) fa.touchT = t;
  carContacts(all);
  t += PHYSICS_STEP_SECONDS;
}
const sum = (k) => field.reduce((a, f) => a + f[k] / f.n, 0) / N * 100;
const offAll = {}; for (const f of field) for (const [k, v] of Object.entries(f.offWhy)) offAll[k] = (offAll[k] || 0) + v;
console.log('OFF THE TRACK (past the edge + 0.5 m): ' + (sum('offT')).toFixed(1) + '% of car-time | why: ' + Object.entries(offAll).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', ') + ' | where (m round the lap): ' + Object.entries(OFFD).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k * 25 + '-' + (k * 25 + 25) + ' ' + v).join(', ') + ' | by time (s): ' + Object.entries(OFFT).map(([k, v]) => k + 's ' + v).join(', ') + ' | lap ' + total.toFixed(0) + ' m, width ' + sub.width);
console.log(`${lv} diff ${d} x${N} seed ${seed}, ${t.toFixed(0)} s: FIELD > 2 m ${sum('w2').toFixed(1)}% | > 4 m ${sum('w4').toFixed(1)}% | > 8 m ${sum('w8').toFixed(1)}%`);
for (const f of field) {
  const top = Object.entries(f.why).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([k, v]) => `${k} ${(100 * v / f.n).toFixed(0)}%`).join(', ');
  console.log(`  #${f.car.spec.id.split('#')[1]} skill ${f.drv.traits.skill.toFixed(2)}: > 2 m off ${(100 * f.w2 / f.n).toFixed(0)}% | > 4 m ${(100 * f.w4 / f.n).toFixed(0)}% | mean toward outside ${(f.offSum / f.n).toFixed(1)} m | ${top}`);
}
