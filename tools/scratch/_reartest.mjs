// _reartest.mjs - AI RUNNING INTO THE BACK of a car braking for a corner (owner 11-04: "ai still
// seem to crash into the back of me coming into a corner a little too often"). A careful LEAD (the
// bench driver, autodrive.ts - it brakes early, as a careful player does) and FOLLOWERS (racing AI
// at the difficulty) lined up behind it on the line, node, full contact. Counts the followers'
// nose-to-tail touches into the lead (and their closing speed), per lap.
// node tools/scratch/_reartest.mjs [level] [diff] [followers] [laps] [seed]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContacts, carContact } from '../../src/contact.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { aiTraits } from '../../src/ai/traits.ts';

const [lv = 'thruston', d = '4', nArg = '3', lapsArg = '3', seedArg = '7'] = process.argv.slice(2);
const N = +nArg, LAPS = +lapsArg, seed = +seedArg, carId = 'hatch-rwd';
L.setLevel(lv); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist;
const place = (car, back) => { const p = L.onTrack(sub, ((total - 20 - back) % total + total) % total, 0, {});
  reset(car, p.x, p.y, p.rot); };
const lead = makeCar(carId); lead.spec = { ...lead.spec, id: carId + '#0' }; place(lead, 0);
const leadDrv = createAutoDriver(sub); const lastU = new Map();
const field = [];
for (let i = 0; i < N; i++) {
  const car = makeCar(carId); car.spec = { ...car.spec, id: carId + '#' + (i + 1) };
  place(car, 9 * (i + 1));
  const drv = createAIDriver(L.LEVEL, aiTraits(+d, i, N, seed)); car.mods.power *= drv.traits.power ?? 1;
  field.push({ car, drv });
}
const all = [lead, ...field.map((f) => f.car)];
let t = 0, dist = 0, hits = 0, hard = 0, touch = new Set(); const closing = [];
while (dist < LAPS * total && t < 400) {
  L.applyGround(lead, PHYSICS_STEP_SECONDS);
  { const u = leadDrv.drive(lead, PHYSICS_STEP_SECONDS); lastU.set(lead, u); step(lead, u, PHYSICS_STEP_SECONDS); }
  dist += Math.hypot(lead.vx, lead.vy) * PHYSICS_STEP_SECONDS;
  for (const f of field) {
    L.applyGround(f.car, PHYSICS_STEP_SECONDS);
    { const u = f.drv.drive(f.car, PHYSICS_STEP_SECONDS, { cars: all.filter((o) => o !== f.car), lap: 1, laps: 5 }); lastU.set(f.car, u); step(f.car, u, PHYSICS_STEP_SECONDS); }
  }
  const now = new Set();
  for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
    const A = all[a], B = all[b]; if (Math.hypot(A.x - B.x, A.y - B.y) > 7 || !carContact(A, B)) continue;
    const key = a + '-' + b; now.add(key); if (touch.has(key)) continue;
    // nose-to-tail: the front car ahead of the rear in the rear's frame, lateral < 1.6 m
    const fa = (B.x - A.x) * Math.cos(A.heading) + (B.y - A.y) * Math.sin(A.heading), rear = fa > 0 ? A : B, front = fa > 0 ? B : A;
    const lat = -(front.x - rear.x) * Math.sin(rear.heading) + (front.y - rear.y) * Math.cos(rear.heading);
    if (Math.abs(lat) > 1.6) continue;
    const vc = (rear.vx - front.vx) * Math.cos(rear.heading) + (rear.vy - front.vy) * Math.sin(rear.heading);
    if (t > 6 && process.env.DBG) { const fr = field.find((x) => x.car === rear), st = fr ? fr.drv.state : {}; const ur = lastU.get(rear) || {}, uf = lastU.get(front) || {};
      const gapc = (front.x - rear.x) * Math.cos(rear.heading) + (front.y - rear.y) * Math.sin(rear.heading);
      console.log('HIT t ' + t.toFixed(1) + ' rear #' + rear.spec.id.split('#')[1] + ' -> #' + front.spec.id.split('#')[1] + ' vc ' + vc.toFixed(1) + ' | v ' + Math.hypot(rear.vx, rear.vy).toFixed(1) + ' / ' + Math.hypot(front.vx, front.vy).toFixed(1) + ' | brk ' + (ur.brake || 0).toFixed(2) + ' thr ' + (ur.throttle || 0).toFixed(2) + ' | front brk ' + (uf.brake || 0).toFixed(2) + ' thr ' + (uf.throttle || 0).toFixed(2) + ' | follow ' + !!st.follow + ' atk ' + !!st.atk + ' vT ' + (st.vT ?? NaN).toFixed(1) + ' gapc ' + gapc.toFixed(1)); }
    if (t > 6) { hits++; closing.push(vc); if (vc > 3) hard++; }
  }
  if (process.env.TRACE && Math.round(t / PHYSICS_STEP_SECONDS) % Math.round(10 / PHYSICS_STEP_SECONDS) === 0) console.log('  t ' + t.toFixed(0) + ' v ' + all.map((c) => Math.hypot(c.vx, c.vy).toFixed(1)).join(' ') + ' | follow ' + field.map((x) => (x.drv.state.follow ? 1 : 0)).join('') + ' | gaps to lead ' + field.map((x) => Math.hypot(x.car.x - lead.x, x.car.y - lead.y).toFixed(0)).join(' '));
  touch = now;
  carContacts(all);
  t += PHYSICS_STEP_SECONDS;
}
closing.sort((x, y) => y - x);
console.log(`${lv} diff ${d} x${N} seed ${seed}: ${(dist / total).toFixed(1)} laps ${t.toFixed(0)} s | nose-tail hits ${hits} (> 3 m/s closing ${hard}) | worst closing ${closing.slice(0, 4).map((v) => v.toFixed(1)).join(' ')} m/s`);
