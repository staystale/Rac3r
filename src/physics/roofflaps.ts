// physics/roofflaps.ts - ROOF FLAPS (owner 11-08 on the Naffcar extras, roadmap G "active
// airbrakes / cowl flaps": "Ok and real no button"). A stock car's two roof flaps lie flush until
// the car turns round in the air stream: the real ones are passive, hinged at their front - a car
// going backwards draws the air over its roof the wrong way and the low pressure pops them up -
// to kill the roof's lift (so it does not take off) and scrub its speed. Here: open once the car
// points ROOF_OPEN or more off the way it travels at ROOF_V or faster, shut again (after HOLD_S)
// within ROOF_SHUT or under ROOF_SLOW. Our aero has no lift going backwards (physics/loads.ts
// keeps the downforce whichever way the car travels - nothing takes off), so what they do here is:
// their DRAG, along the way it travels (two flaps of ~0.125 m^2 standing square, Cd 1.2).
// car.flaps 0..1 (up in OPEN_S, down in SHUT_S) for render/cars.ts. The Naffcar; behind
// ?roofflaps=1.
import { FIX } from '../core/fixes.ts';
import { dragOf } from '../realcars.ts';

const ROOF_CARS = new Set(['naffcar']);
// (owner 11-08 "not seeing ... flaps": 140 deg at 25 m/s was rarely met in a spin - the car slows
// as it comes round - and they fell at once; now from 130 deg at 20 m/s, held up at least HOLD_S)
const ROOF_OPEN = (130 * Math.PI) / 180, ROOF_SHUT = (100 * Math.PI) / 180, ROOF_V = 20,
  ROOF_SLOW = 8;
const OPEN_S = 0.12, SHUT_S = 0.6, HOLD_S = 1, FLAP_DRAG = dragOf(1.2, 0.25);

/** A car as its roof flaps read and slow it. */
interface FlapCar {
  vx: number; vy: number; heading: number; spec: { id?: string; mass: number };
  flaps?: number; flapsHeld?: number;
}

/**
 * Whether a car has roof flaps.
 * @param car the car
 * @returns true for a stock car (the switch on)
 */
export const hasRoofFlaps = (car: { spec: { id?: string } }) => FIX.roofflaps
  && ROOF_CARS.has(String(car.spec.id || '').split('#')[0]);

/**
 * One step of a car's roof flaps: up when it travels backwards fast, down as it comes round or
 * slows; standing, their drag on its way.
 * @param car the car
 * @param dt s
 */
export function roofFlapStep(car: FlapCar, dt: number): void {
  if (!hasRoofFlaps(car)) return;
  const speed = Math.hypot(car.vx, car.vy);
  let off = Math.abs(Math.atan2(car.vy, car.vx) - car.heading) % (2 * Math.PI);
  if (off > Math.PI) off = 2 * Math.PI - off;
  const open = car.flaps ?? 0,
    want = open > 0.5 ? off > ROOF_SHUT && speed > ROOF_SLOW : off > ROOF_OPEN && speed > ROOF_V;
  // once up they stay up HOLD_S (the air under them as the car comes round)
  car.flapsHeld = want ? HOLD_S : Math.max(0, (car.flapsHeld ?? 0) - dt);
  car.flaps = want || car.flapsHeld > 0 ? Math.min(1, open + dt / OPEN_S)
    : Math.max(0, open - dt / SHUT_S);
  if (!car.flaps || speed < 0.1) return;
  const slow = Math.min(speed, (FLAP_DRAG * car.flaps * speed * speed / car.spec.mass) * dt);
  car.vx -= (car.vx / speed) * slow;
  car.vy -= (car.vy / speed) * slow;
}
