// world/startlights.ts - THE START GANTRY'S LIGHTS (owner 11-22: "start gantries
// show the countdown and the green on ALL tracks" - a prop, not a banner). The game sets them each
// step from its start (game/order.ts stepStart): reds one a second before a green (the HUD's own
// three), the green held a moment, dark otherwise. A rally stage's gantry counts each car down at
// the line - yours, then each later starter's. The gantry's sprite (render/props/buildings.ts
// drawGantry) and its glow at night (render/eventglows.ts) read them. Only a gantry at the start
// line counts (a stage's other gantry is its finish); the endless road's gantries carry its speed
// cameras and are left alone.
import { LEVEL } from './state.ts';
import type { Prop } from './types.ts';

/** The start lights now: a start under way, how many reds lit (0-3), the green lit. */
export const START_LIGHTS = { on: false, reds: 0, green: false };

// m: a gantry this near the start line is its start gantry
const START_GANTRY_M = 30;
const START_GANTRY = new WeakMap<Prop, boolean>();

/**
 * Sets the start lights (one sim step: game/order.ts).
 * @param isOn a start under way
 * @param reds reds lit, 0-3
 * @param green the green lit
 */
export function setStartLights(isOn: boolean, reds: number, green: boolean) {
  START_LIGHTS.on = isOn;
  START_LIGHTS.reds = reds;
  START_LIGHTS.green = green;
}

/**
 * Whether a gantry is the start's: at the start line, not on the endless road.
 * @param prop the gantry
 * @returns it is
 */
export function isStartGantry(prop: Prop): boolean {
  let known = START_GANTRY.get(prop);
  if (known === undefined) {
    const line = LEVEL.subtrack?.pts[0];
    known = !LEVEL.endless && !!line && Math.hypot(prop.x - line.x, prop.y - line.y)
      < START_GANTRY_M;
    START_GANTRY.set(prop, known);
  }
  return known;
}

/**
 * Which of a gantry's five pods are lit, and in which colour: all five green, else the middle
 * three's first `reds` red (as the glow: render/eventglows.ts).
 * @returns the lit pods (-2..2) and their colour, or null (dark)
 */
export function litPods(): { pods: number[]; green: boolean } | null {
  if (!START_LIGHTS.on) return null;
  if (START_LIGHTS.green) return { pods: [-2, -1, 0, 1, 2], green: true };
  if (!START_LIGHTS.reds) return null;
  return { pods: [-1, 0, 1].slice(0, START_LIGHTS.reds), green: false };
}
