// aisurface.mjs — what the racing AI does at SURFACE CHANGES (user, 2026-10-04: "AI slow down weirdly on surface changes, dirt to tarmac —
// they should predict it and speed up"). One AI, one lap (node, no contact); every change of the car's surface mu is an event; for each:
// speed 1 s before / at / 1.5 s after, the target vT at the same moments, and whether it braked or lifted with vT above v.
// node tools/aisurface.mjs [level] [car] [diff]
import { makeCar, step, reset, DT } from '../src/vehicle.ts';
import * as L from '../src/lab.js';
const { createAIDriver } = await import(process.env.AINEXT ? '../src/ai/circuit.next.js' : '../src/ai/circuit.ts'), { aiTraits } = await import('../src/ai/traits.ts'), { racingLine } = await import('../src/ai/line.ts');
const [lv = 'slidden-hill', carId = 'rally-4x4', d = '4'] = process.argv.slice(2);
for (const k of ['LO', 'LU', 'LF0', 'LF', 'LP', 'LS', 'SPIN', 'LW']) if (process.env[k] != null) globalThis['__' + k] = +process.env[k];
L.setLevel(lv); L.clearWear();
const Ln = racingLine(L.LEVEL), car = makeCar(carId), p0 = Ln.pts[0];
reset(car, p0.x, p0.y, p0.h);
const drv = createAIDriver(L.LEVEL, aiTraits(+d, 0, 1, 3));
const log = []; let t = 0, lastMu = null; const ev = [];
while (t < 140) {
  L.applyGround(car, DT); const u = drv.drive(car, DT, { cars: [], lap: 2, laps: 5 }); step(car, u, DT); t += DT;
  const mu = car.surface.mu, v = Math.hypot(car.vx, car.vy);
  log.push({ t, v, vT: drv.state.vT, th: u.throttle, br: u.brake, mu, sR: Math.abs(car.t.slipR || 0), sF: Math.abs(car.t.slipF || 0), dbg: drv.state.dbg, d: L.querySubtrack(L.LEVEL.subtrack, car.x, car.y).trackDist });
  if (lastMu !== null && Math.abs(mu - lastMu) > 0.15 && t > 3) ev.push(log.length - 1);
  lastMu = mu;
}
const at = (i) => log[Math.max(0, Math.min(log.length - 1, i))];
const k = Math.round(1 / DT);
let bad = 0;
for (const i of ev) {
  const a = at(i - k), b = at(i), c = at(i + Math.round(1.5 * k));
  // lifted / braked while the target was above the speed, in the 1.5 s after the change
  let lift = 0, sl = 0; for (let j = i; j < i + 1.5 * k; j++) { const q = at(j); if (q.vT > q.v + 1 && q.th < 0.5) lift += DT; sl = Math.max(sl, q.sR); }
  if (lift > 0.3) bad++;
  if (process.env.WHY && lift > 0.3) { const why = {}; for (let j = i; j < i + 1.5 * k; j++) { const q = at(j); if (q.vT > q.v + 1 && q.th < 0.5) { const w = q.dbg.under ? "under" : q.dbg.over ? "over" : q.dbg.feel < 0.8 ? "feel" : "other"; why[w] = (why[w] || 0) + 1; } } console.log("   why", JSON.stringify(why), JSON.stringify(at(i + 20).dbg)); }
  console.log(`t ${b.t.toFixed(1)} d ${b.d.toFixed(0)} mu ${at(i - 1).mu.toFixed(2)}->${b.mu.toFixed(2)} | v ${a.v.toFixed(1)} ${b.v.toFixed(1)} ${c.v.toFixed(1)} | vT ${a.vT.toFixed(1)} ${b.vT.toFixed(1)} ${c.vT.toFixed(1)} | lifted below target ${lift.toFixed(2)} s | max rear slip ${sl.toFixed(2)}`);
}
console.log(`${lv} ${carId} diff ${d}: ${ev.length} surface changes, ${bad} with > 0.3 s of lifting below the target`);
