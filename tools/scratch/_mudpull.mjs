// _mudpull.mjs - flat ground, a standing start flat out (TCS as fitted): time to 50 km/h and the
// speed after 10 s, on dirt / mud / thick mud, per car. The ploughing drag is the suspect.
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
const GRADE = +(process.env.GRADE || 0);   // a hill: the slope's pull, as world/wear.ts sets it
const cars = (process.argv[2] || 'wrz-awd,estate-4x4,rally-4x4,hatch-fwd,hatch-rwd,muscle-rwd,mini-fwd').split(',');
for (const id of cars) {
  const row = [];
  for (const surf of ['dirt', 'mud', 'thickMud']) {
    const c = makeCar(id); reset(c, 0, 0, 0); c.tyreT = [60, 60, 60, 60];
    let t50 = null, v10 = 0;
    for (let t = 0; t < 10; t += DT) {
      c.surface = SURFACES[surf]; c.slopeLong = -c.spec.mass * 9.81 * Math.sin(Math.atan(GRADE)); step(c, { steer: 0, throttle: 1, brake: 0, handbrake: 0 }, DT);
      if (t50 === null && c.t.vLong >= 13.89) t50 = t;
      v10 = c.t.vLong;
    }
    row.push(`${surf} 0-50 ${t50 === null ? 'never' : t50.toFixed(1) + 's'} / ${Math.round(v10 * 3.6)} km/h at 10 s`);
  }
  console.log(id.padEnd(12), row.join(' | '));
}
