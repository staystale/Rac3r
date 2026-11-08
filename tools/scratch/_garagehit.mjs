// _garagehit.mjs - drive a car at 12 m/s square into the BACK of each garage row (from the track
// side) at three places along it; how far its centre gets past the back face (m). The garage is
// ~5 m deep (Brands) / 10 m (Thruston): past ~-2 m (the car's nose touching) it is inside.
import { initWorld, setLevel } from '../../src/world/load.ts';
import { LEVEL } from '../../src/world/state.ts';
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { barrierClamp } from '../../src/world/barriers.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
initWorld();
for (const id of ['brands-snatch', 'thruston']) {
  setLevel(id);
  const row = LEVEL.props.find((prop) => prop.kind === 'garagerow');
  const out = [];
  for (const share of [0.25, 0.5, 0.75]) {
    const i = Math.round((row.back.length - 1) * share), j = Math.min(row.front.length - 1, i);
    const [bx, by] = row.back[i], [fx, fy] = row.front[j];
    const len = Math.hypot(fx - bx, fy - by), nx = (fx - bx) / len, ny = (fy - by) / len;
    const car = makeCar('hatch-fwd');
    reset(car, bx - nx * 8, by - ny * 8, Math.atan2(ny, nx));
    car.vx = nx * 12; car.vy = ny * 12;
    let deepest = -99;
    for (let t = 0; t < 3; t += DT) {
      car.surface = SURFACES.tarmac;
      step(car, { steer: 0, throttle: 0.4, brake: 0, handbrake: 0 }, DT);
      barrierClamp(car);
      deepest = Math.max(deepest, (car.x - bx) * nx + (car.y - by) * ny);
    }
    out.push(deepest.toFixed(1));
  }
  console.log(`${id.padEnd(14)} depth ${row.front.length ? '' : ''}${Math.hypot(row.front[0][0] - row.back[0][0], row.front[0][1] - row.back[0][1]).toFixed(1)} m | car centre past the back face: ${out.join(' / ')} m`);
}
