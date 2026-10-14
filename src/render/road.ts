// the ROAD layer of render.ts (phase 4 of the render.js split): lanes, track ribbon, lane dashes,
// curved kerbs, paint, the floor-edge kerb, slip roads and marks. Moved verbatim.
import { FX0, FX1, FY0, FY1, KERB_W } from "../world/bounds.ts";
import { PAINT, BOARDS, LEVEL } from "../world/state.ts";
import { COL } from "../world/colours.ts";
import { MARK_EXTENT } from '../marks.js';
import type { Prop } from "../world/types.ts";
import type { Cam, ForSide, RenderMarks, RoadGame, View } from "./types.ts";

// what createRoad destructures from the renderer and the ground painter
interface RoadHelpers {
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
  paintLayers: (id: string, x0: number, y0: number, x1: number, y1: number) => void;
  artBase: (id: string, fallback: string) => string;
}

export function createRoad(view: View, cam: Cam, helpers: RoadHelpers) {
  const { PPMz, toScreenX, toScreenY, paintLayers, artBase } = helpers;

  // ---------------------------------------------------------------- lanes (pit lanes, access
  // roads) — lab.js laneAt Drawn PIECE BY PIECE — each segment's rectangle plus a disc at every
  // point — which is exactly the set lab.js laneAt calls lane (distance to the polyline <= half
  // width). The first cut (one polygon, averaged normals) pinched at taxiway corners and so
  // disagreed with the physics there. The pattern is world-anchored, so pieces join without a seam.
  function drawLanes() {
    if (!LEVEL.lanes) return;
    const pxPerM = PPMz(), vx0 = cam.x - view.W / 2 / pxPerM, vx1 = cam.x + view.W / 2 / pxPerM,
        vy0 = cam.y - view.H / 2 / pxPerM, vy1 = cam.y + view.H / 2 / pxPerM;
    for (const lane of LEVEL.lanes) {
      const pts = lane.pts, count = pts.length, halfWidth = lane.width / 2,
          surfaceId = lane.surface.id;
      if (count < 2) continue;
      // SEGMENT CULL (2026-10-04, Castle Cum): the ring road's box is the whole map, so EVERY tile
      // built all 48 pieces and painted a tile of pattern only to clip it away — MEASURED ground
      // tile 45.7 ms (Thruston 26). Now only the pieces touching the view, and the pattern only
      // over their box.
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
      if (!any) continue;
      view.ctx.fillStyle = artBase(surfaceId, COL.tarmac); view.ctx.fill('nonzero');
      view.ctx.save();
      view.ctx.clip('nonzero');
      view.ctx.translate(toScreenX(0), toScreenY(0));
      paintLayers(surfaceId, Math.max(bx0, vx0), Math.max(by0, vy0), Math.min(bx1, vx1), Math.min(
          by1, vy1));
      view.ctx.restore();
    }
  }


  // ---------------------------------------------------------------- circuit ribbon & curved
  // corner kerbs
  function drawTrackRibbon() {
    if (!LEVEL.subtrack || !LEVEL.subtrack.pts) return;
    const sub = LEVEL.subtrack;
    const pts = sub.pts;
    const count = pts.length;
    if (count < 3) return;
    const pxPerM = PPMz();
    const halfW = sub.width / 2;

    // 1. Continuous road ribbon with per-sector surface styling
    // Group contiguous segments into sector spans to fill as ONE solid polygon per sector,
    // which completely eliminates the transverse anti-aliasing seam lines across the road.
    // the surface id at a distance; 'ghost' on a point-to-point stage's invisible return segment
    // (lab.js ghostSegment): never drawn
    const sidAt = (dist: number) => {
      if (sub.ghost && dist >= sub.ghost.d0 && dist < sub.ghost.d1) return 'ghost';
      const sector = sub.sectorAt ? sub.sectorAt(dist) : null;
      return (sector && sector.surface) ? sector.surface.id : 'tarmac';
    };
    const spans: { surface: string; start: number; end: number }[] = [];
    let curSurface: string | null = null;
    let curStart = 0;
    for (let i = 0; i < count; i++) {
      const sId = sidAt(pts[i].dist);
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

    // the exact point where the sector changes between samples i-1 and i (bisected on sectorAt,
    // the physics' own rule)
    function sectorCut(i: number) {
      const prev = pts[(((i - 1) % count) + count) % count], next = pts[
          ((i % count) + count) % count];
      let distA = prev.dist, distB = next.dist; if (distB < distA) distB += sub.totalDist;
      const idOf = (dist: number) => sidAt(dist % sub.totalDist);
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
    for (const span of spans) {
      if (span.surface === 'ghost') continue;
      view.ctx.fillStyle = artBase(span.surface, COL.tarmac);
      // world bbox of this span, so its pattern is painted over THIS span only. MEASURED
      // 2026-10-03: painting each span across the whole view (relying on the clip) drew the screen
      // once per span — Stock Car fell to 10 fps at 4x CPU throttle.
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (let i = span.start; i <= span.end; i++) {
        const point = pts[((i % count) + count) % count];
        bx0 = Math.min(bx0, point.x - halfW); bx1 = Math.max(bx1, point.x + halfW);
        by0 = Math.min(by0, point.y - halfW); by1 = Math.max(by1, point.y + halfW);
      }
      // the span's centreline: cut at the EXACT sector boundaries. MEASURED BUG, 2026-10-03
      // (tools/visualcheck.mjs): spans ran to the first SAMPLE past the boundary, so every sector
      // change was drawn up to ~3 m after the point where the grip actually changes (the physics
      // cuts at the exact track distance).
      const line = spans.length > 1 ? [sectorCut(span.start)] : [];
      for (let i = span.start; i < span.end; i++) line.push(pts[((i % count) + count) % count]);
      line.push(spans.length > 1 ? sectorCut(span.end) : pts[
          ((span.end % count) + count) % count]);
      view.ctx.beginPath();
      // Outer left edge along the span
      for (let i = 0; i < line.length; i++) {
        const point = line[i], edgeX = toScreenX(point.x + point.nx * halfW), edgeY = toScreenY(
            point.y + point.ny * halfW);
        if (i === 0) view.ctx.moveTo(edgeX, edgeY); else view.ctx.lineTo(edgeX, edgeY);
      }
      // Inner right edge along the span in reverse
      for (let i = line.length - 1; i >= 0; i--) {
        const point = line[i];
        view.ctx.lineTo(toScreenX(point.x - point.nx * halfW),
          toScreenY(point.y - point.ny * halfW));
      }
      view.ctx.closePath();
      view.ctx.fill();
      // the surface's pattern, clipped to this span (2026-10-03 — the ribbon used to be flat
      // colour)
      view.ctx.save();
      view.ctx.clip();
      view.ctx.translate(toScreenX(0), toScreenY(0));
      paintLayers(span.surface, bx0, by0, bx1, by1);
      view.ctx.restore();
    }

    // 2. White outer boundary lines (continuous along tarmac/broken/racetarmac, omitted on
    // dirt/mud/grass)
    view.ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    view.ctx.lineWidth = Math.max(1, 0.22 * pxPerM);
    view.ctx.beginPath();
    let leftDrawing = false;
    for (let i = 0; i <= count; i++) {
      const point = pts[i % count];
      const sec = sub.sectorAt ? sub.sectorAt(point.dist) : null;
      const sId = sec && sec.surface ? sec.surface.id : '';
      if (sId === 'dirt' || sId === 'mud' || sId === 'grass' || sId === 'grassShort' || sidAt(
          point.dist) === 'ghost' || sub.noLines) {
        leftDrawing = false;
        continue;
      }
      const edgeX = toScreenX(point.x + point.nx * (halfW - 0.2)), edgeY = toScreenY(
          point.y + point.ny * (halfW - 0.2));
      if (!leftDrawing) {
        view.ctx.moveTo(edgeX, edgeY);
        leftDrawing = true;
      } else {
        view.ctx.lineTo(edgeX, edgeY);
      }
    }
    view.ctx.stroke();

    view.ctx.beginPath();
    let rightDrawing = false;
    for (let i = 0; i <= count; i++) {
      const point = pts[i % count];
      const sec = sub.sectorAt ? sub.sectorAt(point.dist) : null;
      const sId = sec && sec.surface ? sec.surface.id : '';
      if (sId === 'dirt' || sId === 'mud' || sId === 'grass' || sId === 'grassShort' || sidAt(
          point.dist) === 'ghost' || sub.noLines) {
        rightDrawing = false;
        continue;
      }
      const edgeX = toScreenX(point.x - point.nx * (halfW - 0.2)), edgeY = toScreenY(
          point.y - point.ny * (halfW - 0.2));
      if (!rightDrawing) {
        view.ctx.moveTo(edgeX, edgeY);
        rightDrawing = true;
      } else {
        view.ctx.lineTo(edgeX, edgeY);
      }
    }
    view.ctx.stroke();

  }

  // LANE DASHES (the highway, sub.laneDash = lateral offsets): white dashes 3 m on / 6 m off,
  // phased by the road's ABSOLUTE distance (sub.sBase) so they line up across ground tiles painted
  // before and after the road window moved
  function drawLaneDashes() {
    const sub = LEVEL.subtrack; if (!sub || !sub.laneDash) return;
    const pts = sub.pts, count = pts.length, pxPerM = PPMz(), ghost = sub.ghost;
    view.ctx.save();
    view.ctx.strokeStyle = 'rgba(245,245,240,0.8)';
    view.ctx.lineWidth = Math.max(1, 0.15 * pxPerM);
    view.ctx.setLineDash([3 * pxPerM, 6 * pxPerM]);
    view.ctx.lineDashOffset = ((sub.sBase || 0) * pxPerM) % (9 * pxPerM);
    for (const off of sub.laneDash) { view.ctx.beginPath(); let drawing = false;
      for (let i = 0; i < count; i++) {
        const point = pts[i];
        if (ghost && point.dist >= ghost.d0) break;
        const x = toScreenX(point.x + point.nx * off), y = toScreenY(point.y + point.ny * off);
        if (!drawing) {
          view.ctx.moveTo(x, y);
          drawing = true;
        } else view.ctx.lineTo(x, y);
      }
      view.ctx.stroke(); }
    view.ctx.setLineDash([]);
    // SOLID lines (sub.laneSolid, the highway's hard-shoulder line)
    for (const off of sub.laneSolid || []) { view.ctx.beginPath(); let drawing = false;
      for (let i = 0; i < count; i++) {
        const point = pts[i];
        if (ghost && point.dist >= ghost.d0) break;
        const x = toScreenX(point.x + point.nx * off), y = toScreenY(point.y + point.ny * off);
        if (!drawing) {
          view.ctx.moveTo(x, y);
          drawing = true;
        } else view.ctx.lineTo(x, y);
      }
      view.ctx.stroke(); }
    view.ctx.restore();
  }
  // CURVED CORNER KERBS — split out of drawTrackRibbon 2026-10-03 and drawn AFTER patches, wear and
  // covers (user, with a screenshot of churned dirt and a grass patch painted over a kerb:
  // "surfaces shouldn't cover kerbs — kerbs should be their own surface, bumpy and slightly slippy
  // like real race kerbs"). The physics already treats them that way (SURFACES.kerb, mu 0.70,
  // ridges in bumpAt); now nothing can paint over them.
  function drawCurvedKerbs() {
    if (!LEVEL.subtrack || !LEVEL.subtrack.pts) return;
    const sub = LEVEL.subtrack, pts = sub.pts, count = pts.length, pxPerM = PPMz(),
        halfW = sub.width / 2;
    if (sub.curvedKerbs) {
      for (const kerb of sub.curvedKerbs) {
        const sgn = kerb.side === 'left' ? 1 : -1;
        const kerbWidth = kerb.width || 2.4;
        const start = kerb.startDist, end = kerb.endDist;

        for (let i = 0; i < count; i++) {
          const startPt = pts[i];
          const endPt = pts[(i + 1) % count];
          if (startPt.dist < start || startPt.dist > end) continue;

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
      }
    }
  }

  function drawPaint() {
    for (const mark of PAINT) {
      view.ctx.strokeStyle = COL.paint;
      view.ctx.globalAlpha = mark.tone!;   // every painted mark has a tone
      // MEASURED BUG, 2026-09-27 (photographed): this read p.w, which is the BOX WIDTH for a box —
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
      view.ctx.globalAlpha = 1;
    }
    // distance boards down the braking straight
    view.ctx.fillStyle = COL.inkSoft;
    view.ctx.font = `600 ${Math.round(0.9 * PPMz())}px ui-sans-serif, system-ui, sans-serif`;
    view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
    for (const board of BOARDS) view.ctx.fillText(board.label, toScreenX(board.x),
      toScreenY(board.y));
  }

  // JOKER ARROWS (user spec 2026-10-03: "a TRANSLUCENT WHITE ARROW, gently pulsing" at joker / pit
  // entries). Hidden once the joker is done in an RX race. Wall clock: the pulse is something the
  // player watches.
  function drawArrows(game: RoadGame, wallT?: number) {
    const joker = LEVEL.joker; if (!joker || !joker.arrows) return;
    if (game.jokerTaken) return;
    // stronger + OUTLINED (user: "needs to be closed and more clearly pointing") — at 0.28-0.5
    // alpha it faded into the grey tarmac
    const pxPerM = PPMz(), alpha = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin((wallT || 0) * 3.2));
    // ar! below: the arrows hold no null once built (the builders filter them)
    for (const arrow of joker.arrows) {
      if (toScreenX(arrow!.x) < -200 || toScreenX(arrow!.x) > view.W + 200 ||
          toScreenY(arrow!.y) < -200 || toScreenY(arrow!.y) > view.H + 200) continue;
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
  }

  // A4: the boundary is VISIBLE — and now it is three different things, so it has to READ as three
  // (CLAUDE.md §4: if the player cannot find it, it does not exist). From the inside out:
  //   the KERB, a raised rumble strip you ride over and can jump off,
  //   the RUN-OFF, gravel you can drive on badly,
  //   the FENCE, the only thing that actually stops you.
  // Each side is the same drawing rotated, so the whole edge is one function of a side index.
  //
  // `forSide(i, fn)` hands fn a frame where +v points OUTWARD from the floor and u runs along the
  // edge, which is what removes the four near-identical copies the old version had. S-B
  // (2026-10-06): the floor is a RECTANGLE (lab.js FX0..FX1 x FY0..FY1). The frame is centred on
  // it, and fn gets (p, D, Lh): D = the floor edge's distance from the centre on this side, Lh =
  // half the edge's length (both FLOOR on a square: drawn exactly as before). Inside fn the CAMERA
  // is moved into the side's frame (and the view made square), so speckle's view culling - which
  // compares with cam - culls in the frame it draws in. (Before, the three rotated sides culled
  // against the unrotated view: their grass / gravel grain only drew when the camera was somewhere
  // else.)
  function forSide(i: number, callback: Parameters<ForSide>[1]) {
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

  function drawKerb() {
    if (LEVEL.endless) return;
    for (let i = 0; i < 4; i++) forSide(i, (pxPerM, edgeDist, halfLen) => {
      const inner = edgeDist - KERB_W;
      // hazard blocks across the FULL width of the strip, so the thing you drive over is what you
      // see
      const blk = 2.6;                             // m per block
      for (let along = -halfLen; along < halfLen; along += blk) {
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

  // SLIP ROAD (highway.js extras): the tarmac itself is a lane ribbon (drawLanes, ground tiles);
  // this draws its MARKINGS - the edge lines and a row of white squares along the nose where it
  // leaves the hard shoulder - on top, so they are never stale in a tile
  function drawSlip(prop: Prop, pxPerM: number) {
    const line = prop.line; if (!line || line.length < 2) return;
    if (!prop._bb) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of line) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      prop._bb = [minX - 6, minY - 6, maxX + 6, maxY + 6];
    }
    if (toScreenX(prop._bb[0]) > view.W || toScreenX(prop._bb[2]) < 0 ||
        toScreenY(prop._bb[1]) > view.H || toScreenY(prop._bb[3]) < 0) return;
    const halfW = (prop.w || 5) / 2 - 0.3, nrm = (index: number) => {
      const prev = line[Math.max(0, index - 1)], next = line[Math.min(line.length - 1, index + 1)],
          heading = Math.atan2(next[1] - prev[1], next[0] - prev[0]);
      return [-Math.sin(heading), Math.cos(heading)];
    };
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

  function drawMarks(marks: RenderMarks) {
    // one blit of the whole world layer. imageSmoothingEnabled stays on here: the layer is 9 px/m
    // and the screen is 16 px/m, so smoothing is what stops the marks looking like stair-stepped
    // bitmaps.
    const [mox, moy] = marks.origin || [0, 0], markX = toScreenX(mox - MARK_EXTENT),
      markY = toScreenY(
        moy - MARK_EXTENT);
    const size = MARK_EXTENT * 2 * PPMz();
    // smoothing OFF, so marks land on the art grid as hard blocks (photographed soft and blurry
    // with it on, 2026-10-03 — the only smeared thing left in the world layer)
    view.ctx.imageSmoothingEnabled = false;
    view.ctx.drawImage(marks.canvas, markX, markY, size, size);
    view.ctx.imageSmoothingEnabled = true;
  }
  return {
    drawLanes, drawTrackRibbon, drawLaneDashes, drawCurvedKerbs, drawPaint, forSide,
    drawKerb, drawSlip, drawMarks, drawArrows,
  };
}
