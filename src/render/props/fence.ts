// The trackside fence and the barriers: the Armco round the runoff and each barrier kind.
import { RUNOFF_W } from '../../world/bounds.ts';
import { LEVEL } from '../../world/state.ts';
import { BARRIER_HALF } from '../../world/barriers.ts';
import { isTornAfter } from '../../world/armcodent.ts';
import type { Barrier, BarrierStretches, Point } from '../../world/types.ts';
import { FIX } from '../../core/fixes.ts';
import type { PropCtx } from './types.ts';
import { drawRockWall } from './desert.ts';

/**
 * Draws the Armco fence round the runoff on each side of the arena.
 * @param propCtx the view, camera and painter helpers
 */
export function drawPropsFence(propCtx: PropCtx) {
  const { view, cam, forSide } = propCtx;
  // MEASURED: ~133k mesh segments + posts per frame along a 100 km edge (55-105 ms
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
// BARRIERS (lab.ts LEVEL.barriers): drawn at exactly the width the physics collides with
// (BARRIER_HALF)
/**
 * Adds points first..last of a polyline to the current canvas path, as one line from the first
 * (a torn armco rail's gap is left open: world/armcodent.ts).
 * @param propCtx the view and painter helpers
 * @param pts the world points
 * @param first the first point's index
 * @param last the last point's index
 */
function traceBarrierRange(propCtx: PropCtx, pts: Point[], first: number, last: number) {
  const { view, toScreenX, toScreenY } = propCtx;
  view.ctx.moveTo(toScreenX(pts[first][0]), toScreenY(pts[first][1]));
  for (let i = first + 1; i <= last; i++) {
    const [x, y] = pts[i];
    if (isTornAfter(pts[i - 1])) view.ctx.moveTo(toScreenX(x), toScreenY(y));
    else view.ctx.lineTo(toScreenX(x), toScreenY(y));
  }
}

/**
 * Traces a polyline of world points as the current canvas path: all of it, or with its stretches
 * only those on screen, each run of them as one line so the joins inside it are the whole line's.
 * @param propCtx the view and painter helpers
 * @param pts the world points
 * @param stretches its stretches with this frame's shown ones, or null for the whole line
 */
function barrierPath(propCtx: PropCtx, pts: Point[], stretches: BarrierStretches | null) {
  propCtx.view.ctx.beginPath();
  if (!pts.length) return;
  if (!stretches) {
    traceBarrierRange(propCtx, pts, 0, pts.length - 1);
    return;
  }
  const { firsts, shown } = stretches, count = shown.length;
  let stretch = 0;
  while (stretch < count) {
    if (!shown[stretch]) {
      stretch++;
      continue;
    }
    let lastShown = stretch;
    while (lastShown + 1 < count && shown[lastShown + 1]) lastShown++;
    traceBarrierRange(propCtx, pts, firsts[stretch], firsts[lastShown + 1]);
    stretch = lastShown + 1;
  }
}

/**
 * Fills square posts at an even spacing along a polyline: all of it, or with its stretches only
 * those on screen, each started at the running distance the whole line has there (the same posts).
 * @param propCtx the view and painter helpers
 * @param ppm pixels per metre
 * @param pts the world points
 * @param every metres between posts
 * @param size post size in metres
 * @param col post fill colour
 * @param stretches its stretches with this frame's shown ones, or null for the whole line
 */
function barrierPosts(
  propCtx: PropCtx,
  ppm: number,
  pts: Point[],
  every: number,
  size: number,
  col: string,
  stretches: BarrierStretches | null,
) {
  propCtx.view.ctx.fillStyle = col;
  if (!stretches) {
    postsAlong(propCtx, ppm, pts, 0, pts.length - 1, 0, every, size);
    return;
  }
  if (stretches.postEvery !== every) walkPostAcc(stretches, pts, every);
  const { firsts, shown, postAcc } = stretches;
  for (let stretch = 0; stretch < shown.length; stretch++) {
    if (!shown[stretch]) continue;
    postsAlong(propCtx, ppm, pts, firsts[stretch], firsts[stretch + 1], postAcc[stretch],
      every, size);
  }
}

/**
 * Fills the posts on segments firstSeg..endSeg - 1 of a polyline (segment i runs from point i).
 * @param propCtx the view and painter helpers
 * @param ppm pixels per metre
 * @param pts the world points
 * @param firstSeg the first segment
 * @param endSeg one past the last segment
 * @param accStart the running distance at the first segment's start, m
 * @param every metres between posts
 * @param size post size in metres
 */
function postsAlong(propCtx: PropCtx, ppm: number, pts: Point[], firstSeg: number,
    endSeg: number, accStart: number, every: number, size: number) {
  const { view, toScreenX, toScreenY } = propCtx;
  let acc = accStart;
  for (let i = firstSeg; i < endSeg; i++) {
    const [fromX, fromY] = pts[i],
      [toX, toY] = pts[i + 1],
      segLen = Math.hypot(toX - fromX, toY - fromY),
      // no posts across a torn rail's gap
      torn = isTornAfter(pts[i]);
    for (; acc <= segLen; acc += every) {
      if (torn) continue;
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
  // OFF-SCREEN CULL: Thruston's ~500 m of Armco was stroked + posted every frame
  // for the whole lap
  if (!barrier._rbb) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    // (a canyon wall's rock band reaches well past its face)
    for (const [x, y] of barrier.band || barrier.pts) {
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

// STRETCHES (?barriercull=1): a barrier is cut into stretches of about this many metres, each
// with its own box, and only those on screen are stroked and posted. MEASURED: X Gayms' Armco
// (1723 m in 7 runs round whole blocks, ~1.4 m between points) was all drawn every frame
// because each run's box held the screen. 30 m is about a quarter of the narrowest view across.
const STRETCH_METRES = 30;
// m round a stretch's box: more than the widest stroke drawn this way (a wall's 0.45 m half
// width) and a post's half size, so a skipped stretch has no pixel on screen
const STRETCH_PAD_METRES = 1;
// px more round it on screen: the antialiased edge and the 1-2 px least line width zoomed out
const STRETCH_PAD_PX = 3;
// kinds drawn whole: a pit wall's painted blocks are one dash pattern along the whole line (it
// would start again at each run), a rock wall is drawn by its own painter (desert.ts)
const WHOLE_KINDS = new Set(['pitwall', 'rock']);

/**
 * Cuts a polyline into stretches of about STRETCH_METRES, each sharing its last point with the
 * next one's first, and boxes each one.
 * @param pts the world points (2 or more)
 * @returns the stretches, none shown yet
 */
function buildBarrierStretches(pts: Point[]): BarrierStretches {
  const firstList = [0];
  let lengthMetres = 0;
  for (let i = 1; i < pts.length; i++) {
    lengthMetres += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (lengthMetres >= STRETCH_METRES && i < pts.length - 1) {
      firstList.push(i);
      lengthMetres = 0;
    }
  }
  firstList.push(pts.length - 1);
  const count = firstList.length - 1, boxes = new Float64Array(count * 4);
  for (let stretch = 0; stretch < count; stretch++) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = firstList[stretch]; i <= firstList[stretch + 1]; i++) {
      minX = Math.min(minX, pts[i][0]);
      maxX = Math.max(maxX, pts[i][0]);
      minY = Math.min(minY, pts[i][1]);
      maxY = Math.max(maxY, pts[i][1]);
    }
    boxes.set([minX - STRETCH_PAD_METRES, minY - STRETCH_PAD_METRES,
      maxX + STRETCH_PAD_METRES, maxY + STRETCH_PAD_METRES], stretch * 4);
  }
  return { pts, firsts: Int32Array.from(firstList), boxes, shown: new Uint8Array(count),
    shownCount: 0, postEvery: 0, postAcc: new Float64Array(count) };
}

/**
 * Walks the posts' running distance along the whole line exactly as postsAlong does, noting it
 * at each stretch's first point, so a stretch drawn alone puts its posts where the whole line did.
 * @param stretches the stretches
 * @param pts the world points
 * @param every metres between posts
 */
function walkPostAcc(stretches: BarrierStretches, pts: Point[], every: number) {
  const { firsts, postAcc } = stretches;
  let acc = 0, stretch = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    if (i === firsts[stretch]) postAcc[stretch++] = acc;
    const segLen = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    while (acc <= segLen) acc += every;
    acc -= segLen;
  }
  stretches.postEvery = every;
}

/**
 * A barrier's stretches with those on screen this frame marked (cut again when its points
 * changed: a dent, a tear, a restart), or null when it is drawn whole.
 * @param propCtx the view and painter helpers
 * @param barrier the barrier
 * @returns the stretches, or null
 */
function markShownStretches(propCtx: PropCtx, barrier: Barrier): BarrierStretches | null {
  if (WHOLE_KINDS.has(barrier.kind) || barrier.pts.length < 2) return null;
  if (!barrier._stretches || barrier._stretches.pts !== barrier.pts)
    barrier._stretches = buildBarrierStretches(barrier.pts);
  const { view, toScreenX, toScreenY } = propCtx, stretches = barrier._stretches;
  const { boxes, shown } = stretches;
  let shownCount = 0;
  for (let stretch = 0; stretch < shown.length; stretch++) {
    const boxAt = stretch * 4;
    const isOff = toScreenX(boxes[boxAt]) > view.W + STRETCH_PAD_PX
      || toScreenX(boxes[boxAt + 2]) < -STRETCH_PAD_PX
      || toScreenY(boxes[boxAt + 1]) > view.H + STRETCH_PAD_PX
      || toScreenY(boxes[boxAt + 3]) < -STRETCH_PAD_PX;
    shown[stretch] = isOff ? 0 : 1;
    if (!isOff) shownCount++;
  }
  stretches.shownCount = shownCount;
  return stretches;
}

/**
 * Strokes one barrier in the style of its kind.
 * @param propCtx the view and painter helpers
 * @param barrier the barrier
 * @param half half the collision width in metres
 * @param ppm pixels per metre
 * @param stretches its stretches with this frame's shown ones, or null to draw it whole
 */
function drawBarrierKind(propCtx: PropCtx, barrier: Barrier, half: number, ppm: number,
    stretches: BarrierStretches | null) {
  const { view } = propCtx;
  const path = (pts: Point[]) => barrierPath(propCtx, pts, stretches);
  const posts = (pts: Point[], every: number, size: number, col: string) =>
    barrierPosts(propCtx, ppm, pts, every, size, col, stretches);
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
  if (barrier.kind === 'catchfence') {
    // a CATCH FENCE: a see-through mesh band on light galvanised posts, a thin top rail
    path(barrier.pts);
    view.ctx.strokeStyle = 'rgba(206,212,220,0.32)';
    view.ctx.lineWidth = Math.max(2, 4 * half * ppm);
    view.ctx.stroke();
    path(barrier.pts);
    view.ctx.strokeStyle = 'rgba(226,230,236,0.7)';
    view.ctx.lineWidth = Math.max(1, 0.08 * ppm);
    view.ctx.stroke();
    posts(barrier.pts, 2.5, 0.26, '#b9bec6');
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
  if (barrier.kind === 'rock') {
    drawRockWall(propCtx, barrier, ppm);
    return;
  }
  if (drawMedianKind(propCtx, barrier, half, ppm, stretches)) return;
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
 * Draws a central reservation's own kinds (highway/medians.ts): a JERSEY barrier seen from above -
 * its wide sloped foot in light concrete, the narrow top darker, a joint between its sections every
 * 4 m - or a WOODEN post-and-rail fence, brown rails and a post every 2.5 m.
 * @param propCtx the view and painter helpers
 * @param barrier the barrier
 * @param half half the collision width in metres
 * @param ppm pixels per metre
 * @param stretches its stretches with this frame's shown ones, or null to draw it whole
 * @returns whether it was one of these
 */
function drawMedianKind(propCtx: PropCtx, barrier: Barrier, half: number, ppm: number,
    stretches: BarrierStretches | null): boolean {
  const { view } = propCtx;
  const path = () => barrierPath(propCtx, barrier.pts, stretches);
  if (barrier.kind === 'jersey') {
    path();
    view.ctx.strokeStyle = '#c4c1b8';
    view.ctx.lineWidth = Math.max(2, 2 * half * ppm);
    view.ctx.stroke();
    path();
    view.ctx.strokeStyle = '#9c998f';
    view.ctx.lineWidth = Math.max(1, 0.35 * half * ppm);
    view.ctx.stroke();
    barrierPosts(propCtx, ppm, barrier.pts, 4, 0.12, '#8a877e', stretches);
    return true;
  }
  if (barrier.kind !== 'woodfence') return false;
  path();
  view.ctx.strokeStyle = '#7a5a36';
  view.ctx.lineWidth = Math.max(1, 1.2 * half * ppm);
  view.ctx.stroke();
  barrierPosts(propCtx, ppm, barrier.pts, 2.5, 0.3, '#5a4026', stretches);
  return true;
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
    const stretches = FIX.barriercull ? markShownStretches(propCtx, barrier) : null;
    if (stretches && !stretches.shownCount) continue;
    drawBarrierKind(propCtx, barrier, half, ppm, stretches);
  }
  view.ctx.restore();
}
