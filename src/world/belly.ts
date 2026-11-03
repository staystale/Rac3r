// world/belly.ts - GROUND CLEARANCE in soft ground (?belly): how deep a car's underside is in
// the ground, from what it sinks into and the ruts its wheels run in (world/wear.ts sets
// car.bellyDepth each step; physics/tyres.ts drags it).
import { rutAt } from "./wear.ts";
import type { CarBody } from "./types.ts";

// ?belly (owner 11-03: "can suspension travel / ground clearance affect mud's drag?"): a car SINKS
// into soft ground by BELLY_SINK (the wheels' contact under its top), and further by the ruts its
// wheels run in, against the ground between them (the ridge, sampled at the centre). What that
// takes past its ride height (spec.rideH) is its UNDERSIDE in the ground: physics/tyres.ts
// drags it.
// Suspension travel, when it comes, will take clearance away as the springs squat.
const BELLY_SINK: Record<string, number> = { mud: 0.08, thickMud: 0.16, sand: 0.07 };

/**
 * How deep the car's underside is in the ground (?belly), m.
 * @param car the car body
 * @param cosH cos of the car heading
 * @param sinH sin of the car heading
 * @returns m (0: clear)
 */
export function bellyDepth(car: CarBody, cosH: number, sinH: number): number {
  const sink = BELLY_SINK[car.surface ? car.surface.id : ''] || 0;
  const spec = car.spec, hw2 = (spec.trackWidth || 1.5) / 2;
  let ruts = 0;
  for (const [axleX, side] of [[spec.lf, 1], [spec.lf, -1], [-spec.lr, 1], [-spec.lr, -1]]) {
    ruts += rutAt(car.x + cosH * axleX - sinH * hw2 * side,
      car.y + sinH * axleX + cosH * hw2 * side) / 4;
  }
  const ridge = ruts - rutAt(car.x, car.y);
  return Math.max(0, sink + Math.max(0, ridge) - (spec.rideH ?? 0.14));
}
