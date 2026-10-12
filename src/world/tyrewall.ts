// tyrewall.js - the OUTER TYRE WALL section. Moved verbatim out of lab.js.
import { SUB_CELL } from "./subtrack.ts";
import { COURSE, GATE, GATE_SPACING, smoothPath } from "./course.ts";
import { qsHintSub, qsHint } from "./wear.js";
import type {
  Cone, Point, Prop, Subtrack, SubtrackHit, TrackPoint, TyreWallOptions, ClearBox,
} from "./types.ts";

// ---------------------------------------------------------------------------------------------
// OUTER TYRE WALL (user, 2026-10-03: "add a tyre wall around the stock car and grass track circuits";
// chose LOOSE stacks on the OUTSIDE only). Returns plain `tyrestack` objects for a level's `cones` list,
// so they are the same knockable 38 kg stacks as everywhere else — they burst into rolling tyres when hit
// hard (cones.js). Nothing new in the physics; the wall is DATA generated from the track's own centreline.
//
//   margin   m from the track EDGE to the centre of the stacks (the grass runoff before the wall)
//   spacing  m between stacks, measured along the WALL (not the centreline) so corners are as dense as
//            straights — the outside of a bend is longer than the centreline through it
//   clear    boxes {x, y, hw, hh} the wall must leave a gap round (props it would otherwise run through)
//
// "Outside" = the side of the centreline facing AWAY from the loop's centroid, which is right for any
// convex circuit (both ovals). A stack that would land within the track width + 1 m of ANY part of the
// circuit is also dropped, so a tight hairpin cannot throw part of the wall onto another bit of road.
export function outerTyreWall(
  subtrack: Subtrack, { margin = 3, spacing = 1.0, clear = [] }: TyreWallOptions = {},
): Cone[] {
  const pts = subtrack.pts, halfW = subtrack.width / 2;
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;
  // the wall's own path: every centreline point pushed outward by halfW + margin
  const path = pts.map((p) => {
    const s = (p.x - cx) * p.nx + (p.y - cy) * p.ny >= 0 ? 1 : -1;
    return { x: p.x + s * p.nx * (halfW + margin), y: p.y + s * p.ny * (halfW + margin) };
  });
  const out: Cone[] = [];
  let carry = spacing;                 // distance walked since the last stack. Starts at `spacing` so the
                                       // first stack sits ON path[0] and the closing seam is one spacing, not two
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let d = spacing - carry;           // where the next stack falls on this segment
    while (d <= len) {
      const x = a.x + (b.x - a.x) * (d / len), y = a.y + (b.y - a.y) * (d / len);
      const blocked = clear.some((c) => Math.abs(x - c.x) < c.hw && Math.abs(y - c.y) < c.hh)
        || querySubtrack(subtrack, x, y).dist < halfW + 1;
      if (!blocked) out.push({ x, y, kind: 'tyrestack' });
      d += spacing;
    }
    carry = len - (d - spacing);
  }
  return out;
}

// The clearance a prop needs from the wall, from its kind. Half-extents in metres, padded ~0.6 m beyond
// what render.js draws (a stack is 0.48 m in radius). Kinds not listed sit in the infield, away from it.
export function propClearance(props: Prop[]): ClearBox[] {
  const size: Record<string, Point> = {
    pylon: [1.6, 1.6], board: [9.6, 1.7], official_box: [2.8, 2.4],
  };
  return props.flatMap((p) => {
    if (p.kind === 'grandstand') return [{ x: p.x, y: p.y, hw: p.w! / 2 + 1, hh: p.h! / 2 + 1 }];
    const s = size[p.kind];
    return s ? [{ x: p.x, y: p.y, hw: s[0], hh: s[1] }] : [];
  });
}

// A cover placed BY DISTANCE ALONG A TRACK (2026-10-03): \`offset\` metres to the left (+) / right (-) of the
// centreline, rotated to the road. Data, so "move that puddle" is one number — and it stays on the road if
// the track shape changes.
export function onTrack<T extends object>(
  sub: Subtrack, dist: number, offset: number, cover: T,
): T & { x: number; y: number; rot: number } {
  const pts = sub.pts;
  let p = pts[0];
  for (let i = 0; i < pts.length; i++) if (pts[i].dist <= dist) p = pts[i];
  return { ...cover, x: p.x + p.nx * offset, y: p.y + p.ny * offset, rot: p.heading };
}

export function querySubtrack(subtrack: Subtrack, px: number, py: number): SubtrackHit {
  if (!subtrack || !subtrack.segs) return { dist: Infinity, side: 'left', trackDist: 0 };
  const segs = subtrack.segs;
  if (subtrack === qsHintSub) {
    // (subtrack as Subtrack): qsHintSub is typed null in wear.js, so === narrows subtrack to never
    const n = segs.length, lim = ((subtrack as Subtrack).width / 2 + 3) ** 2;
    let bd = Infinity, bi = -1, bt = 0;
    for (let o = -21; o <= 21; o++) { const i = (qsHint + o + n) % n, sg = segs[i]; if (sg.ghost) continue;
      let t = ((px - sg.ax) * sg.dx + (py - sg.ay) * sg.dy) / (sg.l2 || 1); if (t < 0) t = 0; else if (t > 1) t = 1;
      const ex = px - (sg.ax + t * sg.dx), ey = py - (sg.ay + t * sg.dy), d = ex * ex + ey * ey; if (d < bd) { bd = d; bi = i; bt = t; } }
    if (bd < lim) { const sg = segs[bi], cross = sg.dx * (py - sg.ay) - sg.dy * (px - sg.ax);
      return { dist: Math.sqrt(bd), side: cross > 0 ? 'left' : 'right', trackDist: (subtrack as Subtrack).pts[bi].dist + bt * sg.len,
        seg: bi }; }
  }
  let minD = Infinity;
  let bestSide: 'left' | 'right' = 'left';
  let bestTrackDist = 0, bestSeg: number | null = null;
  const cand = subtrack.grid ? subtrack.grid.get(Math.floor(px / SUB_CELL) * 100003 + Math.floor(py / SUB_CELL)) : null;
  if (subtrack.grid && !cand) return { dist: Infinity, side: 'left', trackDist: 0, seg: null };
  const nC = cand ? cand.length : segs.length;
  for (let ci = 0; ci < nC; ci++) {
    const i = cand ? cand[ci] : ci;
    const s = segs[i];
    if (px < s.minX || px > s.maxX || py < s.minY || py > s.maxY) continue;
    let t = ((px - s.ax) * s.dx + (py - s.ay) * s.dy) / (s.l2 || 1);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const ex = px - (s.ax + t * s.dx), ey = py - (s.ay + t * s.dy), d = ex * ex + ey * ey;   // squared; one sqrt at the end
    if (d < minD) {
      minD = d;
      const cross = s.dx * (py - s.ay) - s.dy * (px - s.ax);
      // 'left' = the +normal side (nx = -dy, ny = dx), the SAME convention render.js drawCurvedKerbs uses. MEASURED BUG,
      // 2026-10-03 (tools/visualcheck.mjs): this said 'right', so every kerb you drove on was on the OPPOSITE side of the
      // track from the kerb you could see — invisible bumps on plain grass, and painted kerbs that were just grass.
      bestSide = cross > 0 ? 'left' : 'right';
      bestTrackDist = subtrack.pts[i].dist + t * s.len;
      bestSeg = i;
    }
  }
  return { dist: Math.sqrt(minD), side: bestSide, trackDist: bestTrackDist, seg: bestSeg };
}

export function distToSubtrack(subtrack: Subtrack, px: number, py: number): number {
  return querySubtrack(subtrack, px, py).dist;
}

export function findNearestSubtrackPoint(
  subtrack: Subtrack | null, x: number, y: number, maxProgressDist = Infinity,
): TrackPoint | null {
  if (!subtrack || !subtrack.pts.length) return null;
  const pts = subtrack.pts;
  let best: TrackPoint | null = null, bestDist2 = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    // Never place ahead of driven distance
    if (p.dist > maxProgressDist + 8) continue;
    const dx = x - p.x, dy = y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      best = p;
    }
  }
  return best || pts[0];
}

export function courseCones(
  apexes: Point[] = COURSE, gate: number = GATE, spacing: number = GATE_SPACING,
): Cone[] {
  const path = smoothPath(apexes);
  const out = [];
  let acc = spacing;                          // place one at the very start
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const seg = Math.hypot(dx, dy);
    acc += seg;
    if (acc < spacing) continue;
    acc = 0;
    const ux = dx / (seg || 1), uy = dy / (seg || 1);
    const hx = -uy * gate / 2, hy = ux * gate / 2;
    out.push({ x: a[0] + hx, y: a[1] + hy }, { x: a[0] - hx, y: a[1] - hy });
  }
  return out;
}

// A slalom is still the clearest way to feel a car change direction, so one survives beside the course.
export function slalom(x0: number, y0: number, dx: number, n: number): Cone[] {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: x0 + i * dx, y: y0 + (i % 2 ? 4.5 : -4.5) });
  return out;
}

export const CONE_R = 0.20;
