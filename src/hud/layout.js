// hud/layout.js — HUD geometry: every rectangle for a screen size, and tap hit-testing.
// Pure moves out of hud.js (task 173).

import { CAR_IDS } from '../cars.ts';
import { LEVELS } from '../world/levels/index.ts';
import { PEDAL } from '../input.js';
import { ROWS as TUNE_ROWS } from '../tune.js';
import { MARGIN, BTN_H } from './widgets.js';

/**
 * Work out every HUD rectangle for a screen size (one list for drawing and hit-testing).
 * @param {object} state the shared HUD state (helpLabel, carDiagram)
 * @param {number} width canvas width in px
 * @param {number} height canvas height in px
 * @returns {object} named rects: chip, rows, levelRows, buttons, tune panel, speed, lap, ...
 */
export function layoutHud(state, width, height) {
  const chip = { x: MARGIN, y: MARGIN, w: 116, h: BTN_H };
  // 164, was 132. PHOTOGRAPHED 2026-10-03: "Naffcar Speedway" and "Surface Sandbox" ran into the
  // LEVEL tag at 132. Car and level rows share the width so the dropdown stays one clean column.
  const DROP_W = 164;
  const dTop = MARGIN + BTN_H + 6, dStep = 26,
    perCol = Math.max(4, Math.floor((height - dTop - MARGIN - 42) / dStep));
  const dAt = (i,
    col0) => ({ x: MARGIN + (col0 + Math.floor(i / perCol)) * (DROP_W + 6), y: dTop
    + (i % perCol) * dStep });
  const carCols = Math.ceil(CAR_IDS.length / perCol);
  const rows = CAR_IDS.map((carId, i) => ({ id: carId, ...dAt(i, 0), w: DROP_W, h: dStep - 2 }));
  // LEVEL ROWS hang below the car rows in the SAME dropdown. They do NOT get a chip of their own
  // on the top row: that row already carries car 116 + TUNE 64 + RESET 76 + CLEAR 76 + speed 120
  // and is the exact lane that has produced two overlap bugs. Reusing the dropdown costs no new
  // space and cannot collide with anything (CLAUDE.md §4: the four corners have owners).
  const levelRows = LEVELS.map((level,
    i) => ({ id: level.id, name: level.name, ...dAt(i, carCols), w: DROP_W, h: dStep - 2 }));
  const tuneChip = { x: MARGIN + chip.w + 6, y: MARGIN, w: 64, h: BTN_H };
  // MEASURED BUG, 2026-09-27 (caught by tools/uicheck.mjs, not by eye): adding the TUNE chip made
  // the top row need chip 116 + TUNE 64 + RESET 76 + CLEAR 76 + the speed panel 120 = 462 px, and
  // a portrait phone is 390. TUNE landed on top of RESET and ate its taps. On a narrow screen the
  // pair drops to a second row on the RIGHT, which is empty there. Two systems must never share a
  // lane.
  const narrow = width < 620;
  const btnY = narrow ? MARGIN + BTN_H + 6 : MARGIN;
  const wRestart = 70, wReset = 58, wClear = 54, wVol = 48, wHelp = 34;
  const totalW = wRestart + 4 + wReset + 4 + wClear + (narrow ? 0 : 4 + wVol + 4 + wHelp);
  // Ensure the center block doesn't overlap the new TCS chip on wide screens
  const minX = narrow ? MARGIN : tuneChip.x + tuneChip.w + 6;
  // NARROW = LEFT-ALIGNED, never centred. MEASURED BUG, 2026-10-03 (tools/uicheck.mjs + photo at
  // 390x844): centring this second row (Gemini, 2026-10-01) pushed CLEAR under the speed and lap
  // panels, which own the top-RIGHT corner, at 360/390/412 px wide. The left of row two is free
  // on every phone.
  const startX = narrow ? MARGIN : Math.max(minX, Math.round(width / 2 - totalW / 2));
  const restart = { x: startX, y: btnY, w: wRestart, h: BTN_H, label: 'RESTART' };
  const reset = { x: startX + wRestart + 4, y: btnY, w: wReset, h: BTN_H, label: 'RESET' };
  const clear = { x: startX + wRestart + 4 + wReset + 4, y: btnY, w: wClear, h: BTN_H,
    label: 'CLEAR' };
  const vol = narrow
    ? { x: -200, y: -200, w: 0, h: 0, label: 'VOL' }
    : { x: startX + wRestart + 4 + wReset + 4 + wClear + 4, y: btnY, w: wVol, h: BTN_H,
      label: 'VOL' };
  // "?" replays the HOW TO PLAY guide (user, 2026-10-03: on the button row). Wide: after VOL.
  // Narrow: after CLEAR when it clears the speed panel (390 px and up); at 360 px it would sit on
  // the speed panel, so it drops to row three, left — the dropdown / TUNE panel lane, so it is
  // hidden while either is open.
  const help = { x: narrow ? startX + wRestart + 4 + wReset + 4 + wClear + 4 : vol.x + wVol + 4,
    y: btnY, w: wHelp, h: BTN_H, label: state.helpLabel };
  if (narrow && help.x + help.w > width - MARGIN - 120 - 6) {
    help.x = MARGIN;
    help.y = btnY + BTN_H + 6;
    help.row3 = true;
  }

  // The panel sizes itself to the space available and never runs off the bottom of a short
  // landscape phone: the row height shrinks to fit, with a floor, and the width is capped.
  // Checked at 844x390 and 390x844 by tools/uicheck.mjs.
  const top = (narrow ? MARGIN + BTN_H * 2 + 12 : MARGIN + BTN_H + 6);
  const bottom = height - MARGIN - 34; // leave the bottom-left hint line its lane
  const avail = bottom - top - 24;               // minus the footer button
  const rowHeight = Math.max(16, Math.min(27, Math.floor(avail / TUNE_ROWS.length)));
  const panelWidth = Math.min(272, width - MARGIN * 2);
  const tunePanel = { x: MARGIN, y: top, w: panelWidth,
    h: TUNE_ROWS.length * rowHeight + 26 };
  // Buttons are WIDER than they are tall. Vertical room is the binding constraint on a 390
  // px-tall landscape phone (rows get to 19 px), but there is horizontal room going spare — and a
  // wider target is easier to hit with a thumb than a square one. 44 x 19 beats 20 x 20.
  const btnHeight = Math.max(17, rowHeight - 2), btnWidth = 44;
  const tuneRows = TUNE_ROWS.map((tuneRow, i) => {
    const y = tunePanel.y + 2 + i * rowHeight;
    return {
      row: tuneRow, y, h: rowHeight,
      minus: { x: tunePanel.x + panelWidth - btnWidth * 2 - 12,
        y: y + (rowHeight - btnHeight) / 2, w: btnWidth, h: btnHeight },
      plus: { x: tunePanel.x + panelWidth - btnWidth - 6, y: y + (rowHeight - btnHeight) / 2,
        w: btnWidth, h: btnHeight },
    };
  });
  // footer split in two: RESET TUNING | TYRE HUD on/off
  const footerWidth = Math.floor((panelWidth - 18) / 2);
  const tuneReset = { x: tunePanel.x + 6, y: tunePanel.y + 4 + TUNE_ROWS.length * rowHeight,
    w: footerWidth, h: 20 };
  const tyreHudBtn = { x: tunePanel.x + 12 + footerWidth, y: tuneReset.y, w: footerWidth,
    h: 20 };
  // The speed/tacho panel is a control lane too. MEASURED BUG (user screenshot, 2026-09-27): on a
  // narrow screen RESET and CLEAR moved to a second row on the RIGHT and landed straight on top
  // of the speed readout. The overlap test never caught it because it only compared the buttons
  // with each other, not with the panel they collided with. It is returned from layout() now so
  // it can be.
  const speed = { x: width - MARGIN - 120, y: MARGIN, w: 120, h: 56 + (state.carDiagram ? 50 : 0) };
  // ^ speed grows a car diagram when on (or when damaged)
  const lap = { x: width - MARGIN - 120, y: speed.y + speed.h + 6, w: 120, h: 36 };
  // The knocked-cone tally, under the button row. In layout() so tools/uicheck.mjs can see it.
  // MEASURED BUG, 2026-10-03: it was placed in draw() at a fixed row two, which on a narrow
  // screen IS the RESTART/RESET/CLEAR row — invisible to the overlap test until the tyre walls
  // made it show constantly.
  const tally = { x: Math.round(width / 2 - 46), y: btnY + BTN_H + 6, w: 92, h: 24 };
  // Narrow: the left of row three belongs to the car dropdown and the TUNE panel, so the tally
  // goes top-RIGHT, under the lap panel (it is hidden while TUNE is open — that panel reaches it
  // at 360 px). FPS (test mode, user 2026-10-06: "in the corner always"): a slim strip right
  // under the lap / distance panel, top right; the narrow-screen cone tally moves down under it
  const fps = { x: width - MARGIN - 120, y: lap.y + lap.h + 4, w: 120, h: 18 };
  if (narrow) {
    tally.x = width - MARGIN - 92;
    tally.y = fps.y + fps.h + 6;
  }
  // DRIVER AID CHIPS (user, 2026-10-03: small chips ABOVE THE PEDALS). Laid out from the same
  // PEDAL numbers input.js uses, clear of the brake pedal's generous 1.35r hit circle. Drawn and
  // hit-tested only on cars that have the aid.
  const yBrakeTop = height - PEDAL.margin - PEDAL.r - (PEDAL.r * 2 + PEDAL.gap) - PEDAL.r * 1.35;
  const aidW = 50, aidH = 30, aidY = Math.round(yBrakeTop - 6 - aidH);
  const absChip = { x: width - PEDAL.margin - aidW * 2 - 6, y: aidY, w: aidW, h: aidH };
  const tcsChip = { x: width - PEDAL.margin - aidW, y: aidY, w: aidW, h: aidH };
  // LIGHTS + INDICATORS (user, 2026-10-04: "a button for headlights, bottom / bottom-left, along
  // with indicators"): a row of three at the bottom-left corner — a tap there is consumed before
  // the steering zone sees it
  const lbW = 46, lbH = 34, lbY = height - MARGIN - lbH;
  const indL = { x: MARGIN, y: lbY, w: lbW, h: lbH },
    lights = { x: MARGIN + lbW + 6, y: lbY, w: lbW + 14, h: lbH },
    indR = { x: MARGIN + lbW * 2 + 26, y: lbY, w: lbW, h: lbH };
  return { chip, rows, levelRows, restart, reset, clear, vol, help, absChip, tcsChip, tuneChip,
    panel: tunePanel, tuneRows, tuneReset, tyreHudBtn, speed, lap, fps, tally, indL, lights,
    indR };
}

/**
 * Is a point inside a rectangle (edges included).
 * @param {{x:number,y:number}} point
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @returns {boolean} true when inside
 */
export function inRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y
    + rect.h;
}

/**
 * Hit-test a tap against the HUD controls; may change state (expanded, tuneOpen, mph).
 * @param {object} state the shared HUD state
 * @param {{x:number,y:number}} point the tap
 * @param {number} width canvas width in px
 * @param {number} height canvas height in px
 * @param {object} car the car (aids decide which chips exist)
 * @returns {object|null} the action hit, or null
 */
// Returns an action if the tap hit a control, else null. A tap that hits the HUD is CONSUMED by
// main.js and never reaches the world (CLAUDE.md §4).
export function hitHud(state, point, width, height, car) {
  const rects = layoutHud(state, width, height);
  if (car && car.spec.aids && car.spec.aids.abs
    && inRect(point, rects.absChip)) return { toggleAbs: true };
  if (car && car.spec.aids && car.spec.aids.tcs
    && inRect(point, rects.tcsChip)) return { toggleTcs: true };
  if (inRect(point, rects.lights)) return { toggleLights: true };
  if (inRect(point, rects.indL)) return { indicate: -1 };
  if (inRect(point, rects.indR)) return { indicate: 1 };

  // the tune panel is checked FIRST while it is open — it covers the car list's lane
  if (state.tuneOpen) {
    for (const tuneRow of rects.tuneRows) {
      if (inRect(point, tuneRow.minus)) return { tune: tuneRow.row, dir: -1 };
      if (inRect(point, tuneRow.plus)) return { tune: tuneRow.row, dir: +1 };
    }
    if (inRect(point, rects.tuneReset)) return { tuneReset: true };
    if (inRect(point, rects.tyreHudBtn)) {
      setHudTyreHud(state, !state.tyreHud);
      return { consumed: true };
    }
    if (inRect(point, rects.tuneChip)) {
      state.tuneOpen = false;
      return { consumed: true };
    }
    if (inRect(point, rects.panel)) return { consumed: true }; // swallow taps on the panel body
  }
  if (state.expanded) {
    for (const carRow of rects.rows) if (inRect(point, carRow)) {
      state.expanded = false;
      return { car: carRow.id };
    }
    for (const levelRow of rects.levelRows) if (inRect(point, levelRow)) {
      state.expanded = false;
      return { level: levelRow.id };
    }
    if (!inRect(point, rects.chip)) {
      state.expanded = false;
      return { consumed: true };
    }
  }
  if (inRect(point, rects.chip)) {
    state.expanded = !state.expanded;
    state.tuneOpen = false;
    return { consumed: true };
  }
  if (inRect(point, rects.tuneChip)) {
    state.tuneOpen = !state.tuneOpen;
    state.expanded = false;
    return { consumed: true };
  }
  if (inRect(point, rects.speed)) {
    state.mph = !state.mph;
    try {
      localStorage.setItem('carsim.units', state.mph ? 'mph' : 'kmh');
    } catch { /* fine */ } return { consumed: true };
  }
  if (inRect(point, rects.restart)) return { restart: true };
  if (inRect(point, rects.reset)) return { reset: true };
  if (inRect(point, rects.clear)) return { clear: true };
  if (rects.vol && rects.vol.w > 0 && inRect(point, rects.vol)) return { volumeCycle: true };
  if (inRect(point, rects.help)) return { help: true };
  return null;
}

/**
 * Switch the tyre HUD on or off and remember it on the device.
 * @param {object} state the shared HUD state
 * @param {boolean} enabled
 * @returns {void}
 */
export function setHudTyreHud(state, enabled) {
  state.tyreHud = !!enabled;
  try {
    localStorage.setItem('carsim.tyreHud', state.tyreHud ? '1' : '0');
  } catch { /* fine */ }
}
