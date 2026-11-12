import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContact } from '../../src/contact.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';
let dice = 7 * 7919 + 1;
Math.random = () => { dice = (Math.imul(dice, 1664525) + 1013904223) >>> 0; return dice / 4294967296; };
L.setLevel('spa'); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist, spawn = L.LEVEL.spawn;
const spawnDist = L.querySubtrack(sub, spawn.x, spawn.y).trackDist;
const N = 4, field = [];
for (let slot = 0; slot < N; slot++) {
  const car = makeCar('saloon-rwd'); car.spec = { ...car.spec, id: 'saloon-rwd#' + (slot + 1) };
  const pos = L.onTrack(sub, ((spawnDist - slot * 7) % total + total) % total, slot % 2 ? 3.2 : -3.2, {});
  reset(car, pos.x, pos.y, pos.rot);
  const drv = createAIDriver(L.LEVEL, aiTraits(2, slot, N, 7)); car.mods.power *= drv.traits.power ?? 1;
  field.push({ car, drv, slot, next: 60 });
}
const across = (x, y) => { const q = L.querySubtrack(sub, x, y), p = L.onTrack(sub, q.trackDist, 0, {});
  return { d: ((q.trackDist - spawnDist) % total + total) % total, a: (x - p.x) * Math.cos(p.rot + Math.PI / 2) + (y - p.y) * Math.sin(p.rot + Math.PI / 2) }; };
for (let t = 0; t < 14; t += DT) {
  for (const f of field) {
    L.barrierClamp(f.car); L.solidClamp(f.car); L.applyGround(f.car, DT);
    step(f.car, f.drv.drive(f.car, DT, { cars: field.filter((o) => o !== f).map((o) => o.car), lap: 1, laps: 3 }), DT);
    const w = across(f.car.x, f.car.y);
    if (f.slot === 0 && w.d >= f.next && w.d < 170) { f.next += 5;
      console.log(`#0 @${w.d.toFixed(0)}: across ${w.a.toFixed(1)}, aim ${(f.drv.state.dbgAim ?? NaN).toFixed(1)}, ${(Math.hypot(f.car.vx, f.car.vy) * 3.6).toFixed(0)} km/h, heading err`); }
  }
  for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) carContact(field[a].car, field[b].car);
}
