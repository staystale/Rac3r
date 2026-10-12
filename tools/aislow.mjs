// aislow.mjs — WHERE the racing AI is slower than its own target, per surface (user, 2026-10-04: "drive like slow on slippy surfaces",
// "still slow down on transition change"). One AI, 2 laps, node. For each surface: seconds driven, mean speed, mean target, seconds
// BELOW target by > 1.5 m/s and what it was doing then: full throttle (traction / power limited — physics), part throttle (the driver
// holding back: wheelspin / slide feel), understeer lift, oversteer catch, braking.
// node tools/aislow.mjs [level] [car] [diff]
import { makeCar, step, reset, DT } from '../src/vehicle.js';
import * as L from '../src/lab.js';
const { createAIDriver } = await import(process.env.AINEXT ? '../src/ai/circuit.next.js' : '../src/ai/circuit.js'), { aiTraits } = await import('../src/ai/traits.ts'), { racingLine } = await import('../src/ai/line.ts');
const [lv = 'slidden-hill', carId = 'rally-4x4', d = '4'] = process.argv.slice(2);
for (const k of ['LF', 'LW']) if (process.env[k] != null) globalThis['__' + k] = +process.env[k];
L.setLevel(lv); L.clearWear();
const Ln = racingLine(L.LEVEL), car = makeCar(carId), p0 = Ln.pts[0];
reset(car, p0.x, p0.y, p0.h);
const drv = createAIDriver(L.LEVEL, aiTraits(+d, 0, 1, 3));
const by = {}; let t = 0;
while (t < 130) {
  L.applyGround(car, DT); const u = drv.drive(car, DT, { cars: [], lap: 2, laps: 5 }); step(car, u, DT); t += DT;
  if (t < 5) continue;
  const v = Math.hypot(car.vx, car.vy), vT = Math.min(drv.state.vT, 95), k = car.surface.id || car.surface.name || String(car.surface.mu);
  const b = by[k] || (by[k] = { t: 0, v: 0, vT: 0, below: 0, full: 0, part: 0, brake: 0, spin: 0, under: 0, over: 0, feel: 0, ramp: 0, mu: car.surface.mu });
  b.t += DT; b.v += v * DT; b.vT += vT * DT;
  if (vT > v + 1.5) { b.below += DT; if (u.brake > 0) b.brake += DT; else if (u.throttle >= 0.95) b.full += DT; else { b.part += DT; const loose = Math.max(0, Math.min(1, (1 - car.surface.mu) / 0.5)), sF = Math.abs(car.t.slipF || 0), sR = Math.abs(car.t.slipR || 0);
      if (sR > 0.18) b.over += DT; else if (sF > 0.14 + 0.06 * loose) b.under += DT; else if (sR > 0.07 || car.t.spinR || car.t.spinF) b.feel += DT; else b.ramp += DT; } if (car.t.spinR || car.t.spinF) b.spin += DT; }
}
console.log(`${lv} ${carId} diff ${d}`);
for (const [k, b] of Object.entries(by).sort((a, b) => b[1].t - a[1].t)) if (b.t > 1)
  console.log(`  ${k.padEnd(11)} mu ${b.mu.toFixed(2)} | ${b.t.toFixed(1)} s | v ${(b.v / b.t).toFixed(1)} vs target ${(b.vT / b.t).toFixed(1)} | below target ${b.below.toFixed(1)} s: full throttle ${b.full.toFixed(1)}, PART ${b.part.toFixed(1)} [under ${b.under.toFixed(1)} over ${b.over.toFixed(1)} slip-feel ${b.feel.toFixed(1)} other ${b.ramp.toFixed(1)}], brake ${b.brake.toFixed(1)} (wheelspin ${b.spin.toFixed(1)})`);
