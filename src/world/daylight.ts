// The LIGHT LEVEL of the world: how dark it is, 0 (full day) to 1 (the darkest night). The night
// layer (render/light.ts) draws it and the field's headlights follow it (game/sim.js). Only the
// ?night= test switch sets it so far; a time of day will drive it later.

// darkness at and above which the AI and traffic run their headlights, as drivers do at dusk
export const HEADLIGHTS_ON_DARKNESS = 0.35;

/**
 * The light level: darkness 0..1, and whether the field's headlights follow it (the default;
 * ?fieldlights=0: they follow the player's LIGHTS button, the old rule).
 */
export const DAYLIGHT = { darkness: 0, fieldLights: true, rgb: '4,8,22' };

/**
 * Sets how dark the world is.
 * @param level darkness, 0 (day) to 1 (the darkest night)
 */
export function setDarkness(level: number): void {
  DAYLIGHT.darkness = Math.max(0, Math.min(1, level));
}

/**
 * Sets the sky from the game clock (world/clock.ts): how dark, and the colour of the dark.
 * @param sky darkness 0..1 and the colour, 'r,g,b'
 */
export function setSky(sky: { darkness: number; rgb: string }): void {
  setDarkness(sky.darkness);
  DAYLIGHT.rgb = sky.rgb;
}

/**
 * Whether the AI and traffic run headlights by the light level (true) or as the player does.
 * @param byLight true: by the light level
 */
export function setFieldLights(byLight: boolean): void {
  DAYLIGHT.fieldLights = byLight;
}

/**
 * Whether a driver would have the headlights on in this light.
 * @returns true from dusk on
 */
export function headlightsWanted(): boolean {
  return DAYLIGHT.darkness >= HEADLIGHTS_ON_DARKNESS;
}
