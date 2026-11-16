// hud/lowlever.ts - THE LOW-RANGE LEVER (physics/lowrange.ts), on a car with a
// two-speed box only: a small gear stick in its own panel just left of the speedo. HI at the top,
// LO at the bottom, the knob at the range the car is in (teal in low); each half a 48 x 48 touch
// target - a tap on a half asks for that range. Asked above 10 km/h it is refused: the slot shows
// amber and the label reads STOP for a second (the widget's own, not a banner). It is a control, so
// it is never hidden (not in the pause menu's HUD list).
import { COL } from '../world/colours.ts';
import { drawHudLabel, drawHudPanel, type HudRect } from './widgets.ts';

// px of the lever's panel (two 48 x 48 halves) and its gap from the speedo
export const LEVER_W = 48, LEVER_H = 96, LEVER_GAP = 6;
// ms a refused pull shows (wall clock: a flash)
const REFUSED_MS = 1000;
// the slot, its notches, the knob in high, the refused slot
const SLOT = '#0e1013', NOTCH = '#3a3e47', KNOB = '#d8dbe0', KNOB_SHADE = '#8f949c';
const REFUSED = '#6b4a12';
// px: the knob's size; the slot's place in the panel
const KNOB_PX = 24, SLOT_TOP = 16, SLOT_H = 64;

/**
 * The lever's panel just left of the speedo, its top level with it.
 * @param speed the speedo's rect
 * @returns the lever's rect
 */
export const leverRect = (speed: HudRect): HudRect =>
  ({ x: speed.x - LEVER_GAP - LEVER_W, y: speed.y, w: LEVER_W, h: LEVER_H });

/**
 * Which range a tap on the lever asks for: its top half high, its bottom half low.
 * @param rect the lever's rect
 * @param tapY the tap's y, px
 * @returns 'lo' or 'hi'
 */
export const leverAsk = (rect: HudRect, tapY: number): 'lo' | 'hi' =>
  tapY >= rect.y + rect.h / 2 ? 'lo' : 'hi';

/**
 * Draws the lever: the slot, the notches at its ends, the knob at the car's range, HI / LO.
 * @param ctx the HUD canvas
 * @param rect the lever's rect
 * @param low the car is in low
 * @param refusedAge ms since a refused pull (Infinity: none)
 */
export function drawLowLever(ctx: CanvasRenderingContext2D, rect: HudRect, low: boolean,
  refusedAge: number): void {
  const refused = refusedAge < REFUSED_MS, mid = rect.x + rect.w / 2;
  drawHudPanel(ctx, rect);
  ctx.fillStyle = refused ? REFUSED : SLOT;
  ctx.fillRect(mid - 3, rect.y + SLOT_TOP, 6, SLOT_H);
  ctx.fillStyle = NOTCH;
  for (const notchY of [rect.y + SLOT_TOP, rect.y + SLOT_TOP + SLOT_H - 3])
    ctx.fillRect(mid - 9, notchY, 18, 3);
  // the knob at its end of the slot (half way while a pull is refused)
  const knobY = refused ? rect.y + rect.h / 2 - KNOB_PX / 2
    : low ? rect.y + SLOT_TOP + SLOT_H - KNOB_PX : rect.y + SLOT_TOP;
  ctx.fillStyle = low ? COL.live : KNOB;
  ctx.beginPath();
  ctx.arc(mid, knobY + KNOB_PX / 2, KNOB_PX / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = low ? '#2a8a6e' : KNOB_SHADE;
  ctx.fillRect(mid - 6, knobY + KNOB_PX - 5, 12, 2);
  drawHudLabel(ctx, 'HI', mid, rect.y + 8, { size: 10, weight: 800, align: 'center',
    col: low ? COL.inkSoft : COL.hudText });
  drawHudLabel(ctx, refused ? 'STOP' : 'LO', mid, rect.y + rect.h - 8, { size: 10, weight: 800,
    align: 'center', col: refused ? COL.warn : low ? COL.live : COL.inkSoft });
}
