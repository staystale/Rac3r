// hud/controls.js — touch pedals, the ?dev=1 readout and the fps counter.
// Pure moves out of hud.js (task 173).

import { COL } from '../world/colours.ts';
import { MARGIN, drawHudPanel, drawHudLabel } from './widgets.js';

/**
 * Bottom-right: pedals (touch only), the thumb stick, and the keyboard hint.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game the game
 * @param {number} width canvas width
 * @param {number} height canvas height
 * @returns {void}
 */
export function drawHudPedals(ctx, game, width, height) {
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
      drawHudLabel(ctx, txt, pedal.x, pedal.y,
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
      drawHudLabel(ctx, 'drag anywhere on the left to steer', MARGIN, height - MARGIN - 46,
        { size: 10.5, col: 'rgba(42,44,51,0.5)' });
    }
  } else {
    drawHudLabel(ctx, 'W/S drive   A/D steer   SPACE handbrake   B abs   T tcs   R reset   H help',
      MARGIN, height - MARGIN - 46,
      { size: 11, col: 'rgba(42,44,51,0.55)' });
  }
}

/**
 * Dev readout (?dev=1). Every hidden number the tyre model runs on
 * (CLAUDE.md §3).
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state the shared HUD state
 * @param {object} game the game
 * @param {object} car the car
 * @param {number} height canvas height
 * @returns {void}
 */
export function drawHudDevReadout(ctx, state, game, car, height) {
  if (game.dev && !state.tuneOpen) {
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
    drawHudPanel(ctx, readoutRect, { fill: 'rgba(10,11,14,0.82)' });
    lines.forEach((textLine, i) =>
      drawHudLabel(ctx, textLine, readoutRect.x + 8, readoutRect.y + 12 + i * 11,
        { size: 8.5, weight: 500, col: '#b9f0dd' }));
  }
}

/**
 * FPS, test mode: now + the worst of the last ~10 s; amber under 50, red under 30.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game the game
 * @param {object} rects the layout rectangles
 * @returns {void}
 */
export function drawHudFps(ctx, game, rects) {
  if (game.testMode && game.fps) {
    const fpsRect = rects.fps, fpsLow = game.fpsLow || game.fps,
      col = (value) => (value < 30 ? '#ff6a5c' : value < 50 ? '#e8a13a' : COL.live);
    drawHudPanel(ctx, fpsRect, { fill: 'rgba(14,15,18,0.82)' });
    drawHudLabel(ctx, Math.round(game.fps) + ' FPS', fpsRect.x + 8, fpsRect.y + fpsRect.h / 2,
      { size: 10, weight: 800, col: col(game.fps) });
    drawHudLabel(ctx, 'LOW ' + Math.round(fpsLow), fpsRect.x + fpsRect.w - 8,
      fpsRect.y + fpsRect.h / 2,
      { size: 10, weight: 800, align: 'right', col: col(fpsLow) });
  }
}
