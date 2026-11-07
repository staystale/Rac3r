// _rollspark.mjs - a rolled car's sparks (roll.ts car.sparks): a roll on tarmac that lands back on
// its wheels (sparks must stop), and a roll that tumbles off the tarmac onto grass (none on the
// grass). Steps the roll alone (roll.ts stepRoll) and counts the steps sparking by where the car is.
// node tools/scratch/_rollspark.mjs
import * as L from '../../src/lab.ts';
import { makeCar, reset } from '../../src/vehicle.ts';
import { stepRoll } from '../../src/roll.ts';
import { groundAt } from '../../src/world/wear.ts';
L.setLevel('test-track');
const sub = L.LEVEL.subtrack, p = sub.pts[40];
for (const [name, side] of [['on the road', 0], ['rolling off onto the grass', 1]]) {
  const car = makeCar('hatch-fwd'); reset(car, p.x, p.y, p.heading);
  const nx = -Math.sin(p.heading), ny = Math.cos(p.heading);
  car.vx = side ? nx * 14 : Math.cos(p.heading) * 14; car.vy = side ? ny * 14 : Math.sin(p.heading) * 14;
  car.roll = { phase: 'rolling', phi: 0.1, w: 9, still: 0 };
  let hard = 0, soft = 0, after = 0;
  for (let k = 0; k < 120 * 6; k++) {
    if (car.roll) {
      stepRoll(car, 1 / 120, () => {});
      const surf = groundAt(car.x, car.y).surface;
      if (car.sparks) { if (surf?.hard) hard++; else soft++; }
    } else if (car.sparks) after++;
  }
  console.log(`${name.padEnd(28)}: sparking steps on hard ground ${hard}, on soft ground ${soft}, after it landed ${after} | ended ${car.roll ? car.roll.phase : 'on its wheels'}`);
}
