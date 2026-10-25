// flipramps.ts - draws the flip ramps (world/flipramps.ts): an armco beam turned
// down into the ground - galvanised steel with the w-beam's two dark grooves, its shadow growing
// toward the raised end, a post at the top - drawn with the marks, under the cars
// (render/screen.ts). Square pixels in the game's style.

import { LEVEL } from "../world/state.ts";
import { levelFlipRamps, RAMP_LEN_M, RAMP_RISE_M, RAMP_WID_M } from "../world/flipramps.ts";

const STEEL = '#b3b8bf', GROOVE = '#7b8089', LIT = '#d9dde2', POST = '#4a4e56';
const SHADOW = 'rgba(0,0,0,0.32)';
// m the shadow reaches out per m of height (light from the top left)
const SHADOW_PER_M = 0.9;

/**
 * Draws the level's flip ramps on screen.
 * @param target the screen canvas (art px)
 * @param toScreenX world x -> screen x
 * @param toScreenY world y -> screen y
 * @param pxPerMetre screen px a metre at this zoom
 */
export function drawFlipRamps(
  target: CanvasRenderingContext2D, toScreenX: (x: number) => number,
  toScreenY: (y: number) => number, pxPerMetre: number,
): void {
  const ramps = levelFlipRamps(LEVEL.id);
  if (!ramps.length) return;
  const len = RAMP_LEN_M * pxPerMetre, wid = Math.max(3, RAMP_WID_M * pxPerMetre);
  const reach = RAMP_RISE_M * SHADOW_PER_M * pxPerMetre;
  for (const ramp of ramps) {
    target.save();
    target.translate(toScreenX(ramp.x), toScreenY(ramp.y));
    target.rotate(ramp.rot);
    // the shadow: none at the low end, widest under the raised one
    target.fillStyle = SHADOW;
    target.beginPath();
    target.moveTo(-len / 2, wid / 2);
    target.lineTo(len / 2, wid / 2 + reach);
    target.lineTo(len / 2, wid / 2);
    target.closePath();
    target.fill();
    target.fillStyle = STEEL;
    target.fillRect(-len / 2, -wid / 2, len, wid);
    // the w-beam: a lit edge and two grooves along it
    target.fillStyle = LIT;
    target.fillRect(-len / 2, -wid / 2, len, Math.max(1, wid * 0.15));
    target.fillStyle = GROOVE;
    for (const across of [-0.15, 0.2]) {
      target.fillRect(-len / 2, Math.round(across * wid), len, Math.max(1, wid * 0.12));
    }
    // the post at the raised end
    target.fillStyle = POST;
    target.fillRect(len / 2 - wid * 0.6, -wid * 0.6, wid * 0.6, wid * 1.2);
    target.restore();
  }
}
