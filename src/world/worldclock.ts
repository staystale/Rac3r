// world/worldclock.ts - THE WORLD'S SIM CLOCK: seconds of simulation, advanced
// once per physics step of the player's car (game/sim.ts), for the world's own movers that cars
// can meet - a rail bridge's train (world/trains.ts) - so the physics and the drawing read the
// one time.
let simSeconds = 0;

/**
 * Advances the world's clock by one physics step.
 * @param dt the step, s
 */
export function advanceWorldClock(dt: number): void {
  simSeconds += dt;
}

/**
 * The world's time.
 * @returns sim seconds since the game began
 */
export const worldSeconds = (): number => simSeconds;
