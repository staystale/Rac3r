// _barrierend.mjs - A BARRIER'S END IS SOLID (owner 11-09: "wooden fence and other barriers can't be
// hit on the end ? They should and they should behave correctly", "it doesn't slow you with
// multiple hits on a wooden fence going straight and armco can go thru the car"; ?barrierends=1): a
// hatch driven straight at the end of a 100 m barrier along its line (and 0.5 m to each side), at
// each speed, stepped as the game steps a car; how deep the barrier's end got inside the car's
// body, the speed left after 1.5 s, how far along the barrier's line the car got.
// [BARRIERENDS=1] node tools/scratch/_barrierend.mjs
import * as L from '../../src/lab.ts';
import { makeCar, reset, step, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { rolling, tripCheck, stepRoll } from '../../src/roll.ts';
import { hit } from '../../src/damage.ts';

L.setLevel('lab');
const KMH = [30, 60, 100], SIDES = [0, 0.5, -0.5], LINE_Y = 600;
let dice = 12345;
Math.random = () => { dice = (Math.imul(dice, 1664525) + 1013904223) >>> 0; return dice / 4294967296; };
for (const kind of ['woodfence', 'armco', 'jersey', 'wall', 'catchfence']) {
  const rows = [];
  for (const kmh of KMH) {
    const row = [];
    for (const lat of SIDES) {
      // the barrier from x 0 to 100 along y = LINE_Y, a point every 4 m (as the roads lay them)
      const pts = [];
      for (let x = 0; x <= 100; x += 4) pts.push([x, LINE_Y]);
      const level = { barriers: [{ kind, pts }] };
      L.prepBarriers(level);
      const car = makeCar('hatch-fwd'), v = kmh / 3.6;
      reset(car, -12, LINE_Y + lat, 0);
      let deepest = 0, touched = false, left = v;
      for (let t = 0; t < 2.5; t += DT) {
        if (!touched) Object.assign(car, { vx: v, vy: 0, heading: 0, yawRate: 0 });
        const vx0 = car.vx, vy0 = car.vy;
        L.clampToBarriers(car, level.barriers);
        touched ||= car.vx !== vx0 || car.vy !== vy0 || car.x > -2;
        hit(car, vx0, vy0);
        L.applyGround(car, DT);
        if (rolling(car)) stepRoll(car, DT, () => {});
        else { step(car, { steer: 0, throttle: 0, brake: 0, handbrake: 0 }, DT); tripCheck(car, DT); }
        // the barrier's first point in the car's frame: inside its body by how much
        const relX = 0 - car.x, relY = LINE_Y - car.y, cos = Math.cos(car.heading),
          sin = Math.sin(car.heading), along = relX * cos + relY * sin, side = -relX * sin + relY * cos;
        const inside = Math.min(car.spec.len / 2 - Math.abs(along), car.spec.wid / 2 - Math.abs(side));
        deepest = Math.max(deepest, inside);
        if (Math.abs(t - 1.5) < DT / 2) left = Math.hypot(car.vx, car.vy);
      }
      row.push(`${deepest > 0 ? deepest.toFixed(2).padStart(5) + ' in' : ' out    '}`
        + ` ${String(Math.round(left * 3.6)).padStart(3)} km/h x${String(Math.round(car.x))
          .padStart(4)}`);
    }
    rows.push(`  ${String(kmh).padStart(3)} km/h: ${row.join(' | ')}`);
  }
  console.log(`${kind} - its end inside the car (m), speed at 1.5 s, the car's x at 2.5 s`
    + ` (end at 0, 100 m long); on the line / 0.5 m left / 0.5 m right:`);
  for (const row of rows) console.log(row);
}
