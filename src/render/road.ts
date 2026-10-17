// The ROAD layer of the renderer: lanes, lane dashes, paint, the floor-edge kerb, slip roads,
// joker arrows and the marks layer (the track ribbon and curved kerbs: ribbon.ts). createRoad
// builds one context (view, camera, projection helpers) and hands it to the painters below.
import { FX0, FX1, FY0, FY1, KERB_W } from "../world/bounds.ts";
import { PAINT, BOARDS, LEVEL } from "../world/state.ts";
import { COL } from "../world/colours.ts";
import { MARK_EXTENT, MARK_PPM } from '../marks.js';
import type { Prop } from "../world/types.ts";
import type { Cam, ForSide, RenderMarks, RoadGame, View } from "./types.ts";
import { drawCurvedKerbs, drawTrackRibbon } from "./ribbon.ts";

// what createRoad destructures from the renderer and the ground painter
interface RoadHelpers {
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
  paintLayers: (id: string, x0: number, y0: number, x1: number, y1: number) => void;
  artBase: (id: string, fallback: string) => string;
  /** ribbon.ts: trace only the ribbon and kerbs that reach the view (?drawlite=1) */
  cullRibbon: boolean;
}

/** what every road painter reads: the view, the camera and the projection helpers */
interface RoadCtx extends RoadHelpers {
  view: View;
  cam: Cam;
}

type Sub = NonNullable<typeof LEVEL.subtrack>;
type PaintMark = (typeof PAINT)[number];
type JokerArrow = NonNullable<NonNullable<typeof LEVEL.joker>['arrows']>[number];

/** the world-space box of the view, in metres */
interface ViewBox {
  vx0: number;
  vx1: number;
  vy0: number;
  vy1: number;
}

/** a world-space bounding box */
interface WorldBox {
  bx0: number;
  by0: number;
  bx1: number;
  by1: number;
}

// ---------------------------------------------------------------- lanes (pit lanes, access
// roads) — lab.js laneAt Drawn PIECE BY PIECE — each segment's rectangle plus a disc at every
// point — which is exactly the set lab.js laneAt calls lane (distance to the polyline <= half
// width). The first cut (one polygon, averaged normals) pinched at taxiway corners and so
// disagreed with the physics there. The pattern is world-anchored, so pieces join without a seam.

/**
 * Traces the pieces (quad plus an end disc each) of one lane that touch the view into the
 * current path. SEGMENT CULL (Castle Cum): the ring road's box is the whole map, so only the
 * pieces touching the view are built, and the pattern is painted only over their box.
 * @param ctx the road context
 * @param lane the lane (pts, width)
 * @param viewBox the view's world box
 * @returns the box of the traced pieces, or null when none touches the view
 */
function traceLanePieces(
  ctx: RoadCtx, lane: NonNullable<typeof LEVEL.lanes>[number], viewBox: ViewBox,
): WorldBox | null {
  const { view, PPMz, toScreenX, toScreenY } = ctx;
  const { vx0, vx1, vy0, vy1 } = viewBox;
  const pxPerM = PPMz();
  const pts = lane.pts, count = pts.length, halfWidth = lane.width / 2;
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity, any = false;
  view.ctx.beginPath();
  for (let i = 0; i < count - 1; i++) {
    const [startX, startY] = pts[i], [endX, endY] = pts[i + 1];
    const sx0 = Math.min(startX, endX) - halfWidth, sx1 = Math.max(startX, endX) + halfWidth,
        sy0 = Math.min(startY, endY) - halfWidth, sy1 = Math.max(startY, endY) + halfWidth;
    if (sx1 < vx0 || sx0 > vx1 || sy1 < vy0 || sy0 > vy1) continue;
    any = true;
    bx0 = Math.min(bx0, sx0);
    bx1 = Math.max(bx1, sx1);
    by0 = Math.min(by0, sy0);
    by1 = Math.max(by1, sy1);
    const segLen = Math.hypot(endX - startX, endY - startY) || 1, nx = -(
        endY - startY) / segLen * halfWidth, ny = (endX - startX) / segLen * halfWidth;
    // every piece wound the same way (nonzero fill = their union, no holes where they overlap)
    view.ctx.moveTo(toScreenX(startX + nx), toScreenY(startY + ny));
    view.ctx.lineTo(toScreenX(endX + nx), toScreenY(endY + ny));
    view.ctx.lineTo(toScreenX(endX - nx), toScreenY(endY - ny));
    view.ctx.lineTo(toScreenX(startX - nx), toScreenY(startY - ny));
    view.ctx.closePath();
    // a disc at each end of a visible piece (anticlockwise = the quads' winding, else holes)
    view.ctx.moveTo(toScreenX(startX + halfWidth), toScreenY(startY));
    view.ctx.arc(toScreenX(startX), toScreenY(startY), halfWidth * pxPerM, 0, Math.PI * 2,
      true);
    view.ctx.moveTo(toScreenX(endX + halfWidth), toScreenY(endY));
    view.ctx.arc(toScreenX(endX), toScreenY(endY), halfWidth * pxPerM, 0, Math.PI * 2, true);
  }
  return any ? { bx0, by0, bx1, by1 } : null;
}

/**
 * Fills the traced lane path with its surface colour and paints the surface pattern over the
 * traced box, clipped to the path.
 * @param ctx the road context
 * @param surfaceId the lane's surface id
 * @param box the box of the traced pieces
 * @param viewBox the view's world box
 */
function fillLanePattern(ctx: RoadCtx, surfaceId: string, box: WorldBox, viewBox: ViewBox) {
  const { view, toScreenX, toScreenY, paintLayers, artBase } = ctx;
  const { bx0, by0, bx1, by1 } = box;
  const { vx0, vx1, vy0, vy1 } = viewBox;
  view.ctx.fillStyle = artBase(surfaceId, COL.tarmac); view.ctx.fill('nonzero');
  view.ctx.save();
  view.ctx.clip('nonzero');
  view.ctx.translate(toScreenX(0), toScreenY(0));
  paintLayers(surfaceId, Math.max(bx0, vx0), Math.max(by0, vy0), Math.min(bx1, vx1), Math.min(
      by1, vy1));
  view.ctx.restore();
}

/**
 * Draws the pit lanes and access roads that touch the view.
 * @param ctx the road context
 */
function drawLanes(ctx: RoadCtx) {
  const { view, cam, PPMz } = ctx;
  if (!LEVEL.lanes) return;
  const pxPerM = PPMz(), vx0 = cam.x - view.W / 2 / pxPerM, vx1 = cam.x + view.W / 2 / pxPerM,
      vy0 = cam.y - view.H / 2 / pxPerM, vy1 = cam.y + view.H / 2 / pxPerM;
  const viewBox = { vx0, vx1, vy0, vy1 };
  for (const lane of LEVEL.lanes) {
    if (lane.pts.length < 2) continue;
    const box = traceLanePieces(ctx, lane, viewBox);
    if (!box) continue;
    fillLanePattern(ctx, lane.surface.id, box, viewBox);
  }
}

/**
 * Strokes one lane line at a lateral offset along the track, stopping at the ghost segment.
 * @param ctx the road context
 * @param sub the subtrack
 * @param off the lateral offset in metres
 */
function strokeOffsetLine(ctx: RoadCtx, sub: Sub, off: number) {
  const { view, toScreenX, toScreenY } = ctx;
  const pts = sub.pts, count = pts.length, ghost = sub.ghost;
  view.ctx.beginPath(); let drawing = false;
  for (let i = 0; i < count; i++) {
    const point = pts[i];
    if (ghost && point.dist >= ghost.d0) break;
    const x = toScreenX(point.x + point.nx * off), y = toScreenY(point.y + point.ny * off);
    if (!drawing) {
      view.ctx.moveTo(x, y);
      drawing = true;
    } else view.ctx.lineTo(x, y);
  }
  view.ctx.stroke();
}

/**
 * LANE DASHES (the highway, sub.laneDash = lateral offsets): white dashes 3 m on / 6 m off,
 * phased by the road's ABSOLUTE distance (sub.sBase) so they line up across ground tiles painted
 * before and after the road window moved; then the SOLID lines (sub.laneSolid, the highway's
 * hard-shoulder line).
 * @param ctx the road context
 */
function drawLaneDashes(ctx: RoadCtx) {
  const { view, PPMz } = ctx;
  const sub = LEVEL.subtrack; if (!sub || !sub.laneDash) return;
  const pxPerM = PPMz();
  view.ctx.save();
  view.ctx.strokeStyle = 'rgba(245,245,240,0.8)';
  view.ctx.lineWidth = Math.max(1, 0.15 * pxPerM);
  view.ctx.setLineDash([3 * pxPerM, 6 * pxPerM]);
  view.ctx.lineDashOffset = ((sub.sBase || 0) * pxPerM) % (9 * pxPerM);
  for (const off of sub.laneDash) strokeOffsetLine(ctx, sub, off);
  view.ctx.setLineDash([]);
  for (const off of sub.laneSolid || []) strokeOffsetLine(ctx, sub, off);
  view.ctx.restore();
}

/**
 * Draws one chequered finish line mark: boundary lines, then alternating squares.
 * @param ctx the road context
 * @param mark the chequered mark
 */
function drawChequered(ctx: RoadCtx, mark: PaintMark) {
  const { view, PPMz, toScreenX, toScreenY } = ctx;
  const halfW = (mark.wid || 13) / 2;
  const halfL = (mark.len || 1.6) / 2;
  const cols = 2;
  const rows = 16;
  const rowH = (halfW * 2) / rows;

  view.ctx.save();
  view.ctx.translate(toScreenX(mark.x), toScreenY(mark.y));
  view.ctx.rotate(mark.rot || 0);

  // Leading and trailing boundary lines
  view.ctx.fillStyle = '#ffffff';
  view.ctx.fillRect(-halfL * PPMz(), -halfW * PPMz(), halfL * 2 * PPMz(), Math.max(
      1, 0.12 * PPMz()));
  view.ctx.fillRect(-halfL * PPMz(), (halfW - 0.12) * PPMz(), halfL * 2 * PPMz(), Math.max(
      1, 0.12 * PPMz()));

  // Alternating black and white finish line squares
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const isWhite = (row + col) % 2 === 0;
      view.ctx.fillStyle = isWhite ? '#ffffff' : '#14161c';
      const sqX = (-halfL + col * (halfL * 2 / cols)) * PPMz();
      const sqY = (-halfW + row * rowH) * PPMz();
      const sqW = (halfL * 2 / cols) * PPMz();
      const sqH = rowH * PPMz();
      view.ctx.fillRect(sqX, sqY, sqW + 0.4, sqH + 0.4);
    }
  }
  view.ctx.restore();
}

/**
 * Draws the painted marks (rings, boxes, lanes, the chequered line) and the distance boards
 * down the braking straight.
 * @param ctx the road context
 */
function drawPaint(ctx: RoadCtx) {
  const { view, PPMz, toScreenX, toScreenY } = ctx;
  for (const mark of PAINT) {
    view.ctx.strokeStyle = COL.paint;
    view.ctx.globalAlpha = mark.tone!;   // every painted mark has a tone
    // MEASURED BUG (photographed): this read p.w, which is the BOX WIDTH for a box —
    // so the 6 m start box stroked at 96 px thick and rendered as a pale slab the size of a
    // building. Ring stroke width is now "lw" and nothing else is overloaded.
    view.ctx.lineWidth = Math.max(1, (mark.lw || 0.12) * PPMz());
    if (mark.kind === 'ring') {
      view.ctx.beginPath();
      view.ctx.arc(toScreenX(mark.x), toScreenY(mark.y), mark.r! * PPMz(), 0,
        Math.PI * 2);   // a ring has r
      view.ctx.stroke();
    } else if (mark.kind === 'box' || mark.kind === 'lane') {
      // a box / lane has w and h
      view.ctx.strokeRect(
          toScreenX(mark.x - mark.w! / 2), toScreenY(mark.y - mark.h! / 2), mark.w! * PPMz(),
            mark.h! * PPMz(
          ));
    } else if (mark.kind === 'chequered') {
      drawChequered(ctx, mark);
    }
    view.ctx.globalAlpha = 1;
  }
  // distance boards down the braking straight
  view.ctx.fillStyle = COL.inkSoft;
  view.ctx.font = `600 ${Math.round(0.9 * PPMz())}px ui-sans-serif, system-ui, sans-serif`;
  view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
  for (const board of BOARDS) view.ctx.fillText(board.label, toScreenX(board.x),
    toScreenY(board.y));
}

/**
 * Draws one joker arrow: a translucent white outlined arrow, rotated to its heading.
 * @param ctx the road context
 * @param arrow the arrow (x, y, rot, len)
 * @param alpha the pulse alpha
 * @param pxPerM pixels per metre
 */
function drawJokerArrow(ctx: RoadCtx, arrow: JokerArrow, alpha: number, pxPerM: number) {
  const { view, toScreenX, toScreenY } = ctx;
  const arrowLen = arrow!.len || 7;
  view.ctx.save(); view.ctx.translate(toScreenX(arrow!.x),
    toScreenY(arrow!.y)); view.ctx.rotate(arrow!.rot);
  view.ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
  view.ctx.beginPath();
  view.ctx.moveTo(arrowLen * 0.5 * pxPerM, 0);
  view.ctx.lineTo(0, -arrowLen * 0.42 * pxPerM);
  view.ctx.lineTo(0, -arrowLen * 0.16 * pxPerM);
  view.ctx.lineTo(-arrowLen * 0.5 * pxPerM, -arrowLen * 0.16 * pxPerM);
  view.ctx.lineTo(-arrowLen * 0.5 * pxPerM, arrowLen * 0.16 * pxPerM);
  view.ctx.lineTo(0, arrowLen * 0.16 * pxPerM);
  view.ctx.lineTo(0, arrowLen * 0.42 * pxPerM);
  view.ctx.closePath();
  view.ctx.fill();
  view.ctx.strokeStyle = `rgba(20,22,28,${(alpha * 0.8).toFixed(3)})`;
  view.ctx.lineWidth = Math.max(1.5, 0.25 * pxPerM);
  view.ctx.lineJoin = "miter";
  view.ctx.stroke();
  view.ctx.restore();
}

/**
 * JOKER ARROWS: a translucent white arrow, gently pulsing, at joker / pit entries. Hidden once
 * the joker is done in an RX race. Wall clock: the pulse is something the player watches.
 * @param ctx the road context
 * @param game the game (jokerTaken)
 * @param wallT the wall-clock time in seconds
 */
function drawArrows(ctx: RoadCtx, game: RoadGame, wallT?: number) {
  const { view, PPMz, toScreenX, toScreenY } = ctx;
  const joker = LEVEL.joker; if (!joker || !joker.arrows) return;
  if (game.jokerTaken) return;
  // stronger + OUTLINED: at 0.28-0.5 alpha it faded into the grey tarmac
  const pxPerM = PPMz(), alpha = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin((wallT || 0) * 3.2));
  // ar! below: the arrows hold no null once built (the builders filter them)
  for (const arrow of joker.arrows) {
    if (toScreenX(arrow!.x) < -200 || toScreenX(arrow!.x) > view.W + 200 ||
        toScreenY(arrow!.y) < -200 || toScreenY(arrow!.y) > view.H + 200) continue;
    drawJokerArrow(ctx, arrow, alpha, pxPerM);
  }
}

// A4: the boundary is VISIBLE — and now it is three different things, so it has to READ as three
// (CLAUDE.md §4: if the player cannot find it, it does not exist). From the inside out:
//   the KERB, a raised rumble strip you ride over and can jump off,
//   the RUN-OFF, gravel you can drive on badly,
//   the FENCE, the only thing that actually stops you.
// Each side is the same drawing rotated, so the whole edge is one function of a side index.

/**
 * `forSide(i, fn)` hands fn a frame where +v points OUTWARD from the floor and u runs along the
 * edge, which is what removes the four near-identical copies the old version had. The floor is a
 * RECTANGLE (lab.js FX0..FX1 x FY0..FY1). The frame is centred on it, and fn gets (p, D, Lh):
 * D = the floor edge's distance from the centre on this side, Lh = half the edge's length (both
 * FLOOR on a square). Inside fn the CAMERA is moved into the side's frame (and the view made
 * square), so speckle's view culling - which compares with cam - culls in the frame it draws in.
 * @param ctx the road context
 * @param i the side index (0..3)
 * @param callback receives px per metre, the edge distance and the half length
 */
function runForSide(ctx: RoadCtx, i: number, callback: Parameters<ForSide>[1]) {
  const { view, cam, PPMz, toScreenX, toScreenY } = ctx;
  const centreX = (FX0 + FX1) / 2, centreY = (FY0 + FY1) / 2, edgeDist = i % 2 ? (
      FX1 - FX0) / 2 : (FY1 - FY0) / 2, halfLen = i % 2 ? (FY1 - FY0) / 2 : (FX1 - FX0) / 2;
  const angle = (i * Math.PI) / 2, cosA = Math.round(Math.cos(angle)), sinA = Math.round(
      Math.sin(angle));
  const keep = {
    x: cam.x, y: cam.y, W: view.W, H: view.H
  }, dx = cam.x - centreX, dy = cam.y - centreY;
  view.ctx.save();
  view.ctx.translate(toScreenX(centreX), toScreenY(centreY));
  view.ctx.rotate(angle);
  cam.x = dx * cosA + dy * sinA;
  cam.y = -dx * sinA + dy * cosA;
  view.W = view.H = Math.max(view.W, view.H);
  try { callback(PPMz(), edgeDist, halfLen); }
  finally {
    cam.x = keep.x;
    cam.y = keep.y;
    view.W = keep.W;
    view.H = keep.H;
    view.ctx.restore();
  }
}

/**
 * Draws the floor-edge kerb on the four sides: hazard blocks across the full width of the strip,
 * raised: bright along the crest, shadow at the inner lip where the car climbs on.
 * @param ctx the road context
 */
function drawKerb(ctx: RoadCtx) {
  const { view, cam } = ctx;
  if (LEVEL.endless) return;
  for (let i = 0; i < 4; i++) runForSide(ctx, i, (pxPerM, edgeDist, halfLen) => {
    const inner = edgeDist - KERB_W;
    // hazard blocks across the FULL width of the strip, so the thing you drive over is what you
    // see
    const blk = 2.6;                             // m per block
    // only the blocks in view (runForSide put the camera in the side's frame): every block of
    // a 30 km floor edge was 23k fills a frame, 4.4 s of an 8 s drive at CPU x4
    const reach = view.W / 2 / pxPerM + blk;
    const first = Math.max(0, Math.floor((cam.x - reach + halfLen) / blk));
    const last = Math.ceil((cam.x + reach + halfLen) / blk);
    for (let index = first; index <= last; index++) {
      const along = -halfLen + index * blk;
      if (along >= halfLen) break;
      const blockW = Math.min(blk, halfLen - along);
      view.ctx.fillStyle = (Math.round((along + halfLen) / blk) % 2) ? COL.kerbB : COL.kerbA;
      view.ctx.fillRect(along * pxPerM, inner * pxPerM, blockW * pxPerM + 1, KERB_W * pxPerM);
    }
    // it is RAISED: bright along the crest, shadow at the inner lip where the car climbs on
    view.ctx.fillStyle = 'rgba(255,255,255,0.45)';
    view.ctx.fillRect(-halfLen * pxPerM, (edgeDist - 0.5) * pxPerM, halfLen * 2 * pxPerM,
        0.5 * pxPerM);
    view.ctx.fillStyle = 'rgba(0,0,0,0.16)';
    view.ctx.fillRect(-halfLen * pxPerM, inner * pxPerM, halfLen * 2 * pxPerM, 0.35 * pxPerM);
  });
}

/**
 * Caches the slip road's padded bounding box on the prop.
 * @param prop the slip road prop
 * @param line the slip road's centreline
 */
function cacheSlipBox(prop: Prop, line: NonNullable<Prop['line']>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of line) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  prop._bb = [minX - 6, minY - 6, maxX + 6, maxY + 6];
}

/**
 * The unit normal of a slip road's centreline at a sample.
 * @param line the centreline
 * @param index the sample index
 * @returns the normal [x, y]
 */
function slipNormal(line: NonNullable<Prop['line']>, index: number) {
  const prev = line[Math.max(0, index - 1)], next = line[Math.min(line.length - 1, index + 1)],
      heading = Math.atan2(next[1] - prev[1], next[0] - prev[0]);
  return [-Math.sin(heading), Math.cos(heading)];
}

/**
 * Whether a slip road's bounding box (already cached) is wholly off screen.
 * @param ctx the road context
 * @param prop the slip road prop
 * @returns true when nothing of it can be seen
 */
function slipOffscreen(ctx: RoadCtx, prop: Prop) {
  const { view, toScreenX, toScreenY } = ctx;
  return toScreenX(prop._bb![0]) > view.W || toScreenX(prop._bb![2]) < 0 ||
      toScreenY(prop._bb![1]) > view.H || toScreenY(prop._bb![3]) < 0;
}

/**
 * SLIP ROAD (highway.js extras): the tarmac itself is a lane ribbon (drawLanes, ground tiles);
 * this draws its MARKINGS - the edge lines and a row of white squares along the nose where it
 * leaves the hard shoulder - on top, so they are never stale in a tile.
 * @param ctx the road context
 * @param prop the slip road prop
 * @param pxPerM pixels per metre
 */
function drawSlip(ctx: RoadCtx, prop: Prop, pxPerM: number) {
  const { view, toScreenX, toScreenY } = ctx;
  const line = prop.line; if (!line || line.length < 2) return;
  if (!prop._bb) cacheSlipBox(prop, line);
  if (slipOffscreen(ctx, prop)) return;
  const halfW = (prop.w || 5) / 2 - 0.3, nrm = (index: number) => slipNormal(line, index);
  view.ctx.save();
  view.ctx.strokeStyle = 'rgba(245,245,240,0.85)';
  view.ctx.lineWidth = Math.max(1, 0.15 * pxPerM);
  for (const sign of [-1, 1]) {
    view.ctx.beginPath();
    for (let index = sign > 0 ? 1 : 0; index < line.length; index++) {
      const [x, y] = line[index], [nx, ny] = nrm(index),
        screenX = toScreenX(x + nx * halfW * sign),
          screenY = toScreenY(y + ny * halfW * sign);
      if (index === (sign > 0 ? 1 : 0)) view.ctx.moveTo(screenX, screenY);
      else view.ctx.lineTo(screenX, screenY);
    }
    view.ctx.stroke();
  }
  view.ctx.fillStyle = 'rgba(245,245,240,0.7)';
  if (prop.nose !== false) for (let index = 1; index < Math.min(5, line.length); index++) {
    const [x, y] = line[index], [nx, ny] = nrm(index);
    view.ctx.fillRect(toScreenX(x + nx * halfW) - 0.3 * pxPerM,
      toScreenY(y + ny * halfW) - 0.3 * pxPerM,
        0.6 * pxPerM, 0.6 * pxPerM);
  }
  view.ctx.restore();
}

/**
 * Blits the whole world marks layer.
 * @param ctx the road context
 * @param marks the marks (origin, canvas)
 */
function drawMarks(ctx: RoadCtx, marks: RenderMarks) {
  const { view, PPMz, toScreenX, toScreenY } = ctx;
  // smoothing OFF, so marks land on the art grid as hard blocks (photographed soft and blurry
  // with it on — the only smeared thing left in the world layer)
  view.ctx.imageSmoothingEnabled = false;
  if (marks.shiftX || marks.shiftY) drawWrappedMarks(ctx, marks);
  else {
    // one blit of the whole layer, centred on the world origin
    const size = MARK_EXTENT * 2 * PPMz();
    view.ctx.drawImage(marks.canvas, toScreenX(-MARK_EXTENT), toScreenY(-MARK_EXTENT), size,
      size);
  }
  view.ctx.imageSmoothingEnabled = true;
}

/**
 * Blits a wrap-around marks layer whose window has moved (marks.js "WRAP-AROUND LAYER"): up to
 * four pieces, split where the window wraps past the layer's right and bottom edges.
 * @param ctx the road context
 * @param marks the marks (canvas, size, window shift)
 */
function drawWrappedMarks(ctx: RoadCtx, marks: RenderMarks) {
  const { view, PPMz, toScreenX, toScreenY } = ctx;
  const size = marks.size, screenPerPx = PPMz() / MARK_PPM;
  const startCol = ((marks.shiftX % size) + size) % size;
  const startRow = ((marks.shiftY % size) + size) % size;
  for (let colPiece = 0; colPiece < 2; colPiece++) {
    const srcX = colPiece ? 0 : startCol, width = colPiece ? startCol : size - startCol;
    if (width <= 0) continue;
    // the unwrapped layer px of the piece's first column, then its world x on screen
    const left = toScreenX((marks.shiftX + (colPiece ? size - startCol : 0)) / MARK_PPM
      - MARK_EXTENT);
    for (let rowPiece = 0; rowPiece < 2; rowPiece++) {
      const srcY = rowPiece ? 0 : startRow, height = rowPiece ? startRow : size - startRow;
      if (height <= 0) continue;
      const top = toScreenY((marks.shiftY + (rowPiece ? size - startRow : 0)) / MARK_PPM
        - MARK_EXTENT);
      view.ctx.drawImage(marks.canvas, srcX, srcY, width, height, left, top,
        width * screenPerPx, height * screenPerPx);
    }
  }
}

/**
 * Builds the road painters over one shared context.
 * @param view the canvas view
 * @param cam the camera
 * @param helpers the projection and layer helpers
 * @returns the road painters and forSide
 */
export function createRoad(view: View, cam: Cam, helpers: RoadHelpers) {
  const roadCtx: RoadCtx = { view, cam, ...helpers };
  const forSide = (i: number, callback: Parameters<ForSide>[1]) =>
    runForSide(roadCtx, i, callback);
  return {
    drawLanes: () => drawLanes(roadCtx),
    drawTrackRibbon: () => drawTrackRibbon(roadCtx),
    drawLaneDashes: () => drawLaneDashes(roadCtx),
    drawCurvedKerbs: () => drawCurvedKerbs(roadCtx),
    drawPaint: () => drawPaint(roadCtx),
    forSide,
    drawKerb: () => drawKerb(roadCtx),
    drawSlip: (prop: Prop, pxPerM: number) => drawSlip(roadCtx, prop, pxPerM),
    drawMarks: (marks: RenderMarks) => drawMarks(roadCtx, marks),
    drawArrows: (game: RoadGame, wallT?: number) => drawArrows(roadCtx, game, wallT),
  };
}
