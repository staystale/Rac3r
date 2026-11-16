// hud/hudfit.ts - THE LANDSCAPE HUD DECLUTTERED (owner: the right-hand column "gets
// squished" on a landscape phone; "can ABS and TCS come to the bottom in horizontal mode"; the
// upright layout stays as it is). In landscape only: the track temperature a compact chip ("30°C",
// no TRACK, no bar: hud/tracktemp.ts draws it so when it is this narrow); FPS dropped first when
// the column would reach down past the brake pedal's touch circle; the ABS / TCS chips on the
// bottom line just left of the HAND pedal's touch circle, each with a 44 px tall touch area (the
// chip itself still 30 px). hud/layout.ts calls these once its own rects are made.
import { PEDAL } from '../input.ts';
import { MARGIN, type HudRect } from './widgets.ts';

// px of the compact temperature chip ("30°C"; the full gauge is 120)
export const COMPACT_TEMP_W = 46;
// px: a repeat-use touch target's height (CLAUDE.md: 44 px); the aid chips are drawn 30 px tall
const TOUCH_H = 44;
// px between the chips and the HAND pedal's touch circle, and between the two chips
const CHIP_GAP = 6;

/**
 * Whether the decluttered landscape layout applies (a landscape screen).
 * @param width canvas width in px
 * @param height canvas height in px
 * @param narrow true on a narrow (upright) screen
 * @returns applies
 */
export const isHudFit = (width: number, height: number, narrow: boolean) =>
  !narrow && width > height;

/**
 * px: the top of the brake pedal's touch circle (input.ts PEDAL; its hit circle 1.35 r).
 * @param height canvas height in px
 * @returns px
 */
export const brakeTouchTop = (height: number) =>
  height - PEDAL.margin - PEDAL.r - (PEDAL.r * 2 + PEDAL.gap) - PEDAL.r * 1.35;

/**
 * The column decluttered: the temperature chip compact beside the lap panel, FPS dropped when it
 * would reach past the brake pedal's touch circle (moved in place).
 * @param panels the corner panels (lap, trackTemp, fps)
 * @param height canvas height in px
 */
export function fitCornerPanels(panels: { lap: HudRect; trackTemp: HudRect; fps: HudRect },
  height: number): void {
  const { lap, trackTemp, fps } = panels;
  trackTemp.w = COMPACT_TEMP_W;
  trackTemp.x = lap.x - COMPACT_TEMP_W - 6;
  if (fps.y + fps.h > brakeTouchTop(height)) fps.h = 0;
}

/**
 * The ABS / TCS chips on the bottom line, just left of the HAND pedal's touch circle (moved in
 * place).
 * @param absChip the ABS chip
 * @param tcsChip the TCS chip
 * @param width canvas width in px
 * @param height canvas height in px
 */
export function fitAidChips(absChip: HudRect, tcsChip: HudRect, width: number,
  height: number): void {
  const handLeft = width - PEDAL.margin - PEDAL.r - (PEDAL.r * 2 + PEDAL.gap) - PEDAL.r * 1.35;
  tcsChip.x = Math.round(handLeft - CHIP_GAP - tcsChip.w);
  absChip.x = tcsChip.x - CHIP_GAP - absChip.w;
  // (the chip's 44 px touch area reaches above it; its bottom MARGIN from the screen's edge)
  absChip.y = tcsChip.y = height - MARGIN - (TOUCH_H + absChip.h) / 2;
}

/**
 * A chip's touch area: 44 px tall round it in the decluttered layout, else the chip.
 * @param chip the chip
 * @param fit the decluttered layout applies
 * @returns the rect taps are tested against (a new one when padded)
 */
export function chipTouchArea(chip: HudRect, fit: boolean): HudRect {
  if (!fit || chip.h >= TOUCH_H) return chip;
  const pad = (TOUCH_H - chip.h) / 2;
  return { x: chip.x, y: chip.y - pad, w: chip.w, h: TOUCH_H };
}
