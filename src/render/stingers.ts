// stingers.ts - draws the level's tyre spikes (world/stingers.ts): a grey strip with a
// dark rim and rows of pale spikes, square pixels in the game's style, on the ground under the
// cars (drawn with the marks, render/screen.ts).

import { LEVEL } from "../world/state.ts";
import { levelStingers, STINGER_LEN_M, STINGER_WID_M } from "../world/stingers.ts";

const STRIP = '#8d9099', RIM = '#4a4c54', SPIKE = '#d6d8de', SPIKE_SHADE = '#5b5e66';
// m between spikes along the strip, and the spike's size
const SPIKE_GAP_M = 0.3, SPIKE_M = 0.12;

/**
 * Draws the stingers on screen.
 * @param target the screen canvas (css px)
 * @param toScreenX world x -> screen x
 * @param toScreenY world y -> screen y
 * @param pxPerMetre screen px a metre at this zoom
 */
export function drawStingers(
  target: CanvasRenderingContext2D, toScreenX: (x: number) => number,
  toScreenY: (y: number) => number, pxPerMetre: number,
): void {
  const stingers = levelStingers(LEVEL.id);
  if (!stingers.length) return;
  const len = STINGER_LEN_M * pxPerMetre, wid = Math.max(3, STINGER_WID_M * pxPerMetre);
  const spike = Math.max(1, Math.round(SPIKE_M * pxPerMetre)), gap = SPIKE_GAP_M * pxPerMetre;
  for (const strip of stingers) {
    target.save();
    target.translate(toScreenX(strip.x), toScreenY(strip.y));
    target.rotate(strip.rot);
    target.fillStyle = RIM;
    target.fillRect(-len / 2 - 1, -wid / 2 - 1, len + 2, wid + 2);
    target.fillStyle = STRIP;
    target.fillRect(-len / 2, -wid / 2, len, wid);
    // three rows of spikes, each with a dark pixel under it (a spike stands up)
    for (let along = -len / 2 + gap / 2; along < len / 2; along += gap) {
      for (const across of [-wid / 3, 0, wid / 3]) {
        const left = Math.round(along - spike / 2), top = Math.round(across - spike / 2);
        target.fillStyle = SPIKE_SHADE;
        target.fillRect(left + 1, top + 1, spike, spike);
        target.fillStyle = SPIKE;
        target.fillRect(left, top, spike, spike);
      }
    }
    target.restore();
  }
}
