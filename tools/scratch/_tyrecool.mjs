// _tyrecool.mjs (node tools/scratch/_tyrecool.mjs) - T3 measured, ?tyrecool off vs on: the tyres
// after 120 s of hard cornering at ~60 km/h and of cruising at 150 km/h, on a hot day (track 45 C,
// air 28 C) and a cold one (track 4 C, air -3 C); and a puddle's passes to clear and driven ice's
// chance to break by tyre temperature.
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/lab.js';
const Wx = await import('../../src/world/weather.ts');
const cool = await import('../../src/physics/tyrecool.ts');
const P = await import('../../src/world/puddles.ts');
const run = (secs, control, setup) => {
  const car = makeCar('hatch-rwd'); reset(car, 0, 0, 0); setup(car);
  for (let i = 0; i < secs / PHYSICS_STEP_SECONDS; i++) {
    car.surface = SURFACES.tarmac; step(car, control(car), PHYSICS_STEP_SECONDS);
  }
  return car.tyreT.map((t) => t.toFixed(0)).join('/');
};
const corner = (c) => ({ steer: 0.12, throttle: Math.hypot(c.vx, c.vy) < 17 ? 0.5 : 0, brake: 0 });
const cruise = (c) => ({ steer: 0, throttle: Math.hypot(c.vx, c.vy) < 41.7 ? 0.8 : 0, brake: 0 });
for (const [day, trackC, airC] of [['hot', 45, 28], ['cold', 4, -3]]) {
  for (const on of [false, true]) {
    cool.setTyreCool(on);
    Object.assign(Wx.WEATHER, { trackC, tempC: airC });
    const startT = (c) => { c.tyreT = [trackC, trackC, trackC, trackC]; };
    console.log(`${day} day (track ${trackC}, air ${airC}) tyrecool ${on ? 'ON ' : 'off'}: `
      + `120 s cornering ${run(120, corner, (c) => { c.vx = 17; startT(c); })} | `
      + `120 s at 150 km/h ${run(120, cruise, (c) => { c.vx = 41.7; startT(c); })}`);
  }
}
P.setWeatherPuddles(true);
for (const on of [false, true]) {
  cool.setTyreCool(on);
  const passes = (tyreC) => Math.ceil(1 / P.puddleClearBy(true, tyreC) - 1e-9);
  console.log(`tyrecool ${on ? 'ON ' : 'off'}: passes to clear a puddle at 20 / 70 / 100 C: `
    + `${passes(20)} / ${passes(70)} / ${passes(100)}`);
}
