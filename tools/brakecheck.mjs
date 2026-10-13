// "Normal braking at high speeds still produces the handbrake bug."
// Brake HARD from high speed with the steering held — the realistic phone input — and check the car
// does not spin itself backwards. The foot brake locks the rear through the same path the handbrake
// does, so it needs its own regression test.
import { makeCar, step, reset, neutralInput, DT } from '../src/vehicle.js';
import { CAR_IDS } from '../src/cars.ts';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

function run(id, v0, steer) {
  const car = makeCar(id); reset(car,0,0,0);
  car.vx = v0; car.gear = Math.min(5, car.spec.gears.length); car.rpm = 6000;
  const inp = { ...neutralInput() };
  let peak=0, minV=99, held=0;
  for (let i=0;i<120*8;i++){
    const t=i*DT;
    // progressive brake exactly as input.js ramps it, held down throughout
    held += DT;
    inp.brake = Math.min(1, 0.28 + 0.72*(held/0.50));
    inp.steer = steer;
    step(car,inp,DT);
    // ONLY while actually moving. At the end of a stop, atan2 of two near-zero velocities is noise —
    // it reported 179 deg of "spin" for a car braking almost straight, which is how this bench lied.
    if (Math.hypot(car.vx,car.vy) > 3) {
      peak=Math.max(peak,Math.abs(Math.atan2(car.t.vLat,car.t.vLong)*57.3));
      minV=Math.min(minV,car.t.vLong);
    }
    if (Math.hypot(car.vx,car.vy) < 0.5) break;
  }
  return { peak, minV };
}
for (const steer of [0.9, 0.5]) {
  console.log(`\n--- braking flat out with the wheel held at ${steer}`);
  console.log('car             35 m/s          45 m/s          55 m/s');
  for (const id of CAR_IDS) {
    const cells = [35,45,55].map(v => {
      const r = run(id, v, steer);
      return `${r.peak.toFixed(0).padStart(3)}deg ${r.minV<-0.5?'BACK ':' ok  '}`.padEnd(16);
    });
    console.log(`${id.padEnd(13)} ${cells.join('')}`);
  }
}
