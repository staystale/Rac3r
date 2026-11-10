// game/resethazard.ts - A RESET PUTS THE HAZARDS ON (?resethazard=1; owner 11-10: "resets ...
// should put hazards on for 3 seconds"): the player's reset (game/session.ts doReset) and an AI
// car's (game/ai.ts aiReset, recoverAI) set the car's hazard lights going for RESET_HAZARD_S, on
// the wall clock as the indicators blink (render/cars.ts hazardsOn); a race's start places cars
// without.

// s a reset car's hazard lights blink
export const RESET_HAZARD_S = 3;

/**
 * Starts a reset car's hazard lights.
 * @param car the car
 * @param car.hazardUntil the wall-clock ms they blink until (set)
 */
export function hazardsAfterReset(car: { hazardUntil?: number }): void {
  car.hazardUntil = performance.now() + RESET_HAZARD_S * 1000;
}
