// REVERSING LIGHTS (?reverselights=1; owner: "reverse lights on cars"): every car in reverse gear
// (vehicle.ts gear -1: you, the AI, traffic) lights two white lamps at its tail, inside the tail
// lights - drawn on the car by day and night (render/cars.ts), and after dark a white glow at
// each and a short soft beam behind the car (render/light.ts). A broken rear corner's lamp
// stays dark (damage.js lampLevel, as every lamp).
import type { RenderCar } from './types.ts';

// the reversing beam: its reach and half spread, m, and how much of the dark it rubs out at its
// brightest (a headlight's is 32 m, 9 m, 0.6: reversing lamps are small and dim)
export const REVERSE_BEAM_REACH_M = 8, REVERSE_BEAM_HALF_M = 3.5, REVERSE_BEAM_STRENGTH = 0.35;
// the lamps' colour on the car (a cool white) and in the night's glow ('r,g,b')
export const REVERSE_LAMP = '#eef3ff', REVERSE_GLOW = '235,242,255';
// each lamp's sideways offset as a share of the car's half width (the tail lights sit at 0.7)
export const REVERSE_SIDE_SHARE = 0.4;

let isOn = false;

/**
 * Turns the reversing lights on or off (?reverselights=1).
 * @param isWanted true for reversing lights
 */
export function setReverseLights(isWanted: boolean): void {
  isOn = isWanted;
}

/**
 * Whether a car's reversing lights are lit: it is in reverse gear.
 * @param car the car
 * @returns true while reversing
 */
export function isReversing(car: RenderCar): boolean {
  return isOn && car.gear === -1;
}
