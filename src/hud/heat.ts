// hud/heat.ts - THE POLICE ON THE HUD (?police=1; game/police.ts): the heat as three very small
// yellow stars just above the LIGHTS / indicator row (its own rect: hud/layout.ts heat), filled one
// a star; while a chaser sees you a blue light flashes behind them left and right in turn, as its
// light bar does - the siren's twin (the siren's sound waits for the owner). And the BUSTED card,
// as the speed camera's (hud/overlays.ts drawHudCamera), with its fine.
import { COL } from '../world/colours.ts';
import { bluesSide } from '../render/lightbar.ts';
import { BTN_H, MARGIN, drawHudLabel, drawHudPanel } from './widgets.ts';
import type { HudGame } from './hudtypes.ts';
import type { HudRect } from './widgets.ts';

// px: a star's outer radius and the gap between two
const STAR_R = 6, STAR_GAP = 5;
// ms the BUSTED card shows, and its blue flash
const BUSTED_MS = 3600, FLASH_MS = 200;

/**
 * One five-pointed star's path round (x, y).
 * @param ctx the HUD context
 * @param x centre, px
 * @param y centre, px
 * @param radius outer radius, px
 */
function traceStar(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  for (let point = 0; point < 10; point++) {
    const angle = -Math.PI / 2 + point * Math.PI / 5, reach = point % 2 ? radius * 0.45 : radius;
    if (point) ctx.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
    else ctx.moveTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  }
  ctx.closePath();
}

/**
 * The heat's stars in their rect: the filled ones yellow, the rest dark with a rim; the siren's
 * twin behind them while a chaser sees you.
 * @param ctx the HUD context
 * @param game the game (heat)
 * @param rect the heat's rect (hud/layout.ts)
 */
export function drawHudHeat(ctx: CanvasRenderingContext2D, game: HudGame, rect: HudRect) {
  const heat = game.heat;
  if (!heat) return;
  const rowW = 3 * STAR_R * 2 + 2 * STAR_GAP, left = rect.x + (rect.w - rowW) / 2;
  const midY = rect.y + rect.h / 2;
  if (heat.siren) {
    // (the lit half: left or right of the stars, in turn)
    const side = bluesSide();
    drawHudPanel(ctx, { x: side < 0 ? left - 6 : left + rowW / 2, y: rect.y, w: rowW / 2 + 6,
      h: rect.h }, { fill: COL.blues });
  }
  for (let i = 0; i < 3; i++) {
    traceStar(ctx, left + STAR_R + i * (STAR_R * 2 + STAR_GAP), midY, STAR_R);
    ctx.fillStyle = i < heat.stars ? COL.heat : 'rgba(27,29,34,0.75)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = i < heat.stars ? COL.hud : 'rgba(234,179,8,0.55)';
    ctx.stroke();
  }
}

/**
 * The BUSTED card (a bust: game/police.ts) as the speed camera's, with a short blue flash:
 * BUSTED, the stars you had, the fine (shown, not charged in TEST MODE).
 * @param ctx the HUD context
 * @param game the game (busted)
 * @param width canvas width, px
 * @param height canvas height, px
 * @param columnBottom the top-right column's lowest edge, px (portrait: the card goes under it)
 */
export function drawHudBusted(ctx: CanvasRenderingContext2D, game: HudGame, width: number,
  height: number, columnBottom: number) {
  const busted = game.busted;
  if (!busted) return;
  const elapsed = performance.now() - busted.at;
  if (elapsed > BUSTED_MS) return;
  if (elapsed < FLASH_MS) {
    ctx.fillStyle = `rgba(${COL.bluesRgb},${(0.4 * (1 - elapsed / FLASH_MS)).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
  }
  // (the camera card's size; portrait at the right under the top-right column, landscape centred
  // under the button row - PHOTOGRAPHED, 844x390 and 390x844: the camera card's places are the
  // minimap's and the distance panel's)
  const fontSize = Math.round(Math.min(width, height) * 0.035),
    boxWidth = Math.round(fontSize * 11), boxHeight = Math.round(fontSize * 3.6),
    land = width > height;
  const x = land ? Math.round(width / 2 - boxWidth / 2) : width - boxWidth - 12;
  const y = land ? BTN_H + 2 * MARGIN : Math.round(columnBottom + MARGIN / 2);
  drawHudPanel(ctx, { x, y, w: boxWidth, h: boxHeight },
    { fill: 'rgba(14,15,18,0.94)', stroke: COL.blues });
  drawHudLabel(ctx, 'BUSTED', x + boxWidth / 2, y + fontSize * 0.95,
    { size: fontSize, weight: 800, align: 'center', col: COL.blues });
  drawHudLabel(ctx, `PULLED OVER AT ${busted.stars} STAR${busted.stars > 1 ? 'S' : ''}`,
    x + boxWidth / 2, y + fontSize * 2.05,
    { size: Math.round(fontSize * 0.85), weight: 700, align: 'center', col: COL.hudText,
      maxW: boxWidth - 10 });
  drawHudLabel(ctx, `FINE -$${busted.fine}` + (busted.charged ? '' : '  ·  TEST MODE: NOT'
    + ' CHARGED'), x + boxWidth / 2, y + fontSize * 3.0,
    { size: Math.round(fontSize * 0.75), weight: 700, align: 'center', col: COL.danger,
      maxW: boxWidth - 10 });
}
