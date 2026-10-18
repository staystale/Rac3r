// The STREET LIGHTS (?lamps=1, world/lamps.ts) seen from above. Standing (the overhead layer:
// the head hangs above the cars): the post's foot, the pole when it leans (its top moves by the
// lean), the arm reaching out over the road and the head at its end, pale when off and glowing
// warm when lit (dipping as it flickers). Fallen (the ground layer, under the cars): the pole
// lying the way it fell, bent more each time it is driven over, the arm and the dead head at its
// end. The pool on the ground is the night layer's (render/light.ts). Floodlight pylons keep
// their own painter (buildings.ts).
import {
  activeLamps, lampsLit, STREET_ARM_M, STREET_HEIGHT_M, type Lamp,
} from '../../world/lamps.ts';
import { POST_LONG_M } from '../../world/lampdamage.ts';
import type { PropCtx } from './types.ts';

// sizes seen from above, m: the post, the pole / arm width, the head's length and width
const POST_M = 0.3, ARM_WIDE_M = 0.14, HEAD_LONG_M = 0.8, HEAD_WIDE_M = 0.36;
// a lit head's glow radius, m; how far one pass bends a fallen pole sideways, m
const GLOW_M = 1.1, BEND_PER_PASS_M = 0.5;
const POLE = '#7d858f', POST = '#3b4048', HEAD_RIM = '#5c636c';

/**
 * The lamp head: its rim and its lens, warm when lit (by this frame's brightness).
 * @param ctx the context, at the head's centre, along the arm
 * @param ppm pixels per metre
 * @param shown the lamp's brightness this frame, 0..1 (0: off)
 */
function drawHead(ctx: CanvasRenderingContext2D, ppm: number, shown: number) {
  if (shown > 0) {
    ctx.globalAlpha = 0.35 * shown;
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(0, 0, GLOW_M * ppm, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = HEAD_RIM;
  ctx.fillRect(-HEAD_LONG_M / 2 * ppm, -HEAD_WIDE_M / 2 * ppm, HEAD_LONG_M * ppm,
    HEAD_WIDE_M * ppm);
  ctx.fillStyle = shown > 0.5 ? '#fff4cc' : shown > 0 ? '#c9b98e' : '#aeb5bd';
  ctx.fillRect(-(HEAD_LONG_M / 2 - 0.1) * ppm, -(HEAD_WIDE_M / 2 - 0.08) * ppm,
    (HEAD_LONG_M - 0.2) * ppm, (HEAD_WIDE_M - 0.16) * ppm);
}

/**
 * A thick line between two points, px.
 * @param ctx the context
 * @param fromX start x, px
 * @param fromY start y, px
 * @param toX end x, px
 * @param toY end y, px
 * @param width line width, px
 */
function stroke(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number,
    toY: number, width: number) {
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
}

/**
 * A standing street light: foot, the pole to its (leaning) top, the arm and the head.
 * @param ctx the context, at the lamp's foot (world axes)
 * @param lamp the lamp
 * @param ppm pixels per metre
 * @param lit whether the lamps are on
 */
function drawStanding(ctx: CanvasRenderingContext2D, lamp: Lamp, ppm: number, lit: boolean) {
  const topX = lamp.leanX * STREET_HEIGHT_M * ppm, topY = lamp.leanY * STREET_HEIGHT_M * ppm;
  const armX = Math.cos(lamp.rot) * STREET_ARM_M * ppm;
  const armY = Math.sin(lamp.rot) * STREET_ARM_M * ppm;
  ctx.fillStyle = POST;
  ctx.fillRect(-POST_M / 2 * ppm, -POST_M / 2 * ppm, POST_M * ppm, POST_M * ppm);
  ctx.strokeStyle = POLE;
  if (Math.hypot(topX, topY) > 1) stroke(ctx, 0, 0, topX, topY, ARM_WIDE_M * 1.4 * ppm);
  stroke(ctx, topX, topY, topX + armX, topY + armY, ARM_WIDE_M * ppm);
  ctx.translate(topX + armX, topY + armY);
  ctx.rotate(lamp.rot);
  drawHead(ctx, ppm, lit ? lamp.shown : 0);
}

/**
 * A fallen street light: the pole lying the way it fell, bent by each pass, its arm and head.
 * @param ctx the context, at the lamp's foot (world axes)
 * @param lamp the lamp
 * @param ppm pixels per metre
 */
function drawFallen(ctx: CanvasRenderingContext2D, lamp: Lamp, ppm: number) {
  const fall = Math.atan2(lamp.fallY, lamp.fallX), len = POST_LONG_M * ppm;
  const bend = Math.min(3, lamp.mangle) * BEND_PER_PASS_M * ppm;
  ctx.rotate(fall);
  ctx.strokeStyle = lamp.solidity < 0.3 ? '#5f666e' : POLE;
  ctx.lineWidth = ARM_WIDE_M * 1.6 * ppm;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len * 0.45, bend);
  ctx.lineTo(len, -bend * 0.4);
  ctx.stroke();
  // the arm lies across the end of the pole, the dead head at its end
  stroke(ctx, len, -bend * 0.4, len, -bend * 0.4 + STREET_ARM_M * ppm, ARM_WIDE_M * ppm);
  ctx.translate(len, -bend * 0.4 + STREET_ARM_M * ppm);
  ctx.rotate(Math.PI / 2);
  drawHead(ctx, ppm, 0);
}

/**
 * Draws every street light in view: the standing ones in the overhead layer, the fallen ones on
 * the ground.
 * @param propCtx the view and painter helpers
 * @param ppm pixels per metre
 * @param overhead true for the overhead layer
 */
export function drawStreetLights(propCtx: PropCtx, ppm: number, overhead: boolean) {
  const { view, toScreenX, toScreenY } = propCtx;
  const lit = lampsLit(), margin = 12 * ppm, ctx = view.ctx;
  for (const lamp of activeLamps()) {
    if (lamp.kind !== 'street' || lamp.down === overhead) continue;
    const screenX = toScreenX(lamp.x), screenY = toScreenY(lamp.y);
    if (screenX < -margin || screenY < -margin || screenX > view.W + margin
      || screenY > view.H + margin) continue;
    ctx.save();
    ctx.translate(screenX, screenY);
    if (lamp.down) drawFallen(ctx, lamp, ppm);
    else drawStanding(ctx, lamp, ppm, lit);
    ctx.restore();
  }
}
