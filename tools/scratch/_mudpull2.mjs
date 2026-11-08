// _mudpull2.mjs - like _mudpull, but the BEST launch (throttle 1 .. 0.3, held to 50 km/h): a
// driver feathers in mud. 0-50 and the speed after 10 s at the best cap. GRADE=0.08 for a hill.
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
import { applyTyre } from '../../src/cars.ts';
const GRADE = +(process.env.GRADE || 0), TYRE = process.env.TYRE || '';
const cars = (process.argv[2] || 'wrz-awd,estate-4x4,hatch-fwd,hatch-rwd,muscle-rwd,mini-fwd').split(',');
const run = (id, surf, cap) => {
  const c = makeCar(id); if (TYRE) applyTyre(c.spec, TYRE); reset(c, 0, 0, 0); c.tyreT = [60, 60, 60, 60];
  let t50 = null, v10 = 0;
  for (let t = 0; t < 10; t += DT) {
    c.surface = SURFACES[surf]; c.slopeLong = -c.spec.mass * 9.81 * Math.sin(Math.atan(GRADE));
    step(c, { steer: 0, throttle: cap, brake: 0, handbrake: 0 }, DT);
    if (t50 === null && c.t.vLong >= 13.89) t50 = t;
    v10 = c.t.vLong;
  }
  return { t50, v10 };
};
for (const id of cars) {
  const row = [];
  for (const surf of ['dirt', 'mud', 'thickMud']) {
    let best = null;
    for (const cap of [1, 0.8, 0.6, 0.45, 0.3]) {
      const r = run(id, surf, cap);
      if (!best || (r.t50 ?? 99) < (best.t50 ?? 99) || (r.t50 === null && best.t50 === null && r.v10 > best.v10)) best = { ...r, cap };
    }
    row.push(`${surf} ${best.t50 === null ? 'never' : best.t50.toFixed(1) + 's'} / ${Math.round(best.v10 * 3.6)}`);
  }
  console.log(id.padEnd(12), row.join(' | '));
}
