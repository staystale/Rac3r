// hud/overlays.js — tune panel, signal lights, notice card, speed camera card and race flag.
// Pure moves out of hud.js (task 173).

import { COL } from '../world/colours.ts';
import { isChanged } from '../tune.js';
import { drawHudPanel, drawHudLabel } from './widgets.js';

/**
 * Draw the TUNE panel: rows, +/- buttons, tyre HUD toggle and reset.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state the shared HUD state (tyreHud)
 * @param {object} rects the layout rects
 * @param {object} car the car read live
 * @returns {void}
 */
// The panel. Rows are drawn from the SAME list hit() walks, so a button is never drawn somewhere
// its tap is not. A changed row is marked, and every value is read live off the car (rule 10).
export function drawHudTune(ctx, state, rects, car) {
  drawHudPanel(ctx, rects.panel, { fill: "rgba(14,15,19,0.94)" });
  for (const tuneRow of rects.tuneRows) {
    const row = tuneRow.row;
    const value = row.get(car);
    const changed = isChanged(car, row);
    const centreY = tuneRow.y + tuneRow.h / 2;
    drawHudLabel(ctx, row.label, rects.panel.x + 9, centreY,
      { size: 10.5, weight: 600, col: changed ? "#ffd479" : "#dfe2ea" });
    drawHudLabel(ctx, row.fmt(value), tuneRow.minus.x - 8, centreY,
      { size: 11, weight: 700, align: "right", col: changed ? "#ffd479" : "#8fe6c8" });
    for (const [button, sign] of [[tuneRow.minus, "−"], [tuneRow.plus, "+"]]) {
      drawHudPanel(ctx, button,
        { fill: "rgba(255,255,255,0.10)", stroke: "rgba(255,255,255,0.18)" });
      drawHudLabel(ctx, sign, button.x + button.w / 2, button.y + button.h / 2 + 0.5,
        { size: 15, align: "center", weight: 700 });
    }
  }
  drawHudPanel(ctx, rects.tyreHudBtn,
    { fill: state.tyreHud ? 'rgba(76,194,160,0.92)' : 'rgba(255,255,255,0.10)', stroke: null });
  drawHudLabel(ctx, state.tyreHud ? 'TYRE HUD: ON' : 'TYRE HUD: OFF', rects.tyreHudBtn.x
    + rects.tyreHudBtn.w / 2, rects.tyreHudBtn.y + rects.tyreHudBtn.h / 2,
    { size: 10, weight: 700, align: 'center', col: state.tyreHud ? '#0d1a16' : COL.hudText });
  drawHudPanel(ctx, rects.tuneReset, { fill: "rgba(216,69,60,0.85)", stroke: null });
  drawHudLabel(ctx, "RESET TUNING", rects.tuneReset.x + rects.tuneReset.w / 2, rects.tuneReset.y
    + rects.tuneReset.h / 2,
    { size: 10, align: "center", weight: 700 });
}

/**
 * Draw the three start-light squares (dark rim, glow when lit).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} box the light box: x, y, gap, size
 * @param {boolean} green true once the lights are green
 * @param {number} litCount how many reds are lit
 * @returns {void}
 */
function drawHudLightSquares(ctx, box, green, litCount) {
  const { x: boxX, y: boxY, gap, size: lightSize } = box;
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
}

/**
 * The count-in text under the start lights.
 * @param {object} start the start state
 * @param {boolean} green true once the lights are green
 * @param {number} litCount how many reds are lit
 * @returns {string} the text, or an empty string
 */
function startLightsText(start, green, litCount) {
  return green ? 'GO!' : start.rolling ? 'ROLLING START' : litCount > 0
    ? String(4 - litCount) : start.tGreen - start.t > 4 ? 'START IN '
    + Math.ceil(start.tGreen - start.t) : '';
}

/**
 * Draw the start lights and the count-in text.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game
 * @param {number} width
 * @param {number} height
 * @returns {void}
 */
// START LIGHTS: three big lights at the top-centre, reds one per second with 3-2-1, then all
// GREEN + GO! (held 1.2 s, then gone). Squares with a dark rim (pixel style), a glow when lit.
// Rolling start: "ROLLING START" under red until the green.
export function drawHudLights(ctx, game, width, height) {
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
  drawHudPanel(ctx, { x: boxX, y: boxY, w: boxWidth, h: boxHeight },
    { fill: 'rgba(14,15,18,0.92)', stroke: 'rgba(255,255,255,0.18)' });
  drawHudLightSquares(ctx, { x: boxX, y: boxY, gap, size: lightSize }, green, litCount);
  const txt = startLightsText(start, green, litCount);
  if (txt) drawHudLabel(ctx, txt, width / 2, boxY + boxHeight + Math.round(lightSize * 0.55),
    { size: green || (!start.rolling && litCount > 0) ? Math.round(lightSize * 0.8)
    : Math.round(lightSize * 0.35), weight: 800, align: 'center', col: green ? '#3ddc84'
    : '#ffffff' });
}

  // CHEQUERED FLAG (AI stage 4; user: "a chequered flag sweeping across the WHOLE screen for the
  // winner and when the event ends"): each new entry in game.flow.flags sweeps a waving band of
  // black / white squares left to right over FLAG_S of WALL time (rule 5: watched), with WINNER
  // (the first) or FINISH (the end) in the middle. Squares, not curves (pixel rule).
export const FLAG_S = 1.5;

/**
 * Draw the one-line NOTICE (track cuts etc).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game
 * @param {number} width
 * @param {number} height
 * @returns {void}
 */
// NOTICE (track cuts): one line, centre-top under the lights' place, 2.2 s of wall time
export function drawHudNotice(ctx, game, width, height) {
  const notice = game.notice;
  if (!notice || performance.now() - notice.at > 2200) return;
  const fontSize = Math.round(Math.min(width, height) * 0.06), y = Math.round(height * 0.3);
  ctx.font = '800 ' + fontSize + 'px ui-sans-serif, system-ui, sans-serif';
  const boxWidth = ctx.measureText(notice.text).width + fontSize * 1.4;
  // n.good = good news (green: the highway's PULLING AWAY countdown), else a warning (red)
  drawHudPanel(ctx,
    { x: Math.round(width / 2 - boxWidth / 2), y: y - fontSize, w: Math.round(boxWidth),
    h: Math.round(fontSize * 2) },
    { fill: 'rgba(14,15,18,0.92)', stroke: notice.good ? 'rgba(76,194,160,0.9)'
    : 'rgba(216,69,60,0.9)' });
  drawHudLabel(ctx, notice.text, width / 2, y,
    { size: fontSize, weight: 800, align: 'center', col: notice.good ? '#4cc2a0' : '#ff6a5c' });
}

/**
 * Draw the speed camera card and its white flash.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game
 * @param {number} width
 * @param {number} height
 * @returns {void}
 */
// SPEED CAMERA CARD (highway.js speedCamera): 'YOU GOT CAUGHT' + your speed + the fine, top right
// under the speedo, 3.2 s; a white screen FLASH for the first 0.12 s (the camera going off -
// squares, no glow)
export function drawHudCamera(ctx, game, width, height) {
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
  drawHudPanel(ctx, { x, y, w: boxWidth, h: boxHeight },
    { fill: 'rgba(14,15,18,0.94)', stroke: 'rgba(234,179,8,0.95)' });
  drawHudLabel(ctx, 'YOU GOT CAUGHT', x + boxWidth / 2, y + fontSize * 0.95,
    { size: fontSize, weight: 800, align: 'center', col: '#eab308' });
  drawHudLabel(ctx, `${caught.kmh} km/h  (${caught.mph} mph)`, x + boxWidth / 2,
    y + fontSize * 2.05,
    { size: Math.round(fontSize * 0.85), weight: 700, align: 'center', col: '#ffffff' });
  drawHudLabel(ctx, `FINE -$${caught.fine}`
    + (game.camCount > 1 ? `  \u00b7  ${game.camCount} CAUGHT, -$${game.camFines}` : ''), x
    + boxWidth / 2, y + fontSize * 3.0,
    { size: Math.round(fontSize * 0.75), weight: 700, align: 'center', col: '#ff6a5c',
    maxW: boxWidth - 10 });
}

/**
 * Note a new chequered-flag entry: restart the sweep and pick its text.
 * @param {object} state the shared HUD state (flagSeen, flagAt, flagTxt)
 * @param {object} flow the race flow
 * @param {number} now wall time in seconds
 * @returns {void}
 */
function noteNewFlag(state, flow, now) {
  state.flagSeen = flow.flags.length;
  state.flagAt = now;
  const place = flow.myPlace;
  state.flagTxt = flow.stage ? 'STAGE FINISHED' : flow.highway
    ? (place === 1 ? 'YOU GOT AWAY!' : 'P' + place + ' — THEY GOT AWAY') : place === 1
    ? 'YOU WIN!' : place ? 'P' + place + ' — FINISH' : 'FINISH';
}

/**
 * Draw the waving chequered flag; tracks new flags in state.
 * @param {object} state the shared HUD state (flagSeen, flagAt, flagTxt)
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game
 * @param {number} width
 * @param {number} height
 * @returns {void}
 */
export function drawHudFlag(state, ctx, game, width, height) {
  // THE CHEQUERED FLAG (user, 2026-10-04: "only when you finish a race"; "look more like a real
  // flag — an overlay that WAVES in simulated 3D, shaded, detailed but still a quick pass"): a
  // cloth of NX x NY squares on a pole, every vertex lifted by a travelling wave (stronger toward
  // the free end), each square shaded by the wave's slope (light where it faces up, dark in the
  // folds), swept across the screen in FLAG_S of wall time with your place under it.
  const flow = game.flow;
  if (!flow) {
    state.flagSeen = 0;
    return;
  }
  const now = performance.now() / 1000;
  if (flow.flags.length > state.flagSeen) noteNewFlag(state, flow, now);
  const progress = (now - state.flagAt) / FLAG_S;
  if (!state.flagSeen || progress > 1) return;
  const FLAG_COLS = 18, FLAG_ROWS = 11, flagWidth = Math.min(width * 0.62, height * 1.15),
    flagHeight = flagWidth * 0.62, amp = flagHeight * 0.11, elapsed = now - state.flagAt;
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
  drawHudLabel(ctx, state.flagTxt, poleX + flagWidth * 0.5, top + flagHeight
    + Math.min(width, height) * 0.09, { size: Math.round(Math.min(width, height) * 0.085),
    weight: 800, align: 'center', col: '#e8a13a' });
}
