import { SURFACES } from "./surfaces.ts";
import { smoothPath } from "./course.ts";
import type {
  AutoKerbOptions, CurvedKerb, Point, Sector, SubSeg, Subtrack, Surface, TraceOptions,
  TrackPoint,
} from "./types.ts";
// =============================================================================================
// SUBTRACK SYSTEM (for circuit recovery / reset and lap progress tracking) AUTO KERBS
// (user: "check the kerbs, they look a bit broken"). MEASURED on Thruston: kerbs
// placed by NAMED corner distances landed on the OUTSIDE of four corners and on a straight (a
// naming slip in the Complex shifted them). Now kerbs come from the track's own curvature: every
// corner tighter than maxR gets an INSIDE kerb over the part tighter than 1.6 x its tightest
// radius; corners tighter than exitR also get an OUTSIDE exit kerb after the apex. 'left' =
// +normal side = the inside of a RIGHT-hander (heading increasing, y-down). MERGE + MIN TURN
// (Thruston re-trace): on a traced lap the curvature still ripples, so one sweeper
// came out as 3-6 kerbs with gaps. Corners turning less than minTurn deg get none (a kink is not
// a corner); same-side kerbs closer than mergeGap m join.
﻿/**
 * Fill in the defaults of the autoKerbs options.
 * @param options the caller's options (any may be missing)
 * @returns every option, defaulted
 */
function resolveKerbOptions({
  maxR = 70, exitR = 30, width = 2.4, h: kerbHeight = 0.11, heavyR = 0, heavyW = 3.0,
  heavyH = 0.14, minTurn = 0, mergeGap = 0,
}: AutoKerbOptions): Required<AutoKerbOptions> {
  return { maxR, exitR, width, h: kerbHeight, heavyR, heavyW, heavyH, minTurn, mergeGap };
}
/**
 * Corner radius and turn direction at every track sample (over +-3 samples).
 * @param track the subtrack
 * @returns radii (metres) and turn (+1 / -1) per sample
 */
function sampleCornerRadii(track: Subtrack): { radii: number[]; turn: number[] } {
  const pts = track.pts, count = pts.length;
  const radii: number[] = [], turn: number[] = [];
  for (let i = 0; i < count; i++) {
    const before = pts[(i - 3 + count) % count], after = pts[(i + 3) % count];
    let dHead = after.heading - before.heading;
    dHead = Math.atan2(Math.sin(dHead), Math.cos(dHead));
    radii.push(
      Math.max(1, ((after.dist - before.dist) + track.totalDist) % track.totalDist)
        / Math.max(1e-4, Math.abs(dHead)),
    );
    turn.push(dHead > 0 ? 1 : -1);
  }
  return { radii, turn };
}
/** One corner found by findCornerRun. */
interface CornerRun {
  runEnd: number;   // offset (from the scan start) one past the last tight sample
  minR: number;     // tightest radius in the run
  minAt: number;    // sample index of the tightest radius
}
/**
 * Run along a corner while it stays tight in the SAME direction.
 * @param radii corner radius per sample
 * @param turn turn direction per sample
 * @param start sample index the scan started from
 * @param offset offset (from start) of the first tight sample
 * @param maxR radius below which a sample is in a corner
 * @returns where the run ends and its tightest sample
 */
function findCornerRun(
  radii: number[], turn: number[], start: number, offset: number, maxR: number,
): CornerRun {
  const count = radii.length, index = (start + offset) % count;
  let runEnd = offset;
  const dir = turn[index];
  let minR = Infinity, minAt = index;
  while (
    runEnd < count && radii[(start + runEnd) % count] < maxR
    && turn[(start + runEnd) % count] === dir
  ) {
    const j = (start + runEnd) % count;
    if (radii[j] < minR) {
      minR = radii[j];
      minAt = j;
    }
    runEnd++;
  }
  return { runEnd, minR, minAt };
}
/**
 * Push the inside (and, for tight corners, the outside exit) kerb of one corner.
 * @param kerbs the kerb list to push to
 * @param track the subtrack
 * @param opts the resolved autoKerbs options
 * @param dir turn direction of the corner (+1 / -1)
 * @param minR tightest radius of the corner
 * @param distStart start distance of the apex region
 * @param distEnd end distance of the apex region
 * @param exitDist distance of the apex region's last sample
 */
function pushCornerKerbs(
  kerbs: CurvedKerb[], track: Subtrack, opts: Required<AutoKerbOptions>, dir: number,
  minR: number, distStart: number, distEnd: number, exitDist: number,
): void {
  const { exitR, width, h: kerbHeight, heavyR, heavyW, heavyH } = opts;
  const heavy = minR < heavyR;
  const inside = dir > 0 ? 'left' : 'right', outside = dir > 0 ? 'right' : 'left';
  // NO FANS (photographed at Campbell / Club): a kerb on the inside of a tight
  // corner has its inner edge at R - half road - kerb width; at R 12.6 with a 3 m heavy kerb
  // that was 2.6 m and the blocks fanned into wedges. Cap the inside kerb so its inner edge
  // stays >= 0.7 of its outer one.
  const capW = Math.max(1.2, 0.3 * (minR - track.width / 2));
  if (distEnd - distStart > 3)
    kerbs.push({
      side: inside, startDist: distStart, endDist: distEnd,
      width: Math.min(capW, heavy ? heavyW : width), h: heavy ? heavyH : kerbHeight,
    });
  if (minR < exitR)
    kerbs.push({
      side: outside, startDist: exitDist, endDist: exitDist + 18,
      width: heavy ? heavyW : width, h: heavy ? heavyH : kerbHeight,
    });
}
/**
 * Join same-side kerbs that nearly touch (the longer/heavier style wins); order by start.
 * @param kerbs the kerbs (sorted in place)
 * @param mergeGap kerbs closer than this many metres join
 * @returns the merged kerbs
 */
function mergeCloseKerbs(kerbs: CurvedKerb[], mergeGap: number): CurvedKerb[] {
  kerbs.sort((first, second) => first.startDist - second.startDist);
  const out: CurvedKerb[] = [];
  for (const kerb of kerbs) {
    const prev = [...out].reverse().find((item) => item.side === kerb.side);
    if (prev && kerb.startDist - prev.endDist < mergeGap && kerb.startDist >= prev.startDist) {
      prev.endDist = Math.max(prev.endDist, kerb.endDist);
      prev.width = Math.max(prev.width, kerb.width);
      prev.h = Math.max(prev.h, kerb.h);
    } else out.push({ ...kerb });
  }
  return out;
}
export function autoKerbs(track: Subtrack, options: AutoKerbOptions = {}): CurvedKerb[] {
  const opts = resolveKerbOptions(options), { maxR, minTurn, mergeGap } = opts;
  const pts = track.pts, count = pts.length;
  const { radii, turn } = sampleCornerRadii(track);
  const kerbs: CurvedKerb[] = [];
  // start scanning at a point that is NOT in a corner, so a corner spanning the line is found
  // whole
  let start = 0;
  while (start < count && radii[start] < maxR) start++;
  for (let offset = 0; offset < count; offset++) {
    const index = (start + offset) % count;
    if (radii[index] >= maxR) continue;
    // a corner: run while it stays tight in the SAME direction
    const dir = turn[index];
    const { runEnd, minR, minAt } = findCornerRun(radii, turn, start, offset, maxR);
    // the apex region: tighter than 1.6 x the minimum
    let fromIdx = minAt, toIdx = minAt;
    while (
      radii[(fromIdx - 1 + count) % count] < minR * 1.6 && fromIdx !== (start + offset) % count
    )
      fromIdx = (fromIdx - 1 + count) % count;
    while (radii[(toIdx + 1) % count] < minR * 1.6 && toIdx !== (start + runEnd - 1) % count)
      toIdx = (toIdx + 1) % count;
    const distStart = pts[fromIdx].dist, distEnd = pts[toIdx].dist + 4;
    let turnDeg = pts[(start + runEnd - 1) % count].heading - pts[(start + offset) % count].heading;
    turnDeg = Math.abs(Math.atan2(Math.sin(turnDeg), Math.cos(turnDeg))) * 180 / Math.PI;
    if (turnDeg < minTurn) { offset = runEnd; continue; }
    pushCornerKerbs(kerbs, track, opts, dir, minR, distStart, distEnd, pts[toIdx].dist);
    offset = runEnd;
  }
  if (!mergeGap) return kerbs;
  return mergeCloseKerbs(kerbs, mergeGap);
}
// TRACE A REAL MAP INTO A DRIVABLE CENTRELINE (user: Thruston "kerbs still broken on
// tight corners, not like the real corner"). The first re-lay pushed hand-read map points
// straight through Catmull-Rom and opened only the corners that FOLDED: MEASURED Campbell/Cobb ~R
// 11, Club R 9 (fold at 266 m), so a 3 m inside kerb had its inner edge ~1-4 m from the corner
// centre and drew as wedges (kerbside.mjs "kerb fans"). Now: map px -> metres, resample evenly,
// Taubin-smooth (no shrink), then open every corner tighter than rMin by smoothing only there,
// until the whole lap is >= rMin over an 8 m arc. Returns dense points for createSubtrack(...,
// dense = true). WHY rMin: the cars are full size but the lap is ~1/3 scale, so the real Complex
// / Club (R ~4 m at this scale) cannot carry a 14 m road — under half the width the ribbon FOLDS.
// rMin = half width + kerb + margin keeps the shape and never folds. CURVATURE NOISE: straight
// lines between the read points put ALL the turning at the points, so curvature flickered between
// "straight" and "tight" and autoKerbs laid ~55 fragments (MEASURED: 84 corner edges round the
// lap). A CENTRIPETAL Catmull-Rom through the points (alpha 0.5: no cusps or loops where points
// bunch, which is what kinked the uniform one) then smoothing over +-3 samples: 36 edges.
/**
 * Centripetal knot spacing between two points (square root of the distance).
 * @param ptFrom first point
 * @param ptTo second point
 * @returns the knot gap (never 0)
 */
function knotGap(ptFrom: Point, ptTo: Point): number {
  return Math.sqrt(Math.hypot(ptTo[0] - ptFrom[0], ptTo[1] - ptFrom[1])) || 1e-3;
}
/**
 * Linear interpolation between two points over a knot interval.
 * @param startPt point at knot timeA
 * @param endPt point at knot timeB
 * @param timeA first knot
 * @param timeB second knot
 * @param time the knot value to evaluate at
 * @returns the interpolated point
 */
function lerpKnotPt(
  startPt: Point, endPt: Point, timeA: number, timeB: number, time: number,
): Point {
  return [
    (startPt[0] * (timeB - time) + endPt[0] * (time - timeA)) / (timeB - timeA),
    (startPt[1] * (timeB - time) + endPt[1] * (time - timeA)) / (timeB - timeA),
  ];
}
/**
 * A centripetal Catmull-Rom spline through the points (closed loop).
 * @param points the control points
 * @returns the spline samples
 */
function centripetalSpline(points: Point[]): Point[] {
  const count = points.length, out: Point[] = [];
  for (let i = 0; i < count; i++) {
    const pBefore = points[(i - 1 + count) % count], pStart = points[i],
      pEnd = points[(i + 1) % count], pAfter = points[(i + 2) % count];
    const knot0 = 0, knot1 = knot0 + knotGap(pBefore, pStart),
      knot2 = knot1 + knotGap(pStart, pEnd), knot3 = knot2 + knotGap(pEnd, pAfter);
    const steps = Math.max(
      4, Math.ceil(Math.hypot(pEnd[0] - pStart[0], pEnd[1] - pStart[1]) / 0.5),
    );
    for (let j = 0; j < steps; j++) {
      const time = knot1 + (knot2 - knot1) * j / steps;
      const mix1 = lerpKnotPt(pBefore, pStart, knot0, knot1, time),
        mix2 = lerpKnotPt(pStart, pEnd, knot1, knot2, time),
        mix3 = lerpKnotPt(pEnd, pAfter, knot2, knot3, time);
      out.push(lerpKnotPt(
        lerpKnotPt(mix1, mix2, knot0, knot2, time), lerpKnotPt(mix2, mix3, knot1, knot3, time),
        knot1, knot2, time,
      ));
    }
  }
  return out;
}
/**
 * Resample a closed path to evenly spaced points.
 * @param points the path
 * @param step spacing in metres
 * @returns the resampled path
 */
function resamplePath(points: Point[], step: number): Point[] {
  const out: Point[] = []; const count = points.length; let carry = 0;
  for (let i = 0; i < count; i++) {
    const ptFrom = points[i], ptTo = points[(i + 1) % count],
      segLen = Math.hypot(ptTo[0] - ptFrom[0], ptTo[1] - ptFrom[1]);
    let along = carry;
    while (along < segLen) {
      out.push([
        ptFrom[0] + (ptTo[0] - ptFrom[0]) * along / segLen,
        ptFrom[1] + (ptTo[1] - ptFrom[1]) * along / segLen,
      ]);
      along += step;
    }
    carry = along - segLen;
  }
  return out;
}
/**
 * One smoothing pass: move each (masked) point toward the midpoint of its neighbours.
 * @param points the path
 * @param amount how far to move (negative expands: Taubin step)
 * @param mask only points with a true entry move; null moves all
 * @param span how many samples away the neighbours are
 * @returns the smoothed path
 */
function smoothPass(
  points: Point[], amount: number, mask: boolean[] | null, span = 1,
): Point[] {
  return points.map((cur, i): Point => {
    if (mask && !mask[i]) return cur;
    const ptBack = points[(i - span + points.length) % points.length],
      ptFwd = points[(i + span) % points.length];
    return [
      cur[0] + amount * ((ptBack[0] + ptFwd[0]) / 2 - cur[0]),
      cur[1] + amount * ((ptBack[1] + ptFwd[1]) / 2 - cur[1]),
    ];
  });
}
/**
 * Corner radius at every point of a traced path.
 * @param points the path
 * @param step spacing of the path in metres
 * @returns the radius per point
 */
function tracedRadii(points: Point[], step: number): number[] {
  // R over an 8 m arc from SEGMENT headings (chord-to-chord angles averaged a short sharp bend
  // away: Club read 11.7 m by the chords and 6.6 m by the 8 m arc that kerbside.mjs uses — the
  // same measure now)
  const count = points.length, half = Math.max(1, Math.round(4 / step));
  const heads = points.map((cur, i) => {
    const nextPt = points[(i + 1) % count];
    return Math.atan2(nextPt[1] - cur[1], nextPt[0] - cur[0]);
  });
  return points.map((item, i) => {
    let dHead = heads[(i + half) % count] - heads[(i - half + count) % count];
    dHead = Math.atan2(Math.sin(dHead), Math.cos(dHead));
    return (2 * half * step) / Math.max(1e-4, Math.abs(dHead));
  });
}
/**
 * Mark every point within `reach` samples of a corner tighter than rMin.
 * @param rads corner radius per point
 * @param rMin the smallest allowed radius
 * @param reach how many samples either side to mark
 * @returns the mask and how many points were too tight
 */
function maskTightCorners(
  rads: number[], rMin: number, reach: number,
): { mask: boolean[]; bad: number } {
  const count = rads.length, mask = new Array<boolean>(count).fill(false);
  let bad = 0;
  for (let i = 0; i < count; i++)
    if (rads[i] < rMin) {
      bad++;
      for (let j = -reach; j <= reach; j++) mask[(i + j + count) % count] = true;
    }
  return { mask, bad };
}
export function traceTrack(mapPts: Point[], {
  mpp = 0.47, cx: centreX = 480, cy: centreY = 338, step = 1.5, rMin = 12, passes = 10, kern = 3,
}: TraceOptions = {}): Point[] {
  let path = resamplePath(
    centripetalSpline(mapPts.map(([x, y]) => [(x - centreX) * mpp, (y - centreY) * mpp])), step,
  );
  for (let pass = 0; pass < passes; pass++) {
    path = smoothPass(path, 0.5, null, kern);
    path = smoothPass(path, -0.53, null, kern);
  }
  for (let iter = 0; iter < 3000; iter++) {
    const rads = tracedRadii(path, step);
    const reach = Math.round(6 / step);
    const { mask, bad } = maskTightCorners(rads, rMin, reach);
    if (!bad) break;
    path = smoothPass(path, 0.5, mask);
    if (iter % 20 === 19) path = resamplePath(path, step);
  }
  return resamplePath(path, step);
}
export const SUB_CELL = 16;   // m, subtrack lookup grid cell
export function createSubtrack(
  apexes: Point[], width = 13, sectors: Sector[] = [], curvedKerbs: CurvedKerb[] = [],
  dense = false,
): Subtrack {
  const pts = dense ? apexes : smoothPath(apexes, 20);
  let totalDist = 0;
  const sampled: TrackPoint[] = [];
  const segs: SubSeg[] = [];
  const count = pts.length;
  for (let i = 0; i < count; i++) {
    const ptFrom = pts[i];
    const ptTo = pts[(i + 1) % count];
    const dx = ptTo[0] - ptFrom[0], dy = ptTo[1] - ptFrom[1];
    const len = Math.hypot(dx, dy);
    const hdg = Math.atan2(dy, dx);
    sampled.push({
      x: ptFrom[0], y: ptFrom[1], dist: totalDist,
      dirX: dx / (len || 1), dirY: dy / (len || 1),
      nx: -dy / (len || 1), ny: dx / (len || 1),
      heading: hdg, width,
    });
    totalDist += len;
    // pad 5 -> 18 m past the edge: the camber eases off over 6 m and the Naffcar back slope over
    // 16 m; at 5 the lookup returned "no track" part-way down them and the ground stepped. The
    // GRID below keeps the wider pad cheap.
    const pad = width / 2 + 18;
    segs.push({
      ax: ptFrom[0], ay: ptFrom[1], bx: ptTo[0], by: ptTo[1],
      dx, dy, l2: len * len, len,
      minX: Math.min(ptFrom[0], ptTo[0]) - pad, maxX: Math.max(ptFrom[0], ptTo[0]) + pad,
      minY: Math.min(ptFrom[1], ptTo[1]) - pad, maxY: Math.max(ptFrom[1], ptTo[1]) + pad,
    });
  }

  function sectorAt(dist: number): Sector | { surface: Surface } {
    if (!sectors.length) return { surface: SURFACES.tarmac };
    for (let i = 0; i < sectors.length; i++) {
      const sector = sectors[i];
      if (sector.startDist > sector.endDist) {
        if (dist >= sector.startDist || dist < sector.endDist) return sector;
      } else {
        if (dist >= sector.startDist && dist < sector.endDist) return sector;
      }
    }
    return { surface: SURFACES.tarmac };
  }

  // LOOKUP GRID (perf): segment indices per SUB_CELL m square of their padded box, so
  // querySubtrack checks a handful of segments instead of every one. MEASURED: a shaded Test
  // Track ground tile cost 34 ms at phone-ish CPU speed.
  const grid = new Map<number, number[]>();
  segs.forEach((seg, i) => {
    for (
      let cellX = Math.floor(seg.minX / SUB_CELL);
      cellX <= Math.floor(seg.maxX / SUB_CELL); cellX++
    )
      for (
        let cellY = Math.floor(seg.minY / SUB_CELL);
        cellY <= Math.floor(seg.maxY / SUB_CELL); cellY++
      ) {
        // numeric key (string keys were slow: querySubtrack is the hottest function with AI cars)
        const key = cellX * 100003 + cellY;
        let list = grid.get(key);
        if (!list) grid.set(key, list = []);
        list.push(i);
      }
  });
  return { pts: sampled, segs, totalDist, width, sectors, sectorAt, curvedKerbs, grid };
}

// GHOST SEGMENT (point-to-point stages, user: "rally stages are circular often — they
// should mostly be a LINE"). The engine's roads are closed loops (distances wrap at the start
// line); a point-to-point stage keeps that arithmetic by closing its loop with ONE invisible
// segment from the stop-zone end back to the run-up before the start. A ghost segment is not
// road: it is out of the lookup grid (querySubtrack never returns it, so physics / ground /
// resets / AI-progress never see it) and render.ts does not draw it.
export function ghostSegment(sub: Subtrack, i: number): Subtrack {
  sub.segs[i].ghost = true;
  for (const list of sub.grid.values()) {
    const found = list.indexOf(i);
    if (found >= 0) list.splice(found, 1);
  }
  sub.ghost = {
    d0: sub.pts[i].dist,
    d1: sub.pts[(i + 1) % sub.pts.length].dist || sub.totalDist,
  };
  return sub;
}
