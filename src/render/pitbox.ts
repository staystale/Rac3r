// render/pitbox.ts - ?pitstops: YOUR pit box, marked so it can be spotted at speed (owner 11-22:
// "I saw no marked place for me to stop"). Every box's lines are paint (world/pitlane.ts boxLines);
// yours is drawn over them brighter, in the game's theme orange (COL.theme), flashing its electric
// blue (COL.themeBlue) while you are parked in it (owner: "orange, then flashes blue when you
// park"), with a lollipop at its front as a pit crew holds one: red while you are to stop there
// (COL.danger), green at GO (COL.live). Drawn with the joker arrows (render/road.ts), in the road's
// deck, under the cars.
import { COL } from '../world/colours.ts';
import type { PitBox } from '../world/pitlane.ts';

/** What the drawing needs of the renderer: the 2D context, metres to pixels, the projection. */
export interface PitBoxView {
  canvasCtx: CanvasRenderingContext2D;
  pxPerM: number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
}

// Hz: the parked flash (wall clock: something you watch, CLAUDE.md §3)
const PARKED_FLASH_HZ = 3;
// m: your box's outline width; the lollipop board's radius, how far past the box's front it
// stands, and its pole's length (to the garage side) and width
const OUTLINE_W = 0.35, BOARD_R = 0.55, BOARD_AHEAD = 0.9, POLE_LEN = 1.6, POLE_W = 0.1;

/**
 * Draws your box: its outline, bright, and the lollipop at its front.
 * @param view the renderer's context and projection
 * @param box your box
 * @param now the stop now: the GO showing (the lollipop green), parked (the flash), wall s
 * @param now.showsGo the GO is showing
 * @param now.parked you are parked in the box
 * @param now.wallT the wall clock, s
 */
export function drawYourBox(view: PitBoxView, box: PitBox,
  now: { showsGo: boolean; parked: boolean; wallT: number }): void {
  const flashOn = now.parked && Math.floor(now.wallT * PARKED_FLASH_HZ * 2) % 2 === 0;
  const { canvasCtx, pxPerM } = view;
  const halfLen = box.len / 2, halfWid = box.wid / 2;
  canvasCtx.save();
  canvasCtx.translate(view.toScreenX(box.x), view.toScreenY(box.y));
  canvasCtx.rotate(box.heading);
  canvasCtx.strokeStyle = flashOn ? COL.themeBlue : COL.theme;
  canvasCtx.lineWidth = Math.max(2, OUTLINE_W * pxPerM);
  canvasCtx.lineJoin = 'miter';
  canvasCtx.strokeRect(-halfLen * pxPerM, -halfWid * pxPerM, box.len * pxPerM, box.wid * pxPerM);
  // the lollipop: its pole from the garage side, its round board over the box's middle line
  const boardX = (halfLen + BOARD_AHEAD) * pxPerM, side = box.side || 1;
  canvasCtx.strokeStyle = COL.ink;
  canvasCtx.lineWidth = Math.max(1, POLE_W * pxPerM);
  canvasCtx.beginPath();
  canvasCtx.moveTo(boardX, 0);
  canvasCtx.lineTo(boardX, side * POLE_LEN * pxPerM);
  canvasCtx.stroke();
  canvasCtx.fillStyle = now.showsGo ? COL.live : COL.danger;
  canvasCtx.beginPath();
  canvasCtx.arc(boardX, 0, BOARD_R * pxPerM, 0, Math.PI * 2);
  canvasCtx.fill();
  canvasCtx.lineWidth = Math.max(1, 0.12 * pxPerM);
  canvasCtx.stroke();
  canvasCtx.restore();
}
