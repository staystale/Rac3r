// The trackside fence and the barriers: the Armco round the runoff and each barrier kind.
import { RUNOFF_W } from '../../world/bounds.ts';
import { LEVEL } from '../../world/state.ts';
import { BARRIER_HALF } from '../../world/barriers.ts';
import type { Barrier, Point } from '../../world/types.ts';
import type { PropCtx } from './types.ts';

/**
 * Draws the Armco fence round the runoff on each side of the arena.
 * @param propCtx the view, camera and painter helpers
 */
export function drawPropsFence(propCtx: PropCtx) {
  const { view, cam, forSide } = propCtx;
  // MEASURED 2026-10-05: ~133k mesh segments + posts per frame along a 100 km edge (55-105 ms
  // frames)
  if (LEVEL.endless) return;
  for (let i = 0; i < 4; i++)
    forSide(i, (ppm: number, edgeDist: number, halfLen: number) => {
      const y = (edgeDist + RUNOFF_W) * ppm,
        // E: the half-length of this side's fence, corners included
        fenceHalf = halfLen + RUNOFF_W;
      // only the stretch in view (the frame's cam / W from forSide): the long sides are ~1 km of
      // mesh
      const uMin = Math.max(-fenceHalf, Math.floor((cam.x - view.W / 2 / ppm) / 4) * 4 - 4),
        uMax = Math.min(fenceHalf, cam.x + view.W / 2 / ppm + 4);
      // High-performance Armco crash barrier:
      // 1. Backing catch-fence wire mesh
      view.ctx.strokeStyle = 'rgba(145,148,160,0.32)';
      view.ctx.lineWidth = Math.max(1, 0.08 * ppm);
      view.ctx.beginPath();
      for (
        let pos = Math.max(-fenceHalf, Math.floor((uMin + fenceHalf) / 2.4) * 2.4 - fenceHalf);
        pos < uMax;
        pos += 2.4
      ) {
        view.ctx.moveTo(pos * ppm, y - 1.2 * ppm);
        view.ctx.lineTo((pos + 2.4) * ppm, y + 0.4 * ppm);
        view.ctx.moveTo((pos + 2.4) * ppm, y - 1.2 * ppm);
        view.ctx.lineTo(pos * ppm, y + 0.4 * ppm);
      }
      view.ctx.stroke();

      // 2. Steel I-beam stanchions every 4 m
      const postW = Math.max(2, 0.28 * ppm);
      const postH = Math.max(3, 0.55 * ppm);
      view.ctx.fillStyle = '#42454e';
      for (
        let pos = Math.max(-fenceHalf, Math.floor((uMin + fenceHalf) / 4) * 4 - fenceHalf);
        pos <= uMax;
        pos += 4
      ) {
        view.ctx.fillRect(pos * ppm - postW / 2, y - postH * 0.4, postW, postH);
      }

      // 3. Double-corrugated Armco rail: deep shadow underneath, steel beam, specular upper
      // highlight
      view.ctx.fillStyle = 'rgba(25,27,32,0.6)';
      view.ctx.fillRect(
        -fenceHalf * ppm,
        y + 0.15 * ppm,
        fenceHalf * 2 * ppm,
        Math.max(1, 0.15 * ppm),
      );

      view.ctx.fillStyle = '#9296a2'; // galvanized beam
      view.ctx.fillRect(
        -fenceHalf * ppm,
        y - 0.25 * ppm,
        fenceHalf * 2 * ppm,
        Math.max(2, 0.45 * ppm),
      );

      view.ctx.fillStyle = '#d2d6e2'; // top reflective bevel
      view.ctx.fillRect(
        -fenceHalf * ppm,
        y - 0.25 * ppm,
        fenceHalf * 2 * ppm,
        Math.max(1, 0.12 * ppm),
      );
    });
}

// ---------------------------------------------------------------- trackside scenery & props
// BARRIERS (lab.js LEVEL.barriers): drawn at exactly the width the physics collides with
// (BARRIER_HALF)
/**
 * Traces a polyline of world points as the current canvas path.
 * @param propCtx the view and painter helpers
 * @param pts the world points
 */
function barrierPath(propCtx: PropCtx, pts: Point[]) {
  const { view, toScreenX, toScreenY } = propCtx;
  view.ctx.beginPath();
  pts.forEach(([x, y], i) =>
    i ? view.ctx.lineTo(toScreenX(x), toScreenY(y)) : view.ctx.moveTo(toScreenX(x),
      toScreenY(y)));
}

/**
 * Fills square posts at an even spacing along a polyline.
 * @param propCtx the view and painter helpers
 * @param ppm pixels per metre
 * @param pts the world points
 * @param every metres between posts
 * @param size post size in metres
 * @param col post fill colour
 */
function barrierPosts(
  propCtx: PropCtx,
  ppm: number,
  pts: Point[],
  every: number,
  size: number,
  col: string,
) {
  const { view, toScreenX, toScreenY } = propCtx;
  view.ctx.fillStyle = col;
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [fromX, fromY] = pts[i],
      [toX, toY] = pts[i + 1],
      segLen = Math.hypot(toX - fromX, toY - fromY);
    for (; acc <= segLen; acc += every) {
      const frac = acc / segLen,
        x = fromX + (toX - fromX) * frac,
        y = fromY + (toY - fromY) * frac;
      view.ctx.fillRect(
        toScreenX(x) - (size * ppm) / 2,
        toScreenY(y) - (size * ppm) / 2,
        size * ppm,
        size * ppm,
      );
    }
    acc -= segLen;
  }
}

/**
 * Tells whether a barrier lies wholly off screen (caches its bounding box).
 * @param propCtx the view and painter helpers
 * @param barrier the barrier
 * @returns true when it can be skipped
 */
function isBarrierOffscreen(propCtx: PropCtx, barrier: Barrier) {
  const { view, toScreenX, toScreenY } = propCtx;
  // OFF-SCREEN CULL (2026-10-04): Thruston's ~500 m of Armco was stroked + posted every frame
  // for the whole lap
  if (!barrier._rbb) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [x, y] of barrier.pts) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    barrier._rbb = [minX - 1, minY - 1, maxX + 1, maxY + 1];
  }
  return (
    toScreenX(barrier._rbb[0]) > view.W ||
    toScreenX(barrier._rbb[2]) < 0 ||
    toScreenY(barrier._rbb[1]) > view.H ||
    toScreenY(barrier._rbb[3]) < 0
  );
}

/**
 * Strokes one barrier in the style of its kind.
 * @param propCtx the view and painter helpers
 * @param barrier the barrier
 * @param half half the collision width in metres
 * @param ppm pixels per metre
 */
function drawBarrierKind(propCtx: PropCtx, barrier: Barrier, half: number, ppm: number) {
  const { view } = propCtx;
  const path = (pts: Point[]) => barrierPath(propCtx, pts);
  const posts = (pts: Point[], every: number, size: number, col: string) =>
    barrierPosts(propCtx, ppm, pts, every, size, col);
  if (barrier.kind === 'line') {
    path(barrier.pts);
    view.ctx.strokeStyle = barrier.col || '#e2c13a';
    view.ctx.lineWidth = Math.max(1, 0.25 * ppm);
    view.ctx.stroke();
    return;
  }
  if (barrier.kind === 'fence') {
    path(barrier.pts);
    view.ctx.strokeStyle = 'rgba(40,44,52,0.55)';
    view.ctx.lineWidth = Math.max(1, 2 * half * ppm);
    view.ctx.stroke();
    posts(barrier.pts, 3, 0.35, '#2b2f38');
    return;
  }
  if (barrier.kind === 'armco') {
    path(barrier.pts);
    view.ctx.strokeStyle = '#5d626d';
    view.ctx.lineWidth = Math.max(2, 2 * half * ppm);
    view.ctx.stroke(); // shadowed rail
    path(barrier.pts);
    view.ctx.strokeStyle = '#c9ccd3';
    view.ctx.lineWidth = Math.max(1, half * ppm);
    view.ctx.stroke(); // bright face
    posts(barrier.pts, 2, 0.32, '#3d4049');
    return;
  }
  // wall / pitwall
  path(barrier.pts);
  view.ctx.strokeStyle = '#a9a7a0';
  view.ctx.lineWidth = Math.max(2, 2 * half * ppm);
  view.ctx.stroke();
  if (barrier.kind === 'pitwall') {
    // painted red / white / blue blocks along the base (photographed at Thruxton)
    view.ctx.lineWidth = Math.max(1, half * 0.9 * ppm);
    const cols = ['#c8302c', '#f2f2f2', '#2b56b5'];
    view.ctx.setLineDash([2 * ppm, 4 * ppm]);
    cols.forEach((col, stripe) => {
      view.ctx.lineDashOffset = -stripe * 2 * ppm;
      path(barrier.pts);
      view.ctx.strokeStyle = col;
      view.ctx.stroke();
    });
    view.ctx.setLineDash([]);
  }
}

/**
 * Draws the crash barriers at exactly the width the physics collides with.
 * @param propCtx the view, camera and painter helpers
 */
export function drawPropsBarriers(propCtx: PropCtx) {
  const { view, PPMz } = propCtx;
  const list = LEVEL.barriers;
  if (!list || !list.length) return;
  const ppm = PPMz();
  view.ctx.save();
  view.ctx.lineJoin = 'round';
  view.ctx.lineCap = 'butt';
  for (const barrier of list) {
    const half = BARRIER_HALF[barrier.kind] ?? 0.2;
    if (barrier.kind === 'building') continue;
    if (isBarrierOffscreen(propCtx, barrier)) continue;
    drawBarrierKind(propCtx, barrier, half, ppm);
  }
  view.ctx.restore();
}
