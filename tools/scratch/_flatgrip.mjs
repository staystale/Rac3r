import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
sub('src/core/fixes.ts', `  smokeOver: atLoad('smokeover'),
};`, `  smokeOver: atLoad('smokeover'),
  // ?heatease=1: tyres heat 15 % slower from slip and flex (tyreheat.ts)
  heatEase: atLoad('heatease'),
  // ?flatgrip=1: a flat tyre keeps most of its grip, the axle averages its two tyres, and the
  // flat wheel drags its own side (tyrepressure.ts, vehicle.ts)
  flatGrip: atLoad('flatgrip'),
};`);
// ---- heat
const H = 'src/physics/tyreheat.ts';
sub(H, `import { wearTyres } from './tyrewear.ts';`, `import { wearTyres } from './tyrewear.ts';
import { FIX } from '../core/fixes.ts';`);
sub(H, `  const heatScale = (car.surface.heatK ?? 1)
      * (car.surface.hard && carSpec.tyre ? carSpec.tyre.heatHard || 1 : 1);`,
`  const heatScale = (car.surface.heatK ?? 1)
      * (car.surface.hard && carSpec.tyre ? carSpec.tyre.heatHard || 1 : 1)
      * (FIX.heatEase ? HEAT_EASE : 1);`);
sub(H, `// the temperature the tyres cool toward this step,`, `// ?heatease=1 (owner 11-02: "tyres maybe heat up a tiny bit too easily"): slip and flex heat x
// HEAT_EASE; cooling as before
const HEAT_EASE = 0.85;
// the temperature the tyres cool toward this step,`);
// ---- pressure
const T = 'src/physics/tyrepressure.ts';
sub(T, `import { wheelGone } from '../world/wheels.ts';`, `import { wheelGone } from '../world/wheels.ts';
import { FIX } from '../core/fixes.ts';`);
sub(T, `const GRAVITY = 9.81;`, `const GRAVITY = 9.81;
// ?flatgrip=1 (owner 11-02: "when punctured and flat but still rubber there, a tyre should be
// nearly as grippy although not quite but it should create a reasonable amount of drag on that
// side / currently it seems even one puncture make the whole axel slippy"; the muscle car could
// hardly pull away on one flat rear). A flat tyre keeps FLAT_GRIP_REAL of its grip, an axle's grip
// is the MEAN of its two tyres (was the softer one's), and a flat wheel / a rim drags at its own
// corner with a rolling coefficient of CRR_FLAT / CRR_RIM of that wheel's static load (a good
// tyre ~0.015): the drag slows the car and, being one side, turns it toward the flat
// (vehicle.ts). The symmetric DRAG_FLAT / DRAG_RIM are left out under it.
const FLAT_GRIP_REAL = 0.9, CRR_FLAT = 0.12, CRR_RIM = 0.18;`);
sub(T, `function tyreGrip(pressure: number, isOnRim: boolean): number {
  return isOnRim ? RIM_GRIP : 1 - (1 - FLAT_GRIP) * (1 - pressure);
}`, `function tyreGrip(pressure: number, isOnRim: boolean): number {
  const flat = FIX.flatGrip ? FLAT_GRIP_REAL : FLAT_GRIP;
  return isOnRim ? RIM_GRIP : 1 - (1 - flat) * (1 - pressure);
}`);
sub(T, `/** What the tyres' air adds to car.wreck. */
export interface PressureWreck { gripF: number; gripR: number; toe: number; roll: number }`,
`/**
 * What the tyres' air adds to car.wreck. flatDrag / flatYaw (?flatgrip): the soft wheels' extra
 * rolling coefficients summed, and summed by side (+y +), each a share of one wheel's load.
 */
export interface PressureWreck {
  gripF: number; gripR: number; toe: number; roll: number; flatDrag: number; flatYaw: number;
}`);
sub(T, `  let toe = car.tyreKick || 0, roll = 0;
  for (let corner = 0; corner < 4; corner++) {
    if (wheelGone(car, corner)) continue;
    const soft = 1 - pressure[corner], side = corner % 2 ? 1 : -1;
    toe += (corner < 2 ? PULL_FRONT : PULL_REAR) * side * soft;
    roll += rim[corner] ? DRAG_RIM : DRAG_FLAT * soft;
  }
  return { gripF: Math.min(grip[0], grip[1]), gripR: Math.min(grip[2], grip[3]), toe, roll };`,
`  let toe = car.tyreKick || 0, roll = 0, flatDrag = 0, flatYaw = 0;
  for (let corner = 0; corner < 4; corner++) {
    if (wheelGone(car, corner)) continue;
    const soft = 1 - pressure[corner], side = corner % 2 ? 1 : -1;
    toe += (corner < 2 ? PULL_FRONT : PULL_REAR) * side * soft;
    if (!FIX.flatGrip) { roll += rim[corner] ? DRAG_RIM : DRAG_FLAT * soft; continue; }
    const crr = rim[corner] ? CRR_RIM : CRR_FLAT * soft;
    flatDrag += crr;
    flatYaw += crr * side;
  }
  const axle = FIX.flatGrip ? (left: number, right: number) => (left + right) / 2 : Math.min;
  return { gripF: axle(grip[0], grip[1]), gripR: axle(grip[2], grip[3]), toe, roll, flatDrag,
    flatYaw };`);
// ---- damage derive
const D = 'src/damage.ts';
sub(D, `    roll: 1 + 4 * (offF + offR) + air.roll,
  };`, `    roll: 1 + 4 * (offF + offR) + air.roll,
    flatDrag: air.flatDrag, flatYaw: air.flatYaw,
  };`);
// ---- vehicle
const V = 'src/vehicle.ts';
sub(V, `export interface CarWreck {
  toe: number; power: number; roll: number; gripF: number; gripR: number;
}`, `export interface CarWreck {
  toe: number; power: number; roll: number; gripF: number; gripR: number;
  // ?flatgrip: soft wheels' rolling drag, total and by side (shares of one wheel's static load)
  flatDrag?: number; flatYaw?: number;
}`);
sub(V, `  const roll = vLongAbs < 0.05 ? 0
      : -carSpec.rollC * mass * gravity * dirSign * (car.wreck ? car.wreck.roll : 1);`,
`  const roll = vLongAbs < 0.05 ? 0
      : -carSpec.rollC * mass * gravity * dirSign * (car.wreck ? car.wreck.roll : 1)
        - flatForce(car, mass, gravity, vLongAbs) * dirSign * (car.wreck?.flatDrag || 0);`);
sub(V, `/**
 * Force sum of step:`, `/**
 * One wheel's static load (N) as the flat wheels' drag reads it (?flatgrip), faded in over the
 * first 1 m/s so a car at rest is not pushed.
 * @param car the car
 * @param mass its mass, kg
 * @param gravity g
 * @param vLongAbs its speed along itself, m/s
 * @returns N per unit of rolling coefficient
 */
function flatForce(car: Car, mass: number, gravity: number, vLongAbs: number): number {
  return car.wreck?.flatDrag ? mass * gravity / 4 * Math.min(1, vLongAbs) : 0;
}

/**
 * Force sum of step:`);
sub(V, `      * rearAxle.Fy + aeroYaw + carSpec.lf * FpyF - carSpec.lr * FpyR + escMz + (car.slopeYaw || 0);`,
`      * rearAxle.Fy + aeroYaw + carSpec.lf * FpyF - carSpec.lr * FpyR + escMz + (car.slopeYaw || 0)
      + flatYawMoment(car, carSpec, vLong);`);
sub(V, `function integrateYaw(`, `/**
 * The yaw moment of the flat wheels' one-sided drag (?flatgrip): drag at the +y side turns the
 * car toward +y going forward (and the other way reversing).
 * @param car the car
 * @param carSpec its spec
 * @param vLong its speed along itself, m/s
 * @returns N m
 */
function flatYawMoment(car: Car, carSpec: Spec, vLong: number): number {
  const yaw = car.wreck?.flatYaw;
  if (!yaw) return 0;
  const vLongAbs = Math.abs(vLong);
  return Math.sign(vLong) * yaw * flatForce(car, carSpec.mass * car.mods.mass, GRAVITY, vLongAbs)
    * (carSpec.trackWidth || 1.5) / 2;
}

function integrateYaw(`);
console.log('ok');
