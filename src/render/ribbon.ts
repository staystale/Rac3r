// The CIRCUIT RIBBON of the renderer: the track's surface spans, its white edge lines and the
// curved corner kerbs. Their world geometry is built once per subtrack (ribbonGeometry) and each
// draw traces only what reaches the view, so a ground tile no longer traces the whole track.
// MEASURED (Brands GP, 4 AI, CPU x4, 90 s): the ribbon (3.6 s) and the kerb teeth (3.4 s) were
// 87 % of the tile painting (8.1 s), almost all of it outside the tile, clipped by the canvas.
// With the cull (?drawlite=1) a span outline is clipped to the view box plus CULL margins
// (Sutherland-Hodgman keeps every vertex and edge inside the box and the winding inside it), an
// edge line drops only segments wholly outside the box, a kerb tooth only when wholly outside.
// The shapes are the same, but Chrome's canvas picks its anti-aliasing method by a path's point
// count, so a few road-edge pixels change shade (renderhash: up to 0.014 % of the screen).
// Without it the traced paths are the old ones (renderhash SAME).
import { LEVEL } from "../world/state.ts";
import { COL } from "../world/colours.ts";
import type { Cam, View } from "./types.ts";

/** what the ribbon painters read: the view, the camera and the projection helpers */
export interface RibbonCtx {
  view: View;
  cam: Cam;
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
  paintLayers: (id: string, x0: number, y0: number, x1: number, y1: number) => void;
  artBase: (id: string, fallback: string) => string;
  /** false: trace everything, as before the cull (the paths, and so the pixels, are the same) */
  cullRibbon: boolean;
}

type Sub = NonNullable<typeof LEVEL.subtrack>;
type SubPts = Sub['pts'];
type CurvedKerb = NonNullable<Sub['curvedKerbs']>[number];
type RibbonSpan = { surface: string; start: number; end: number };

/** a world-space box, in metres */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** one sector span: its surface, its outline in metres (left edge out, right edge back), boxes */
interface SpanShape {
  surface: string;
  outlineX: Float64Array;
  outlineY: Float64Array;
  /** the outline's own box (the cull test) */
  outlineBox: Box;
  /** the centreline samples' box widened by half the width (the pattern's fill rect) */
  patternBox: Box;
}

/** one unbroken run of a white edge line, in metres */
interface EdgeRun {
  pointsX: Float64Array;
  pointsY: Float64Array;
}

/** one kerb tooth: its kerb, the index of its first sample and its box */
interface Tooth {
  kerb: CurvedKerb;
  index: number;
  box: Box;
}

/** everything the ribbon draws, in world metres, and what it was built from */
interface RibbonGeometry {
  pts: SubPts;
  count: number;
  sectors: Sub['sectors'];
  sectorCount: number;
  layoutId: number;
  ghost: Sub['ghost'];
  noLines: boolean;
  width: number;
  curvedKerbs: Sub['curvedKerbs'];
  spans: SpanShape[];
  /** the left edge's runs, then the right edge's from this index */
  edgeRuns: EdgeRun[];
  rightFirst: number;
  teeth: Tooth[];
}

// CULL margins: what is traced reaches this far past the view, so a clip edge, a dropped join
// or a skipped tooth lies well outside every pixel (kerb width 2.4 m, line width 0.22 m, a miter
// spike at most 10 half line widths, anti-aliasing a pixel)
const CULL_MARGIN_M = 4, CULL_MARGIN_PX = 8;
// the box with the cull off: every span, edge segment and tooth reaches it, nothing is clipped
const EVERYWHERE: Box = { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };

const geometryCache = new WeakMap<Sub, RibbonGeometry>();

/**
 * The surface id at a distance along the track; 'ghost' on a point-to-point stage's invisible
 * return segment (lab.js ghostSegment): never drawn.
 * @param sub the subtrack
 * @param dist the distance along the track
 * @returns the surface id
 */
function ribbonSurfaceAt(sub: Sub, dist: number) {
  if (sub.ghost && dist >= sub.ghost.d0 && dist < sub.ghost.d1) return 'ghost';
  const sector = sub.sectorAt ? sub.sectorAt(dist) : null;
  return (sector && sector.surface) ? sector.surface.id : 'tarmac';
}

/**
 * Groups contiguous samples into sector spans (one solid polygon per sector, which removes the
 * transverse anti-aliasing seam lines across the road) and merges the wrap-around span across
 * the start/finish line so there is no seam at index 0.
 * @param sub the subtrack
 * @param pts the track samples
 * @param count the number of samples (>= 3)
 * @returns the spans
 */
function buildRibbonSpans(sub: Sub, pts: SubPts, count: number) {
  const spans: RibbonSpan[] = [];
  let curSurface: string | null = null;
  let curStart = 0;
  for (let i = 0; i < count; i++) {
    const sId = ribbonSurfaceAt(sub, pts[i].dist);
    if (sId !== curSurface) {
      if (curSurface !== null) spans.push({ surface: curSurface, start: curStart, end: i });
      curSurface = sId;
      curStart = i;
    }
  }
  spans.push({ surface: curSurface!, start: curStart, end: count });   // n >= 3: set in the loop

  // Merge wrap-around span across start/finish line so there is no seam at index 0
  if (spans.length > 1 && spans[0].surface === spans[spans.length - 1].surface) {
    const last = spans.pop()!;   // length > 1
    spans[0].start = last.start - count;
  }
  return spans;
}

/**
 * The exact point where the sector changes between samples i-1 and i (bisected on sectorAt, the
 * physics' own rule).
 * @param sub the subtrack
 * @param pts the track samples
 * @param count the number of samples
 * @param i the sample index
 * @returns the cut point and its normal
 */
function findSectorCut(sub: Sub, pts: SubPts, count: number, i: number) {
  const prev = pts[(((i - 1) % count) + count) % count], next = pts[
      ((i % count) + count) % count];
  let distA = prev.dist, distB = next.dist; if (distB < distA) distB += sub.totalDist;
  const idOf = (dist: number) => ribbonSurfaceAt(sub, dist % sub.totalDist);
  const ida = idOf(distA);
  let low = 0, high = 1;
  for (let step = 0; step < 20; step++) {
    const mid = (low + high) / 2;
    if (idOf(distA + (distB - distA) * mid) === ida) low = mid;
    else high = mid;
  }
  const frac = (low + high) / 2;
  return {
    x: prev.x + (next.x - prev.x) * frac, y: prev.y + (next.y - prev.y) * frac, nx: prev.nx,
        ny: prev.ny
  };
}

/**
 * The box of a list of points.
 * @param pointsX the x coordinates, metres
 * @param pointsY the y coordinates, metres
 * @returns the box
 */
function boxOf(pointsX: ArrayLike<number>, pointsY: ArrayLike<number>): Box {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (let i = 0; i < pointsX.length; i++) {
    box.x0 = Math.min(box.x0, pointsX[i]); box.x1 = Math.max(box.x1, pointsX[i]);
    box.y0 = Math.min(box.y0, pointsY[i]); box.y1 = Math.max(box.y1, pointsY[i]);
  }
  return box;
}

/**
 * One span's outline (left edge along the span, right edge back), its boxes and its surface.
 * @param sub the subtrack
 * @param spans all the spans
 * @param span the span
 * @returns the span shape
 */
function buildSpanShape(sub: Sub, spans: RibbonSpan[], span: RibbonSpan): SpanShape {
  const pts = sub.pts, count = pts.length, halfW = sub.width / 2;
  const patternBox = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (let i = span.start; i <= span.end; i++) {
    const point = pts[((i % count) + count) % count];
    patternBox.x0 = Math.min(patternBox.x0, point.x - halfW);
    patternBox.x1 = Math.max(patternBox.x1, point.x + halfW);
    patternBox.y0 = Math.min(patternBox.y0, point.y - halfW);
    patternBox.y1 = Math.max(patternBox.y1, point.y + halfW);
  }
  // the span's centreline: cut at the EXACT sector boundaries (spans ran to the first SAMPLE
  // past the boundary, so every sector change was drawn up to ~3 m after the point where the
  // grip actually changes; the physics cuts at the exact track distance).
  const line = spans.length > 1 ? [findSectorCut(sub, pts, count, span.start)] : [];
  for (let i = span.start; i < span.end; i++) line.push(pts[((i % count) + count) % count]);
  line.push(spans.length > 1 ? findSectorCut(sub, pts, count, span.end) : pts[
      ((span.end % count) + count) % count]);
  const outlineX = new Float64Array(line.length * 2), outlineY = new Float64Array(line.length * 2);
  for (let i = 0; i < line.length; i++) {
    const point = line[i], back = line.length * 2 - 1 - i;
    outlineX[i] = point.x + point.nx * halfW;
    outlineY[i] = point.y + point.ny * halfW;
    outlineX[back] = point.x - point.nx * halfW;
    outlineY[back] = point.y - point.ny * halfW;
  }
  return {
    surface: span.surface, outlineX, outlineY, outlineBox: boxOf(outlineX, outlineY), patternBox,
  };
}

/**
 * The runs of one white edge line (continuous along tarmac / broken / racetarmac, omitted on
 * dirt / mud / grass and the ghost segment), in metres.
 * @param sub the subtrack
 * @param side +1 for the left edge, -1 for the right edge
 * @param runs the list the runs are added to
 */
function buildEdgeRuns(sub: Sub, side: number, runs: EdgeRun[]) {
  const pts = sub.pts, count = pts.length, halfW = sub.width / 2;
  let pointsX: number[] = [], pointsY: number[] = [];
  const endRun = () => {
    if (pointsX.length > 1) {
      runs.push({ pointsX: Float64Array.from(pointsX), pointsY: Float64Array.from(pointsY) });
    }
    pointsX = []; pointsY = [];
  };
  for (let i = 0; i <= count; i++) {
    const point = pts[i % count];
    const sec = sub.sectorAt ? sub.sectorAt(point.dist) : null;
    const sId = sec && sec.surface ? sec.surface.id : '';
    if (sId === 'dirt' || sId === 'mud' || sId === 'grass' || sId === 'grassShort' ||
        ribbonSurfaceAt(sub, point.dist) === 'ghost' || sub.noLines) {
      endRun();
      continue;
    }
    pointsX.push(point.x + side * point.nx * (halfW - 0.2));
    pointsY.push(point.y + side * point.ny * (halfW - 0.2));
  }
  endRun();
}

/**
 * The teeth of the curved kerbs, in drawing order, each with its box.
 * @param sub the subtrack
 * @returns the teeth
 */
function buildTeeth(sub: Sub) {
  const teeth: Tooth[] = [];
  const pts = sub.pts, count = pts.length, halfW = sub.width / 2;
  for (const kerb of sub.curvedKerbs || []) {
    const sgn = kerb.side === 'left' ? 1 : -1, reach = halfW + (kerb.width || 2.4);
    for (let i = 0; i < count; i++) {
      const startPt = pts[i], endPt = pts[(i + 1) % count];
      if (startPt.dist < kerb.startDist || startPt.dist > kerb.endDist) continue;
      const pointsX = [startPt.x + sgn * startPt.nx * halfW, endPt.x + sgn * endPt.nx * halfW,
        startPt.x + sgn * startPt.nx * reach, endPt.x + sgn * endPt.nx * reach];
      const pointsY = [startPt.y + sgn * startPt.ny * halfW, endPt.y + sgn * endPt.ny * halfW,
        startPt.y + sgn * startPt.ny * reach, endPt.y + sgn * endPt.ny * reach];
      teeth.push({ kerb, index: i, box: boxOf(pointsX, pointsY) });
    }
  }
  return teeth;
}

/**
 * The ribbon's world geometry for a subtrack, built once and rebuilt when the track, its sectors
 * (the grass track re-rolls them in place and bumps layoutId), its ghost or its kerbs change.
 * @param sub the subtrack (>= 3 samples)
 * @returns the geometry
 */
function ribbonGeometry(sub: Sub): RibbonGeometry {
  const hit = geometryCache.get(sub);
  if (hit && hit.pts === sub.pts && hit.count === sub.pts.length && hit.sectors === sub.sectors
      && hit.sectorCount === (sub.sectors ? sub.sectors.length : 0)
      && hit.layoutId === (sub.layoutId || 0) && hit.ghost === sub.ghost
      && hit.noLines === !!sub.noLines && hit.width === sub.width
      && hit.curvedKerbs === sub.curvedKerbs) return hit;
  const spans = buildRibbonSpans(sub, sub.pts, sub.pts.length);
  const edgeRuns: EdgeRun[] = [];
  buildEdgeRuns(sub, 1, edgeRuns);
  const rightFirst = edgeRuns.length;
  buildEdgeRuns(sub, -1, edgeRuns);
  const geometry: RibbonGeometry = {
    pts: sub.pts, count: sub.pts.length, sectors: sub.sectors,
    sectorCount: sub.sectors ? sub.sectors.length : 0, layoutId: sub.layoutId || 0,
    ghost: sub.ghost, noLines: !!sub.noLines, width: sub.width, curvedKerbs: sub.curvedKerbs,
    spans: spans.filter((span) => span.surface !== 'ghost')
      .map((span) => buildSpanShape(sub, spans, span)),
    edgeRuns, rightFirst, teeth: buildTeeth(sub),
  };
  geometryCache.set(sub, geometry);
  return geometry;
}

/**
 * The view's world box widened by the cull margins (everywhere with the cull off).
 * @param ctx the ribbon context
 * @returns the box, metres
 */
function cullBox(ctx: RibbonCtx): Box {
  const { view, cam, PPMz } = ctx;
  if (!ctx.cullRibbon) return EVERYWHERE;
  const pxPerM = PPMz(), margin = CULL_MARGIN_M + CULL_MARGIN_PX / pxPerM;
  return {
    x0: cam.x - view.W / 2 / pxPerM - margin, x1: cam.x + view.W / 2 / pxPerM + margin,
    y0: cam.y - view.H / 2 / pxPerM - margin, y1: cam.y + view.H / 2 / pxPerM + margin,
  };
}

/**
 * Whether two boxes overlap.
 * @param first a box
 * @param second a box
 * @returns true when they share any point
 */
function overlaps(first: Box, second: Box) {
  return first.x0 <= second.x1 && first.x1 >= second.x0 && first.y0 <= second.y1
    && first.y1 >= second.y0;
}

/**
 * Whether one box lies wholly inside another.
 * @param inner the box tested
 * @param outer the box it must fit in
 * @returns true when inner is inside outer
 */
function inside(inner: Box, outer: Box) {
  return inner.x0 >= outer.x0 && inner.x1 <= outer.x1 && inner.y0 >= outer.y0
    && inner.y1 <= outer.y1;
}

// the clip's ping-pong buffers, grown as needed (no allocation per tile once warm)
let clipAX = new Float64Array(256), clipAY = new Float64Array(256);
let clipBX = new Float64Array(256), clipBY = new Float64Array(256);

/**
 * Makes sure the clip buffers hold a polygon of this many vertices.
 * @param size the vertex count needed
 */
function growClipBuffers(size: number) {
  if (clipAX.length >= size) return;
  const length = Math.max(size, clipAX.length * 2);
  clipAX = new Float64Array(length); clipAY = new Float64Array(length);
  clipBX = new Float64Array(length); clipBY = new Float64Array(length);
}

/**
 * Clips a polygon to one side of an axis line (one Sutherland-Hodgman pass): keeps the vertices
 * on the kept side exactly, adds the crossing points on the line.
 * @param count vertices in (srcX, srcY)
 * @param axisY true to cut on y, false on x
 * @param limit the line's coordinate
 * @param keepAbove true keeps coordinate >= limit, false keeps <= limit
 * @param srcX source x
 * @param srcY source y
 * @param outX destination x
 * @param outY destination y
 * @returns the vertices written
 */
function clipPass(count: number, axisY: boolean, limit: number, keepAbove: boolean,
    srcX: Float64Array, srcY: Float64Array, outX: Float64Array, outY: Float64Array) {
  let written = 0;
  const sideOf = (index: number) => {
    const value = axisY ? srcY[index] : srcX[index];
    return keepAbove ? value >= limit : value <= limit;
  };
  for (let i = 0; i < count; i++) {
    const prev = (i + count - 1) % count, prevIn = sideOf(prev), curIn = sideOf(i);
    if (prevIn !== curIn) {
      const from = axisY ? srcY[prev] : srcX[prev], toward = axisY ? srcY[i] : srcX[i];
      const frac = (limit - from) / (toward - from);
      outX[written] = axisY ? srcX[prev] + (srcX[i] - srcX[prev]) * frac : limit;
      outY[written] = axisY ? limit : srcY[prev] + (srcY[i] - srcY[prev]) * frac;
      written++;
    }
    if (curIn) {
      outX[written] = srcX[i]; outY[written] = srcY[i];
      written++;
    }
  }
  return written;
}

/**
 * Clips a span outline to a box into clipBX / clipBY.
 * @param shape the span shape
 * @param box the box
 * @returns the vertices in clipBX / clipBY
 */
function clipOutline(shape: SpanShape, box: Box) {
  const size = shape.outlineX.length;
  // each pass adds at most one vertex per crossing: twice the input is ample
  growClipBuffers(size * 2 + 8);
  let count = clipPass(size, false, box.x0, true, shape.outlineX, shape.outlineY, clipAX, clipAY);
  count = clipPass(count, false, box.x1, false, clipAX, clipAY, clipBX, clipBY);
  count = clipPass(count, true, box.y0, true, clipBX, clipBY, clipAX, clipAY);
  return clipPass(count, true, box.y1, false, clipAX, clipAY, clipBX, clipBY);
}

/**
 * Fills one ribbon span (the part of its outline in the cull box) and paints the surface's
 * pattern clipped to it, over the span's own world box only. MEASURED: painting each span
 * across the whole view (relying on the clip) drew the screen once per span.
 * @param ctx the ribbon context
 * @param shape the span shape
 * @param box the cull box
 */
function drawSpanShape(ctx: RibbonCtx, shape: SpanShape, box: Box) {
  const { view, toScreenX, toScreenY, paintLayers, artBase } = ctx;
  let count = shape.outlineX.length, pointsX = shape.outlineX, pointsY = shape.outlineY;
  if (!inside(shape.outlineBox, box)) {
    count = clipOutline(shape, box);
    pointsX = clipBX; pointsY = clipBY;
  }
  if (count < 3) return;
  view.ctx.fillStyle = artBase(shape.surface, COL.tarmac);
  view.ctx.beginPath();
  view.ctx.moveTo(toScreenX(pointsX[0]), toScreenY(pointsY[0]));
  for (let i = 1; i < count; i++) view.ctx.lineTo(toScreenX(pointsX[i]), toScreenY(pointsY[i]));
  view.ctx.closePath();
  view.ctx.fill();
  // the surface's pattern, clipped to this span
  const pattern = shape.patternBox;
  view.ctx.save();
  view.ctx.clip();
  view.ctx.translate(toScreenX(0), toScreenY(0));
  paintLayers(shape.surface, pattern.x0, pattern.y0, pattern.x1, pattern.y1);
  view.ctx.restore();
}

/**
 * Strokes edge runs [first, end) as one path: only the segments that reach the cull box.
 * @param ctx the ribbon context
 * @param runs the edge runs
 * @param first the first run
 * @param end one past the last run
 * @param box the cull box
 */
function strokeEdgeRuns(ctx: RibbonCtx, runs: EdgeRun[], first: number, end: number, box: Box) {
  const { view, toScreenX, toScreenY } = ctx;
  view.ctx.beginPath();
  for (let runIndex = first; runIndex < end; runIndex++) {
    const { pointsX, pointsY } = runs[runIndex];
    let open = false;
    for (let i = 0; i + 1 < pointsX.length; i++) {
      const reaches = Math.min(pointsX[i], pointsX[i + 1]) <= box.x1
        && Math.max(pointsX[i], pointsX[i + 1]) >= box.x0
        && Math.min(pointsY[i], pointsY[i + 1]) <= box.y1
        && Math.max(pointsY[i], pointsY[i + 1]) >= box.y0;
      if (!reaches) {
        open = false;
        continue;
      }
      if (!open) view.ctx.moveTo(toScreenX(pointsX[i]), toScreenY(pointsY[i]));
      view.ctx.lineTo(toScreenX(pointsX[i + 1]), toScreenY(pointsY[i + 1]));
      open = true;
    }
  }
  view.ctx.stroke();
}

/**
 * Draws the circuit ribbon: one solid polygon per sector span with its surface pattern, then
 * the white boundary lines on both edges.
 * @param ctx the ribbon context
 */
export function drawTrackRibbon(ctx: RibbonCtx) {
  const { view, PPMz } = ctx;
  if (!LEVEL.subtrack || !LEVEL.subtrack.pts) return;
  const sub = LEVEL.subtrack;
  if (sub.pts.length < 3) return;
  const geometry = ribbonGeometry(sub), box = cullBox(ctx);

  // 1. Continuous road ribbon with per-sector surface styling
  for (const shape of geometry.spans) {
    if (overlaps(shape.outlineBox, box)) drawSpanShape(ctx, shape, box);
  }

  // 2. White outer boundary lines (continuous along tarmac/broken/racetarmac, omitted on
  // dirt/mud/grass)
  view.ctx.strokeStyle = 'rgba(255,255,255,0.72)';
  view.ctx.lineWidth = Math.max(1, 0.22 * PPMz());
  // each edge is one path, as it was traced before the cache
  strokeEdgeRuns(ctx, geometry.edgeRuns, 0, geometry.rightFirst, box);
  strokeEdgeRuns(ctx, geometry.edgeRuns, geometry.rightFirst, geometry.edgeRuns.length, box);
}

// CURVED CORNER KERBS are drawn AFTER patches, wear and covers, so nothing can paint over them:
// kerbs are their own surface, bumpy and slightly slippy like real race kerbs. The physics
// already treats them that way (SURFACES.kerb, mu 0.70, ridges in bumpAt).

/**
 * Draws one tooth of a curved kerb between two track samples: the quad, its outer highlight
 * bevel along the crest and the inner shadow joint along the asphalt edge.
 * @param ctx the ribbon context
 * @param sub the subtrack
 * @param kerb the curved kerb (side, width)
 * @param index the index of the tooth's first sample
 */
function drawKerbTooth(ctx: RibbonCtx, sub: Sub, kerb: CurvedKerb, index: number) {
  const { view, PPMz, toScreenX, toScreenY } = ctx;
  const pts = sub.pts, count = pts.length, pxPerM = PPMz(), halfW = sub.width / 2;
  const sgn = kerb.side === 'left' ? 1 : -1;
  const kerbWidth = kerb.width || 2.4;
  const startPt = pts[index];
  const endPt = pts[(index + 1) % count];

  // Red and white kerb teeth alternating every 2.0 m along the corner
  const tooth = Math.floor(startPt.dist / 2.0) % 2;
  view.ctx.fillStyle = tooth ? COL.kerbB : COL.kerbA;

  const iaX = toScreenX(startPt.x + sgn * startPt.nx * halfW), iaY = toScreenY(
      startPt.y + sgn * startPt.ny * halfW);
  const ibX = toScreenX(endPt.x + sgn * endPt.nx * halfW), ibY = toScreenY(
      endPt.y + sgn * endPt.ny * halfW);
  const oaX = toScreenX(startPt.x + sgn * startPt.nx * (halfW + kerbWidth)),
    oaY = toScreenY(
      startPt.y + sgn * startPt.ny * (halfW + kerbWidth));
  const obX = toScreenX(endPt.x + sgn * endPt.nx * (halfW + kerbWidth)), obY = toScreenY(
      endPt.y + sgn * endPt.ny * (halfW + kerbWidth));

  view.ctx.beginPath();
  view.ctx.moveTo(iaX, iaY);
  view.ctx.lineTo(ibX, ibY);
  view.ctx.lineTo(obX, obY);
  view.ctx.lineTo(oaX, oaY);
  view.ctx.closePath();
  view.ctx.fill();

  // Outer highlight bevel along crest
  view.ctx.strokeStyle = 'rgba(255,255,255,0.40)';
  view.ctx.lineWidth = Math.max(1, 0.08 * pxPerM);
  view.ctx.beginPath();
  view.ctx.moveTo(oaX, oaY); view.ctx.lineTo(obX, obY);
  view.ctx.stroke();

  // Inner shadow joint along asphalt edge
  view.ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  view.ctx.lineWidth = Math.max(1, 0.08 * pxPerM);
  view.ctx.beginPath();
  view.ctx.moveTo(iaX, iaY); view.ctx.lineTo(ibX, ibY);
  view.ctx.stroke();
}

/**
 * Draws the curved corner kerbs of the subtrack: the teeth that reach the view, in order.
 * @param ctx the ribbon context
 */
export function drawCurvedKerbs(ctx: RibbonCtx) {
  if (!LEVEL.subtrack || !LEVEL.subtrack.pts || LEVEL.subtrack.pts.length < 3) return;
  const sub = LEVEL.subtrack, box = cullBox(ctx);
  for (const tooth of ribbonGeometry(sub).teeth) {
    if (overlaps(tooth.box, box)) drawKerbTooth(ctx, sub, tooth.kerb, tooth.index);
  }
}
