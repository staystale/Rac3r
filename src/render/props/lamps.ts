// The STREET LIGHTS (?lamps=1, world/lamps.ts) seen from above: the post's foot, the arm reaching
// out over the road and the head at its end, pale when off and glowing warm when lit. Drawn in
// the overhead layer: the head hangs above the cars. The pool on the ground is the night
// layer's (render/light.ts). Floodlight pylons keep their own painter (buildings.ts).
import { activeLamps, lampsLit } from '../../world/lamps.ts';
import type { PropCtx } from './types.ts';

// sizes seen from above, m: the post, the arm's width, the head's length and width
const POST_M = 0.3, ARM_WIDE_M = 0.14, HEAD_LONG_M = 0.8, HEAD_WIDE_M = 0.36;
// a lit head's glow radius, m
const GLOW_M = 1.1;

/**
 * Draws every street light in view.
 * @param propCtx the view and painter helpers
 * @param ppm pixels per metre
 */
export function drawStreetLights(propCtx: PropCtx, ppm: number) {
  const { view, toScreenX, toScreenY } = propCtx;
  const lit = lampsLit(), margin = 4 * ppm, ctx = view.ctx;
  for (const lamp of activeLamps()) {
    if (lamp.kind !== 'street') continue;
    const screenX = toScreenX(lamp.x), screenY = toScreenY(lamp.y);
    if (screenX < -margin || screenY < -margin || screenX > view.W + margin
      || screenY > view.H + margin) continue;
    const arm = Math.hypot(lamp.headX - lamp.x, lamp.headY - lamp.y) * ppm;
    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(lamp.rot);
    ctx.fillStyle = '#3b4048';
    ctx.fillRect(-POST_M / 2 * ppm, -POST_M / 2 * ppm, POST_M * ppm, POST_M * ppm);
    ctx.fillStyle = '#7d858f';
    ctx.fillRect(0, -ARM_WIDE_M / 2 * ppm, arm, ARM_WIDE_M * ppm);
    if (lit && lamp.level > 0) {
      ctx.globalAlpha = 0.35 * lamp.level;
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(arm, 0, GLOW_M * ppm, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#5c636c';
    ctx.fillRect(arm - HEAD_LONG_M / 2 * ppm, -HEAD_WIDE_M / 2 * ppm, HEAD_LONG_M * ppm,
      HEAD_WIDE_M * ppm);
    ctx.fillStyle = lit && lamp.level > 0 ? '#fff4cc' : '#aeb5bd';
    ctx.fillRect(arm - (HEAD_LONG_M / 2 - 0.1) * ppm, -(HEAD_WIDE_M / 2 - 0.08) * ppm,
      (HEAD_LONG_M - 0.2) * ppm, (HEAD_WIDE_M - 0.16) * ppm);
    ctx.restore();
  }
}
