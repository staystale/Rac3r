// HOT BRAKE GLOW (owner's Q9: brake discs glowing when hot, at night). Each axle's
// brakes heat with the braking work - how hard the brakes are on times the speed, the fronts
// doing more of it - and cool toward the air, faster the faster the car goes (airflow), slowly
// enough that heat BUILDS: one hard stop only warms them, several close together make them glow
// (owner). The HANDBRAKE works the rear brakes alone, so a lot of it (or using it instead of the
// brakes) makes the rears glow (owner). Past GLOW_FROM the discs glow deep orange at their wheels
// in the night layer (render/light.ts), so only after dark. A look: the wall clock, never the sim.
import type { RenderCar } from './types.ts';

// heat per (m/s of speed x brake share) per second: the foot brake's front and rear shares, the
// handbrake's on the rears (MEASURED, tools/scratch/_brakeheat.mjs: full stops from 160 km/h
// every 10 s: the fronts glow from the 3rd (0.31, 0.53, 0.69); 2 s handbrake turns every 7 s:
// the rears from the 3rd, fronts never)
const HEAT_PER_MS = 0.0045, FRONT_SHARE = 1, REAR_SHARE = 0.55, HANDBRAKE_SHARE = 1;
// cooling: a share of the heat a second at rest, and more per m/s of speed
const COOL_PER_S = 0.01, COOL_PER_MS = 0.0008;
// heat at which the discs start to glow (full glow at 1), and the glow's radius, m
const GLOW_FROM = 0.5;
export const BRAKE_GLOW_M = 0.7;
// a frame gap longer than this (a pause, a hidden tab) is not counted, s
const MAX_GAP_S = 0.25;
export const BRAKE_GLOW = '255,96,24';

/** A car's brake heat: front and rear axles, 0..1, when it was last worked out (ms), and
 * the tyre temperatures it was worked out with (a reset gives the car new ones: brakes cold). */
interface BrakeHeat {
  front: number;
  rear: number;
  at: number;
  tyres: number[] | undefined;
}

const heats = new WeakMap<RenderCar, BrakeHeat>();

/**
 * A car's brake heat now (worked out once a frame, whoever asks first).
 * @param car the car
 * @param now the wall clock, ms
 * @returns its heat
 */
function heatOf(car: RenderCar, now: number): BrakeHeat {
  let heat = heats.get(car);
  if (!heat) {
    heat = { front: 0, rear: 0, at: now, tyres: car.tyreT };
    heats.set(car, heat);
  }
  // RESTART / RESET (vehicle.ts reset: new tyre temperatures) starts the brakes cold, as the tyres
  if (heat.tyres !== car.tyreT) Object.assign(heat, { front: 0, rear: 0, tyres: car.tyreT });
  const seconds = (now - heat.at) / 1000;
  if (seconds <= 0) return heat;
  heat.at = now;
  if (seconds > MAX_GAP_S) return heat;
  const speed = Math.hypot(car.vx, car.vy), work = HEAT_PER_MS * speed * seconds;
  const foot = Math.min(1, car.brakeLight || 0), hand = car.handbrakeOn ? 1 : 0;
  const cool = Math.min(1, (COOL_PER_S + COOL_PER_MS * speed) * seconds);
  heat.front = Math.min(1, heat.front + work * foot * FRONT_SHARE - heat.front * cool);
  heat.rear = Math.min(1, heat.rear + work * (foot * REAR_SHARE + hand * HANDBRAKE_SHARE)
    - heat.rear * cool);
  return heat;
}

/**
 * Each wheel whose brakes glow: its place on the car (ahead, to the +y side, m) and how much.
 * @param car the car
 * @returns the glowing wheels (none with cool brakes)
 */
export function hotBrakes(car: RenderCar): { along: number; across: number; level: number }[] {
  const heat = heatOf(car, performance.now()), out = [];
  const half = (car.spec.trackWidth || car.spec.wid * 0.8) / 2;
  for (const [along, axleHeat] of [[car.spec.lf, heat.front], [-car.spec.lr, heat.rear]]) {
    const level = (axleHeat - GLOW_FROM) / (1 - GLOW_FROM);
    if (level <= 0) continue;
    for (const across of [-half, half]) out.push({ along, across, level });
  }
  return out;
}
