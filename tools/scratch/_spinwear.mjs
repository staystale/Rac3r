// _spinwear.mjs - A7 (owner: "check all surfaces degrade slightly faster with wheel spinning /
// locking up brakes; rolling / normal driving should degrade at normal speed"): the slip speed the
// ground wear reads (vehicle.ts telemetry slipSpeedF / R; wear.ts counts a pass twice above
// SLIDE_WEAR_MIN = 4 m/s) for rolling, full-throttle wheelspin from rest and a locked brake, on the
// Test Track's tarmac and on the grass beside it. node tools/scratch/_spinwear.mjs [car]
import * as L from '../../src/lab.js';
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';

const carId = process.argv[2] || 'hatch-rwd';
L.setLevel('test-track');
const sub = L.LEVEL.subtrack;
const spots = { tarmac: L.onTrack(sub, 100, 0, {}), grass: L.onTrack(sub, 100, sub.width / 2 + 12, {}) };
const runs = {
  rolling: { v0: 15, input: { steer: 0, throttle: 0.25, brake: 0, handbrake: 0 }, secs: 2 },
  wheelspin: { v0: 0, input: { steer: 0, throttle: 1, brake: 0, handbrake: 0 }, secs: 2 },
  locked: { v0: 20, input: { steer: 0, throttle: 0, brake: 1, handbrake: 0 }, secs: 1.5 },
  handbrake: { v0: 15, input: { steer: 0.3, throttle: 0, brake: 0, handbrake: 1 }, secs: 1.5 },
  'hb-straight': { v0: 15, input: { steer: 0, throttle: 0, brake: 0, handbrake: 1 }, secs: 1.5 },
  turn: { v0: 15, input: { steer: 0.3, throttle: 0.25, brake: 0, handbrake: 0 }, secs: 1.5 },
};
for (const [where, spot] of Object.entries(spots)) {
  for (const [name, run] of Object.entries(runs)) {
    const car = makeCar(carId);
    reset(car, spot.x, spot.y, spot.rot);
    car.vx = Math.cos(spot.rot) * run.v0;
    car.vy = Math.sin(spot.rot) * run.v0;
    let maxF = 0, maxR = 0, slideSteps = 0, steps = 0;
    const startT = [...(car.tyreT || [0, 0, 0, 0])];
    for (let t = 0; t < run.secs; t += DT) {
      L.applyGround(car, DT);
      step(car, run.input, DT);
      const front = car.t.slipSpeedF || 0, rear = car.t.slipSpeedR || 0;
      maxF = Math.max(maxF, front);
      maxR = Math.max(maxR, rear);
      if (front > 4 || rear > 4) slideSteps++;
      steps++;
    }
    console.log(`${where.padEnd(6)} ${name.padEnd(9)} ${car.surface.id.padEnd(10)} slip max F`
      + ` ${maxF.toFixed(1)} R ${maxR.toFixed(1)} m/s; sliding ${(100 * slideSteps
      / steps).toFixed(0)} %; tyres F +${(car.tyreT[0] - startT[0]).toFixed(1)}`
      + ` R +${(car.tyreT[2] - startT[2]).toFixed(1)} C from ${startT[0].toFixed(0)} C`);
  }
}
