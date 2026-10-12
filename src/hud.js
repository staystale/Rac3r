// hud.js — HUD, touch overlay and the dev readout.
//
// THE FOUR CORNERS HAVE OWNERS (CLAUDE.md §4) and no two systems share a lane:
//   top-left      car selector chip (collapsed by default; expands DOWNWARD into five rows)
//   top-centre    RESET and CLEAR MARKS
//   top-right     speed, gear, tacho + shift light   (the silent twin of the engine note)
//   bottom-left   thumb stick (touch) / key hints (pc)
//   bottom-right  throttle / brake / handbrake pedals (touch)
//   left edge     dev readout, ?dev=1 only, below the chip — nothing else may live there
//
// Buttons are DATA so hit-testing and drawing read the same geometry. Two copies of a rect is how a
// button ends up visually somewhere its tap is not.

import { ROSTER, CAR_IDS } from './cars.js';
import { LEVELS } from "./world/levels/index.ts";
import { LEVEL } from "./world/state.ts";
import { COL } from "./world/colours.ts";
import { PEDAL } from './input.js';
import { ROWS as TUNE_ROWS, isChanged } from './tune.js';

const M = 12;              // minimum margin
const BTN_H = 34;          // >= 30px touch target; the repeated ones (pedals) are 72px

function fmtTime(s) {
  if (!s || s <= 0) return '0:00.00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 100);
  return `${m}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

export function createHud() {
  let expanded = false;        // car list
  let tuneOpen = false;        // debug/tuning panel — only one of the two is ever open
  let shiftFlash = 0;
  let gearFlash = 0, lastGear = 1;
  const aidFlash = { abs: 0, tcs: 0 };
  // the replay / pause chip: '?' replays the guide; with menus on it is the PAUSE chip ('II'), and How to play lives in there
  let helpLabel = '?';   // a shift should be VISIBLE even on the automatic box (user)
  // OPTIONAL TYRE / DAMAGE HUD (user, 2026-10-03: "hud should be optional, turn on and off"). Off by default —
  // the car itself shows only realistic feedback (faint cold marks, marbles, smoke). Remembered per device;
  // storage can throw in private windows, so every access is guarded.
  let tyreHud = false, carDiagram = false;   // carDiagram: the tyre HUD is on, OR the car is damaged (user: "use that for damage too")
  try { tyreHud = localStorage.getItem('carsim.tyreHud') === '1'; } catch { /* no storage: stays off */ }
  // SPEED UNITS (user, 2026-10-04: "tapping the speed / kph should change it to mph"), remembered on the device
  let mph = false;
  try { mph = localStorage.getItem('carsim.units') === 'mph'; } catch { /* no storage: km/h */ }
  const setTyreHud = (on) => { tyreHud = !!on; try { localStorage.setItem('carsim.tyreHud', tyreHud ? '1' : '0'); } catch { /* fine */ } };

  function layout(W, H) {
    const chip = { x: M, y: M, w: 116, h: BTN_H };
    // 164, was 132. PHOTOGRAPHED 2026-10-03: "Naffcar Speedway" and "Surface Sandbox" ran into the LEVEL
    // tag at 132. Car and level rows share the width so the dropdown stays one clean column.
    const DROP_W = 164;
    const dTop = M + BTN_H + 6, dStep = 26, perCol = Math.max(4, Math.floor((H - dTop - M - 42) / dStep));
    const dAt = (i, col0) => ({ x: M + (col0 + Math.floor(i / perCol)) * (DROP_W + 6), y: dTop + (i % perCol) * dStep });
    const carCols = Math.ceil(CAR_IDS.length / perCol);
    const rows = CAR_IDS.map((id, i) => ({ id, ...dAt(i, 0), w: DROP_W, h: dStep - 2 }));
    // LEVEL ROWS hang below the car rows in the SAME dropdown. They do NOT get a chip of their own on
    // the top row: that row already carries car 116 + TUNE 64 + RESET 76 + CLEAR 76 + speed 120 and is
    // the exact lane that has produced two overlap bugs. Reusing the dropdown costs no new space and
    // cannot collide with anything (CLAUDE.md §4: the four corners have owners).
    const levelRows = LEVELS.map((lv, i) => ({ id: lv.id, name: lv.name, ...dAt(i, carCols), w: DROP_W, h: dStep - 2 }));
    const cw = 76;
    const tuneChip = { x: M + chip.w + 6, y: M, w: 64, h: BTN_H };
    // MEASURED BUG, 2026-09-27 (caught by tools/uicheck.mjs, not by eye): adding the TUNE chip made the
    // top row need chip 116 + TUNE 64 + RESET 76 + CLEAR 76 + the speed panel 120 = 462 px, and a
    // portrait phone is 390. TUNE landed on top of RESET and ate its taps. On a narrow screen the pair
    // drops to a second row on the RIGHT, which is empty there. Two systems must never share a lane.
    const narrow = W < 620;
    const btnY = narrow ? M + BTN_H + 6 : M;
    const wRestart = 70, wReset = 58, wClear = 54, wVol = 48, wHelp = 34;
    const totalW = wRestart + 4 + wReset + 4 + wClear + (narrow ? 0 : 4 + wVol + 4 + wHelp);
    // Ensure the center block doesn't overlap the new TCS chip on wide screens
    const minX = narrow ? M : tuneChip.x + tuneChip.w + 6;
    // NARROW = LEFT-ALIGNED, never centred. MEASURED BUG, 2026-10-03 (tools/uicheck.mjs + photo at
    // 390x844): centring this second row (Gemini, 2026-10-01) pushed CLEAR under the speed and lap panels,
    // which own the top-RIGHT corner, at 360/390/412 px wide. The left of row two is free on every phone.
    const startX = narrow ? M : Math.max(minX, Math.round(W / 2 - totalW / 2));
    const restart = { x: startX, y: btnY, w: wRestart, h: BTN_H, label: 'RESTART' };
    const reset = { x: startX + wRestart + 4, y: btnY, w: wReset, h: BTN_H, label: 'RESET' };
    const clear = { x: startX + wRestart + 4 + wReset + 4, y: btnY, w: wClear, h: BTN_H, label: 'CLEAR' };
    const vol = narrow
      ? { x: -200, y: -200, w: 0, h: 0, label: 'VOL' }
      : { x: startX + wRestart + 4 + wReset + 4 + wClear + 4, y: btnY, w: wVol, h: BTN_H, label: 'VOL' };
    // "?" replays the HOW TO PLAY guide (user, 2026-10-03: on the button row). Wide: after VOL. Narrow: after
    // CLEAR when it clears the speed panel (390 px and up); at 360 px it would sit on the speed panel, so it
    // drops to row three, left — the dropdown / TUNE panel lane, so it is hidden while either is open.
    const help = { x: narrow ? startX + wRestart + 4 + wReset + 4 + wClear + 4 : vol.x + wVol + 4, y: btnY, w: wHelp, h: BTN_H, label: helpLabel };
    if (narrow && help.x + help.w > W - M - 120 - 6) { help.x = M; help.y = btnY + BTN_H + 6; help.row3 = true; }

    // The panel sizes itself to the space available and never runs off the bottom of a short landscape
    // phone: the row height shrinks to fit, with a floor, and the width is capped. Checked at 844x390
    // and 390x844 by tools/uicheck.mjs.
    const top = (narrow ? M + BTN_H * 2 + 12 : M + BTN_H + 6);
    const bottom = H - M - 34;                     // leave the bottom-left hint line its lane
    const avail = bottom - top - 24;               // minus the footer button
    const rh = Math.max(16, Math.min(27, Math.floor(avail / TUNE_ROWS.length)));
    const pw = Math.min(272, W - M * 2);
    const panel = { x: M, y: top, w: pw, h: TUNE_ROWS.length * rh + 26 };
    // Buttons are WIDER than they are tall. Vertical room is the binding constraint on a 390 px-tall
    // landscape phone (rows get to 19 px), but there is horizontal room going spare — and a wider target
    // is easier to hit with a thumb than a square one. 44 x 19 beats 20 x 20.
    const bh = Math.max(17, rh - 2), bw = 44;
    const tuneRows = TUNE_ROWS.map((r, i) => {
      const y = panel.y + 2 + i * rh;
      return {
        row: r, y, h: rh,
        minus: { x: panel.x + pw - bw * 2 - 12, y: y + (rh - bh) / 2, w: bw, h: bh },
        plus: { x: panel.x + pw - bw - 6, y: y + (rh - bh) / 2, w: bw, h: bh },
      };
    });
    // footer split in two: RESET TUNING | TYRE HUD on/off
    const fw = Math.floor((pw - 18) / 2);
    const tuneReset = { x: panel.x + 6, y: panel.y + 4 + TUNE_ROWS.length * rh, w: fw, h: 20 };
    const tyreHudBtn = { x: panel.x + 12 + fw, y: tuneReset.y, w: fw, h: 20 };
    // The speed/tacho panel is a control lane too. MEASURED BUG (user screenshot, 2026-09-27): on a
    // narrow screen RESET and CLEAR moved to a second row on the RIGHT and landed straight on top of
    // the speed readout. The overlap test never caught it because it only compared the buttons with
    // each other, not with the panel they collided with. It is returned from layout() now so it can be.
    const speed = { x: W - M - 120, y: M, w: 120, h: 56 + (carDiagram ? 50 : 0) };   // grows a car diagram when on (or when damaged)
    const lap = { x: W - M - 120, y: speed.y + speed.h + 6, w: 120, h: 36 };
    // The knocked-cone tally, under the button row. In layout() so tools/uicheck.mjs can see it. MEASURED
    // BUG, 2026-10-03: it was placed in draw() at a fixed row two, which on a narrow screen IS the
    // RESTART/RESET/CLEAR row — invisible to the overlap test until the tyre walls made it show constantly.
    const tally = { x: Math.round(W / 2 - 46), y: btnY + BTN_H + 6, w: 92, h: 24 };
    // Narrow: the left of row three belongs to the car dropdown and the TUNE panel, so the tally goes
    // top-RIGHT, under the lap panel (it is hidden while TUNE is open — that panel reaches it at 360 px).
    // FPS (test mode, user 2026-10-06: "in the corner always"): a slim strip right under the lap / distance panel, top right; the
    // narrow-screen cone tally moves down under it
    const fps = { x: W - M - 120, y: lap.y + lap.h + 4, w: 120, h: 18 };
    if (narrow) { tally.x = W - M - 92; tally.y = fps.y + fps.h + 6; }
    // DRIVER AID CHIPS (user, 2026-10-03: small chips ABOVE THE PEDALS). Laid out from the same PEDAL numbers input.js
    // uses, clear of the brake pedal's generous 1.35r hit circle. Drawn and hit-tested only on cars that have the aid.
    const yBrakeTop = H - PEDAL.margin - PEDAL.r - (PEDAL.r * 2 + PEDAL.gap) - PEDAL.r * 1.35;
    const aidW = 50, aidH = 30, aidY = Math.round(yBrakeTop - 6 - aidH);
    const absChip = { x: W - PEDAL.margin - aidW * 2 - 6, y: aidY, w: aidW, h: aidH };
    const tcsChip = { x: W - PEDAL.margin - aidW, y: aidY, w: aidW, h: aidH };
    // LIGHTS + INDICATORS (user, 2026-10-04: "a button for headlights, bottom / bottom-left, along with indicators"): a row of three at the
    // bottom-left corner — a tap there is consumed before the steering zone sees it
    const lbW = 46, lbH = 34, lbY = H - M - lbH;
    const indL = { x: M, y: lbY, w: lbW, h: lbH }, lights = { x: M + lbW + 6, y: lbY, w: lbW + 14, h: lbH }, indR = { x: M + lbW * 2 + 26, y: lbY, w: lbW, h: lbH };
    return { chip, rows, levelRows, restart, reset, clear, vol, help, absChip, tcsChip, tuneChip, panel, tuneRows, tuneReset, tyreHudBtn, speed, lap, fps, tally, indL, lights, indR };
  }

  function inRect(p, r) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  // Returns an action if the tap hit a control, else null. A tap that hits the HUD is CONSUMED by
  // main.js and never reaches the world (CLAUDE.md §4).
  function hit(p, W, H, car) {
    const L = layout(W, H);
    if (car && car.spec.aids && car.spec.aids.abs && inRect(p, L.absChip)) return { toggleAbs: true };
    if (car && car.spec.aids && car.spec.aids.tcs && inRect(p, L.tcsChip)) return { toggleTcs: true };
    if (inRect(p, L.lights)) return { toggleLights: true };
    if (inRect(p, L.indL)) return { indicate: -1 };
    if (inRect(p, L.indR)) return { indicate: 1 };

    // the tune panel is checked FIRST while it is open — it covers the car list's lane
    if (tuneOpen) {
      for (const tr of L.tuneRows) {
        if (inRect(p, tr.minus)) return { tune: tr.row, dir: -1 };
        if (inRect(p, tr.plus)) return { tune: tr.row, dir: +1 };
      }
      if (inRect(p, L.tuneReset)) return { tuneReset: true };
      if (inRect(p, L.tyreHudBtn)) { setTyreHud(!tyreHud); return { consumed: true }; }
      if (inRect(p, L.tuneChip)) { tuneOpen = false; return { consumed: true }; }
      if (inRect(p, L.panel)) return { consumed: true };     // swallow taps on the panel body
    }
    if (expanded) {
      for (const r of L.rows) if (inRect(p, r)) { expanded = false; return { car: r.id }; }
      for (const r of L.levelRows) if (inRect(p, r)) { expanded = false; return { level: r.id }; }
      if (!inRect(p, L.chip)) { expanded = false; return { consumed: true }; }
    }
    if (inRect(p, L.chip)) { expanded = !expanded; tuneOpen = false; return { consumed: true }; }
    if (inRect(p, L.tuneChip)) { tuneOpen = !tuneOpen; expanded = false; return { consumed: true }; }
    if (inRect(p, L.speed)) { mph = !mph; try { localStorage.setItem('carsim.units', mph ? 'mph' : 'kmh'); } catch { /* fine */ } return { consumed: true }; }
    if (inRect(p, L.restart)) return { restart: true };
    if (inRect(p, L.reset)) return { reset: true };
    if (inRect(p, L.clear)) return { clear: true };
    if (L.vol && L.vol.w > 0 && inRect(p, L.vol)) return { volumeCycle: true };
    if (inRect(p, L.help)) return { help: true };
    return null;
  }

  function panel(g, r, { fill = 'rgba(27,29,34,0.88)', stroke = 'rgba(255,255,255,0.14)' } = {}) {
    g.fillStyle = fill;
    g.beginPath();
    const rad = 8;
    g.moveTo(r.x + rad, r.y);
    g.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
    g.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
    g.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
    g.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
    g.closePath();
    g.fill();
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
  }

  // maxW: shrink the font until the text fits (long car names: "Lamburghini Hurrikan" ran into TUNE and the drive tag)
  function label(g, text, x, y, { size = 12, col = COL.hudText, align = 'left', weight = 600, maxW = 0 } = {}) {
    g.fillStyle = col;
    g.font = `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    if (maxW) while (size > 7 && g.measureText(text).width > maxW) { size -= 0.5; g.font = `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`; }
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillText(text, x, y);
  }

  // The panel. Rows are drawn from the SAME list hit() walks, so a button is never drawn somewhere
  // its tap is not. A changed row is marked, and every value is read live off the car (rule 10).
  function drawTune(g, L, car) {
    panel(g, L.panel, { fill: "rgba(14,15,19,0.94)" });
    for (const tr of L.tuneRows) {
      const r = tr.row;
      const v = r.get(car);
      const changed = isChanged(car, r);
      const cy = tr.y + tr.h / 2;
      label(g, r.label, L.panel.x + 9, cy, { size: 10.5, weight: 600, col: changed ? "#ffd479" : "#dfe2ea" });
      label(g, r.fmt(v), tr.minus.x - 8, cy, { size: 11, weight: 700, align: "right", col: changed ? "#ffd479" : "#8fe6c8" });
      for (const [b, sign] of [[tr.minus, "−"], [tr.plus, "+"]]) {
        panel(g, b, { fill: "rgba(255,255,255,0.10)", stroke: "rgba(255,255,255,0.18)" });
        label(g, sign, b.x + b.w / 2, b.y + b.h / 2 + 0.5, { size: 15, align: "center", weight: 700 });
      }
    }
    panel(g, L.tyreHudBtn, { fill: tyreHud ? 'rgba(76,194,160,0.92)' : 'rgba(255,255,255,0.10)', stroke: null });
    label(g, tyreHud ? 'TYRE HUD: ON' : 'TYRE HUD: OFF', L.tyreHudBtn.x + L.tyreHudBtn.w / 2, L.tyreHudBtn.y + L.tyreHudBtn.h / 2,
      { size: 10, weight: 700, align: 'center', col: tyreHud ? '#0d1a16' : COL.hudText });
    panel(g, L.tuneReset, { fill: "rgba(216,69,60,0.85)", stroke: null });
    label(g, "RESET TUNING", L.tuneReset.x + L.tuneReset.w / 2, L.tuneReset.y + L.tuneReset.h / 2,
      { size: 10, align: "center", weight: 700 });
  }

  // START LIGHTS: three big lights at the top-centre, reds one per second with 3-2-1, then all GREEN + GO! (held 1.2 s, then gone).
  // Squares with a dark rim (pixel style), a glow when lit. Rolling start: "ROLLING START" under red until the green.
  function drawLights(g, game, W, H) {
    const s = game.start; if (!s || !s.on) return;
    const sinceGreen = s.green ? s.t - s.tGreen : -1;
    if (s.green && sinceGreen > 1.2) return;
    // reds light in the LAST 3 s before the green (a rally stage's later start waits with "START IN n" first)
    const n = s.rolling ? (s.t >= 1 ? 3 : 0) : Math.min(3, Math.max(0, Math.floor(s.t - (s.tGreen - 4)))), green = s.green || s.t >= s.tGreen - 0.12;
    const L = Math.round(Math.min(W, H) * 0.11), gap = Math.round(L * 0.35), w = 3 * L + 2 * gap + 2 * gap, h = L + 2 * gap;
    const x0 = Math.round(W / 2 - w / 2), y0 = Math.round(H * 0.2);
    panel(g, { x: x0, y: y0, w, h }, { fill: 'rgba(14,15,18,0.92)', stroke: 'rgba(255,255,255,0.18)' });
    for (let i = 0; i < 3; i++) {
      const x = x0 + gap + i * (L + gap), y = y0 + gap, lit = green || i < n;
      const col = green ? '#3ddc84' : lit ? '#ff3b2f' : '#3a1414';
      if (lit) { g.fillStyle = green ? 'rgba(61,220,132,0.35)' : 'rgba(255,59,47,0.35)'; g.fillRect(x - 4, y - 4, L + 8, L + 8); }
      g.fillStyle = '#0b0c0f'; g.fillRect(x - 2, y - 2, L + 4, L + 4);
      g.fillStyle = col; g.fillRect(x, y, L, L);
      if (lit) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + L * 0.15, y + L * 0.15, L * 0.3, L * 0.18); }
    }
    const txt = green ? 'GO!' : s.rolling ? 'ROLLING START' : n > 0 ? String(4 - n) : s.tGreen - s.t > 4 ? 'START IN ' + Math.ceil(s.tGreen - s.t) : '';
    if (txt) label(g, txt, W / 2, y0 + h + Math.round(L * 0.55), { size: green || (!s.rolling && n > 0) ? Math.round(L * 0.8) : Math.round(L * 0.35), weight: 800, align: 'center', col: green ? '#3ddc84' : '#ffffff' });
  }
  // CHEQUERED FLAG (AI stage 4; user: "a chequered flag sweeping across the WHOLE screen for the winner and when the event ends"): each
  // new entry in game.flow.flags sweeps a waving band of black / white squares left to right over FLAG_S of WALL time (rule 5: watched),
  // with WINNER (the first) or FINISH (the end) in the middle. Squares, not curves (pixel rule).
  const FLAG_S = 1.5; let flagSeen = 0, flagAt = 0, flagTxt = '';
  // NOTICE (track cuts): one line, centre-top under the lights' place, 2.2 s of wall time
  function drawNotice(g, game, W, H) {
    const n = game.notice; if (!n || performance.now() - n.at > 2200) return;
    const sz = Math.round(Math.min(W, H) * 0.06), y = Math.round(H * 0.3);
    g.font = '800 ' + sz + 'px ui-sans-serif, system-ui, sans-serif'; const w = g.measureText(n.text).width + sz * 1.4;
    // n.good = good news (green: the highway's PULLING AWAY countdown), else a warning (red)
    panel(g, { x: Math.round(W / 2 - w / 2), y: y - sz, w: Math.round(w), h: Math.round(sz * 2) }, { fill: 'rgba(14,15,18,0.92)', stroke: n.good ? 'rgba(76,194,160,0.9)' : 'rgba(216,69,60,0.9)' });
    label(g, n.text, W / 2, y, { size: sz, weight: 800, align: 'center', col: n.good ? '#4cc2a0' : '#ff6a5c' });
  }
  // SPEED CAMERA CARD (highway.js speedCamera): 'YOU GOT CAUGHT' + your speed + the fine, top right under the speedo, 3.2 s; a white
  // screen FLASH for the first 0.12 s (the camera going off - squares, no glow)
  function drawCamera(g, game, W, H) {
    const c = game.camCaught; if (!c) return; const t = performance.now() - c.at; if (t > 3200) return;
    if (t < 120) { g.fillStyle = `rgba(255,255,255,${(0.55 * (1 - t / 120)).toFixed(3)})`; g.fillRect(0, 0, W, H); }
    // portrait: top right under the speedo; landscape: the empty left column under the top-left buttons (PHOTOGRAPHED 2026-10-06: top
    // right in landscape covered the ABS / TCS buttons)
    const sz = Math.round(Math.min(W, H) * 0.035), w = Math.round(sz * 11), h = Math.round(sz * 3.6), land = W > H;
    const x = land ? 24 : W - w - 12, y = land ? 104 : Math.round(Math.min(H * 0.32, 150));
    panel(g, { x, y, w, h }, { fill: 'rgba(14,15,18,0.94)', stroke: 'rgba(234,179,8,0.95)' });
    label(g, 'YOU GOT CAUGHT', x + w / 2, y + sz * 0.95, { size: sz, weight: 800, align: 'center', col: '#eab308' });
    label(g, `${c.kmh} km/h  (${c.mph} mph)`, x + w / 2, y + sz * 2.05, { size: Math.round(sz * 0.85), weight: 700, align: 'center', col: '#ffffff' });
    label(g, `FINE -$${c.fine}` + (game.camCount > 1 ? `  \u00b7  ${game.camCount} CAUGHT, -$${game.camFines}` : ''), x + w / 2, y + sz * 3.0, { size: Math.round(sz * 0.75), weight: 700, align: 'center', col: '#ff6a5c', maxW: w - 10 });
  }
  function drawFlag(g, game, W, H) {
    // THE CHEQUERED FLAG (user, 2026-10-04: "only when you finish a race"; "look more like a real flag — an overlay that WAVES in
    // simulated 3D, shaded, detailed but still a quick pass"): a cloth of NX x NY squares on a pole, every vertex lifted by a travelling
    // wave (stronger toward the free end), each square shaded by the wave's slope (light where it faces up, dark in the folds), swept
    // across the screen in FLAG_S of wall time with your place under it.
    const f = game.flow; if (!f) { flagSeen = 0; return; }
    const now = performance.now() / 1000;
    if (f.flags.length > flagSeen) { flagSeen = f.flags.length; flagAt = now; const p = f.myPlace;
      flagTxt = f.stage ? 'STAGE FINISHED' : f.highway ? (p === 1 ? 'YOU GOT AWAY!' : 'P' + p + ' — THEY GOT AWAY') : p === 1 ? 'YOU WIN!' : p ? 'P' + p + ' — FINISH' : 'FINISH'; }
    const k = (now - flagAt) / FLAG_S; if (!flagSeen || k > 1) return;
    const NX = 18, NY = 11, FW = Math.min(W * 0.62, H * 1.15), FH = FW * 0.62, amp = FH * 0.11, t = now - flagAt;
    const ease = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k), poleX = -FW * 1.05 + ease * (W + FW * 1.25), top = H * 0.5 - FH * 0.62;
    const wave = (u, v) => amp * u * Math.sin(u * 7.5 - t * 11 + v * 1.4) + amp * 0.35 * u * Math.sin(u * 13 - t * 17);
    const P = (i, j) => { const u = i / NX, v = j / NY; return [poleX + u * FW * (0.97 + 0.03 * Math.cos(t * 9 + u * 6)), top + v * FH + wave(u, v)]; };
    // shadow of the cloth, then the cloth
    g.save(); g.globalAlpha = 0.25; g.fillStyle = '#000'; g.beginPath(); g.moveTo(...P(0, 0).map((z, n) => z + (n ? 10 : 8))); for (let i = 1; i <= NX; i++) g.lineTo(...P(i, 0).map((z, n) => z + (n ? 10 : 8)));
    for (let j = 1; j <= NY; j++) g.lineTo(...P(NX, j).map((z, n) => z + (n ? 10 : 8))); for (let i = NX - 1; i >= 0; i--) g.lineTo(...P(i, NY).map((z, n) => z + (n ? 10 : 8))); g.closePath(); g.fill(); g.restore();
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      const u = (i + 0.5) / NX, v = (j + 0.5) / NY, slope = (wave(u + 0.02, v) - wave(u - 0.02, v)) / (0.04 * FW);
      const sh = Math.max(0.45, Math.min(1.25, 1 - slope * 2.6)), white = (i + j) % 2 === 0, base = white ? 236 : 26, col = Math.round(Math.min(255, base * sh + (white ? 0 : 18 * (sh - 1))));
      g.fillStyle = 'rgb(' + col + ',' + col + ',' + Math.min(255, col + (white ? 4 : 6)) + ')';
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill();
    }
    // the pole: dark edge, light highlight, a ball on top
    const pw = Math.max(4, FW * 0.025);
    g.fillStyle = '#2a2d34'; g.fillRect(poleX - pw, top - FH * 0.08, pw, FH * 1.55); g.fillStyle = '#9aa0aa'; g.fillRect(poleX - pw * 0.7, top - FH * 0.08, pw * 0.3, FH * 1.55);
    g.fillStyle = '#e8a13a'; g.fillRect(poleX - pw * 1.4, top - FH * 0.16, pw * 1.8, pw * 1.8);
    label(g, flagTxt, poleX + FW * 0.5, top + FH + Math.min(W, H) * 0.09, { size: Math.round(Math.min(W, H) * 0.085), weight: 800, align: 'center', col: '#e8a13a' });
  }

  function draw(g, game, W, H, wallDt) {
    carDiagram = tyreHud || !!(game.car.dmg && game.car.dmg.some((d) => d >= 0.05) || (game.car.punct && game.car.punct.some(Boolean)));
    try { drawLightsLater = () => { drawLights(g, game, W, H); drawNotice(g, game, W, H); drawCamera(g, game, W, H); drawFlag(g, game, W, H); }; } catch (e) {}
    const L = layout(W, H);
    const car = game.car;
    const s = car.spec;

    // ---- top-left: car chip
    panel(g, L.chip);
    label(g, s.name, L.chip.x + 10, L.chip.y + L.chip.h / 2, { size: 12.5, maxW: L.chip.w - 30 });
    label(g, expanded ? '▴' : '▾', L.chip.x + L.chip.w - 12, L.chip.y + L.chip.h / 2, { align: 'right', col: COL.inkSoft });
    if (expanded) {
      for (const r of L.rows) {
        const on = r.id === s.id;
        panel(g, r, { fill: on ? 'rgba(76,194,160,0.92)' : 'rgba(27,29,34,0.88)' });
        const row = ROSTER.find((c) => c.id === r.id);
        label(g, row.name, r.x + 10, r.y + r.h / 2, { size: 12, col: on ? '#0d1a16' : COL.hudText, maxW: r.w - 52 });
        // the drive layout is the point of the roster, so it is on the row
        const d = row.drive === 1 ? 'FWD' : row.drive === 0 ? 'RWD' : '4WD';
        label(g, d, r.x + r.w - 10, r.y + r.h / 2, { size: 10.5, align: 'right', col: on ? '#0d1a16' : COL.inkSoft });
      }
      // ---- and the LEVELS, under the cars in the same dropdown
      for (const r of L.levelRows) {
        const on = r.id === LEVEL.id;
        panel(g, r, { fill: on ? 'rgba(232,161,58,0.94)' : 'rgba(27,29,34,0.88)' });
        label(g, r.name, r.x + 10, r.y + r.h / 2, { size: 12, col: on ? '#2a1405' : COL.hudText });
        label(g, 'LEVEL', r.x + r.w - 10, r.y + r.h / 2, { size: 10, align: 'right', col: on ? '#2a1405' : COL.inkSoft });
      }
    }

    // ---- top-left: the TUNE chip, opening the debug panel
    panel(g, L.tuneChip, { fill: tuneOpen ? 'rgba(232,161,58,0.94)' : 'rgba(27,29,34,0.88)' });
    label(g, 'TUNE', L.tuneChip.x + L.tuneChip.w / 2, L.tuneChip.y + L.tuneChip.h / 2,
      { size: 11.5, align: 'center', col: tuneOpen ? '#2a1405' : COL.hudText });

    // ---- bottom-right, above the pedals: DRIVER AIDS. Green = on, dark = off, AMBER FLASH while working — the
    //      silent twin of a real ABS buzz (the phone may be muted). Flash on the wall clock (rule 5).
    if (s.aids) {
      for (const [key, r, on, working] of [['abs', L.absChip, car.absOn, car.t.absWorking], ['tcs', L.tcsChip, car.tcsOn, car.t.tcsWorking]]) {
        if (!s.aids[key]) continue;
        aidFlash[key] = working && on ? 1 : Math.max(0, aidFlash[key] - wallDt * 5);
        const fl = aidFlash[key] * (0.6 + 0.4 * Math.sin(performance.now() / 45));
        panel(g, r, { fill: fl > 0.05 ? 'rgba(232,161,58,' + (0.55 + 0.4 * fl).toFixed(2) + ')' : on ? 'rgba(76,194,160,0.90)' : 'rgba(27,29,34,0.80)' });
        label(g, key.toUpperCase(), r.x + r.w / 2, r.y + r.h / 2 - (on ? 0 : 5), { size: 11.5, weight: 700, align: 'center', col: on ? '#0d1a16' : COL.inkSoft });
        if (!on) label(g, 'OFF', r.x + r.w / 2, r.y + r.h / 2 + 7, { size: 8.5, weight: 700, align: 'center', col: COL.danger });
      }
    }

    // ---- bottom-left: ◄ LIGHTS ► (the indicator buttons blink amber while on, LIGHTS lit while the headlights are on)
    {
      const blink = Math.floor(performance.now() / 333) % 2 === 0;
      for (const [r, txt, on] of [[L.indL, '◄', car.indicator === -1 && blink], [L.lights, 'LIGHTS', !!car.lightsOn], [L.indR, '►', car.indicator === 1 && blink]]) {
        panel(g, r, { fill: on ? (txt === 'LIGHTS' ? 'rgba(242,230,170,0.92)' : 'rgba(232,161,58,0.92)') : 'rgba(27,29,34,0.80)' });
        label(g, txt, r.x + r.w / 2, r.y + r.h / 2, { size: txt === 'LIGHTS' ? 10.5 : 14, weight: 800, align: 'center', col: on ? '#1b1d22' : COL.hudText });
      }
    }

    if (tuneOpen) drawTune(g, L, car);

    // ---- top-centre: restart / reset / clear / vol
    const audio = game.audio;
    if (L.vol && L.vol.w > 0) {
      L.vol.label = !audio ? 'VOL' : audio.muted ? 'MUTE' : Math.round(audio.volume * 100) + '%';
    }
    const btns = (L.vol && L.vol.w > 0) ? [L.restart, L.reset, L.clear, L.vol] : [L.restart, L.reset, L.clear];
    if (!(L.help.row3 && (expanded || tuneOpen))) btns.push(L.help);
    // On a narrow screen this row sits in the car dropdown's lane (left, row two). While the dropdown is
    // open it owns that lane — hit() already sends those taps to the dropdown — so do not draw over it.
    const rowHidden = expanded && L.restart.y > M;
    if (!rowHidden) for (const b of btns) {
      panel(g, b);
      const isMuted = b === L.vol && audio && (audio.muted || audio.volume <= 0.001);
      label(g, b.label, b.x + b.w / 2, b.y + b.h / 2, {
        size: b === L.help ? 14 : 10.5, align: 'center', weight: b === L.help ? 700 : 600,
        col: isMuted ? COL.danger : COL.hudText,
      });
    }

    // ---- top-centre, under the buttons: cone tally. Reads LIVE state — it counts what is actually
    //      lying down, not what was hit (rule 10) — so standing one back up with RESET counts down again.
    const knocked = game.cones.knocked;
    // ONLY ON A LEVEL THAT ASKS FOR IT (LEVEL.coneCount: the Lab + Test Track courses) — user: "only relevant when asked for, not on most race tracks"
    if (LEVEL.coneCount && knocked > 0 && !tuneOpen) {
      const cr = L.tally;
      panel(g, cr, { fill: 'rgba(242,106,27,0.92)', stroke: null });
      label(g, knocked + ' / ' + game.cones.total + ' CONES', cr.x + cr.w / 2, cr.y + cr.h / 2,
        { size: 11, align: 'center', col: '#2a1405', weight: 700 });
    }

    // ---- top-right: speed, gear, tacho (the SILENT TWIN of the engine note — the phone may be muted)
    const pr = L.speed, pw = pr.w;
    panel(g, pr);
    const kph = Math.hypot(car.vx, car.vy) * 3.6;
    label(g, String(Math.round(mph ? kph * 0.621371 : kph)), pr.x + 10, pr.y + 19, { size: 22, weight: 700 });
    label(g, mph ? 'mph' : 'km/h', pr.x + 62, pr.y + 24, { size: 9.5, col: COL.inkSoft });
    // GEAR CHANGE, made obvious. The automatic box already cuts the torque for a quarter of a second,
    // but with no sound and no needle the player had no way to know a shift had happened. Flash the
    // gear digit and pop it up a size — on the WALL CLOCK, because it is something you watch (rule 5).
    const gearTxt = car.gear < 0 ? 'R' : String(car.gear);
    if (car.gear !== lastGear) { gearFlash = 1; lastGear = car.gear; }
    gearFlash = Math.max(0, gearFlash - wallDt * 2.6);
    const gf = gearFlash * gearFlash;
    if (gf > 0.02) {
      g.globalAlpha = gf * 0.85;
      g.fillStyle = COL.warn;
      g.beginPath(); g.arc(pr.x + pw - 22, pr.y + 19, 17 + gf * 9, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    label(g, gearTxt, pr.x + pw - 12, pr.y + 19,
      { size: 20 + gf * 8, weight: 700, align: 'right', col: gf > 0.15 ? '#2a1405' : COL.live });

    // tacho bar
    const tx = pr.x + 10, ty = pr.y + 38, tw = pw - 20, th = 7;
    const frac = Math.max(0, Math.min(1, (car.rpm - s.idleRpm) / (s.redline - s.idleRpm)));
    const redFrac = (s.upshiftRpm - s.idleRpm) / (s.redline - s.idleRpm);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(tx, ty, tw, th);
    g.fillStyle = frac > redFrac ? COL.danger : frac > redFrac * 0.82 ? COL.warn : COL.live;
    g.fillRect(tx, ty, tw * frac, th);
    // redline zone marker
    g.fillStyle = 'rgba(216,69,60,0.55)';
    g.fillRect(tx + tw * redFrac, ty - 2, 1.5, th + 4);
    // shift light: flashes on the WALL CLOCK (rule 5), not per physics step
    if (frac > redFrac) shiftFlash = Math.min(1, shiftFlash + wallDt * 8);
    else shiftFlash = Math.max(0, shiftFlash - wallDt * 6);
    if (shiftFlash > 0.02) {
      g.globalAlpha = shiftFlash * (0.55 + 0.45 * Math.sin(performance.now() / 60));
      g.fillStyle = COL.danger;
      g.fillRect(tx, ty - 5, tw, 2.5);
      g.globalAlpha = 1;
    }

    // TYRE DIAGRAM (optional HUD). A little top-down car, FRONT UP, each wheel filled with its temperature colour
    // and its number beside it (user, 2026-10-03: "not clear which is front and which is back — draw a little
    // car and display the colours on the wheels"). The same body outline is where DAMAGE will be shown later.
    // vehicle.js indexes tyres by body side: 0 F+y, 1 F-y, 2 R+y, 3 R-y, and +y is the car's RIGHT.
    if (carDiagram && car.tyreT) {
      const [lo, hi] = s.tyreOpt || [65, 110];
      const col = (T) => (T < lo - 15 ? '#5b8fd6' : T < lo ? '#7fb6c9' : T <= hi ? COL.live : T <= hi + 25 ? COL.warn : COL.danger);
      const cx = pr.x + pw / 2, top = pr.y + 56, bw = 20, bh = 40, bx = cx - bw / 2, by = top + 4;
      // wheels first (under the body edge), then the body, then a windscreen so the FRONT is unmistakable
      const wheels = [[1, -1, 0], [0, 1, 0], [3, -1, 1], [2, 1, 1]];     // [tyre index, side -1 left / +1 right, rear?]
      for (const [ti, sd, rear] of wheels) {
        const wx = sd < 0 ? bx - 4 : bx + bw - 3, wy = by + (rear ? bh - 14 : 4);
        // plain rectangles: panel()'s 8 px corner radius is larger than a 7 px wheel and drew mangled slants
        g.fillStyle = col(car.tyreT[ti]); g.fillRect(wx, wy, 7, 11);
        g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1; g.strokeRect(wx + 0.5, wy + 0.5, 6, 10);
        label(g, String(Math.round(car.tyreT[ti])), sd < 0 ? wx - 4 : wx + 11, wy + 6,
          { size: 9.5, weight: 700, align: sd < 0 ? 'right' : 'left', col: col(car.tyreT[ti]) });
      }
      panel(g, { x: bx, y: by, w: bw, h: bh }, { fill: 'rgba(205,210,220,0.92)', stroke: 'rgba(0,0,0,0.35)' });
      // DAMAGE (damage.js corners: 0 front -y, 1 front +y, 2 rear -y, 3 rear +y; +y = RIGHT): each body quarter amber / red with the
      // damage there, a white-ringed wheel = a puncture
      if (car.dmg) for (let c = 0; c < 4; c++) {
        const dd = car.dmg[c], qx = c % 2 ? bx + bw / 2 : bx + 1, qy = c < 2 ? by + 1 : by + bh / 2;
        if (dd >= 0.05) { g.fillStyle = dd < 0.5 ? 'rgba(232,161,58,' + (0.45 + 0.5 * dd).toFixed(2) + ')' : 'rgba(216,69,60,' + (0.6 + 0.4 * dd).toFixed(2) + ')'; g.fillRect(qx, qy, bw / 2 - 1, bh / 2 - 1); }
        if (car.punct && car.punct[c]) { const wx = c % 2 ? bx + bw - 3 : bx - 4, wy = by + (c >= 2 ? bh - 14 : 4); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.strokeRect(wx - 0.5, wy - 0.5, 8, 12); }
        if (car.wheelOff && car.wheelOff[c]) { const wx = c % 2 ? bx + bw - 3 : bx - 4, wy = by + (c >= 2 ? bh - 14 : 4); g.fillStyle = '#1b1c21'; g.fillRect(wx, wy, 7, 11); g.strokeStyle = COL.danger; g.lineWidth = 1.5; g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + 7, wy + 11); g.moveTo(wx + 7, wy); g.lineTo(wx, wy + 11); g.stroke(); }   // wheel GONE
      }
      g.fillStyle = 'rgba(40,46,58,0.85)';
      g.fillRect(bx + 3, by + 9, bw - 6, 6);                   // windscreen near the top = the front
      g.fillRect(bx + 4, by + bh - 9, bw - 8, 4);              // rear window
      label(g, 'FRONT', cx, by - 1, { size: 6.5, weight: 700, align: 'center', col: COL.inkSoft });
    }

    // ---- top-right, under speed: lap counter & timer (circuit levels only)
    if (LEVEL.subtrack && game.lap) {
      const lr = L.lap;
      panel(g, lr);
      if (game.ai && game.ai.length && game.position) label(g, `P${game.position}/${game.ai.length + 1}`, lr.x + lr.w - 8, lr.y + 26, { size: 11, weight: 800, align: 'right', col: game.position === 1 ? '#f2c21b' : COL.live });
      const lapNum = Math.max(1, game.lap.lap || 1);
      const rc = game.race, sg = game.stage;
      if (LEVEL.endless) {
        // HIGHWAY TO HULL: how far you have got, and your best
        label(g, 'DISTANCE', lr.x + 8, lr.y + 13, { size: 11, weight: 700, col: COL.live });
        label(g, ((game.hwDist || 0) / 1000).toFixed(2) + ' KM', lr.x + lr.w - 8, lr.y + 13, { size: 11, weight: 700, align: 'right', col: COL.hudText });
        // in a VS AI race the second line is the gap to the car ahead (or your lead over the one behind) instead of your best
        const fl = game.flow, me = fl && fl.highway && game.car._hwf;
        if (me && game.ai && game.ai.length) {
          const ss = game.ai.map((a) => (a.car._hwf ? a.car._hwf.s - me.s : -Infinity)), ah = ss.filter((d) => d > 0), bh = ss.filter((d) => d <= 0 && isFinite(d));
          const txt = ah.length ? 'AHEAD +' + Math.round(Math.min(...ah)) + ' M' : bh.length ? 'LEAD ' + Math.round(-Math.max(...bh)) + ' M' : '';
          label(g, txt, lr.x + 8, lr.y + 26, { size: 9, weight: 700, col: ah.length ? COL.inkSoft : COL.live });
        } else label(g, 'BEST ' + ((game.hwBest || 0) / 1000).toFixed(2) + ' KM', lr.x + 8, lr.y + 26, { size: 9, weight: 600, col: COL.inkSoft });
      } else if (LEVEL.stage && sg) {
        // RALLY STAGE: the same panel. READY -> STAGE (running clock) -> FINISH with the run's time; BEST underneath
        const run = sg.state === 'running', done = sg.state === 'done';
        label(g, done ? 'FINISH' : 'STAGE', lr.x + 8, lr.y + 13, { size: 11, weight: 700, col: COL.live });
        label(g, fmtTime(done ? sg.last : run ? sg.t : 0), lr.x + lr.w - 8, lr.y + 13, { size: 11, weight: done ? 700 : 600, align: 'right', col: COL.hudText });
        const newBest = done && sg.best === sg.last;
        label(g, newBest ? 'NEW BEST' : sg.best != null ? `BEST ${fmtTime(sg.best)}` : sg.state === 'ready' ? 'CROSS THE LINE' : 'BEST --:--.--', lr.x + 8, lr.y + 26, { size: 9, weight: newBest ? 700 : 600, col: newBest ? COL.live : COL.inkSoft });
      } else if (rc && rc.on && LEVEL.joker) {
        // RX RACE: the same panel, no new HUD lane (CLAUDE.md §4: the corners have owners)
        if (rc.done) {
          label(g, 'FINISH', lr.x + 8, lr.y + 13, { size: 11, weight: 700, col: COL.live });
          label(g, fmtTime(rc.total), lr.x + lr.w - 8, lr.y + 13, { size: 11, weight: 700, align: 'right', col: COL.hudText });
          label(g, !rc.penalty ? 'JOKER DONE' : rc.jokers === 0 ? `+${rc.penalty} s NO JOKER` : `+${rc.penalty} s EXTRA JOKER`, lr.x + 8, lr.y + 26, { size: 9, weight: 700, col: rc.penalty ? COL.danger : COL.live });
        } else {
          label(g, `LAP ${Math.min(lapNum, rc.laps)}/${rc.laps}`, lr.x + 8, lr.y + 13, { size: 11, weight: 700, col: COL.live });
          label(g, fmtTime(rc.t), lr.x + lr.w - 8, lr.y + 13, { size: 11, weight: 600, align: 'right', col: COL.hudText });
          // approaching the joker turn-off without it done: the line FLASHES "JOKER >" (the approach arrow's distance, lab.js jokerApproach)
          const JA = LEVEL.joker && LEVEL.joker.arrows && LEVEL.joker.arrows.find((x) => x.d != null), td = game.trackD;
          const near = rc.started && !rc.joker && JA && td != null && (((JA.d - td) % LEVEL.subtrack.totalDist) + LEVEL.subtrack.totalDist) % LEVEL.subtrack.totalDist < 140;
          const flash = near && Math.floor(performance.now() / 250) % 2 === 0;
          // the line switches as it happens: TO DO -> ››› (approaching) -> IN JOKER (on the lane) -> JOKER TAKEN ✓ (flashing 2 s) -> JOKER DONE
          const inLane = !rc.joker && game.inJokerLane, fresh = rc.joker && rc.jokers === 1 && performance.now() - (game.jokerAt || 0) < 2000;
          const blink = Math.floor(performance.now() / 200) % 2 === 0;
          const jTxt = rc.jokers > 1 ? `JOKER x${rc.jokers}: +${(rc.jokers - 1) * 30} s` : fresh ? 'JOKER TAKEN ✓' : rc.joker ? 'JOKER DONE ✓' : inLane ? 'IN JOKER ›' : near ? 'JOKER  ›››' : 'JOKER TO DO';
          const jCol = rc.jokers > 1 ? COL.danger : fresh ? (blink ? '#ffffff' : COL.live) : rc.joker || inLane ? COL.live : flash ? '#ffffff' : COL.warn || '#e8a13a';
          label(g, jTxt, lr.x + 8, lr.y + 26, { size: near || fresh || inLane ? 10.5 : 9, weight: 800, col: jCol });
        }
      } else {
        // a VS AI race (raceflow.js): LAP n/N from the race's own count, FINISH once you are home
        const fl = game.flow, me = fl && fl.entries.find((e) => e.player);
        label(g, me ? (me.finish != null ? 'FINISH' : `LAP ${Math.min(fl.laps, me.lapDone + 1)}/${fl.laps}`) : `LAP ${lapNum}`, lr.x + 8, lr.y + 13, { size: 11, weight: 700, col: COL.live });
        label(g, fmtTime(me ? (me.finish != null ? me.finish : fl.t) : game.lap.lapTime), lr.x + lr.w - 8, lr.y + 13, { size: 11, weight: 600, align: 'right', col: COL.hudText });
        const bestTxt = game.lap.bestTime ? `BEST ${fmtTime(game.lap.bestTime)}` : 'BEST --:--.--';
        label(g, bestTxt, lr.x + 8, lr.y + 26, { size: 9, weight: 600, col: COL.inkSoft });
      }
    }

    // ---- bottom-right: pedals (touch only)
    if (game.input.isTouch()) {
      for (const p of game.input.pedalHits(W, H)) {
        const on = !!game.input.pedals[p.name];
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fillStyle = on
          ? (p.name === 'throttle' ? 'rgba(76,194,160,0.92)' : p.name === 'brake' ? 'rgba(216,69,60,0.92)' : 'rgba(232,161,58,0.92)')
          : 'rgba(27,29,34,0.80)';
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.20)'; g.lineWidth = 1.5; g.stroke();
        const txt = p.name === 'throttle' ? 'GAS' : p.name === 'brake' ? 'BRAKE' : p.name === 'reverse' ? 'R' : 'HAND';
        label(g, txt, p.x, p.y, { size: p.name === 'reverse' ? 13 : 10.5, align: 'center', col: on ? '#0d1a16' : COL.hudText });
      }
      // ---- bottom-left: the thumb stick, drawn where the thumb actually landed
      const st = game.input.stick;
      if (st.active) {
        g.beginPath(); g.arc(st.ox, st.oy, 46, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 2; g.stroke();
        const dx = Math.max(-52, Math.min(52, st.x - st.ox));
        g.beginPath(); g.arc(st.ox + dx, st.oy, 22, 0, Math.PI * 2);
        g.fillStyle = 'rgba(232,232,238,0.85)'; g.fill();
      } else {
        label(g, 'drag anywhere on the left to steer', M, H - M - 46, { size: 10.5, col: 'rgba(42,44,51,0.5)' });
      }
    } else {
      label(g, 'W/S drive   A/D steer   SPACE handbrake   B abs   T tcs   R reset   H help', M, H - M - 46,
        { size: 11, col: 'rgba(42,44,51,0.55)' });
    }

    // ---- dev readout (?dev=1). Every hidden number the tyre model runs on (CLAUDE.md §3: a system the
    //      player reads by feel is one you cannot debug by feel).
    if (game.dev && !tuneOpen) {
      const t = car.t;
      const lines = [
        `v ${(Math.hypot(car.vx, car.vy)).toFixed(1)} m/s   vLong ${t.vLong.toFixed(1)}  vLat ${t.vLat.toFixed(2)}`,
        `beta ${(Math.atan2(t.vLat, Math.abs(t.vLong)) * 57.3).toFixed(1)}°   yaw ${car.yawRate.toFixed(2)}  delta ${(car.delta * 57.3).toFixed(1)}°`,
        `slip F ${(t.slipF * 57.3).toFixed(1)}°  R ${(t.slipR * 57.3).toFixed(1)}°`,
        `Fz  F ${t.FzF.toFixed(0)}  R ${t.FzR.toFixed(0)}`,
        `Fy  F ${t.FyF.toFixed(0)}/${t.FyMaxF.toFixed(0)}  R ${t.FyR.toFixed(0)}/${t.FyMaxR.toFixed(0)}`,
        `sat F ${t.satF.toFixed(2)} R ${t.satR.toFixed(2)}   ax ${t.ax.toFixed(1)} ay ${t.ay.toFixed(1)}`,
        `slide F ${t.slidingF ? 'Y' : '.'} R ${t.slidingR ? 'Y' : '.'}   lock F ${t.lockedF ? 'Y' : '.'} R ${t.lockedR ? 'Y' : '.'}`,
        `slipSpd F ${t.slipSpeedF.toFixed(2)} R ${t.slipSpeedR.toFixed(2)}  marks ${game.marks.stamps}`,
        // WHAT YOU ARE STANDING ON. With ten surfaces the single most useful line in here: a handling
        // complaint is meaningless without it, and load tells you what the suspension is doing.
        `surf ${car.surface.id} mu ${car.surface.mu.toFixed(2)} peak ${(car.surface.peakK || 1).toFixed(2)} plough ${(car.surface.plough || 0).toFixed(1)}  load F ${t.loadKF.toFixed(2)} R ${t.loadKR.toFixed(2)}`,
        `rpm ${car.rpm.toFixed(0)}  gear ${car.gear}  T ${t.torque.toFixed(0)}Nm  steps/f ${game.stepsLastFrame}`,
        `fps ${game.fps.toFixed(0)}   in  st ${game.in.steer.toFixed(2)} th ${game.in.throttle.toFixed(2)} br ${game.in.brake.toFixed(2)} hb ${game.in.handbrake ? 1 : 0}`,
      ];
      const dh = lines.length * 11 + 12;
      const dr = { x: M, y: H - M - dh - 22, w: 232, h: dh };
      panel(g, dr, { fill: 'rgba(10,11,14,0.82)' });
      lines.forEach((ln, i) =>
        label(g, ln, dr.x + 8, dr.y + 12 + i * 11, { size: 8.5, weight: 500, col: '#b9f0dd' }));
    }
    // ---- FPS, test mode: now + the worst of the last ~10 s; amber under 50, red under 30
    if (game.testMode && game.fps) {
      const fr = L.fps, lo = game.fpsLow || game.fps, col = (v) => (v < 30 ? '#ff6a5c' : v < 50 ? '#e8a13a' : COL.live);
      panel(g, fr, { fill: 'rgba(14,15,18,0.82)' });
      label(g, Math.round(game.fps) + ' FPS', fr.x + 8, fr.y + fr.h / 2, { size: 10, weight: 800, col: col(game.fps) });
      label(g, 'LOW ' + Math.round(lo), fr.x + fr.w - 8, fr.y + fr.h / 2, { size: 10, weight: 800, align: 'right', col: col(lo) });
    }
    if (drawLightsLater) { drawLightsLater(); drawLightsLater = null; }
  }
  let drawLightsLater = null;

  return {
    draw, hit, layout,
    get tyreHud() { return tyreHud; }, setTyreHud,
    get expanded() { return expanded; },
    setHelpLabel(s) { helpLabel = s; },
    get tuneOpen() { return tuneOpen; },
    close() { expanded = false; tuneOpen = false; },
  };
}
