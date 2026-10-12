// the ROAD layer of render.js (phase 4 of the render.js split): lanes, track ribbon, lane dashes,
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
  sx: (wx: number) => number;
  sy: (wy: number) => number;
  paintLayers: (id: string, x0: number, y0: number, x1: number, y1: number) => void;
  artBase: (id: string, fallback: string) => string;
}

export function createRoad(view: View, cam: Cam, helpers: RoadHelpers) {
  const { PPMz, sx, sy, paintLayers, artBase } = helpers;

  // ---------------------------------------------------------------- lanes (pit lanes, access roads) — lab.js laneAt
  // Drawn PIECE BY PIECE — each segment's rectangle plus a disc at every point — which is exactly the set lab.js laneAt calls
  // lane (distance to the polyline <= half width). The first cut (one polygon, averaged normals) pinched at taxiway corners and
  // so disagreed with the physics there. The pattern is world-anchored, so pieces join without a seam.
  function drawLanes() {
    if (!LEVEL.lanes) return;
    const P = PPMz(), vx0 = cam.x - view.W / 2 / P, vx1 = cam.x + view.W / 2 / P, vy0 = cam.y - view.H / 2 / P, vy1 = cam.y + view.H / 2 / P;
    for (const ln of LEVEL.lanes) {
      const pts = ln.pts, n = pts.length, hw = ln.width / 2, id = ln.surface.id;
      if (n < 2) continue;
      // SEGMENT CULL (2026-10-04, Castle Cum): the ring road's box is the whole map, so EVERY tile built all 48 pieces and painted a
      // tile of pattern only to clip it away — MEASURED ground tile 45.7 ms (Thruston 26). Now only the pieces touching the view,
      // and the pattern only over their box.
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity, any = false;
      view.ctx.beginPath();
      for (let i = 0; i < n - 1; i++) {
        const [ax, ay] = pts[i], [qx, qy] = pts[i + 1];
        const sx0 = Math.min(ax, qx) - hw, sx1 = Math.max(ax, qx) + hw, sy0 = Math.min(ay, qy) - hw, sy1 = Math.max(ay, qy) + hw;
        if (sx1 < vx0 || sx0 > vx1 || sy1 < vy0 || sy0 > vy1) continue;
        any = true; bx0 = Math.min(bx0, sx0); bx1 = Math.max(bx1, sx1); by0 = Math.min(by0, sy0); by1 = Math.max(by1, sy1);
        const L = Math.hypot(qx - ax, qy - ay) || 1, nx = -(qy - ay) / L * hw, ny = (qx - ax) / L * hw;
        // every piece wound the same way (nonzero fill = their union, no holes where they overlap)
        view.ctx.moveTo(sx(ax + nx), sy(ay + ny)); view.ctx.lineTo(sx(qx + nx), sy(qy + ny)); view.ctx.lineTo(sx(qx - nx), sy(qy - ny)); view.ctx.lineTo(sx(ax - nx), sy(ay - ny)); view.ctx.closePath();
        // a disc at each end of a visible piece (anticlockwise = the quads' winding, else holes)
        view.ctx.moveTo(sx(ax + hw), sy(ay)); view.ctx.arc(sx(ax), sy(ay), hw * P, 0, Math.PI * 2, true);
        view.ctx.moveTo(sx(qx + hw), sy(qy)); view.ctx.arc(sx(qx), sy(qy), hw * P, 0, Math.PI * 2, true);
      }
      if (!any) continue;
      view.ctx.fillStyle = artBase(id, COL.tarmac); view.ctx.fill('nonzero');
      view.ctx.save(); view.ctx.clip('nonzero'); view.ctx.translate(sx(0), sy(0)); paintLayers(id, Math.max(bx0, vx0), Math.max(by0, vy0), Math.min(bx1, vx1), Math.min(by1, vy1)); view.ctx.restore();
    }
  }


  // ---------------------------------------------------------------- circuit ribbon & curved corner kerbs
  function drawTrackRibbon() {
    if (!LEVEL.subtrack || !LEVEL.subtrack.pts) return;
    const sub = LEVEL.subtrack;
    const pts = sub.pts;
    const n = pts.length;
    if (n < 3) return;
    const p = PPMz();
    const halfW = sub.width / 2;

    // 1. Continuous road ribbon with per-sector surface styling
    // Group contiguous segments into sector spans to fill as ONE solid polygon per sector,
    // which completely eliminates the transverse anti-aliasing seam lines across the road.
    // the surface id at a distance; 'ghost' on a point-to-point stage's invisible return segment (lab.js ghostSegment): never drawn
    const sidAt = (d: number) => { if (sub.ghost && d >= sub.ghost.d0 && d < sub.ghost.d1) return 'ghost'; const s = sub.sectorAt ? sub.sectorAt(d) : null; return (s && s.surface) ? s.surface.id : 'tarmac'; };
    const spans: { surface: string; start: number; end: number }[] = [];
    let curSurface: string | null = null;
    let curStart = 0;
    for (let i = 0; i < n; i++) {
      const sId = sidAt(pts[i].dist);
      if (sId !== curSurface) {
        if (curSurface !== null) spans.push({ surface: curSurface, start: curStart, end: i });
        curSurface = sId;
        curStart = i;
      }
    }
    spans.push({ surface: curSurface!, start: curStart, end: n });   // n >= 3: set in the loop

    // Merge wrap-around span across start/finish line so there is no seam at index 0
    if (spans.length > 1 && spans[0].surface === spans[spans.length - 1].surface) {
      const last = spans.pop()!;   // length > 1
      spans[0].start = last.start - n;
    }

    // the exact point where the sector changes between samples i-1 and i (bisected on sectorAt, the physics' own rule)
    function sectorCut(i: number) {
      const a = pts[(((i - 1) % n) + n) % n], b = pts[((i % n) + n) % n];
      let d0 = a.dist, d1 = b.dist; if (d1 < d0) d1 += sub.totalDist;
      const idOf = (d: number) => sidAt(d % sub.totalDist);
      const ida = idOf(d0);
      let lo = 0, hi = 1;
      for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (idOf(d0 + (d1 - d0) * m) === ida) lo = m; else hi = m; }
      const t = (lo + hi) / 2;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, nx: a.nx, ny: a.ny };
    }
    for (const span of spans) {
      if (span.surface === 'ghost') continue;
      view.ctx.fillStyle = artBase(span.surface, COL.tarmac);
      // world bbox of this span, so its pattern is painted over THIS span only. MEASURED 2026-10-03: painting
      // each span across the whole view (relying on the clip) drew the screen once per span — Stock Car
      // fell to 10 fps at 4x CPU throttle.
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (let i = span.start; i <= span.end; i++) {
        const pt = pts[((i % n) + n) % n];
        bx0 = Math.min(bx0, pt.x - halfW); bx1 = Math.max(bx1, pt.x + halfW);
        by0 = Math.min(by0, pt.y - halfW); by1 = Math.max(by1, pt.y + halfW);
      }
      // the span's centreline: cut at the EXACT sector boundaries. MEASURED BUG, 2026-10-03 (tools/visualcheck.mjs):
      // spans ran to the first SAMPLE past the boundary, so every sector change was drawn up to ~3 m after the point
      // where the grip actually changes (the physics cuts at the exact track distance).
      const line = spans.length > 1 ? [sectorCut(span.start)] : [];
      for (let i = span.start; i < span.end; i++) line.push(pts[((i % n) + n) % n]);
      line.push(spans.length > 1 ? sectorCut(span.end) : pts[((span.end % n) + n) % n]);
      view.ctx.beginPath();
      // Outer left edge along the span
      for (let i = 0; i < line.length; i++) {
        const pt = line[i], lx = sx(pt.x + pt.nx * halfW), ly = sy(pt.y + pt.ny * halfW);
        if (i === 0) view.ctx.moveTo(lx, ly); else view.ctx.lineTo(lx, ly);
      }
      // Inner right edge along the span in reverse
      for (let i = line.length - 1; i >= 0; i--) {
        const pt = line[i];
        view.ctx.lineTo(sx(pt.x - pt.nx * halfW), sy(pt.y - pt.ny * halfW));
      }
      view.ctx.closePath();
      view.ctx.fill();
      // the surface's pattern, clipped to this span (2026-10-03 — the ribbon used to be flat colour)
      view.ctx.save();
      view.ctx.clip();
      view.ctx.translate(sx(0), sy(0));
      paintLayers(span.surface, bx0, by0, bx1, by1);
      view.ctx.restore();
    }

    // 2. White outer boundary lines (continuous along tarmac/broken/racetarmac, omitted on dirt/mud/grass)
    view.ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    view.ctx.lineWidth = Math.max(1, 0.22 * p);
    view.ctx.beginPath();
    let leftDrawing = false;
    for (let i = 0; i <= n; i++) {
      const a = pts[i % n];
      const sec = sub.sectorAt ? sub.sectorAt(a.dist) : null;
      const sId = sec && sec.surface ? sec.surface.id : '';
      if (sId === 'dirt' || sId === 'mud' || sId === 'grass' || sId === 'grassShort' || sidAt(a.dist) === 'ghost' || sub.noLines) {
        leftDrawing = false;
        continue;
      }
      const lx = sx(a.x + a.nx * (halfW - 0.2)), ly = sy(a.y + a.ny * (halfW - 0.2));
      if (!leftDrawing) {
        view.ctx.moveTo(lx, ly);
        leftDrawing = true;
      } else {
        view.ctx.lineTo(lx, ly);
      }
    }
    view.ctx.stroke();

    view.ctx.beginPath();
    let rightDrawing = false;
    for (let i = 0; i <= n; i++) {
      const a = pts[i % n];
      const sec = sub.sectorAt ? sub.sectorAt(a.dist) : null;
      const sId = sec && sec.surface ? sec.surface.id : '';
      if (sId === 'dirt' || sId === 'mud' || sId === 'grass' || sId === 'grassShort' || sidAt(a.dist) === 'ghost' || sub.noLines) {
        rightDrawing = false;
        continue;
      }
      const rx = sx(a.x - a.nx * (halfW - 0.2)), ry = sy(a.y - a.ny * (halfW - 0.2));
      if (!rightDrawing) {
        view.ctx.moveTo(rx, ry);
        rightDrawing = true;
      } else {
        view.ctx.lineTo(rx, ry);
      }
    }
    view.ctx.stroke();

  }

  // LANE DASHES (the highway, sub.laneDash = lateral offsets): white dashes 3 m on / 6 m off, phased by the road's ABSOLUTE distance
  // (sub.sBase) so they line up across ground tiles painted before and after the road window moved
  function drawLaneDashes() {
    const sub = LEVEL.subtrack; if (!sub || !sub.laneDash) return;
    const pts = sub.pts, n = pts.length, p = PPMz(), gh = sub.ghost;
    view.ctx.save(); view.ctx.strokeStyle = 'rgba(245,245,240,0.8)'; view.ctx.lineWidth = Math.max(1, 0.15 * p); view.ctx.setLineDash([3 * p, 6 * p]); view.ctx.lineDashOffset = ((sub.sBase || 0) * p) % (9 * p);
    for (const off of sub.laneDash) { view.ctx.beginPath(); let on = false;
      for (let i = 0; i < n; i++) { const a = pts[i]; if (gh && a.dist >= gh.d0) break; const x = sx(a.x + a.nx * off), y = sy(a.y + a.ny * off); if (!on) { view.ctx.moveTo(x, y); on = true; } else view.ctx.lineTo(x, y); }
      view.ctx.stroke(); }
    view.ctx.setLineDash([]);
    // SOLID lines (sub.laneSolid, the highway's hard-shoulder line)
    for (const off of sub.laneSolid || []) { view.ctx.beginPath(); let on = false;
      for (let i = 0; i < n; i++) { const a = pts[i]; if (gh && a.dist >= gh.d0) break; const x = sx(a.x + a.nx * off), y = sy(a.y + a.ny * off); if (!on) { view.ctx.moveTo(x, y); on = true; } else view.ctx.lineTo(x, y); }
      view.ctx.stroke(); }
    view.ctx.restore();
  }
  // CURVED CORNER KERBS — split out of drawTrackRibbon 2026-10-03 and drawn AFTER patches, wear and covers
  // (user, with a screenshot of churned dirt and a grass patch painted over a kerb: "surfaces shouldn't cover
  // kerbs — kerbs should be their own surface, bumpy and slightly slippy like real race kerbs"). The physics
  // already treats them that way (SURFACES.kerb, mu 0.70, ridges in bumpAt); now nothing can paint over them.
  function drawCurvedKerbs() {
    if (!LEVEL.subtrack || !LEVEL.subtrack.pts) return;
    const sub = LEVEL.subtrack, pts = sub.pts, n = pts.length, p = PPMz(), halfW = sub.width / 2;
    if (sub.curvedKerbs) {
      for (const k of sub.curvedKerbs) {
        const sgn = k.side === 'left' ? 1 : -1;
        const kw = k.width || 2.4;
        const start = k.startDist, end = k.endDist;

        for (let i = 0; i < n; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % n];
          if (a.dist < start || a.dist > end) continue;

          // Red and white kerb teeth alternating every 2.0 m along the corner
          const tooth = Math.floor(a.dist / 2.0) % 2;
          view.ctx.fillStyle = tooth ? COL.kerbB : COL.kerbA;

          const iaX = sx(a.x + sgn * a.nx * halfW), iaY = sy(a.y + sgn * a.ny * halfW);
          const ibX = sx(b.x + sgn * b.nx * halfW), ibY = sy(b.y + sgn * b.ny * halfW);
          const oaX = sx(a.x + sgn * a.nx * (halfW + kw)), oaY = sy(a.y + sgn * a.ny * (halfW + kw));
          const obX = sx(b.x + sgn * b.nx * (halfW + kw)), obY = sy(b.y + sgn * b.ny * (halfW + kw));

          view.ctx.beginPath();
          view.ctx.moveTo(iaX, iaY);
          view.ctx.lineTo(ibX, ibY);
          view.ctx.lineTo(obX, obY);
          view.ctx.lineTo(oaX, oaY);
          view.ctx.closePath();
          view.ctx.fill();

          // Outer highlight bevel along crest
          view.ctx.strokeStyle = 'rgba(255,255,255,0.40)';
          view.ctx.lineWidth = Math.max(1, 0.08 * p);
          view.ctx.beginPath();
          view.ctx.moveTo(oaX, oaY); view.ctx.lineTo(obX, obY);
          view.ctx.stroke();

          // Inner shadow joint along asphalt edge
          view.ctx.strokeStyle = 'rgba(0,0,0,0.22)';
          view.ctx.lineWidth = Math.max(1, 0.08 * p);
          view.ctx.beginPath();
          view.ctx.moveTo(iaX, iaY); view.ctx.lineTo(ibX, ibY);
          view.ctx.stroke();
        }
      }
    }
  }

  function drawPaint() {
    for (const p of PAINT) {
      view.ctx.strokeStyle = COL.paint;
      view.ctx.globalAlpha = p.tone!;   // every painted mark has a tone
      // MEASURED BUG, 2026-09-27 (photographed): this read p.w, which is the BOX WIDTH for a box —
      // so the 6 m start box stroked at 96 px thick and rendered as a pale slab the size of a building.
      // Ring stroke width is now "lw" and nothing else is overloaded.
      view.ctx.lineWidth = Math.max(1, (p.lw || 0.12) * PPMz());
      if (p.kind === 'ring') {
        view.ctx.beginPath();
        view.ctx.arc(sx(p.x), sy(p.y), p.r! * PPMz(), 0, Math.PI * 2);   // a ring has r
        view.ctx.stroke();
      } else if (p.kind === 'box' || p.kind === 'lane') {
        // a box / lane has w and h
        view.ctx.strokeRect(sx(p.x - p.w! / 2), sy(p.y - p.h! / 2), p.w! * PPMz(), p.h! * PPMz());
      } else if (p.kind === 'chequered') {
        const halfW = (p.wid || 13) / 2;
        const halfL = (p.len || 1.6) / 2;
        const cols = 2;
        const rows = 16;
        const rowH = (halfW * 2) / rows;

        view.ctx.save();
        view.ctx.translate(sx(p.x), sy(p.y));
        view.ctx.rotate(p.rot || 0);

        // Leading and trailing boundary lines
        view.ctx.fillStyle = '#ffffff';
        view.ctx.fillRect(-halfL * PPMz(), -halfW * PPMz(), halfL * 2 * PPMz(), Math.max(1, 0.12 * PPMz()));
        view.ctx.fillRect(-halfL * PPMz(), (halfW - 0.12) * PPMz(), halfL * 2 * PPMz(), Math.max(1, 0.12 * PPMz()));

        // Alternating black and white finish line squares
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const isWhite = (r + c) % 2 === 0;
            view.ctx.fillStyle = isWhite ? '#ffffff' : '#14161c';
            const sqX = (-halfL + c * (halfL * 2 / cols)) * PPMz();
            const sqY = (-halfW + r * rowH) * PPMz();
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
    for (const b of BOARDS) view.ctx.fillText(b.label, sx(b.x), sy(b.y));
  }

  // JOKER ARROWS (user spec 2026-10-03: "a TRANSLUCENT WHITE ARROW, gently pulsing" at joker / pit entries). Hidden once the joker
  // is done in an RX race. Wall clock: the pulse is something the player watches.
  function drawArrows(game: RoadGame, wallT?: number) {
    const J = LEVEL.joker; if (!J || !J.arrows) return;
    if (game.jokerTaken) return;
    // stronger + OUTLINED (user: "needs to be closed and more clearly pointing") — at 0.28-0.5 alpha it faded into the grey tarmac
    const p = PPMz(), a = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin((wallT || 0) * 3.2));
    // ar! below: the arrows hold no null once built (the builders filter them)
    for (const ar of J.arrows) {
      if (sx(ar!.x) < -200 || sx(ar!.x) > view.W + 200 || sy(ar!.y) < -200 || sy(ar!.y) > view.H + 200) continue;
      const L = ar!.len || 7;
      view.ctx.save(); view.ctx.translate(sx(ar!.x), sy(ar!.y)); view.ctx.rotate(ar!.rot);
      view.ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      view.ctx.beginPath();
      view.ctx.moveTo(L * 0.5 * p, 0); view.ctx.lineTo(0, -L * 0.42 * p); view.ctx.lineTo(0, -L * 0.16 * p); view.ctx.lineTo(-L * 0.5 * p, -L * 0.16 * p);
      view.ctx.lineTo(-L * 0.5 * p, L * 0.16 * p); view.ctx.lineTo(0, L * 0.16 * p); view.ctx.lineTo(0, L * 0.42 * p); view.ctx.closePath(); view.ctx.fill();
      view.ctx.strokeStyle = `rgba(20,22,28,${(a * 0.8).toFixed(3)})`; view.ctx.lineWidth = Math.max(1.5, 0.25 * p); view.ctx.lineJoin = "miter"; view.ctx.stroke();
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
  // `forSide(i, fn)` hands fn a frame where +v points OUTWARD from the floor and u runs along the edge,
  // which is what removes the four near-identical copies the old version had.
  // S-B (2026-10-06): the floor is a RECTANGLE (lab.js FX0..FX1 x FY0..FY1). The frame is centred on it, and fn gets (p, D, Lh): D = the
  // floor edge's distance from the centre on this side, Lh = half the edge's length (both FLOOR on a square: drawn exactly as before).
  // Inside fn the CAMERA is moved into the side's frame (and the view made square), so speckle's view culling - which compares with
  // cam - culls in the frame it draws in. (Before, the three rotated sides culled against the unrotated view: their grass / gravel grain
  // only drew when the camera was somewhere else.)
  function forSide(i: number, fn: Parameters<ForSide>[1]) {
    const cx = (FX0 + FX1) / 2, cy = (FY0 + FY1) / 2, D = i % 2 ? (FX1 - FX0) / 2 : (FY1 - FY0) / 2, Lh = i % 2 ? (FY1 - FY0) / 2 : (FX1 - FX0) / 2;
    const a = (i * Math.PI) / 2, co = Math.round(Math.cos(a)), si = Math.round(Math.sin(a));
    const keep = { x: cam.x, y: cam.y, W: view.W, H: view.H }, dx = cam.x - cx, dy = cam.y - cy;
    view.ctx.save();
    view.ctx.translate(sx(cx), sy(cy));
    view.ctx.rotate(a);
    cam.x = dx * co + dy * si; cam.y = -dx * si + dy * co; view.W = view.H = Math.max(view.W, view.H);
    try { fn(PPMz(), D, Lh); }
    finally { cam.x = keep.x; cam.y = keep.y; view.W = keep.W; view.H = keep.H; view.ctx.restore(); }
  }

  function drawKerb() {
    if (LEVEL.endless) return;
    for (let i = 0; i < 4; i++) forSide(i, (p, D, Lh) => {
      const inner = D - KERB_W;
      // hazard blocks across the FULL width of the strip, so the thing you drive over is what you see
      const blk = 2.6;                             // m per block
      for (let u = -Lh; u < Lh; u += blk) {
        const w = Math.min(blk, Lh - u);
        view.ctx.fillStyle = (Math.round((u + Lh) / blk) % 2) ? COL.kerbB : COL.kerbA;
        view.ctx.fillRect(u * p, inner * p, w * p + 1, KERB_W * p);
      }
      // it is RAISED: bright along the crest, shadow at the inner lip where the car climbs on
      view.ctx.fillStyle = 'rgba(255,255,255,0.45)';
      view.ctx.fillRect(-Lh * p, (D - 0.5) * p, Lh * 2 * p, 0.5 * p);
      view.ctx.fillStyle = 'rgba(0,0,0,0.16)';
      view.ctx.fillRect(-Lh * p, inner * p, Lh * 2 * p, 0.35 * p);
    });
  }

  // SLIP ROAD (highway.js extras): the tarmac itself is a lane ribbon (drawLanes, ground tiles); this draws its MARKINGS - the edge
  // lines and a row of white squares along the nose where it leaves the hard shoulder - on top, so they are never stale in a tile
  function drawSlip(pr: Prop, p: number) {
    const L = pr.line; if (!L || L.length < 2) return;
    if (!pr._bb) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of L) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } pr._bb = [x0 - 6, y0 - 6, x1 + 6, y1 + 6]; }
    if (sx(pr._bb[0]) > view.W || sx(pr._bb[2]) < 0 || sy(pr._bb[1]) > view.H || sy(pr._bb[3]) < 0) return;
    const hw = (pr.w || 5) / 2 - 0.3, nrm = (k: number) => { const a = L[Math.max(0, k - 1)], b = L[Math.min(L.length - 1, k + 1)], h = Math.atan2(b[1] - a[1], b[0] - a[0]); return [-Math.sin(h), Math.cos(h)]; };
    view.ctx.save(); view.ctx.strokeStyle = 'rgba(245,245,240,0.85)'; view.ctx.lineWidth = Math.max(1, 0.15 * p);
    for (const sg of [-1, 1]) { view.ctx.beginPath(); for (let k = sg > 0 ? 1 : 0; k < L.length; k++) { const [x, y] = L[k], [nx, ny] = nrm(k), X = sx(x + nx * hw * sg), Y = sy(y + ny * hw * sg); if (k === (sg > 0 ? 1 : 0)) view.ctx.moveTo(X, Y); else view.ctx.lineTo(X, Y); } view.ctx.stroke(); }
    view.ctx.fillStyle = 'rgba(245,245,240,0.7)';
    if (pr.nose !== false) for (let k = 1; k < Math.min(5, L.length); k++) { const [x, y] = L[k], [nx, ny] = nrm(k); view.ctx.fillRect(sx(x + nx * hw) - 0.3 * p, sy(y + ny * hw) - 0.3 * p, 0.6 * p, 0.6 * p); }
    view.ctx.restore();
  }

  function drawMarks(marks: RenderMarks) {
    // one blit of the whole world layer. imageSmoothingEnabled stays on here: the layer is 9 px/m and
    // the screen is 16 px/m, so smoothing is what stops the marks looking like stair-stepped bitmaps.
    const [mox, moy] = marks.origin || [0, 0], px = sx(mox - MARK_EXTENT), py = sy(moy - MARK_EXTENT);
    const size = MARK_EXTENT * 2 * PPMz();
    // smoothing OFF, so marks land on the art grid as hard blocks (photographed soft and blurry with
    // it on, 2026-10-03 — the only smeared thing left in the world layer)
    view.ctx.imageSmoothingEnabled = false;
    view.ctx.drawImage(marks.canvas, px, py, size, size);
    view.ctx.imageSmoothingEnabled = true;
  }
  return {
    drawLanes, drawTrackRibbon, drawLaneDashes, drawCurvedKerbs, drawPaint, forSide,
    drawKerb, drawSlip, drawMarks, drawArrows,
  };
}
