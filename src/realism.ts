// realism.ts - K13 REALISM DIALS under test (owner 11-02: "ok" to the measured table). Each dial
// runs 0 (the game as it is) to 1 (a typical real car of each kind), for the owner to tune on
// the phone: ?realbrake= ?reallock= ?realgrip= ?realpower= (0..1). On the owner's pick the values
// are written into the roster (cars.ts) and this file is deleted (one system).
import { dialAtLoad, FIX } from './core/fixes.ts';
import type { RosterRow } from './cars.ts';

/** The dials, 0 = now, 1 = real. */
export const DIAL = {
  brake: dialAtLoad('realbrake'),   // front brake share toward a real 0.65 (single-seaters 0.60)
  lock: dialAtLoad('reallock'),     // a locked / spinning tyre's grip toward a real 0.70 of peak
  grip: dialAtLoad('realgrip'),     // tyre mu toward each car's real cornering g
  power: dialAtLoad('realpower'),   // torque and drag toward each car's real power and body
};

// Measured 11-02 (main 0e68d60: carstats gripG at 60 km/h, peak hp off the torque curve) against
// a typical real car of the kind (rounded published figures; drag = 0.5 x rho x Cd x A).
// [game g, real g, game hp, real hp, real drag]
const REAL: Record<string, [number, number, number, number, number]> = {
  'hatch-fwd': [1.42, 0.95, 345, 245, 0.42], 'hatch-rwd': [1.40, 0.97, 345, 340, 0.42],
  'saloon-rwd': [1.43, 1.00, 548, 480, 0.40], 'wrz-awd': [1.46, 0.95, 564, 300, 0.48],
  'estate-4x4': [1.38, 0.92, 349, 350, 0.46], 'muscle-rwd': [1.36, 0.95, 1653, 450, 0.60],
  'rally-4x4': [1.54, 1.10, 662, 500, 0.48], 'track-rwd': [1.80, 1.80, 818, 1000, 0.90],
  'naffcar': [1.59, 1.40, 2438, 670, 0.54], 'tractor': [1.28, 0.70, 1441, 350, 2.9],
  'mini-fwd': [1.39, 0.80, 126, 76, 0.41], 'lambo-awd': [1.57, 1.08, 1078, 610, 0.43],
  'mikra-r1': [1.43, 1.00, 189, 120, 0.44], 'kit-2l': [1.47, 1.15, 562, 280, 0.44],
  'rx-super': [1.54, 1.20, 1005, 600, 0.60], 'banger-f2': [1.36, 1.00, 392, 200, 0.66],
  'grass-special': [1.41, 1.10, 372, 300, 0.65], 'drift-s13': [1.39, 1.05, 663, 600, 0.42],
  'f2-rwd': [1.71, 1.80, 657, 620, 0.66],
};
const BIAS_REAL = 0.65, BIAS_REAL_SINGLE = 0.60;
// ?muscle6=1: the muscle car's real-style 6-speed (a Mustang GT's is too): the same first three
// and a 1.00 fourth, then two overdrives. On 4 gears its 4th at the redline capped it at 205 km/h.
const MUSCLE_6 = [2.66, 1.78, 1.30, 1.00, 0.80, 0.63];
/** A locked or spinning tyre's grip as a share of its peak on dry tarmac, real. */
export const LOCK_REAL = 0.70;

const mix = (from: number, goal: number, dial: number) => from + (goal - from) * dial;

/**
 * How far the car's tyre grip is scaled by ?realgrip (1 = as now).
 * @param carId the car
 * @returns the grip factor
 */
export function realGripK(carId: string): number {
  const row = REAL[carId];
  return row && DIAL.grip ? mix(1, row[1] / row[0], DIAL.grip) : 1;
}

/**
 * The dials applied to a car's spec as it is built (cars.ts spec): a no-op with all dials at 0.
 * @param out the spec, changed in place (its torque curve replaced, never the roster's)
 */
export function applyRealism(out: RosterRow): void {
  const row = REAL[out.id];
  if (FIX.muscle6 && out.id === 'muscle-rwd') out.gears = MUSCLE_6;
  if (DIAL.brake) {
    out.brakeBiasF = mix(out.brakeBiasF, out.cls === 'single' ? BIAS_REAL_SINGLE : BIAS_REAL,
      DIAL.brake);
  }
  if (!row) return;
  if (DIAL.grip) out.mu *= realGripK(out.id);
  if (DIAL.power) {
    const torqueK = mix(1, row[3] / row[2], DIAL.power);
    out.curve = out.curve.map(([rpm, torque]) => [rpm, torque * torqueK] as [number, number]);
    out.dragC = mix(out.dragC, row[4], DIAL.power);
  }
}
