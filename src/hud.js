// hud.js — HUD, touch overlay and the dev readout.
//
// THE FOUR CORNERS HAVE OWNERS (CLAUDE.md §4) and no two systems share a lane:
//   top-left      car selector chip (collapsed by default; expands DOWNWARD into five rows)
//   top-centre    RESET and CLEAR MARKS (the button row)
//   top-right     speed, gear, tacho + shift light   (the silent twin of the engine note)
//   bottom-left   thumb stick (touch) / key hints (pc)
//   bottom-right  throttle / brake / handbrake pedals (touch)
//   left edge     dev readout, ?dev=1 only, below the chip — nothing else may live there
//
// Buttons are DATA so hit-testing and drawing read the same geometry. Two copies of
// a rect is how a button ends up visually somewhere its tap is not.

import { ROSTER, CAR_IDS } from './cars.ts';
import { LEVELS } from "./world/levels/index.ts";
import { LEVEL } from "./world/state.ts";
import { COL } from "./world/colours.ts";
import { PEDAL } from './input.js';
import { ROWS as TUNE_ROWS, isChanged } from './tune.js';

const MARGIN = 12;              // minimum margin
const BTN_H = 34;          // >= 30px touch target; the repeated ones (pedals) are 72px

function fmtTime(seconds) {
  if (!seconds || seconds <= 0) return '0:00.00';
  const minutes = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  const centis = Math.floor((seconds % 1) * 100);
  return `${minutes}:${String(sec).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

export function createHud() {
  let expanded = false;        // car list
  let tuneOpen = false;        // debug/tuning panel — only one of the two is ever open
  let shiftFlash = 0;
  let gearFlash = 0, lastGear = 1;
  const aidFlash = { abs: 0, tcs: 0 };
  // the replay / pause chip: '?' replays the guide; with menus on it is the PAUSE chip ('II'), and
  // How to play lives in there
  let helpLabel = '?';   // a shift should be VISIBLE even on the automatic box (user)
  // OPTIONAL TYRE / DAMAGE HUD (user, 2026-10-03: "hud should be optional, turn on and off"). Off
  // by default — the car itself shows only realistic feedback (faint cold marks, marbles, smoke).
  // Remembered per device; storage can throw in private windows, so every access is guarded.
  // carDiagram: the tyre HUD is on, OR the car is damaged (user: "use that for damage too")
  let tyreHud = false, carDiagram = false;
  try {
    tyreHud = localStorage.getItem('carsim.tyreHud') === '1';
  } catch { /* no storage: stays off */ }
  // SPEED UNITS (user, 2026-10-04: "tapping the speed / kph should change it to mph"), remembered
  // on the device
  let mph = false;
  try { mph = localStorage.getItem('carsim.units') === 'mph'; } catch { /* no storage: km/h */ }
  const setTyreHud = (enabled) => {
    tyreHud = !!enabled;
    try {
      localStorage.setItem('carsim.tyreHud', tyreHud ? '1' : '0');
    } catch { /* fine */ }
  };

  function layout(width, height) {
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
      y: btnY, w: wHelp, h: BTN_H, label: helpLabel };
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
    const speed = { x: width - MARGIN - 120, y: MARGIN, w: 120, h: 56 + (carDiagram ? 50 : 0) };
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

  function inRect(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y
      + rect.h;
  }

  // Returns an action if the tap hit a control, else null. A tap that hits the HUD is CONSUMED by
  // main.js and never reaches the world (CLAUDE.md §4).
  function hit(point, width, height, car) {
    const rects = layout(width, height);
    if (car && car.spec.aids && car.spec.aids.abs
      && inRect(point, rects.absChip)) return { toggleAbs: true };
    if (car && car.spec.aids && car.spec.aids.tcs
      && inRect(point, rects.tcsChip)) return { toggleTcs: true };
    if (inRect(point, rects.lights)) return { toggleLights: true };
    if (inRect(point, rects.indL)) return { indicate: -1 };
    if (inRect(point, rects.indR)) return { indicate: 1 };

    // the tune panel is checked FIRST while it is open — it covers the car list's lane
    if (tuneOpen) {
      for (const tuneRow of rects.tuneRows) {
        if (inRect(point, tuneRow.minus)) return { tune: tuneRow.row, dir: -1 };
        if (inRect(point, tuneRow.plus)) return { tune: tuneRow.row, dir: +1 };
      }
      if (inRect(point, rects.tuneReset)) return { tuneReset: true };
      if (inRect(point, rects.tyreHudBtn)) {
        setTyreHud(!tyreHud);
        return { consumed: true };
      }
      if (inRect(point, rects.tuneChip)) {
        tuneOpen = false;
        return { consumed: true };
      }
      if (inRect(point, rects.panel)) return { consumed: true }; // swallow taps on the panel body
    }
    if (expanded) {
      for (const carRow of rects.rows) if (inRect(point, carRow)) {
        expanded = false;
        return { car: carRow.id };
      }
      for (const levelRow of rects.levelRows) if (inRect(point, levelRow)) {
        expanded = false;
        return { level: levelRow.id };
      }
      if (!inRect(point, rects.chip)) {
        expanded = false;
        return { consumed: true };
      }
    }
    if (inRect(point, rects.chip)) {
      expanded = !expanded;
      tuneOpen = false;
      return { consumed: true };
    }
    if (inRect(point, rects.tuneChip)) {
      tuneOpen = !tuneOpen;
      expanded = false;
      return { consumed: true };
    }
    if (inRect(point, rects.speed)) {
      mph = !mph;
      try {
        localStorage.setItem('carsim.units', mph ? 'mph' : 'kmh');
      } catch { /* fine */ } return { consumed: true };
    }
    if (inRect(point, rects.restart)) return { restart: true };
    if (inRect(point, rects.reset)) return { reset: true };
    if (inRect(point, rects.clear)) return { clear: true };
    if (rects.vol && rects.vol.w > 0 && inRect(point, rects.vol)) return { volumeCycle: true };
    if (inRect(point, rects.help)) return { help: true };
    return null;
  }

  function panel(ctx, rect,
    { fill = 'rgba(27,29,34,0.88)', stroke = 'rgba(255,255,255,0.14)' } = {}) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    const rad = 8;
    ctx.moveTo(rect.x + rad, rect.y);
    ctx.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, rad);
    ctx.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, rad);
    ctx.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, rad);
    ctx.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, rad);
    ctx.closePath();
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // maxW: shrink the font until the text fits (long car names: "Lamburghini Hurrikan" ran into TUNE
  // and the drive tag)
  function label(ctx, text, x, y,
    { size = 12, col = COL.hudText, align = 'left', weight = 600, maxW = 0 } = {}) {
    ctx.fillStyle = col;
    ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    if (maxW) while (size > 7 && ctx.measureText(text).width > maxW) {
      size -= 0.5;
      ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    }
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  // The panel. Rows are drawn from the SAME list hit() walks, so a button is never drawn somewhere
  // its tap is not. A changed row is marked, and every value is read live off the car (rule 10).
  function drawTune(ctx, rects, car) {
    panel(ctx, rects.panel, { fill: "rgba(14,15,19,0.94)" });
    for (const tuneRow of rects.tuneRows) {
      const row = tuneRow.row;
      const value = row.get(car);
      const changed = isChanged(car, row);
      const centreY = tuneRow.y + tuneRow.h / 2;
      label(ctx, row.label, rects.panel.x + 9, centreY,
        { size: 10.5, weight: 600, col: changed ? "#ffd479" : "#dfe2ea" });
      label(ctx, row.fmt(value), tuneRow.minus.x - 8, centreY,
        { size: 11, weight: 700, align: "right", col: changed ? "#ffd479" : "#8fe6c8" });
      for (const [button, sign] of [[tuneRow.minus, "−"], [tuneRow.plus, "+"]]) {
        panel(ctx, button, { fill: "rgba(255,255,255,0.10)", stroke: "rgba(255,255,255,0.18)" });
        label(ctx, sign, button.x + button.w / 2, button.y + button.h / 2 + 0.5,
          { size: 15, align: "center", weight: 700 });
      }
    }
    panel(ctx, rects.tyreHudBtn,
      { fill: tyreHud ? 'rgba(76,194,160,0.92)' : 'rgba(255,255,255,0.10)', stroke: null });
    label(ctx, tyreHud ? 'TYRE HUD: ON' : 'TYRE HUD: OFF', rects.tyreHudBtn.x
      + rects.tyreHudBtn.w / 2, rects.tyreHudBtn.y + rects.tyreHudBtn.h / 2,
      { size: 10, weight: 700, align: 'center', col: tyreHud ? '#0d1a16' : COL.hudText });
    panel(ctx, rects.tuneReset, { fill: "rgba(216,69,60,0.85)", stroke: null });
    label(ctx, "RESET TUNING", rects.tuneReset.x + rects.tuneReset.w / 2, rects.tuneReset.y
      + rects.tuneReset.h / 2,
      { size: 10, align: "center", weight: 700 });
  }

  // START LIGHTS: three big lights at the top-centre, reds one per second with 3-2-1, then all
  // GREEN + GO! (held 1.2 s, then gone). Squares with a dark rim (pixel style), a glow when lit.
  // Rolling start: "ROLLING START" under red until the green.
  function drawLights(ctx, game, width, height) {
    const start = game.start;
    if (!start || !start.on) return;
    const sinceGreen = start.green ? start.t - start.tGreen : -1;
    if (start.green && sinceGreen > 1.2) return;
    // reds light in the LAST 3 s before the green (a rally stage's later start waits with "START IN
    // n" first)
    const litCount = start.rolling ? (start.t >= 1 ? 3 : 0)
      : Math.min(3, Math.max(0, Math.floor(start.t - (start.tGreen - 4)))), green = start.green
      || start.t >= start.tGreen - 0.12;
    const lightSize = Math.round(Math.min(width, height) * 0.11),
      gap = Math.round(lightSize * 0.35), boxWidth = 3 * lightSize + 2 * gap + 2 * gap,
      boxHeight = lightSize + 2 * gap;
    const boxX = Math.round(width / 2 - boxWidth / 2), boxY = Math.round(height * 0.2);
    panel(ctx, { x: boxX, y: boxY, w: boxWidth, h: boxHeight },
      { fill: 'rgba(14,15,18,0.92)', stroke: 'rgba(255,255,255,0.18)' });
    for (let i = 0; i < 3; i++) {
      const x = boxX + gap + i * (lightSize + gap), y = boxY + gap, lit = green || i < litCount;
      const col = green ? '#3ddc84' : lit ? '#ff3b2f' : '#3a1414';
      if (lit) {
        ctx.fillStyle = green ? 'rgba(61,220,132,0.35)' : 'rgba(255,59,47,0.35)';
        ctx.fillRect(x - 4, y - 4, lightSize + 8, lightSize + 8);
      }
      ctx.fillStyle = '#0b0c0f';
      ctx.fillRect(x - 2, y - 2, lightSize + 4, lightSize + 4);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, lightSize, lightSize);
      if (lit) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x + lightSize * 0.15, y + lightSize * 0.15, lightSize * 0.3, lightSize * 0.18);
      }
    }
    const txt = green ? 'GO!' : start.rolling ? 'ROLLING START' : litCount > 0
      ? String(4 - litCount) : start.tGreen - start.t > 4 ? 'START IN '
      + Math.ceil(start.tGreen - start.t) : '';
    if (txt) label(ctx, txt, width / 2, boxY + boxHeight + Math.round(lightSize * 0.55),
      { size: green || (!start.rolling && litCount > 0) ? Math.round(lightSize * 0.8)
      : Math.round(lightSize * 0.35), weight: 800, align: 'center', col: green ? '#3ddc84'
      : '#ffffff' });
  }
  // CHEQUERED FLAG (AI stage 4; user: "a chequered flag sweeping across the WHOLE screen for the
  // winner and when the event ends"): each new entry in game.flow.flags sweeps a waving band of
  // black / white squares left to right over FLAG_S of WALL time (rule 5: watched), with WINNER
  // (the first) or FINISH (the end) in the middle. Squares, not curves (pixel rule).
  const FLAG_S = 1.5;
  let flagSeen = 0, flagAt = 0, flagTxt = '';
  // NOTICE (track cuts): one line, centre-top under the lights' place, 2.2 s of wall time
  function drawNotice(ctx, game, width, height) {
    const notice = game.notice;
    if (!notice || performance.now() - notice.at > 2200) return;
    const fontSize = Math.round(Math.min(width, height) * 0.06), y = Math.round(height * 0.3);
    ctx.font = '800 ' + fontSize + 'px ui-sans-serif, system-ui, sans-serif';
    const boxWidth = ctx.measureText(notice.text).width + fontSize * 1.4;
    // n.good = good news (green: the highway's PULLING AWAY countdown), else a warning (red)
    panel(ctx,
      { x: Math.round(width / 2 - boxWidth / 2), y: y - fontSize, w: Math.round(boxWidth),
      h: Math.round(fontSize * 2) },
      { fill: 'rgba(14,15,18,0.92)', stroke: notice.good ? 'rgba(76,194,160,0.9)'
      : 'rgba(216,69,60,0.9)' });
    label(ctx, notice.text, width / 2, y,
      { size: fontSize, weight: 800, align: 'center', col: notice.good ? '#4cc2a0' : '#ff6a5c' });
  }
  // SPEED CAMERA CARD (highway.js speedCamera): 'YOU GOT CAUGHT' + your speed + the fine, top right
  // under the speedo, 3.2 s; a white screen FLASH for the first 0.12 s (the camera going off -
  // squares, no glow)
  function drawCamera(ctx, game, width, height) {
    const caught = game.camCaught;
    if (!caught) return;
    const elapsed = performance.now() - caught.at;
    if (elapsed > 3200) return;
    if (elapsed < 120) {
      ctx.fillStyle = `rgba(255,255,255,${(0.55 * (1 - elapsed / 120)).toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
    }
    // portrait: top right under the speedo; landscape: the empty left column under the top-left
    // buttons (PHOTOGRAPHED 2026-10-06: top right in landscape covered the ABS / TCS buttons)
    const fontSize = Math.round(Math.min(width, height) * 0.035),
      boxWidth = Math.round(fontSize * 11), boxHeight = Math.round(fontSize * 3.6),
      land = width > height;
    const x = land ? 24 : width - boxWidth - 12, y = land ? 104
      : Math.round(Math.min(height * 0.32, 150));
    panel(ctx, { x, y, w: boxWidth, h: boxHeight },
      { fill: 'rgba(14,15,18,0.94)', stroke: 'rgba(234,179,8,0.95)' });
    label(ctx, 'YOU GOT CAUGHT', x + boxWidth / 2, y + fontSize * 0.95,
      { size: fontSize, weight: 800, align: 'center', col: '#eab308' });
    label(ctx, `${caught.kmh} km/h  (${caught.mph} mph)`, x + boxWidth / 2, y + fontSize * 2.05,
      { size: Math.round(fontSize * 0.85), weight: 700, align: 'center', col: '#ffffff' });
    label(ctx, `FINE -$${caught.fine}`
      + (game.camCount > 1 ? `  \u00b7  ${game.camCount} CAUGHT, -$${game.camFines}` : ''), x
      + boxWidth / 2, y + fontSize * 3.0,
      { size: Math.round(fontSize * 0.75), weight: 700, align: 'center', col: '#ff6a5c',
      maxW: boxWidth - 10 });
  }
  function drawFlag(ctx, game, width, height) {
    // THE CHEQUERED FLAG (user, 2026-10-04: "only when you finish a race"; "look more like a real
    // flag — an overlay that WAVES in simulated 3D, shaded, detailed but still a quick pass"): a
    // cloth of NX x NY squares on a pole, every vertex lifted by a travelling wave (stronger toward
    // the free end), each square shaded by the wave's slope (light where it faces up, dark in the
    // folds), swept across the screen in FLAG_S of wall time with your place under it.
    const flow = game.flow;
    if (!flow) {
      flagSeen = 0;
      return;
    }
    const now = performance.now() / 1000;
    if (flow.flags.length > flagSeen) {
      flagSeen = flow.flags.length;
      flagAt = now;
      const place = flow.myPlace;
      flagTxt = flow.stage ? 'STAGE FINISHED' : flow.highway
        ? (place === 1 ? 'YOU GOT AWAY!' : 'P' + place + ' — THEY GOT AWAY') : place === 1
        ? 'YOU WIN!' : place ? 'P' + place + ' — FINISH' : 'FINISH';
      }
    const progress = (now - flagAt) / FLAG_S;
    if (!flagSeen || progress > 1) return;
    const FLAG_COLS = 18, FLAG_ROWS = 11, flagWidth = Math.min(width * 0.62, height * 1.15),
      flagHeight = flagWidth * 0.62, amp = flagHeight * 0.11, elapsed = now - flagAt;
    const ease = progress < 0.5 ? 2 * progress * progress : 1 - 2 * (1 - progress) * (1 - progress),
      poleX = -flagWidth * 1.05 + ease * (width + flagWidth * 1.25), top = height * 0.5
      - flagHeight * 0.62;
    const wave = (along, down) => amp * along * Math.sin(along * 7.5 - elapsed * 11 + down * 1.4)
      + amp * 0.35 * along * Math.sin(along * 13 - elapsed * 17);
    const vertex = (i, j) => {
      const along = i / FLAG_COLS, down = j / FLAG_ROWS;
      return [poleX + along * flagWidth * (0.97 + 0.03 * Math.cos(elapsed * 9 + along * 6)), top
        + down * flagHeight + wave(along, down)];
    };
    // shadow of the cloth, then the cloth
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(...vertex(0, 0).map((z, axis) => z + (axis ? 10 : 8)));
    for (let i = 1; i <= FLAG_COLS; i++) ctx.lineTo(...vertex(i, 0).map((z, axis) => z
      + (axis ? 10 : 8)));
    for (let j = 1; j <= FLAG_ROWS; j++) ctx.lineTo(...vertex(FLAG_COLS, j).map((z, axis) => z
      + (axis ? 10 : 8)));
    for (let i = FLAG_COLS
      - 1; i >= 0; i--) ctx.lineTo(...vertex(i, FLAG_ROWS).map((z, axis) => z + (axis ? 10 : 8)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < FLAG_COLS; i++) for (let j = 0; j < FLAG_ROWS; j++) {
      const topLeft = vertex(i, j), topRight = vertex(i + 1, j), bottomRight = vertex(i + 1, j + 1),
        bottomLeft = vertex(i, j + 1);
      const along = (i + 0.5) / FLAG_COLS, down = (j + 0.5) / FLAG_ROWS,
        slope = (wave(along + 0.02, down) - wave(along - 0.02, down)) / (0.04 * flagWidth);
      const shade = Math.max(0.45, Math.min(1.25, 1 - slope * 2.6)), white = (i + j) % 2 === 0,
        base = white ? 236 : 26,
        col = Math.round(Math.min(255, base * shade + (white ? 0 : 18 * (shade - 1))));
      ctx.fillStyle = 'rgb(' + col + ',' + col + ',' + Math.min(255, col + (white ? 4 : 6)) + ')';
      ctx.beginPath();
      ctx.moveTo(topLeft[0], topLeft[1]);
      ctx.lineTo(topRight[0], topRight[1]);
      ctx.lineTo(bottomRight[0], bottomRight[1]);
      ctx.lineTo(bottomLeft[0], bottomLeft[1]);
      ctx.closePath();
      ctx.fill();
    }
    // the pole: dark edge, light highlight, a ball on top
    const poleWidth = Math.max(4, flagWidth * 0.025);
    ctx.fillStyle = '#2a2d34';
    ctx.fillRect(poleX - poleWidth, top - flagHeight * 0.08, poleWidth, flagHeight * 1.55);
    ctx.fillStyle = '#9aa0aa';
    ctx.fillRect(poleX - poleWidth * 0.7, top - flagHeight * 0.08, poleWidth * 0.3,
      flagHeight * 1.55);
    ctx.fillStyle = '#e8a13a';
    ctx.fillRect(poleX - poleWidth * 1.4, top - flagHeight * 0.16, poleWidth * 1.8,
      poleWidth * 1.8);
    label(ctx, flagTxt, poleX + flagWidth * 0.5, top + flagHeight + Math.min(width, height) * 0.09,
      { size: Math.round(Math.min(width, height) * 0.085), weight: 800, align: 'center',
      col: '#e8a13a' });
  }

  function draw(ctx, game, width, height, wallDt) {
    carDiagram = tyreHud
      || !!(game.car.dmg && game.car.dmg.some((amount) => amount >= 0.05)
      || (game.car.punct && game.car.punct.some(Boolean)));
    try {
      drawLightsLater = () => {
        drawLights(ctx, game, width, height);
        drawNotice(ctx, game, width, height);
        drawCamera(ctx, game, width, height);
        drawFlag(ctx, game, width, height);
      };
    } catch {}
    const rects = layout(width, height);
    const car = game.car;
    const spec = car.spec;

    // ---- top-left: car chip
    panel(ctx, rects.chip);
    label(ctx, spec.name, rects.chip.x + 10, rects.chip.y + rects.chip.h / 2,
      { size: 12.5, maxW: rects.chip.w - 30 });
    label(ctx, expanded ? '▴' : '▾', rects.chip.x + rects.chip.w - 12, rects.chip.y
      + rects.chip.h / 2, { align: 'right', col: COL.inkSoft });
    if (expanded) {
      for (const carRow of rects.rows) {
        const selected = carRow.id === spec.id;
        panel(ctx, carRow, { fill: selected ? 'rgba(76,194,160,0.92)' : 'rgba(27,29,34,0.88)' });
        const row = ROSTER.find((entry) => entry.id === carRow.id);
        label(ctx, row.name, carRow.x + 10, carRow.y + carRow.h / 2,
          { size: 12, col: selected ? '#0d1a16' : COL.hudText, maxW: carRow.w - 52 });
        // the drive layout is the point of the roster, so it is on the row
        const drive = row.drive === 1 ? 'FWD' : row.drive === 0 ? 'RWD' : '4WD';
        label(ctx, drive, carRow.x + carRow.w - 10, carRow.y + carRow.h / 2,
          { size: 10.5, align: 'right', col: selected ? '#0d1a16' : COL.inkSoft });
      }
      // ---- and the LEVELS, under the cars in the same dropdown
      for (const levelRow of rects.levelRows) {
        const selected = levelRow.id === LEVEL.id;
        panel(ctx, levelRow, { fill: selected ? 'rgba(232,161,58,0.94)' : 'rgba(27,29,34,0.88)' });
        label(ctx, levelRow.name, levelRow.x + 10, levelRow.y + levelRow.h / 2,
          { size: 12, col: selected ? '#2a1405' : COL.hudText });
        label(ctx, 'LEVEL', levelRow.x + levelRow.w - 10, levelRow.y + levelRow.h / 2,
          { size: 10, align: 'right', col: selected ? '#2a1405' : COL.inkSoft });
      }
    }

    // ---- top-left: the TUNE chip, opening the debug panel
    panel(ctx, rects.tuneChip,
      { fill: tuneOpen ? 'rgba(232,161,58,0.94)' : 'rgba(27,29,34,0.88)' });
    label(ctx, 'TUNE', rects.tuneChip.x + rects.tuneChip.w / 2, rects.tuneChip.y
      + rects.tuneChip.h / 2,
      { size: 11.5, align: 'center', col: tuneOpen ? '#2a1405' : COL.hudText });

    // ---- bottom-right, above the pedals: DRIVER AIDS. Green = on, dark = off, AMBER FLASH while
    // working — the silent twin of a real ABS buzz (the phone may be muted). Flash on the wall
    // clock (rule 5).
    if (spec.aids) {
      for (const [key, chip, active,
        working] of [['abs', rects.absChip, car.absOn, car.t.absWorking],
        ['tcs', rects.tcsChip, car.tcsOn, car.t.tcsWorking]]) {
        if (!spec.aids[key]) continue;
        aidFlash[key] = working && active ? 1 : Math.max(0, aidFlash[key] - wallDt * 5);
        const flash = aidFlash[key] * (0.6 + 0.4 * Math.sin(performance.now() / 45));
        panel(ctx, chip,
          { fill: flash > 0.05 ? 'rgba(232,161,58,' + (0.55 + 0.4 * flash).toFixed(2) + ')' : active
          ? 'rgba(76,194,160,0.90)' : 'rgba(27,29,34,0.80)' });
        label(ctx, key.toUpperCase(), chip.x + chip.w / 2, chip.y + chip.h / 2 - (active ? 0 : 5),
          { size: 11.5, weight: 700, align: 'center', col: active ? '#0d1a16' : COL.inkSoft });
        if (!active) label(ctx, 'OFF', chip.x + chip.w / 2, chip.y + chip.h / 2 + 7,
          { size: 8.5, weight: 700, align: 'center', col: COL.danger });
      }
    }

    // ---- bottom-left: ◄ LIGHTS ► (the indicator buttons blink amber while on, LIGHTS lit while
    // the headlights are on)
    {
      const blink = Math.floor(performance.now() / 333) % 2 === 0;
      for (const [button, txt, lit] of [[rects.indL, '◄', car.indicator === -1 && blink],
        [rects.lights, 'LIGHTS', !!car.lightsOn],
        [rects.indR, '►', car.indicator === 1 && blink]]) {
        panel(ctx, button,
          { fill: lit ? (txt === 'LIGHTS' ? 'rgba(242,230,170,0.92)' : 'rgba(232,161,58,0.92)')
          : 'rgba(27,29,34,0.80)' });
        label(ctx, txt, button.x + button.w / 2, button.y + button.h / 2,
          { size: txt === 'LIGHTS' ? 10.5 : 14, weight: 800, align: 'center', col: lit ? '#1b1d22'
          : COL.hudText });
      }
    }

    if (tuneOpen) drawTune(ctx, rects, car);

    // ---- top-centre: restart / reset / clear / vol
    const audio = game.audio;
    if (rects.vol && rects.vol.w > 0) {
      rects.vol.label = !audio ? 'VOL' : audio.muted ? 'MUTE' : Math.round(audio.volume * 100)
        + '%';
    }
    const btns = (rects.vol && rects.vol.w > 0)
      ? [rects.restart, rects.reset, rects.clear, rects.vol]
      : [rects.restart, rects.reset, rects.clear];
    if (!(rects.help.row3 && (expanded || tuneOpen))) btns.push(rects.help);
    // On a narrow screen this row sits in the car dropdown's lane (left, row two). While the
    // dropdown is open it owns that lane — hit() already sends those taps to the dropdown — so do
    // not draw over it.
    const rowHidden = expanded && rects.restart.y > MARGIN;
    if (!rowHidden) for (const button of btns) {
      panel(ctx, button);
      const isMuted = button === rects.vol && audio && (audio.muted || audio.volume <= 0.001);
      label(ctx, button.label, button.x + button.w / 2, button.y + button.h / 2, {
        size: button === rects.help ? 14 : 10.5, align: 'center', weight: button === rects.help
          ? 700 : 600,
        col: isMuted ? COL.danger : COL.hudText,
      });
    }

    // ---- top-centre, under the buttons: cone tally. Reads LIVE state — it counts what is actually
    // lying down, not what was hit (rule 10) — so standing one back up with RESET counts down
    // again.
    const knocked = game.cones.knocked;
    // ONLY ON A LEVEL THAT ASKS FOR IT (LEVEL.coneCount: the Lab + Test Track courses) — user:
    // "only relevant when asked for, not on most race tracks"
    if (LEVEL.coneCount && knocked > 0 && !tuneOpen) {
      const tallyRect = rects.tally;
      panel(ctx, tallyRect, { fill: 'rgba(242,106,27,0.92)', stroke: null });
      label(ctx, knocked + ' / ' + game.cones.total + ' CONES', tallyRect.x + tallyRect.w / 2,
        tallyRect.y + tallyRect.h / 2,
        { size: 11, align: 'center', col: '#2a1405', weight: 700 });
    }

    // ---- top-right: speed, gear, tacho (the SILENT TWIN of the engine note — the phone may be
    // muted)
    const speedRect = rects.speed, speedWidth = speedRect.w;
    panel(ctx, speedRect);
    const kph = Math.hypot(car.vx, car.vy) * 3.6;
    label(ctx, String(Math.round(mph ? kph * 0.621371 : kph)), speedRect.x + 10, speedRect.y + 19,
      { size: 22, weight: 700 });
    label(ctx, mph ? 'mph' : 'km/h', speedRect.x + 62, speedRect.y + 24,
      { size: 9.5, col: COL.inkSoft });
    // GEAR CHANGE, made obvious. The automatic box already cuts the torque for a quarter of a
    // second, but with no sound and no needle the player had no way to know a shift had happened.
    // Flash the gear digit and pop it up a size — on the WALL CLOCK, because it is something you
    // watch (rule 5).
    const gearTxt = car.gear < 0 ? 'R' : String(car.gear);
    if (car.gear !== lastGear) {
      gearFlash = 1;
      lastGear = car.gear;
    }
    gearFlash = Math.max(0, gearFlash - wallDt * 2.6);
    const gearPop = gearFlash * gearFlash;
    if (gearPop > 0.02) {
      ctx.globalAlpha = gearPop * 0.85;
      ctx.fillStyle = COL.warn;
      ctx.beginPath();
      ctx.arc(speedRect.x + speedWidth - 22, speedRect.y + 19, 17 + gearPop * 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    label(ctx, gearTxt, speedRect.x + speedWidth - 12, speedRect.y + 19,
      { size: 20 + gearPop * 8, weight: 700, align: 'right', col: gearPop > 0.15 ? '#2a1405'
        : COL.live });

    // tacho bar
    const barX = speedRect.x + 10, barY = speedRect.y + 38, barW = speedWidth - 20, barH = 7;
    const frac = Math.max(0, Math.min(1, (car.rpm - spec.idleRpm) / (spec.redline - spec.idleRpm)));
    const redFrac = (spec.upshiftRpm - spec.idleRpm) / (spec.redline - spec.idleRpm);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = frac > redFrac ? COL.danger : frac > redFrac * 0.82 ? COL.warn : COL.live;
    ctx.fillRect(barX, barY, barW * frac, barH);
    // redline zone marker
    ctx.fillStyle = 'rgba(216,69,60,0.55)';
    ctx.fillRect(barX + barW * redFrac, barY - 2, 1.5, barH + 4);
    // shift light: flashes on the WALL CLOCK (rule 5), not per physics step
    if (frac > redFrac) shiftFlash = Math.min(1, shiftFlash + wallDt * 8);
    else shiftFlash = Math.max(0, shiftFlash - wallDt * 6);
    if (shiftFlash > 0.02) {
      ctx.globalAlpha = shiftFlash * (0.55 + 0.45 * Math.sin(performance.now() / 60));
      ctx.fillStyle = COL.danger;
      ctx.fillRect(barX, barY - 5, barW, 2.5);
      ctx.globalAlpha = 1;
    }

    // TYRE DIAGRAM (optional HUD). A little top-down car, FRONT UP, each wheel filled with its
    // temperature colour and its number beside it (user, 2026-10-03: "not clear which is front and
    // which is back — draw a little car and display the colours on the wheels"). The same body
    // outline is where DAMAGE will be shown later. vehicle.js indexes tyres by body side: 0 F+y, 1
    // F-y, 2 R+y, 3 R-y, and +y is the car's RIGHT.
    if (carDiagram && car.tyreT) {
      const [optLow, optHigh] = spec.tyreOpt || [65, 110];
      const col = (temp) => (temp < optLow - 15 ? '#5b8fd6' : temp < optLow ? '#7fb6c9'
        : temp <= optHigh ? COL.live : temp <= optHigh + 25 ? COL.warn : COL.danger);
      const centreX = speedRect.x + speedWidth / 2, top = speedRect.y + 56, bodyW = 20, bodyH = 40,
        bodyX = centreX - bodyW / 2, bodyY = top + 4;
      // wheels first (under the body edge), then the body, then a windscreen so the FRONT is
      // unmistakable
      const wheels = [[1, -1, 0], [0, 1, 0], [3, -1, 1], [2, 1, 1]];
      // ^ [tyre index, side -1 left / +1 right, rear?]
      for (const [tyreIdx, side, rear] of wheels) {
        const wheelX = side < 0 ? bodyX - 4 : bodyX + bodyW - 3, wheelY = bodyY
          + (rear ? bodyH - 14 : 4);
        // plain rectangles: panel()'s 8 px corner radius is larger than a 7 px wheel and drew
        // mangled slants
        ctx.fillStyle = col(car.tyreT[tyreIdx]);
        ctx.fillRect(wheelX, wheelY, 7, 11);
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(wheelX + 0.5, wheelY + 0.5, 6, 10);
        label(ctx, String(Math.round(car.tyreT[tyreIdx])), side < 0 ? wheelX - 4 : wheelX + 11,
          wheelY + 6,
          { size: 9.5, weight: 700, align: side < 0 ? 'right' : 'left',
            col: col(car.tyreT[tyreIdx]) });
      }
      panel(ctx, { x: bodyX, y: bodyY, w: bodyW, h: bodyH },
        { fill: 'rgba(205,210,220,0.92)', stroke: 'rgba(0,0,0,0.35)' });
      // DAMAGE (damage.js corners: 0 front -y, 1 front +y, 2 rear -y, 3 rear +y; +y = RIGHT): each
      // body quarter amber / red with the damage there, a white-ringed wheel = a puncture
      if (car.dmg) for (let corner = 0; corner < 4; corner++) {
        const damage = car.dmg[corner], quarterX = corner % 2 ? bodyX + bodyW / 2 : bodyX + 1,
          quarterY = corner < 2 ? bodyY + 1 : bodyY + bodyH / 2;
        if (damage >= 0.05) {
          ctx.fillStyle = damage < 0.5 ? 'rgba(232,161,58,' + (0.45 + 0.5 * damage).toFixed(2) + ')'
            : 'rgba(216,69,60,' + (0.6 + 0.4 * damage).toFixed(2) + ')';
          ctx.fillRect(quarterX, quarterY, bodyW / 2 - 1, bodyH / 2 - 1);
        }
        if (car.punct && car.punct[corner]) {
          const wheelX = corner % 2 ? bodyX + bodyW - 3 : bodyX - 4, wheelY = bodyY
            + (corner >= 2 ? bodyH - 14 : 4);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(wheelX - 0.5, wheelY - 0.5, 8, 12);
        }
        // wheel GONE
        if (car.wheelOff && car.wheelOff[corner]) {
          const wheelX = corner % 2 ? bodyX + bodyW - 3 : bodyX - 4, wheelY = bodyY
            + (corner >= 2 ? bodyH - 14 : 4);
          ctx.fillStyle = '#1b1c21';
          ctx.fillRect(wheelX, wheelY, 7, 11);
          ctx.strokeStyle = COL.danger;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(wheelX, wheelY);
          ctx.lineTo(wheelX + 7, wheelY + 11);
          ctx.moveTo(wheelX + 7, wheelY);
          ctx.lineTo(wheelX, wheelY + 11);
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(40,46,58,0.85)';
      ctx.fillRect(bodyX + 3, bodyY + 9, bodyW - 6, 6); // windscreen near the top = the front
      ctx.fillRect(bodyX + 4, bodyY + bodyH - 9, bodyW - 8, 4);              // rear window
      label(ctx, 'FRONT', centreX, bodyY - 1,
        { size: 6.5, weight: 700, align: 'center', col: COL.inkSoft });
    }

    // ---- top-right, under speed: lap counter & timer (circuit levels only)
    if (LEVEL.subtrack && game.lap) {
      const lapRect = rects.lap;
      panel(ctx, lapRect);
      if (game.ai && game.ai.length
        && game.position) label(ctx, `P${game.position}/${game.ai.length + 1}`, lapRect.x
        + lapRect.w - 8, lapRect.y + 26,
        { size: 11, weight: 800, align: 'right', col: game.position === 1 ? '#f2c21b' : COL.live });
      const lapNum = Math.max(1, game.lap.lap || 1);
      const race = game.race, stage = game.stage;
      if (LEVEL.endless) {
        // HIGHWAY TO HULL: how far you have got, and your best
        label(ctx, 'DISTANCE', lapRect.x + 8, lapRect.y + 13,
          { size: 11, weight: 700, col: COL.live });
        label(ctx, ((game.hwDist || 0) / 1000).toFixed(2) + ' KM', lapRect.x + lapRect.w - 8,
          lapRect.y + 13, { size: 11, weight: 700, align: 'right', col: COL.hudText });
        // in a VS AI race the second line is the gap to the car ahead (or your lead over the one
        // behind) instead of your best
        const flow = game.flow, player = flow && flow.highway && game.car._hwf;
        if (player && game.ai && game.ai.length) {
          const gaps = game.ai.map((rival) => (rival.car._hwf ? rival.car._hwf.s - player.s
            : -Infinity)), ahead = gaps.filter((gap) => gap > 0),
            behind = gaps.filter((gap) => gap <= 0 && isFinite(gap));
          const txt = ahead.length ? 'AHEAD +' + Math.round(Math.min(...ahead)) + ' M'
            : behind.length ? 'LEAD ' + Math.round(-Math.max(...behind)) + ' M' : '';
          label(ctx, txt, lapRect.x + 8, lapRect.y + 26,
            { size: 9, weight: 700, col: ahead.length ? COL.inkSoft : COL.live });
        } else label(ctx, 'BEST ' + ((game.hwBest || 0) / 1000).toFixed(2) + ' KM', lapRect.x + 8,
          lapRect.y + 26, { size: 9, weight: 600, col: COL.inkSoft });
      } else if (LEVEL.stage && stage) {
        // RALLY STAGE: the same panel. READY -> STAGE (running clock) -> FINISH with the run's
        // time; BEST underneath
        const run = stage.state === 'running', done = stage.state === 'done';
        label(ctx, done ? 'FINISH' : 'STAGE', lapRect.x + 8, lapRect.y + 13,
          { size: 11, weight: 700, col: COL.live });
        label(ctx, fmtTime(done ? stage.last : run ? stage.t : 0), lapRect.x + lapRect.w - 8,
          lapRect.y + 13, { size: 11, weight: done ? 700 : 600, align: 'right', col: COL.hudText });
        const newBest = done && stage.best === stage.last;
        label(ctx, newBest ? 'NEW BEST' : stage.best != null ? `BEST ${fmtTime(stage.best)}`
          : stage.state === 'ready' ? 'CROSS THE LINE' : 'BEST --:--.--', lapRect.x + 8, lapRect.y
          + 26, { size: 9, weight: newBest ? 700 : 600, col: newBest ? COL.live : COL.inkSoft });
      } else if (race && race.on && LEVEL.joker) {
        // RX RACE: the same panel, no new HUD lane (CLAUDE.md §4: the corners have owners)
        if (race.done) {
          label(ctx, 'FINISH', lapRect.x + 8, lapRect.y + 13,
            { size: 11, weight: 700, col: COL.live });
          label(ctx, fmtTime(race.total), lapRect.x + lapRect.w - 8, lapRect.y + 13,
            { size: 11, weight: 700, align: 'right', col: COL.hudText });
          label(ctx, !race.penalty ? 'JOKER DONE' : race.jokers === 0
            ? `+${race.penalty} s NO JOKER` : `+${race.penalty} s EXTRA JOKER`, lapRect.x + 8,
            lapRect.y + 26, { size: 9, weight: 700, col: race.penalty ? COL.danger : COL.live });
        } else {
          label(ctx, `LAP ${Math.min(lapNum, race.laps)}/${race.laps}`, lapRect.x + 8, lapRect.y
            + 13, { size: 11, weight: 700, col: COL.live });
          label(ctx, fmtTime(race.t), lapRect.x + lapRect.w - 8, lapRect.y + 13,
            { size: 11, weight: 600, align: 'right', col: COL.hudText });
          // approaching the joker turn-off without it done: the line FLASHES "JOKER >" (the
          // approach arrow's distance, lab.js jokerApproach)
          const jokerArrow = LEVEL.joker && LEVEL.joker.arrows
            && LEVEL.joker.arrows.find((x) => x.d != null), trackDist = game.trackD;
          const near = race.started && !race.joker && jokerArrow && trackDist != null
            && (((jokerArrow.d - trackDist) % LEVEL.subtrack.totalDist)
            + LEVEL.subtrack.totalDist) % LEVEL.subtrack.totalDist < 140;
          const flash = near && Math.floor(performance.now() / 250) % 2 === 0;
          // the line switches as it happens: TO DO -> ››› (approaching) -> IN JOKER (on the lane)
          // -> JOKER TAKEN ✓ (flashing 2 s) -> JOKER DONE
          const inLane = !race.joker && game.inJokerLane, fresh = race.joker && race.jokers === 1
            && performance.now() - (game.jokerAt || 0) < 2000;
          const blink = Math.floor(performance.now() / 200) % 2 === 0;
          const jTxt = race.jokers > 1 ? `JOKER x${race.jokers}: +${(race.jokers - 1) * 30} s`
            : fresh ? 'JOKER TAKEN ✓' : race.joker ? 'JOKER DONE ✓' : inLane ? 'IN JOKER ›' : near
            ? 'JOKER  ›››' : 'JOKER TO DO';
          const jCol = race.jokers > 1 ? COL.danger : fresh ? (blink ? '#ffffff' : COL.live)
            : race.joker || inLane ? COL.live : flash ? '#ffffff' : COL.warn || '#e8a13a';
          label(ctx, jTxt, lapRect.x + 8, lapRect.y + 26,
            { size: near || fresh || inLane ? 10.5 : 9, weight: 800, col: jCol });
        }
      } else {
        // a VS AI race (raceflow.js): LAP n/N from the race's own count, FINISH once you are home
        const flow = game.flow, player = flow && flow.entries.find((entry) => entry.player);
        label(ctx, player
          ? (player.finish != null ? 'FINISH'
          : `LAP ${Math.min(flow.laps, player.lapDone + 1)}/${flow.laps}`) : `LAP ${lapNum}`,
          lapRect.x + 8, lapRect.y + 13, { size: 11, weight: 700, col: COL.live });
        label(ctx,
          fmtTime(player ? (player.finish != null ? player.finish : flow.t) : game.lap.lapTime),
          lapRect.x + lapRect.w - 8, lapRect.y + 13,
          { size: 11, weight: 600, align: 'right', col: COL.hudText });
        const bestTxt = game.lap.bestTime ? `BEST ${fmtTime(game.lap.bestTime)}` : 'BEST --:--.--';
        label(ctx, bestTxt, lapRect.x + 8, lapRect.y + 26,
          { size: 9, weight: 600, col: COL.inkSoft });
      }
    }

    // ---- bottom-right: pedals (touch only)
    if (game.input.isTouch()) {
      for (const pedal of game.input.pedalHits(width, height)) {
        const pressed = !!game.input.pedals[pedal.name];
        ctx.beginPath();
        ctx.arc(pedal.x, pedal.y, pedal.r, 0, Math.PI * 2);
        ctx.fillStyle = pressed
          ? (pedal.name === 'throttle' ? 'rgba(76,194,160,0.92)' : pedal.name === 'brake'
            ? 'rgba(216,69,60,0.92)' : 'rgba(232,161,58,0.92)')
          : 'rgba(27,29,34,0.80)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.20)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const txt = pedal.name === 'throttle' ? 'GAS' : pedal.name === 'brake' ? 'BRAKE'
          : pedal.name === 'reverse' ? 'R' : 'HAND';
        label(ctx, txt, pedal.x, pedal.y,
          { size: pedal.name === 'reverse' ? 13 : 10.5, align: 'center', col: pressed ? '#0d1a16'
          : COL.hudText });
      }
      // ---- bottom-left: the thumb stick, drawn where the thumb actually landed
      const stick = game.input.stick;
      if (stick.active) {
        ctx.beginPath();
        ctx.arc(stick.ox, stick.oy, 46, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 2;
        ctx.stroke();
        const dx = Math.max(-52, Math.min(52, stick.x - stick.ox));
        ctx.beginPath();
        ctx.arc(stick.ox + dx, stick.oy, 22, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(232,232,238,0.85)';
        ctx.fill();
      } else {
        label(ctx, 'drag anywhere on the left to steer', MARGIN, height - MARGIN - 46,
          { size: 10.5, col: 'rgba(42,44,51,0.5)' });
      }
    } else {
      label(ctx, 'W/S drive   A/D steer   SPACE handbrake   B abs   T tcs   R reset   H help',
        MARGIN, height - MARGIN - 46,
        { size: 11, col: 'rgba(42,44,51,0.55)' });
    }

    // ---- dev readout (?dev=1). Every hidden number the tyre model runs on (CLAUDE.md §3: a system
    // the player reads by feel is one you cannot debug by feel).
    if (game.dev && !tuneOpen) {
      const tyreState = car.t;
      const lines = [
        `v ${(Math.hypot(car.vx, car.vy)).toFixed(1)} m/s   `
          + `vLong ${tyreState.vLong.toFixed(1)}  vLat ${tyreState.vLat.toFixed(2)}`,
        `beta ${(Math.atan2(tyreState.vLat, Math.abs(tyreState.vLong)) * 57.3).toFixed(1)}°   `
          + `yaw ${car.yawRate.toFixed(2)}  delta ${(car.delta * 57.3).toFixed(1)}°`,
        `slip F ${(tyreState.slipF * 57.3).toFixed(1)}°  `
          + `R ${(tyreState.slipR * 57.3).toFixed(1)}°`,
        `Fz  F ${tyreState.FzF.toFixed(0)}  R ${tyreState.FzR.toFixed(0)}`,
        `Fy  F ${tyreState.FyF.toFixed(0)}/${tyreState.FyMaxF.toFixed(0)}  `
          + `R ${tyreState.FyR.toFixed(0)}/${tyreState.FyMaxR.toFixed(0)}`,
        `sat F ${tyreState.satF.toFixed(2)} R ${tyreState.satR.toFixed(2)}   `
          + `ax ${tyreState.ax.toFixed(1)} ay ${tyreState.ay.toFixed(1)}`,
        `slide F ${tyreState.slidingF ? 'Y' : '.'} R ${tyreState.slidingR ? 'Y' : '.'}   `
          + `lock F ${tyreState.lockedF ? 'Y' : '.'} R ${tyreState.lockedR ? 'Y' : '.'}`,
        `slipSpd F ${tyreState.slipSpeedF.toFixed(2)} R ${tyreState.slipSpeedR.toFixed(2)}  `
          + `marks ${game.marks.stamps}`,
        // WHAT YOU ARE STANDING ON. With ten surfaces the single most useful line in here: a
        // handling complaint is meaningless without it, and load tells you what the suspension is
        // doing.
        `surf ${car.surface.id} mu ${car.surface.mu.toFixed(2)} `
          + `peak ${(car.surface.peakK || 1).toFixed(2)} `
          + `plough ${(car.surface.plough || 0).toFixed(1)}  `
          + `load F ${tyreState.loadKF.toFixed(2)} R ${tyreState.loadKR.toFixed(2)}`,
        `rpm ${car.rpm.toFixed(0)}  gear ${car.gear}  T ${tyreState.torque.toFixed(0)}Nm  `
          + `steps/f ${game.stepsLastFrame}`,
        `fps ${game.fps.toFixed(0)}   `
          + `in  st ${game.in.steer.toFixed(2)} th ${game.in.throttle.toFixed(2)} `
          + `br ${game.in.brake.toFixed(2)} hb ${game.in.handbrake ? 1 : 0}`,
      ];
      const readoutH = lines.length * 11 + 12;
      const readoutRect = { x: MARGIN, y: height - MARGIN - readoutH - 22, w: 232, h: readoutH };
      panel(ctx, readoutRect, { fill: 'rgba(10,11,14,0.82)' });
      lines.forEach((textLine, i) =>
        label(ctx, textLine, readoutRect.x + 8, readoutRect.y + 12 + i * 11,
          { size: 8.5, weight: 500, col: '#b9f0dd' }));
    }
    // ---- FPS, test mode: now + the worst of the last ~10 s; amber under 50, red under 30
    if (game.testMode && game.fps) {
      const fpsRect = rects.fps, fpsLow = game.fpsLow || game.fps,
        col = (value) => (value < 30 ? '#ff6a5c' : value < 50 ? '#e8a13a' : COL.live);
      panel(ctx, fpsRect, { fill: 'rgba(14,15,18,0.82)' });
      label(ctx, Math.round(game.fps) + ' FPS', fpsRect.x + 8, fpsRect.y + fpsRect.h / 2,
        { size: 10, weight: 800, col: col(game.fps) });
      label(ctx, 'LOW ' + Math.round(fpsLow), fpsRect.x + fpsRect.w - 8, fpsRect.y + fpsRect.h / 2,
        { size: 10, weight: 800, align: 'right', col: col(fpsLow) });
    }
    if (drawLightsLater) {
      drawLightsLater();
      drawLightsLater = null;
    }
  }
  let drawLightsLater = null;

  return {
    draw, hit, layout,
    get tyreHud() { return tyreHud; }, setTyreHud,
    get expanded() { return expanded; },
    setHelpLabel(labelText) { helpLabel = labelText; },
    get tuneOpen() { return tuneOpen; },
    close() {
      expanded = false;
      tuneOpen = false;
    },
  };
}
