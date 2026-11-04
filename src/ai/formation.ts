// THE ROLLING START'S FORMATION (owner: "the cars weave sometimes oddly /
// crash before the race even starts / start off set including the player"). MEASURED
// (tools/scratch/_rollstart.mjs, Naffcar, 5 AI): before the green each AI drove its own RACE
// driver capped at the pace (its racing line, attack and cover moves) - cars left their columns
// by up to 5 m and closed to 0.26 m - and the player's car was driven to the centreline. Now the
// game drives every car the same way until the green: the scripted driver (autodrive.ts) along
// its grid column, at the pace car's speed, closing on its own slot behind the pole car.
import { querySubtrack } from '../world/tyrewall.ts';
import type { Subtrack } from '../world/types.ts';
import { roadFrame, roadPose } from '../highway.ts';
import { steerCap, steerDemand } from './steerLaw.ts';
import type { AiCar, DriveInput, HighwayLevel } from './types.ts';

// the speed to close on the slot: this many m/s per m of gap, at most FORM_SPREAD m/s either side
// of the pace
const FORM_GAIN = 0.4, FORM_SPREAD = 4;
// throttle and brake gains, per m/s off the target speed; the throttle stays gentle (a formation
// lap, as the old pace cap's 0.55)
const THROTTLE_GAIN = 0.5, THROTTLE_MAX = 0.55, BRAKE_GAIN = 0.4, BRAKE_MAX = 0.6;

/** A scripted driver (autodrive.ts) that can hold a column. */
interface ColumnDriver {
  drive: (car: AiCar, dt?: number, opts?: { offsetM?: number }) => DriveInput;
}

/** One car's place in the formation. */
export interface FormationPlace {
  columnM: number;    // its grid column, m across the road (game/grid.ts gridColumn)
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
  return { steer, ...slotPedals(car, gapM, paceMps), handbrake: 0 };
}

/**
 * The pedals that hold the pace and close on the slot.
 * @param car the car
 * @param gapM m to its slot (> 0: the slot is ahead)
 * @param paceMps the formation's speed, m/s
 * @returns throttle and brake
 */
function slotPedals(car: AiCar, gapM: number, paceMps: number) {
  const target = paceMps + Math.max(-FORM_SPREAD, Math.min(FORM_SPREAD, gapM * FORM_GAIN));
  const speed = Math.hypot(car.vx, car.vy);
  const throttle = speed < target ? Math.min(THROTTLE_MAX, (target - speed) * THROTTLE_GAIN) : 0;
  const brake = speed > target + 0.5 ? Math.min(BRAKE_MAX, (speed - target) * BRAKE_GAIN) : 0;
  return { throttle, brake };
}

/**
 * The HIGHWAY's formation (?oneai; owner 11-04: "rolling starts seem not to hold formation on
 * highways"): the same as a circuit's - its grid lane, at the pace, closing on its slot behind the
 * pole car - read along the road (it is built as you go: no lap to measure along), steered by the
 * one steering law (ai/steerLaw.ts). (Was: each racer's own race driver capped at the pace - the
 * circuit driver races for its line and gaps, so the formation broke up before the green.)
 * @param car the car
 * @param place its lane (m off the road's base line) and m behind the pole's slot
 * @param pole the pole car
 * @param level the highway
 * @param paceMps the formation's speed, m/s
 * @returns the controls, or null (off the road there is)
 */
export function roadFormationInput(car: AiCar, place: FormationPlace, pole: AiCar,
    level: HighwayLevel, paceMps: number): DriveInput | null {
  const half = car.spec.L / 2, cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const axle = roadFrame(level, car.x + cosH * half, car.y + sinH * half, car._hwf ? car._hwf.s
    : null);
  const poleAt = pole === car ? axle : roadFrame(level, pole.x, pole.y, pole._hwf ? pole._hwf.s
    : null);
  if (!axle || !poleAt) return null;
  const speed = Math.hypot(car.vx, car.vy), lock = car.spec.steerMax || 0.56;
  const ahead = roadPose(level, axle.s + 2 + speed * 0.15, place.columnM);
  let psi = ahead.h - car.heading;
  psi = Math.atan2(Math.sin(psi), Math.cos(psi));
  const demand = steerDemand(psi, axle.off - place.columnM, speed, car.yawRate, car.delta,
    car.spec.L);
  const cap = steerCap(car.spec.L, (car.spec.mu || 1) * (car.surface.mu || 1), speed, lock);
  const steer = Math.max(-cap, Math.min(cap, demand / lock));
  return { steer, ...slotPedals(car, poleAt.s - place.backM - (axle.s - half), paceMps),
    handbrake: 0 };
}
