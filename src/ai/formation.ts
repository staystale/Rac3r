// THE ROLLING START'S FORMATION (A3, ?formation=1; owner: "the cars weave sometimes oddly /
// crash before the race even starts / start off set including the player"). MEASURED
// (tools/scratch/_rollstart.mjs, Naffcar, 5 AI): before the green each AI drove its own RACE
// driver capped at the pace (its racing line, attack and cover moves) - cars left their columns
// by up to 5 m and closed to 0.26 m - and the player's car was driven to the centreline. Now the
// game drives every car the same way until the green: the scripted driver (autodrive.ts) along
// its grid column, at the pace car's speed, closing on its own slot behind the pole car.
import { querySubtrack } from '../world/tyrewall.ts';
import type { Subtrack } from '../world/types.ts';
import type { AiCar, DriveInput } from './types.ts';

// the speed to close on the slot: this many m/s per m of gap, at most FORM_SPREAD m/s either side
// of the pace
const FORM_GAIN = 0.4, FORM_SPREAD = 4;
// throttle and brake gains, per m/s off the target speed; the throttle stays gentle (a formation
// lap, as the old pace cap's 0.55)
const THROTTLE_GAIN = 0.5, THROTTLE_MAX = 0.55, BRAKE_GAIN = 0.4, BRAKE_MAX = 0.6;

// ?formation=1: the game drives every car in formation until the green
let isFormationOn = false;

/**
 * Turns the formation on or off (?formation=1).
 * @param isOn true for the formation
 */
export function setFormation(isOn: boolean): void {
  isFormationOn = isOn;
}

/** Whether the rolling start drives every car in formation (?formation=1). */
export function formationOn(): boolean {
  return isFormationOn;
}

/** A scripted driver (autodrive.ts) that can hold a column. */
interface ColumnDriver {
  drive: (car: AiCar, dt?: number, opts?: { offsetM?: number }) => DriveInput;
}

/** One car's place in the formation. */
export interface FormationPlace {
  columnM: number;    // its grid column, m across the road (game/grid.js gridColumn)
  backM: number;      // how far behind the pole car its slot is, m
}

/**
 * A car's controls in the formation: along its column, at the pace, closing on its slot.
 * @param car the car
 * @param driver its scripted driver (its own: the driver keeps the car's progress)
 * @param place its column and slot
 * @param pole the pole car (the front of the formation)
 * @param sub the lap
 * @param paceMps the formation's speed, m/s
 * @returns the controls
 */
export function formationInput(car: AiCar, driver: ColumnDriver, place: FormationPlace,
    pole: { x: number; y: number }, sub: Subtrack, paceMps: number): DriveInput {
  const steer = driver.drive(car, 0, { offsetM: place.columnM }).steer;
  const total = sub.totalDist;
  const myDist = querySubtrack(sub, car.x, car.y).trackDist;
  const slotDist = querySubtrack(sub, pole.x, pole.y).trackDist - place.backM;
  let gapM = slotDist - myDist;
  gapM -= Math.round(gapM / total) * total;
  const target = paceMps + Math.max(-FORM_SPREAD, Math.min(FORM_SPREAD, gapM * FORM_GAIN));
  const speed = Math.hypot(car.vx, car.vy);
  const throttle = speed < target ? Math.min(THROTTLE_MAX, (target - speed) * THROTTLE_GAIN) : 0;
  const brake = speed > target + 0.5 ? Math.min(BRAKE_MAX, (speed - target) * BRAKE_GAIN) : 0;
  return { steer, throttle, brake, handbrake: 0 };
}
