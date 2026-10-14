// tyrewall.js - the OUTER TYRE WALL section. Moved verbatim out of lab.js.
import { SUB_CELL } from "./subtrack.ts";
import { COURSE, GATE, GATE_SPACING, smoothPath } from "./course.ts";
import { qsHintSub, qsHint } from "./wear.ts";
import type {
  Cone, Point, Prop, SubSeg, Subtrack, SubtrackHit, TrackPoint, TyreWallOptions, ClearBox,
} from "./types.ts";

// ---------------------------------------------------------------------------------------------
// OUTER TYRE WALL (user, 2026-10-03: "add a tyre wall around the stock car and grass track
// circuits"; chose LOOSE stacks on the OUTSIDE only). Returns plain `tyrestack` objects for a
// level's `cones` list, so they are the same knockable 38 kg stacks as everywhere else — they
// burst into rolling tyres when hit hard (cones.js). Nothing new in the physics; the wall is DATA
// generated from the track's own centreline.
//
//   margin   m from the track EDGE to the centre of the stacks (the grass runoff before the wall)
//   spacing  m between stacks, measured along the WALL (not the centreline) so corners are as
//            dense as straights — the outside of a bend is longer than the centreline through it
//   clear    boxes {x, y, hw, hh} the wall must leave a gap round (props it would otherwise run
//            through)
//
// "Outside" = the side of the centreline facing AWAY from the loop's centroid, which is right for
// any convex circuit (both ovals). A stack that would land within the track width + 1 m of ANY
// part of the circuit is also dropped, so a tight hairpin cannot throw part of the wall onto
// another bit of road.
export function outerTyreWall(
  subtrack: Subtrack, { margin = 3, spacing = 1.0, clear = [] }: TyreWallOptions = {},
): Cone[] {
  const pts = subtrack.pts, halfW = subtrack.width / 2;
  let centroidX = 0, centroidY = 0;
  for (const point of pts) { centroidX += point.x; centroidY += point.y; }
  centroidX /= pts.length; centroidY /= pts.length;
  // the wall's own path: every centreline point pushed outward by halfW + margin
  const path = pts.map((point) => {
    const side = (point.x - centroidX) * point.nx + (point.y - centroidY) * point.ny >= 0
      ? 1 : -1;
    return {
      x: point.x + side * point.nx * (halfW + margin),
      y: point.y + side * point.ny * (halfW + margin),
    };
  });
  const out: Cone[] = [];
  // distance walked since the last stack. Starts at `spacing` so the first stack sits ON path[0]
  // and the closing seam is one spacing, not two
  let carry = spacing;
  for (let i = 0; i < path.length; i++) {
    const from = path[i], dest = path[(i + 1) % path.length];
    const len = Math.hypot(dest.x - from.x, dest.y - from.y);
    let along = spacing - carry;           // where the next stack falls on this segment
    while (along <= len) {
      const x = from.x + (dest.x - from.x) * (along / len),
        y = from.y + (dest.y - from.y) * (along / len);
      const blocked = clear.some(
        (box) => Math.abs(x - box.x) < box.hw && Math.abs(y - box.y) < box.hh)
        || querySubtrack(subtrack, x, y).dist < halfW + 1;
      if (!blocked) out.push({ x, y, kind: 'tyrestack' });
      along += spacing;
    }
    carry = len - (along - spacing);
  }
  return out;
}

// The clearance a prop needs from the wall, from its kind. Half-extents in metres, padded ~0.6 m
// beyond what render.ts draws (a stack is 0.48 m in radius). Kinds not listed sit in the infield,
// away from it.
export function propClearance(props: Prop[]): ClearBox[] {
  const size: Record<string, Point> = {
    pylon: [1.6, 1.6], board: [9.6, 1.7], official_box: [2.8, 2.4],
  };
  return props.flatMap((prop) => {
    if (prop.kind === 'grandstand')
      return [{ x: prop.x, y: prop.y, hw: prop.w! / 2 + 1, hh: prop.h! / 2 + 1 }];
    const half = size[prop.kind];
    return half ? [{ x: prop.x, y: prop.y, hw: half[0], hh: half[1] }] : [];
  });
}

// A cover placed BY DISTANCE ALONG A TRACK (2026-10-03): \`offset\` metres to the left (+) / right
// (-) of the centreline, rotated to the road. Data, so "move that puddle" is one number — and it
// stays on the road if the track shape changes.
export function onTrack<T extends object>(
  sub: Subtrack, dist: number, offset: number, cover: T,
): T & { x: number; y: number; rot: number } {
  const pts = sub.pts;
  let point = pts[0];
  for (let i = 0; i < pts.length; i++) if (pts[i].dist <= dist) point = pts[i];
  return {
    ...cover, x: point.x + point.nx * offset, y: point.y + point.ny * offset, rot: point.heading,
  };
}

/**
 * Search the ~43 segments round the last hit (qsHint) for the nearest one to a probe.
 * @param subtrack the subtrack (must be the one qsHint belongs to)
 * @param segs the subtrack's segments
 * @param probeX world x
 * @param probeY world y
 * @returns the hit, or null when nothing is within half width + 3 m
 */
function queryNearHint(
  subtrack: Subtrack, segs: SubSeg[], probeX: number, probeY: number,
): SubtrackHit | null {
  const count = segs.length, lim = (subtrack.width / 2 + 3) ** 2;
  let bestDist2 = Infinity, bestIndex = -1, bestFrac = 0;
  for (let shift = -21; shift <= 21; shift++) {
    const i = (qsHint + shift + count) % count, segment = segs[i];
    if (segment.ghost) continue;
    let frac = ((probeX - segment.ax) * segment.dx + (probeY - segment.ay) * segment.dy)
      / (segment.l2 || 1);
    if (frac < 0) frac = 0; else if (frac > 1) frac = 1;
    const errX = probeX - (segment.ax + frac * segment.dx),
      errY = probeY - (segment.ay + frac * segment.dy), distSq = errX * errX + errY * errY;
    if (distSq < bestDist2) { bestDist2 = distSq; bestIndex = i; bestFrac = frac; } }
  if (bestDist2 < lim) {
    const segment = segs[bestIndex],
      cross = segment.dx * (probeY - segment.ay) - segment.dy * (probeX - segment.ax);
    return {
      dist: Math.sqrt(bestDist2), side: cross > 0 ? 'left' : 'right',
      trackDist: subtrack.pts[bestIndex].dist + bestFrac * segment.len,
      seg: bestIndex };
  }
  return null;
}
/**
 * The candidate segments for a probe: the grid cell's list, or null for "scan them all".
 * @param subtrack the subtrack
 * @param probeX world x
 * @param probeY world y
 * @returns the cell's segment indices, or null when there is no grid
 */
function gridCandidates(subtrack: Subtrack, probeX: number, probeY: number): number[] | null {
  return subtrack.grid
    ? subtrack.grid.get(Math.floor(probeX / SUB_CELL) * 100003 + Math.floor(probeY / SUB_CELL))
      || null
    : null;
}
/**
 * Scan the candidate segments for the nearest one to a probe.
 * @param subtrack the subtrack
 * @param segs the subtrack's segments
 * @param cand candidate segment indices, or null to scan every segment
 * @param probeX world x
 * @param probeY world y
 * @returns the nearest hit
 */
function scanSegments(
  subtrack: Subtrack, segs: SubSeg[], cand: number[] | null, probeX: number, probeY: number,
): SubtrackHit {
  let minD = Infinity;
  let bestSide: 'left' | 'right' = 'left';
  let bestTrackDist = 0, bestSeg: number | null = null;
  const candCount = cand ? cand.length : segs.length;
  for (let candIdx = 0; candIdx < candCount; candIdx++) {
    const i = cand ? cand[candIdx] : candIdx;
    const segment = segs[i];
    if (probeX < segment.minX || probeX > segment.maxX
      || probeY < segment.minY || probeY > segment.maxY) continue;
    let frac = ((probeX - segment.ax) * segment.dx + (probeY - segment.ay) * segment.dy)
      / (segment.l2 || 1);
    if (frac < 0) frac = 0; else if (frac > 1) frac = 1;
    const errX = probeX - (segment.ax + frac * segment.dx),
      errY = probeY - (segment.ay + frac * segment.dy),
      distSq = errX * errX + errY * errY;   // squared; one sqrt at the end
    if (distSq < minD) {
      minD = distSq;
      const cross = segment.dx * (probeY - segment.ay) - segment.dy * (probeX - segment.ax);
      // 'left' = the +normal side (nx = -dy, ny = dx), the SAME convention render.ts
      // drawCurvedKerbs uses. MEASURED BUG, 2026-10-03 (tools/visualcheck.mjs): this said
      // 'right', so every kerb you drove on was on the OPPOSITE side of the track from the kerb
      // you could see — invisible bumps on plain grass, and painted kerbs that were just grass.
      bestSide = cross > 0 ? 'left' : 'right';
      bestTrackDist = subtrack.pts[i].dist + frac * segment.len;
      bestSeg = i;
    }
  }
  return { dist: Math.sqrt(minD), side: bestSide, trackDist: bestTrackDist, seg: bestSeg };
}
export function querySubtrack(subtrack: Subtrack, probeX: number, probeY: number): SubtrackHit {
  if (!subtrack || !subtrack.segs) return { dist: Infinity, side: 'left', trackDist: 0 };
  const segs = subtrack.segs;
  if (subtrack === qsHintSub) {
    const near = queryNearHint(subtrack, segs, probeX, probeY);
    if (near) return near;
  }
  const cand = gridCandidates(subtrack, probeX, probeY);
  if (subtrack.grid && !cand) return { dist: Infinity, side: 'left', trackDist: 0, seg: null };
  return scanSegments(subtrack, segs, cand, probeX, probeY);
}

export function distToSubtrack(subtrack: Subtrack, probeX: number, probeY: number): number {
  return querySubtrack(subtrack, probeX, probeY).dist;
}

export function findNearestSubtrackPoint(
  subtrack: Subtrack | null, x: number, y: number, maxProgressDist = Infinity,
): TrackPoint | null {
  if (!subtrack || !subtrack.pts.length) return null;
  const pts = subtrack.pts;
  let best: TrackPoint | null = null, bestDist2 = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const point = pts[i];
    // Never place ahead of driven distance
    if (point.dist > maxProgressDist + 8) continue;
    const dx = x - point.x, dy = y - point.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDist2) {
      bestDist2 = distSq;
      best = point;
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
    const from = path[i], dest = path[(i + 1) % path.length];
    const dx = dest[0] - from[0], dy = dest[1] - from[1];
    const seg = Math.hypot(dx, dy);
    acc += seg;
    if (acc < spacing) continue;
    acc = 0;
    const unitX = dx / (seg || 1), unitY = dy / (seg || 1);
    const gateX = -unitY * gate / 2, gateY = unitX * gate / 2;
    out.push(
      { x: from[0] + gateX, y: from[1] + gateY }, { x: from[0] - gateX, y: from[1] - gateY },
    );
  }
  return out;
}

// A slalom is still the clearest way to feel a car change direction, so one survives beside the
// course.
export function slalom(startX: number, startY: number, dx: number, count: number): Cone[] {
  const out = [];
  for (let i = 0; i < count; i++)
    out.push({ x: startX + i * dx, y: startY + (i % 2 ? 4.5 : -4.5) });
  return out;
}

export const CONE_R = 0.20;
