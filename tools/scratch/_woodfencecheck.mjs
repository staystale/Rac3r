// _woodfencecheck.mjs - A WOODEN FENCE BREAKS (world/armcodent.ts woodfence; highway/medians.ts): a
// hatch driven square at a wooden fence, a chain-link fence and Armco at each speed; whether it
// tore through, what flew off, the speed it kept. node tools/scratch/_woodfencecheck.mjs
import * as L from '../../src/lab.ts';
import { makeCar, reset, step, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { takeFenceShreds } from '../../src/world/armcodent.ts';
import { hit } from '../../src/damage.ts';
L.setLevel('lab');
for (const kind of ['woodfence', 'catchfence', 'armco']) for (const kmh of [20, 30, 40, 60]) {
  const level = { barriers: [{ kind, pts: [[-50, 600], [50, 600]] }] };
  L.prepBarriers(level); takeFenceShreds();
  const car = makeCar('hatch-fwd'), v = kmh / 3.6, head = Math.PI / 2 * 0.8;
  reset(car, 0, 590, head); car.vx = Math.cos(head) * v; car.vy = Math.sin(head) * v;
  for (let t = 0; t < 2; t += DT) {
    const vx0 = car.vx, vy0 = car.vy;
    L.clampToBarriers(car, level.barriers); hit(car, vx0, vy0);
    step(car, { steer: 0, throttle: 0, brake: 0, handbrake: 0 }, DT);
  }
  const shreds = takeFenceShreds(), kinds = {};
  for (const bit of shreds) kinds[bit.kind] = (kinds[bit.kind] || 0) + 1;
  console.log(kind.padEnd(10), String(kmh).padStart(3), 'km/h:', car.y > 601 ? 'THROUGH' : 'held   ',
    'kept', (Math.hypot(car.vx, car.vy) * 3.6).toFixed(0), 'km/h, flew off', JSON.stringify(kinds));
}
