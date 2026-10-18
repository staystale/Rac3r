// The LIGHT LEVEL of the world: how dark it is, 0 (full day) to 1 (the darkest night). The night
// layer (render/light.ts) draws it and the field's headlights follow it (game/sim.js). Only the
// ?night= test switch sets it so far; a time of day will drive it later.

// darkness at and above which the AI and traffic run their headlights, as drivers do at dusk
export const HEADLIGHTS_ON_DARKNESS = 0.35;

/** The light level: darkness 0..1, and whether anything sets it (off: the old rules hold). */
export const DAYLIGHT = { darkness: 0, active: false };

/**
 * Sets how dark the world is and turns the light rules on.
 * @param level darkness, 0 (day) to 1 (the darkest night)
 */
export function setDarkness(level: number): void {
  DAYLIGHT.darkness = Math.max(0, Math.min(1, level));
  DAYLIGHT.active = true;
}

/**
 * Whether a driver would have the headlights on in this light.
 * @returns true from dusk on
 */
export function headlightsWanted(): boolean {
  return DAYLIGHT.darkness >= HEADLIGHTS_ON_DARKNESS;
}
