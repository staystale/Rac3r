// render/props/desert.ts - DEAF VALLEY's desert (highway/canyon.ts; owner 11-08: "canyon ... Cactus
// too?"): the canyon's ROCK WALL (the red rock behind its face in flat pixel-art tones, two strata
// lines, the cliff's shadow over the verge, a pale lip along the face) and the CACTUS (a loose
// object: a saguaro, its round top and arms seen from above, a long shadow - it stands tall; a
// small barrel cactus, a round green dome with pale spines; the pulp a hit leaves).
import { FIX } from '../../core/fixes.ts';
import type { Barrier, Point } from '../../world/types.ts';
import type { PropCtx } from './types.ts';

const SPINE = '#e8e2c4';
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
  // (?rocklook=1: the band is ground in the rock's look - highway/canyon.ts rockGround)
  if (barrier.band && !FIX.rocklook) {
    trace(propCtx, barrier.band, true);
    ctx.fillStyle = ROCK;
    ctx.fill();
  }
  ctx.strokeStyle = FIX.rocklook ? 'rgba(120,62,40,0.55)' : STRATA;
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
 * A CACTUS, a loose object (highway/canyon.ts; cones/coneConsts.ts DEBRIS - it snaps when hit), in
 * its own frame: a saguaro (round top, one or two arms, a long shadow), a small barrel cactus (a
 * dome with pale spines), or what a hit left (pulp: green chunks and spines scattered flat).
 * @param ctx the canvas, at the object
 * @param cone the object (its kind, its angle, its home spot for its look)
 * @param ppm pixels per metre
 * @returns true for a cactus kind
 */
export function drawLooseCactus(ctx: CanvasRenderingContext2D,
    cone: { kind: string; ang?: number; hx?: number; hy?: number }, ppm: number): boolean {
  if (cone.kind !== 'cactus' && cone.kind !== 'barrelcactus' && cone.kind !== 'pulp')
    return false;
  const seed = Math.abs(Math.round((cone.hx || 0) * 7 + (cone.hy || 0) * 13)) % 997 + 1;
  if (cone.kind === 'pulp') drawPulp(ctx, seed, ppm);
  else if (cone.kind === 'barrelcactus') drawBarrel(ctx, (0.7 + (seed % 5) * 0.1) * ppm, seed);
  else drawSaguaro(ctx, (2.2 + (seed % 11) * 0.1) * ppm, seed, cone.ang || 0);
  return true;
}

/**
 * A small barrel cactus: a green dome with pale spines and its shadow.
 * @param ctx the canvas
 * @param size px
 * @param seed its look
 */
function drawBarrel(ctx: CanvasRenderingContext2D, size: number, seed: number) {
  const dome = size * 0.8;
  ctx.fillStyle = 'rgba(40,24,14,0.35)';
  ctx.fillRect(-dome / 2 + dome * 0.25, -dome / 2 + dome * 0.3, dome, dome);
  ctx.fillStyle = '#3f7a43';
  ctx.fillRect(-dome / 2, -dome / 2, dome, dome);
  ctx.fillStyle = '#5e9a55';
  ctx.fillRect(-dome / 2 + dome * 0.15, -dome / 2 + dome * 0.15, dome * 0.45, dome * 0.4);
  ctx.fillStyle = SPINE;
  for (let i = 0; i < 4; i++)
    ctx.fillRect(-dome / 2 + dome * ((i * 0.27 + seed * 0.13) % 0.9), -dome / 2 + dome
      * ((i * 0.41 + seed * 0.07) % 0.9), Math.max(1, dome * 0.08), Math.max(1, dome * 0.08));
}

/**
 * A saguaro seen from above: its long shadow (down-right, a step at a time, as the other props'),
 * one or two arms (turned with it), its round top.
 * @param ctx the canvas
 * @param size px
 * @param seed its look
 * @param ang its turn
 */
function drawSaguaro(ctx: CanvasRenderingContext2D, size: number, seed: number, ang: number) {
  const trunk = size * 0.4, arm = size * 0.26, arms = 1 + (seed % 2);
  ctx.fillStyle = 'rgba(40,24,14,0.22)';
  for (let step = 1; step <= 3; step++)
    ctx.fillRect(-trunk / 2 + trunk * 0.45 * step, -trunk / 2 + trunk * 0.45 * step, trunk, trunk);
  ctx.save();
  ctx.rotate(ang);
  ctx.fillStyle = '#2f5d34';
  for (let i = 0; i < arms; i++) {
    const out = (i === 0 ? 1 : -1) * (trunk / 2 + arm * 0.6), along = (seed * 0.37 + i * 0.5) % 1;
    ctx.fillRect(out - arm / 2, -arm / 2 + (along - 0.5) * trunk, arm, arm);
  }
  ctx.restore();
  ctx.fillStyle = '#2f5d34';
  ctx.fillRect(-trunk / 2, -trunk / 2, trunk, trunk);
  ctx.fillStyle = '#4f8a49';
  ctx.fillRect(-trunk / 2 + trunk * 0.18, -trunk / 2 + trunk * 0.18, trunk * 0.5, trunk * 0.45);
}

/**
 * A snapped cactus: green chunks and pale spines scattered flat (seeded by its home).
 * @param ctx the canvas
 * @param seed its look
 * @param ppm pixels per metre
 */
function drawPulp(ctx: CanvasRenderingContext2D, seed: number, ppm: number) {
  let state = seed;
  const rand = () => (state = (state * 16807) % 2147483647) / 2147483647;
  for (let bit = 0; bit < 12; bit++) {
    const angle = rand() * 6.283, radius = Math.sqrt(rand()) * 1.3,
      side = (0.15 + rand() * 0.35) * ppm, spine = bit % 3 === 2;
    ctx.fillStyle = spine ? SPINE : bit % 2 ? '#3f7a43' : '#2f5d34';
    ctx.fillRect(Math.cos(angle) * radius * ppm - side / 2, Math.sin(angle) * radius * ppm
      - side / 2, spine ? Math.max(1, side * 0.3) : side, side);
  }
}
