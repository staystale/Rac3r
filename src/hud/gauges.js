// hud/gauges.js — car/tune chips, aids, indicators, button row, cone tally, speedo, tyre diagram.
// Pure moves out of hud.js.

import { ROSTER } from '../cars.ts';
import { LEVEL } from '../world/state.ts';
import { COL } from '../world/colours.ts';
import { wearColour } from '../physics/tyrewear.ts';
import { tempInUnits } from './tracktemp.js';
import { drawEngineLights } from './enginelights.ts';
import {
  MARGIN, DIAGRAM_H, drawHudPanel, drawHudLabel, drawHudButton,
} from './widgets.js';

/**
 * Top-left: the car chip and, when open, the car and level dropdown.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state the shared HUD state
 * @param {object} rects the layout rectangles
 * @param {object} spec the car spec
 * @returns {void}
 */
export function drawHudCarChip(ctx, state, rects, spec) {
  drawHudPanel(ctx, rects.chip);
  drawHudLabel(ctx, spec.name, rects.chip.x + 10, rects.chip.y + rects.chip.h / 2,
    { size: 12.5, maxW: rects.chip.w - 30 });
  drawHudLabel(ctx, state.expanded ? '▴' : '▾', rects.chip.x + rects.chip.w - 12, rects.chip.y
    + rects.chip.h / 2, { align: 'right', col: COL.inkSoft });
  if (state.expanded) {
    for (const carRow of rects.rows) {
      const selected = carRow.id === spec.id;
      drawHudPanel(ctx, carRow,
        { fill: selected ? 'rgba(76,194,160,0.92)' : 'rgba(27,29,34,0.88)' });
      const row = ROSTER.find((entry) => entry.id === carRow.id);
      drawHudLabel(ctx, row.name, carRow.x + 10, carRow.y + carRow.h / 2,
        { size: 12, col: selected ? '#0d1a16' : COL.hudText, maxW: carRow.w - 52 });
      // the drive layout is the point of the roster, so it is on the row
      const drive = row.drive === 1 ? 'FWD' : row.drive === 0 ? 'RWD' : '4WD';
      drawHudLabel(ctx, drive, carRow.x + carRow.w - 10, carRow.y + carRow.h / 2,
        { size: 10.5, align: 'right', col: selected ? '#0d1a16' : COL.inkSoft });
    }
    // ---- and the LEVELS, under the cars in the same dropdown
    for (const levelRow of rects.levelRows) {
      const selected = levelRow.id === LEVEL.id;
      drawHudPanel(ctx, levelRow,
        { fill: selected ? 'rgba(232,161,58,0.94)' : 'rgba(27,29,34,0.88)' });
      drawHudLabel(ctx, levelRow.name, levelRow.x + 10, levelRow.y + levelRow.h / 2,
        { size: 12, col: selected ? '#2a1405' : COL.hudText });
      drawHudLabel(ctx, 'LEVEL', levelRow.x + levelRow.w - 10, levelRow.y + levelRow.h / 2,
        { size: 10, align: 'right', col: selected ? '#2a1405' : COL.inkSoft });
    }
  }
}

/**
 * Top-left: the TUNE chip, opening the debug panel.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state the shared HUD state
 * @param {object} rects the layout rectangles
 * @returns {void}
 */
export function drawHudTuneChip(ctx, state, rects) {
  drawHudPanel(ctx, rects.tuneChip,
    { fill: state.tuneOpen ? 'rgba(232,161,58,0.94)' : 'rgba(27,29,34,0.88)' });
  drawHudLabel(ctx, 'TUNE', rects.tuneChip.x + rects.tuneChip.w / 2, rects.tuneChip.y
    + rects.tuneChip.h / 2,
    { size: 11.5, align: 'center', col: state.tuneOpen ? '#2a1405' : COL.hudText });
}

/**
 * Bottom-right, above the pedals: DRIVER AIDS. Green = on, dark = off, AMBER FLASH
 * while working - the silent twin of a real ABS buzz (the phone may be muted). Flash on the wall
 * clock (rule 5).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state the shared HUD state
 * @param {object} rects the layout rectangles
 * @param {object} car the car
 * @param {object} spec the car spec
 * @param {number} wallDt wall-clock seconds
 * @returns {void}
 */
export function drawHudAids(ctx, state, rects, car, spec, wallDt) {
  if (spec.aids) {
    for (const [key, chip, active,
      working] of [['abs', rects.absChip, car.absOn, car.t.absWorking],
      ['tcs', rects.tcsChip, car.tcsOn, car.t.tcsWorking]]) {
      if (!spec.aids[key]) continue;
      state.aidFlash[key] = working && active ? 1 : Math.max(0, state.aidFlash[key] - wallDt * 5);
      const flash = state.aidFlash[key] * (0.6 + 0.4 * Math.sin(performance.now() / 45));
      drawHudPanel(ctx, chip,
        { fill: flash > 0.05 ? 'rgba(232,161,58,' + (0.55 + 0.4 * flash).toFixed(2) + ')' : active
        ? 'rgba(76,194,160,0.90)' : 'rgba(27,29,34,0.80)' });
      drawHudLabel(ctx, key.toUpperCase(), chip.x + chip.w / 2,
        chip.y + chip.h / 2 - (active ? 0 : 5),
        { size: 11.5, weight: 700, align: 'center', col: active ? '#0d1a16' : COL.inkSoft });
      if (!active) drawHudLabel(ctx, 'OFF', chip.x + chip.w / 2, chip.y + chip.h / 2 + 7,
        { size: 8.5, weight: 700, align: 'center', col: COL.danger });
    }
  }
}

/**
 * Bottom-left: LIGHTS and indicators (the indicator buttons blink amber while
 * on, LIGHTS lit while the headlights are on).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} rects the layout rectangles
 * @param {object} car the car
 * @returns {void}
 */
export function drawHudIndicators(ctx, rects, car) {
  const blink = Math.floor(performance.now() / 333) % 2 === 0;
  for (const [button, txt, lit] of [[rects.indL, '◄', car.indicator === -1 && blink],
    [rects.lights, 'LIGHTS', !!car.lightsOn],
    [rects.indR, '►', car.indicator === 1 && blink]]) {
    drawHudPanel(ctx, button,
      { fill: lit ? (txt === 'LIGHTS' ? 'rgba(242,230,170,0.92)' : 'rgba(232,161,58,0.92)')
      : 'rgba(27,29,34,0.80)' });
    drawHudLabel(ctx, txt, button.x + button.w / 2, button.y + button.h / 2,
      { size: txt === 'LIGHTS' ? 10.5 : 14, weight: 800, align: 'center', col: lit ? '#1b1d22'
      : COL.hudText });
  }
}

/**
 * Top-centre: restart / reset / clear / vol.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state the shared HUD state
 * @param {object} game the game
 * @param {object} rects the layout rectangles
 * @returns {void}
 */
export function drawHudButtonRow(ctx, state, game, rects) {
  const audio = game.audio;
  if (rects.vol && rects.vol.w > 0) {
    rects.vol.label = !audio ? 'VOL' : audio.muted ? 'MUTE' : Math.round(audio.volume * 100)
      + '%';
  }
  const btns = (rects.vol && rects.vol.w > 0)
    ? [rects.restart, rects.reset, rects.clear, rects.vol]
    : [rects.restart, rects.reset, rects.clear];
  if (!(rects.help.row3 && (state.expanded || state.tuneOpen))) btns.push(rects.help);
  // On a narrow screen this row sits in the car dropdown's lane (left, row two). While the
  // dropdown is open it owns that lane — hit already sends those taps to the dropdown — so do
  // not draw over it.
  const rowHidden = state.expanded && rects.restart.y > MARGIN;
  if (!rowHidden) for (const button of btns) drawHudButton(ctx, rects, audio, button);
}

/**
 * Top-centre, under the buttons: cone tally. Reads LIVE state - it counts what is
 * actually lying down, not what was hit (rule 10) - so standing one back up with RESET counts down
 * again.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state the shared HUD state
 * @param {object} game the game
 * @param {object} rects the layout rectangles
 * @returns {void}
 */
export function drawHudConeTally(ctx, state, game, rects) {
  const knocked = game.cones.knocked;
  // ONLY ON A LEVEL THAT ASKS FOR IT (LEVEL.coneCount: the Lab + Test Track courses) (requirement:
  // only relevant when asked for, not on most race tracks)
  if (LEVEL.coneCount && knocked > 0 && !state.tuneOpen) {
    const tallyRect = rects.tally;
    drawHudPanel(ctx, tallyRect, { fill: 'rgba(242,106,27,0.92)', stroke: null });
    drawHudLabel(ctx, knocked + ' / ' + game.cones.total + ' CONES', tallyRect.x + tallyRect.w / 2,
      tallyRect.y + tallyRect.h / 2,
      { size: 11, align: 'center', col: '#2a1405', weight: 700 });
  }
}

/**
 * Top-right: speed, gear, tacho (the SILENT TWIN of the engine note - the phone may be
 * muted).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state the shared HUD state
 * @param {object} rects the layout rectangles
 * @param {object} car the car
 * @param {object} spec the car spec
 * @param {number} wallDt wall-clock seconds
 * @returns {void}
 */
export function drawHudSpeedo(ctx, state, rects, car, spec, wallDt) {
  const speedRect = rects.speed, speedWidth = speedRect.w;
  drawHudPanel(ctx, speedRect);
  const kph = Math.hypot(car.vx, car.vy) * 3.6;
  drawHudLabel(ctx, String(Math.round(state.mph ? kph * 0.621371 : kph)), speedRect.x + 10,
    speedRect.y + 19,
    { size: 22, weight: 700 });
  drawHudLabel(ctx, state.mph ? 'mph' : 'km/h', speedRect.x + 62, speedRect.y + 24,
    { size: 9.5, col: COL.inkSoft });
  // the temperature and oil lights over the units (hud/enginelights.ts)
  drawEngineLights(ctx, speedRect, car);
  // GEAR CHANGE, made obvious. The automatic box already cuts the torque for a quarter of a
  // second, but with no sound and no needle the player had no way to know a shift had happened.
  // Flash the gear digit and pop it up a size — on the WALL CLOCK, because it is something you
  // watch (rule 5).
  const gearTxt = car.gear < 0 ? 'R' : String(car.gear);
  if (car.gear !== state.lastGear) {
    state.gearFlash = 1;
    state.lastGear = car.gear;
  }
  state.gearFlash = Math.max(0, state.gearFlash - wallDt * 2.6);
  const gearPop = state.gearFlash * state.gearFlash;
  if (gearPop > 0.02) {
    ctx.globalAlpha = gearPop * 0.85;
    ctx.fillStyle = COL.warn;
    ctx.beginPath();
    ctx.arc(speedRect.x + speedWidth - 22, speedRect.y + 19, 17 + gearPop * 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  drawHudLabel(ctx, gearTxt, speedRect.x + speedWidth - 12, speedRect.y + 19,
    { size: 20 + gearPop * 8, weight: 700, align: 'right', col: gearPop > 0.15 ? '#2a1405'
      : COL.live });

  // tacho bar
  const barX = speedRect.x + 10, barY = speedRect.y + 38, barW = speedWidth - 20, barH = 7;
  // a seized engine turns no more: the needle drops (physics/engineheat.ts)
  const frac = car.engSeized ? 0
    : Math.max(0, Math.min(1, (car.rpm - spec.idleRpm) / (spec.redline - spec.idleRpm)));
  const redFrac = (spec.upshiftRpm - spec.idleRpm) / (spec.redline - spec.idleRpm);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = frac > redFrac ? COL.danger : frac > redFrac * 0.82 ? COL.warn : COL.live;
  ctx.fillRect(barX, barY, barW * frac, barH);
  // redline zone marker
  ctx.fillStyle = 'rgba(216,69,60,0.55)';
  ctx.fillRect(barX + barW * redFrac, barY - 2, 1.5, barH + 4);
  // shift light: flashes on the WALL CLOCK (rule 5), not per physics step
  if (frac > redFrac) state.shiftFlash = Math.min(1, state.shiftFlash + wallDt * 8);
  else state.shiftFlash = Math.max(0, state.shiftFlash - wallDt * 6);
  if (state.shiftFlash > 0.02) {
    ctx.globalAlpha = state.shiftFlash * (0.55 + 0.45 * Math.sin(performance.now() / 60));
    ctx.fillStyle = COL.danger;
    ctx.fillRect(barX, barY - 5, barW, 2.5);
    ctx.globalAlpha = 1;
  }
}

/**
 * The ring colour for a tyre by its air: none while full, amber going down, red flat, silver on
 * the rim.
 * @param {object} car the car (car.tyreP set)
 * @param {number} corner the damage corner
 * @returns {string|null} the colour, or null for no ring
 */
function pressureRing(car, corner) {
  if (car.onRim && car.onRim[corner]) return '#c9c9d2';
  const pressure = car.tyreP[corner];
  return pressure >= 0.9 ? null : pressure > 0.2 ? COL.warn : COL.danger;
}

/**
 * A white ring round a punctured wheel, or a crossed-out box where the wheel is GONE.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} car the car
 * @param {number} corner 0 front -y, 1 front +y, 2 rear -y, 3 rear +y
 * @param {number} bodyX left of the diagram body
 * @param {number} bodyY top of the diagram body
 * @param {number} bodyW width of the diagram body
 * @param {number} bodyH height of the diagram body
 * @returns {void}
 */
export function drawHudWheelFault(ctx, car, corner, bodyX, bodyY, bodyW, bodyH) {
  // the ring follows the tyre's air (physics/tyrepressure.ts)
  const ring = car.tyreP && pressureRing(car, corner);
  if (ring) {
    const wheelX = corner % 2 ? bodyX + bodyW - 3 : bodyX - 4, wheelY = bodyY
      + (corner >= 2 ? bodyH - 14 : 4);
    ctx.strokeStyle = ring;
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

/**
 * One wheel of the tyre diagram: filled with its WEAR colour with tyre wear on (owner), else its
 * heat colour; its temperature beside it in the heat colour.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} car the car
 * @param {number} tyreIdx the tyre (vehicle.js order)
 * @param {number} side -1 left, +1 right
 * @param {string} heatCol the tyre's temperature colour
 * @param {number} wheelX the wheel's left, px
 * @param {number} wheelY the wheel's top, px
 * @param {boolean} fahrenheit the numbers in °F (?hudunits=1)
 */
function drawDiagramWheel(ctx, car, tyreIdx, side, heatCol, wheelX, wheelY, fahrenheit) {
  // plain rectangles: panel's 8 px corner radius is larger than a 7 px wheel and drew mangled
  // slants
  ctx.fillStyle = car.tyreWear ? wearColour(car.tyreWear[tyreIdx], COL) : heatCol;
  ctx.fillRect(wheelX, wheelY, 7, 11);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(wheelX + 0.5, wheelY + 0.5, 6, 10);
  drawHudLabel(ctx, String(tempInUnits(car.tyreT[tyreIdx], fahrenheit)),
    side < 0 ? wheelX - 4 : wheelX + 11,
    wheelY + 6, { size: 9.5, weight: 700, align: side < 0 ? 'right' : 'left', col: heatCol });
}

/**
 * A tyre temperature's colour: cold blues, the working window live, then warn and danger.
 * @param {number} temp the tyre's temperature, C
 * @param {number[]} window its working window [low, high], C
 * @returns {string} a CSS colour
 */
function tyreTempColour(temp, [optLow, optHigh]) {
  if (temp < optLow) return temp < optLow - 15 ? COL.cold : COL.cool;
  if (temp <= optHigh) return COL.live;
  return temp <= optHigh + 25 ? COL.warn : COL.danger;
}

/**
 * TYRE DIAGRAM (optional HUD). A little top-down car, FRONT UP, each wheel filled
 * with its temperature colour and its number beside it. The same body outline shows DAMAGE.
 * vehicle.js indexes tyres by body side: 0 F+y, 1 F-y, 2 R+y, 3 R-y, and +y is the car's RIGHT.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state the shared HUD state
 * @param {object} rects the layout rectangles
 * @param {object} car the car
 * @param {object} spec the car spec
 * @returns {void}
 */
export function drawHudTyreDiagram(ctx, state, rects, car, spec) {
  const speedRect = rects.speed, speedWidth = speedRect.w;
  if (state.carDiagram && car.tyreT) {
    const window = spec.tyreOpt || [65, 110], col = (temp) => tyreTempColour(temp, window);
    // the bottom DIAGRAM_H of the speed panel (all of it while the speedo is hidden)
    const centreX = speedRect.x + speedWidth / 2, top = speedRect.y + speedRect.h - DIAGRAM_H;
    const bodyW = 20, bodyH = 40,
      bodyX = centreX - bodyW / 2, bodyY = top + 4;
    // wheels first (under the body edge), then the body, then a windscreen so the FRONT is
    // unmistakable
    const wheels = [[1, -1, 0], [0, 1, 0], [3, -1, 1], [2, 1, 1]];
    // ^ [tyre index, side -1 left / +1 right, rear?]
    for (const [tyreIdx, side, rear] of wheels) {
      drawDiagramWheel(ctx, car, tyreIdx, side, col(car.tyreT[tyreIdx]),
        side < 0 ? bodyX - 4 : bodyX + bodyW - 3, bodyY + (rear ? bodyH - 14 : 4), state.tempF);
    }
    drawHudPanel(ctx, { x: bodyX, y: bodyY, w: bodyW, h: bodyH },
      { fill: 'rgba(205,210,220,0.92)', stroke: 'rgba(0,0,0,0.35)' });
    // DAMAGE (damage.ts corners: 0 front -y, 1 front +y, 2 rear -y, 3 rear +y; +y = RIGHT): each
    // body quarter amber / red with the damage there, a white-ringed wheel = a puncture
    if (car.dmg) for (let corner = 0; corner < 4; corner++) {
      const damage = car.dmg[corner], quarterX = corner % 2 ? bodyX + bodyW / 2 : bodyX + 1,
        quarterY = corner < 2 ? bodyY + 1 : bodyY + bodyH / 2;
      if (damage >= 0.05) {
        ctx.fillStyle = damage < 0.5 ? 'rgba(232,161,58,' + (0.45 + 0.5 * damage).toFixed(2) + ')'
          : 'rgba(216,69,60,' + (0.6 + 0.4 * damage).toFixed(2) + ')';
        ctx.fillRect(quarterX, quarterY, bodyW / 2 - 1, bodyH / 2 - 1);
      }
      drawHudWheelFault(ctx, car, corner, bodyX, bodyY, bodyW, bodyH);
    }
    ctx.fillStyle = 'rgba(40,46,58,0.85)';
    ctx.fillRect(bodyX + 3, bodyY + 9, bodyW - 6, 6); // windscreen near the top = the front
    ctx.fillRect(bodyX + 4, bodyY + bodyH - 9, bodyW - 8, 4);              // rear window
    drawHudLabel(ctx, 'FRONT', centreX, bodyY - 1,
      { size: 6.5, weight: 700, align: 'center', col: COL.inkSoft });
  }
}
