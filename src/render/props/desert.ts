// render/props/desert.ts - DEAF VALLEY's desert (highway/canyon.ts; owner 11-08: "canyon ... Cactus
// too?"): the canyon's ROCK WALL (the red rock behind its face in flat pixel-art tones, two strata
// lines, the cliff's shadow over the verge, a pale lip along the face) and the CACTUS (a saguaro:
// its round top and arms seen from above, a long shadow - it stands tall; a small barrel cactus:
// a round green dome with pale spines).
import type { Barrier, Point, Prop } from '../../world/types.ts';
import type { PropCtx } from './types.ts';

const ROCK = '#a8643f', STRATA = '#8c4f33', SHADOW = 'rgba(58,30,20,0.55)', LIP = '#d49a6c';

/**
 * Trace a world polyline (or polygon) on the screen.
 * @param propCtx the view and painter helpers
 * @param pts the world points
 * @param close close it as a polygon
 */
function trace(propCtx: PropCtx, pts: Point[], close = false) {
  const { view, toScreenX, toScreenY } = propCtx;
  view.ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? view.ctx.lineTo(toScreenX(x), toScreenY(y))
    : view.ctx.moveTo(toScreenX(x), toScreenY(y))));
  if (close) view.ctx.closePath();
}

/**
 * A canyon's rock wall: the rock band, its strata, the cliff's shadow on the verge, the lip.
 * @param propCtx the view and painter helpers
 * @param barrier the wall (its band and strata)
 * @param ppm pixels per metre
 */
export function drawRockWall(propCtx: PropCtx, barrier: Barrier, ppm: number) {
  const ctx = propCtx.view.ctx;
  if (barrier.band) {
    trace(propCtx, barrier.band, true);
    ctx.fillStyle = ROCK;
    ctx.fill();
  }
  ctx.strokeStyle = STRATA;
  ctx.lineWidth = Math.max(1, 0.6 * ppm);
  for (const line of barrier.strata || []) {
    trace(propCtx, line);
    ctx.stroke();
  }
  // the face: its shadow falling 1.5 m over the verge, then a pale lip where the rock tops it
  trace(propCtx, barrier.pts);
  ctx.strokeStyle = SHADOW;
  ctx.lineWidth = Math.max(2, 3 * ppm);
  ctx.stroke();
  trace(propCtx, barrier.pts);
  ctx.strokeStyle = LIP;
  ctx.lineWidth = Math.max(1, 0.35 * ppm);
  ctx.stroke();
}

/**
 * The cactus prop: a saguaro (s 1.6 m and up: round top, one or two arms, a long shadow) or a
 * small barrel cactus (a dome with pale spines).
 * @param propCtx the view and painter helpers
 * @param prop the prop
 * @param ppm pixels per metre
 */
export function drawCactus(propCtx: PropCtx, prop: Prop, ppm: number) {
  const ctx = propCtx.view.ctx, size = (prop.s || 2) * ppm, seed = prop.seed || 1;
  if ((prop.s || 2) < 1.6) {
    const dome = size * 0.8;
    ctx.fillStyle = 'rgba(40,24,14,0.35)';
    ctx.fillRect(-dome / 2 + dome * 0.25, -dome / 2 + dome * 0.3, dome, dome);
    ctx.fillStyle = '#3f7a43';
    ctx.fillRect(-dome / 2, -dome / 2, dome, dome);
    ctx.fillStyle = '#5e9a55';
    ctx.fillRect(-dome / 2 + dome * 0.15, -dome / 2 + dome * 0.15, dome * 0.45, dome * 0.4);
    ctx.fillStyle = '#e8e2c4';
    for (let i = 0; i < 4; i++)
      ctx.fillRect(-dome / 2 + dome * ((i * 0.27 + seed * 0.13) % 0.9), -dome / 2 + dome
        * ((i * 0.41 + seed * 0.07) % 0.9), Math.max(1, dome * 0.08), Math.max(1, dome * 0.08));
    return;
  }
  const trunk = size * 0.4, arm = size * 0.26, arms = 1 + (seed % 2);
  // tall: its shadow falls down-right as the other props' do, a step at a time
  ctx.fillStyle = 'rgba(40,24,14,0.22)';
  for (let step = 1; step <= 3; step++)
    ctx.fillRect(-trunk / 2 + trunk * 0.45 * step, -trunk / 2 + trunk * 0.45 * step, trunk, trunk);
  ctx.fillStyle = '#2f5d34';
  for (let i = 0; i < arms; i++) {
    const out = (i === 0 ? 1 : -1) * (trunk / 2 + arm * 0.6), along = (seed * 0.37 + i * 0.5) % 1;
    ctx.fillRect(out - arm / 2, -arm / 2 + (along - 0.5) * trunk, arm, arm);
  }
  ctx.fillRect(-trunk / 2, -trunk / 2, trunk, trunk);
  ctx.fillStyle = '#4f8a49';
  ctx.fillRect(-trunk / 2 + trunk * 0.18, -trunk / 2 + trunk * 0.18, trunk * 0.5, trunk * 0.45);
}
