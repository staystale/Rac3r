// hud/layout.ts — HUD geometry: every rectangle for a screen size, and tap hit-testing.
// Pure moves out of hud.ts.

import { PEDAL } from '../input.ts';
import { MARGIN, BTN_H, DIAGRAM_H } from './widgets.ts';
import { trackTempShown } from './tracktemp.ts';
import type { HudState, HudCar, ScreenPoint } from './hudtypes.ts';
import type { HudRect } from './widgets.ts';

/**
 * Whether the player hid a HUD piece (the pause menu's HUD list).
 * @param state the shared HUD state (hidden)
 * @param pieceId the piece (hud.ts HIDEABLE)
 * @returns hidden
 */
// px the heat's stars take above the lights / indicator row (?police=1: hud/heat.ts), a gap
// included; the keyboard / steering hint above the row moves up by it (hud/controls.ts)
export const HEAT_ROW_H = 18;

const isHidden = (state: HudState, pieceId: string) => !!state.hidden && state.hidden.has(pieceId);

/**
 * Top-right panels and the cone tally: speed, lap, fps strip and tally rects. A hidden speedo or
 * lap timer takes no room: the panels under it move up.
 * @param state the shared HUD state (carDiagram, hidden)
 * @param width canvas width in px
 * @param btnY y of the button row
 * @param narrow true on a narrow screen
 * @returns speed, lap, fps and tally rects
 */
function layoutCornerPanels(state: HudState, width: number, btnY: number, narrow: boolean) {
  // The speed/tacho panel is a control lane too. MEASURED BUG (user screenshot): on a
  // narrow screen RESET and CLEAR moved to a second row on the RIGHT and landed straight on top
  // of the speed readout. The overlap test never caught it because it only compared the buttons
  // with each other, not with the panel they collided with. It is returned from layout now so
  // it can be.
  // speed grows a car diagram when on (or when damaged), the whole panel while the speedo is hidden
  const speedH = (isHidden(state, 'speedo') ? 0 : 56) + (state.carDiagram ? DIAGRAM_H : 0);
  const speed = { x: width - MARGIN - 120, y: MARGIN, w: 120, h: speedH };
  const lap = { x: width - MARGIN - 120, y: speedH ? speed.y + speedH + 6 : MARGIN, w: 120,
    h: isHidden(state, 'lapTimer') ? 0 : 36 };
  // The knocked-cone tally, under the button row. In layout so tools/uicheck.mjs can see it.
  // MEASURED BUG: it was placed in draw at a fixed row two, which on a narrow
  // screen IS the RESTART/RESET/CLEAR row — invisible to the overlap test until the tyre walls
  // made it show constantly.
  const tally = { x: Math.round(width / 2 - 46), y: btnY + BTN_H + 6, w: 92, h: 24 };
  // Narrow: the tally goes top-RIGHT, under the lap panel. FPS (test mode, requirement: in the
  // corner always): a slim strip right under the lap / distance panel, top right; the
  // narrow-screen cone tally moves down under it
  const belowLap = lap.h ? lap.y + lap.h + 4 : lap.y;
  // the track temperature gauge (?hudunits=1, hud/tracktemp.ts): on a narrow (portrait) screen
  // between the lap panel and FPS; wide, beside the lap panel (a landscape phone's column has no
  // room above the ABS / TCS chips)
  const gaugeH = trackTempShown() ? 18 : 0, inColumn = narrow && gaugeH > 0;
  const trackTemp = inColumn ? { x: lap.x, y: belowLap, w: 120, h: gaugeH }
    : { x: lap.x - 126, y: lap.h ? lap.y : belowLap, w: 120, h: gaugeH };
  const fps = { x: width - MARGIN - 120, y: inColumn ? belowLap + 22 : belowLap, w: 120, h: 18 };
  if (narrow) {
    tally.x = width - MARGIN - 92;
    tally.y = fps.y + fps.h + 6;
  }
  return { speed, lap, trackTemp, fps, tally };
}

/**
 * Bottom corners: the ABS / TCS aid chips above the pedals and the lights / indicator row.
 * @param width canvas width in px
 * @param height canvas height in px
 * @returns absChip, tcsChip, indL, lights, indR and heat rects
 */
function layoutBottomChips(width: number, height: number) {
  // DRIVER AID CHIPS (user: small chips ABOVE THE PEDALS). Laid out from the same
  // PEDAL numbers input.ts uses, clear of the brake pedal's generous 1.35r hit circle. Drawn and
  // hit-tested only on cars that have the aid.
  const yBrakeTop = height - PEDAL.margin - PEDAL.r - (PEDAL.r * 2 + PEDAL.gap) - PEDAL.r * 1.35;
  const aidW = 50, aidH = 30, aidY = Math.round(yBrakeTop - 6 - aidH);
  const absChip = { x: width - PEDAL.margin - aidW * 2 - 6, y: aidY, w: aidW, h: aidH };
  const tcsChip = { x: width - PEDAL.margin - aidW, y: aidY, w: aidW, h: aidH };
  // LIGHTS + INDICATORS (requirement: a button for headlights, bottom / bottom-left, along with
  // indicators): a row of three at the bottom-left corner — a tap there is consumed before the
  // steering zone sees it
  const lbW = 46, lbH = 34, lbY = height - MARGIN - lbH;
  const indL = { x: MARGIN, y: lbY, w: lbW, h: lbH },
    lights = { x: MARGIN + lbW + 6, y: lbY, w: lbW + 14, h: lbH },
    indR = { x: MARGIN + lbW * 2 + 26, y: lbY, w: lbW, h: lbH };
  // ?police=1: the heat's stars (hud/heat.ts) just above the row, its own room
  const heat = { x: MARGIN, y: lbY - HEAT_ROW_H, w: indR.x + lbW - MARGIN, h: HEAT_ROW_H - 4 };
  return { absChip, tcsChip, indL, lights, indR, heat };
}

/**
 * ?hudunits=1: on a short landscape screen the top-right column (speed, tyre diagram, lap, FPS)
 * reached down over the ABS / TCS chips (tools/scratch/_hudoverlap.mjs: 844x390 and 740x360 with
 * the tyre diagram on); then the chips move just left of the pedals, at their height (in thumb
 * reach, clear of the column).
 * @param absChip the ABS chip (moved in place)
 * @param tcsChip the TCS chip (moved in place)
 * @param width canvas width in px
 * @param columnBottom the column's lowest edge, px
 * @param gauge the track gauge (beside the lap panel when wide): the chips go under it
 *   where they would meet it (740x360)
 */
function clearAidChips(absChip: HudRect, tcsChip: HudRect, width: number, columnBottom: number,
  gauge: HudRect) {
  if (columnBottom + 6 <= absChip.y) return;
  // the pedal block: two columns of PEDAL.r circles, PEDAL.gap apart, PEDAL.margin from the edge
  const pedalsLeft = width - PEDAL.margin - PEDAL.r * 4 - PEDAL.gap;
  tcsChip.x = pedalsLeft - 6 - tcsChip.w;
  absChip.x = tcsChip.x - 6 - absChip.w;
  const meets = gauge.h && absChip.x < gauge.x + gauge.w && gauge.x < tcsChip.x + tcsChip.w
    && absChip.y < gauge.y + gauge.h && gauge.y < absChip.y + absChip.h;
  if (meets) absChip.y = tcsChip.y = gauge.y + gauge.h + 6;
}

/**
 * Work out every HUD rectangle for a screen size (one list for drawing and hit-testing).
 * @param state the shared HUD state (helpLabel, carDiagram)
 * @param width canvas width in px
 * @param height canvas height in px
 * @returns named rects: buttons, speed, lap, chips, ...
 */
export function layoutHud(state: HudState, width: number, height: number) {
  // NO CAR / LEVEL LIST, NO TUNE, NO CLEAR in a session (owner 11-04, passed: "remove any in game
  // tuning so no car changing once a race has started ... remove tune and clear tyre marks"): the
  // car and the track are picked in the menus; the top-left is the RESTART row's on every screen.
  const narrow = width < 620;
  const btnY = MARGIN;
  const wRestart = 70, wReset = 58, wVol = 48, wHelp = 34;
  const totalW = wRestart + 4 + wReset + (narrow ? 0 : 4 + wVol + 4 + wHelp);
  // NARROW = LEFT-ALIGNED, never centred. MEASURED BUG, (tools/uicheck.mjs + photo at
  // 390x844): a centred row ran under the speed and lap panels, which own the top-RIGHT corner,
  // at 360/390/412 px wide.
  const startX = narrow ? MARGIN : Math.max(MARGIN, Math.round(width / 2 - totalW / 2));
  const restart = { x: startX, y: btnY, w: wRestart, h: BTN_H, label: 'RESTART' };
  const reset = { x: startX + wRestart + 4, y: btnY, w: wReset, h: BTN_H, label: 'RESET' };
  const vol = narrow
    ? { x: -200, y: -200, w: 0, h: 0, label: 'VOL' }
    : { x: startX + wRestart + 4 + wReset + 4, y: btnY, w: wVol, h: BTN_H, label: 'VOL' };
  // "?" replays the HOW TO PLAY guide (user: on the button row). Wide: after VOL. Narrow: after
  // RESET when it clears the speed panel; else it drops to row two, left.
  const help: HudRect & { row3?: boolean } = {
    x: narrow ? startX + wRestart + 4 + wReset + 4 : vol.x + wVol + 4,
    y: btnY, w: wHelp, h: BTN_H, label: state.helpLabel };
  if (narrow && help.x + help.w > width - MARGIN - 120 - 6) {
    help.x = MARGIN;
    help.y = btnY + BTN_H + 6;
    help.row3 = true;
  }

  const { speed, lap, trackTemp, fps, tally } = layoutCornerPanels(state, width, btnY, narrow);
  const { absChip, tcsChip, indL, lights, indR, heat } = layoutBottomChips(width, height);
  clearAidChips(absChip, tcsChip, width, Math.max(lap.y + lap.h, fps.y + fps.h), trackTemp);
  return { restart, reset, vol, help, absChip, tcsChip, speed, lap, trackTemp, fps, tally, indL,
    lights, indR, heat };
}

/**
 * Is a point inside a rectangle (edges included).
 * @param {{x:number,y:number}} point
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @returns true when inside
 */
export function inRect(point: ScreenPoint, rect: HudRect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y
    + rect.h;
}

/**
 * Hit-test a tap against the HUD controls; may change state (mph).
 * @param state the shared HUD state
 * @param {{x:number,y:number}} point the tap
 * @param width canvas width in px
 * @param height canvas height in px
 * @param car the car (aids decide which chips exist)
 * @returns the action hit, or null
 */
// Returns an action if the tap hit a control, else null. A tap that hits the HUD is CONSUMED by
// main.ts and never reaches the world (CLAUDE.md §4).
export function hitHud(state: HudState, point: ScreenPoint, width: number, height: number,
  car: HudCar) {
  const rects = layoutHud(state, width, height);
  const aidHit = hitAidChips(rects, point, car);
  if (aidHit) return aidHit;
  return hitControls(state, rects, point);
}

/**
 * Hit-test the ABS / TCS chips, lights and indicators.
 * @param rects the layout rectangles
 * @param {{x:number,y:number}} point the tap
 * @param car the car (aids decide which chips exist)
 * @returns the action hit, or null
 */
function hitAidChips(rects: HudRects, point: ScreenPoint, car: HudCar) {
  if (car && car.spec.aids && car.spec.aids.abs
    && inRect(point, rects.absChip)) return { toggleAbs: true };
  if (car && car.spec.aids && car.spec.aids.tcs
    && inRect(point, rects.tcsChip)) return { toggleTcs: true };
  if (inRect(point, rects.lights)) return { toggleLights: true };
  if (inRect(point, rects.indL)) return { indicate: -1 };
  if (inRect(point, rects.indR)) return { indicate: 1 };
  return null;
}

/**
 * Sets the speed units and remembers them on the device (the speedo tap, the HUD list).
 * @param state the HUD state (mph)
 * @param mph true for mph
 */
export function setHudMph(state: HudState, mph: boolean) {
  state.mph = mph;
  try {
    localStorage.setItem('carsim.units', mph ? 'mph' : 'kmh');
  } catch { /* no storage: this session only */ }
}

/**
 * Sets the temperature units and remembers them on the device (the HUD list, ?hudunits=1).
 * @param state the HUD state (tempF)
 * @param fahrenheit true for °F
 */
export function setHudTempF(state: HudState, fahrenheit: boolean) {
  state.tempF = fahrenheit;
  try {
    localStorage.setItem('carsim.tempUnits', fahrenheit ? 'F' : 'C');
  } catch { /* no storage: this session only */ }
}

/**
 * Hit-test the speed panel (units toggle) and the button row.
 * @param state the shared HUD state
 * @param rects the layout rectangles
 * @param {{x:number,y:number}} point the tap
 * @returns the action hit, or null
 */
function hitControls(state: HudState, rects: HudRects, point: ScreenPoint) {
  if (!state.hidden.has('speedo') && inRect(point, rects.speed)) {
    setHudMph(state, !state.mph);
    return { consumed: true };
  }
  if (inRect(point, rects.restart)) return { restart: true };
  if (inRect(point, rects.reset)) return { reset: true };
  if (rects.vol && rects.vol.w > 0 && inRect(point, rects.vol)) return { volumeCycle: true };
  if (inRect(point, rects.help)) return { help: true };
  return null;
}

/**
 * Switch the tyre HUD on or off and remember it on the device.
 * @param state the shared HUD state
 * @param enabled
 * @returns {void}
 */
export function setHudTyreHud(state: HudState, enabled: boolean) {
  state.tyreHud = !!enabled;
  try {
    localStorage.setItem(TYRE_HUD_KEY, state.tyreHud ? '1' : '0');
  } catch { /* fine */ }
}
export type HudRects = ReturnType<typeof layoutHud>;
/** Where the tyre / damage diagram's choice is kept (a new key 11-10: on by default). */
export const TYRE_HUD_KEY = 'carsim.tyreHud.v2';
