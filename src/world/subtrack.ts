import { SURFACES } from "./surfaces.ts";
import { smoothPath } from "./course.ts";
import type {
  AutoKerbOptions, CurvedKerb, Point, Sector, SubSeg, Subtrack, Surface, TraceOptions,
  TrackPoint,
} from "./types.ts";
// =============================================================================================
// SUBTRACK SYSTEM (for circuit recovery / reset and lap progress tracking) AUTO KERBS
// (2026-10-03; user: "check the kerbs, they look a bit broken"). MEASURED on Thruston: kerbs
// placed by NAMED corner distances landed on the OUTSIDE of four corners and on a straight (a
// naming slip in the Complex shifted them). Now kerbs come from the track's own curvature: every
// corner tighter than maxR gets an INSIDE kerb over the part tighter than 1.6 x its tightest
// radius; corners tighter than exitR also get an OUTSIDE exit kerb after the apex. 'left' =
// +normal side = the inside of a RIGHT-hander (heading increasing, y-down). MERGE + MIN TURN
// (2026-10-04, Thruston re-trace): on a traced lap the curvature still ripples, so one sweeper
// came out as 3-6 kerbs with gaps. Corners turning less than minTurn deg get none (a kink is not
// a corner); same-side kerbs closer than mergeGap m join.
export function autoKerbs(track: Subtrack, {
  maxR = 70, exitR = 30, width = 2.4, h: kerbHeight = 0.11, heavyR = 0, heavyW = 3.0,
  heavyH = 0.14, minTurn = 0, mergeGap = 0,
}: AutoKerbOptions = {}): CurvedKerb[] {
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
  const kerbs: CurvedKerb[] = [];
  // start scanning at a point that is NOT in a corner, so a corner spanning the line is found
  // whole
  let start = 0;
  while (start < count && radii[start] < maxR) start++;
  for (let offset = 0; offset < count; offset++) {
    const index = (start + offset) % count;
    if (radii[index] >= maxR) continue;
    // a corner: run while it stays tight in the SAME direction
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
    // the apex region: tighter than 1.6 x the minimum
    let fromIdx = minAt, toIdx = minAt;
    while (
      radii[(fromIdx - 1 + count) % count] < minR * 1.6 && fromIdx !== (start + offset) % count
    )
      fromIdx = (fromIdx - 1 + count) % count;
    while (radii[(toIdx + 1) % count] < minR * 1.6 && toIdx !== (start + runEnd - 1) % count)
      toIdx = (toIdx + 1) % count;
    const heavy = minR < heavyR;
    const distStart = pts[fromIdx].dist, distEnd = pts[toIdx].dist + 4;
    let turnDeg = pts[(start + runEnd - 1) % count].heading - pts[(start + offset) % count].heading;
    turnDeg = Math.abs(Math.atan2(Math.sin(turnDeg), Math.cos(turnDeg))) * 180 / Math.PI;
    if (turnDeg < minTurn) { offset = runEnd; continue; }
    const inside = dir > 0 ? 'left' : 'right', outside = dir > 0 ? 'right' : 'left';
    // NO FANS (2026-10-04, photographed at Campbell / Club): a kerb on the inside of a tight
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
        side: outside, startDist: pts[toIdx].dist, endDist: pts[toIdx].dist + 18,
        width: heavy ? heavyW : width, h: heavy ? heavyH : kerbHeight,
      });
    offset = runEnd;
  }
  if (!mergeGap) return kerbs;
  // join same-side kerbs that nearly touch (the longer/heavier style wins); order by start
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
// TRACE A REAL MAP INTO A DRIVABLE CENTRELINE (2026-10-04; user: Thruston "kerbs still broken on
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
export function traceTrack(mapPts: Point[], {
  mpp = 0.47, cx: centreX = 480, cy: centreY = 338, step = 1.5, rMin = 12, passes = 10, kern = 3,
}: TraceOptions = {}): Point[] {
  const centripetal = (points: Point[]): Point[] => {
    const count = points.length, out: Point[] = [];
    const knotGap = (ptFrom: Point, ptTo: Point) =>
      Math.sqrt(Math.hypot(ptTo[0] - ptFrom[0], ptTo[1] - ptFrom[1])) || 1e-3;
    const lerpPt = (
      startPt: Point, endPt: Point, timeA: number, timeB: number, time: number,
    ): Point => [
      (startPt[0] * (timeB - time) + endPt[0] * (time - timeA)) / (timeB - timeA),
      (startPt[1] * (timeB - time) + endPt[1] * (time - timeA)) / (timeB - timeA),
    ];
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
        const mix1 = lerpPt(pBefore, pStart, knot0, knot1, time),
          mix2 = lerpPt(pStart, pEnd, knot1, knot2, time),
          mix3 = lerpPt(pEnd, pAfter, knot2, knot3, time);
        out.push(lerpPt(
          lerpPt(mix1, mix2, knot0, knot2, time), lerpPt(mix2, mix3, knot1, knot3, time),
          knot1, knot2, time,
        ));
      }
    }
    return out;
  };
  const resample = (points: Point[]): Point[] => {
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
  };
  const lap = (points: Point[], amount: number, mask: boolean[] | null, span = 1): Point[] =>
    points.map((cur, i): Point => {
    if (mask && !mask[i]) return cur;
    const ptBack = points[(i - span + points.length) % points.length],
      ptFwd = points[(i + span) % points.length];
    return [
      cur[0] + amount * ((ptBack[0] + ptFwd[0]) / 2 - cur[0]),
      cur[1] + amount * ((ptBack[1] + ptFwd[1]) / 2 - cur[1]),
    ];
  });
  // R over an 8 m arc from SEGMENT headings (chord-to-chord angles averaged a short sharp bend
  // away: Club read 11.7 m by the chords and 6.6 m by the 8 m arc that kerbside.mjs uses — the
  // same measure now)
  const radii = (points: Point[]) => {
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
  };
  let path = resample(
    centripetal(mapPts.map(([x, y]) => [(x - centreX) * mpp, (y - centreY) * mpp])),
  );
  for (let pass = 0; pass < passes; pass++) {
    path = lap(path, 0.5, null, kern);
    path = lap(path, -0.53, null, kern);
  }
  for (let iter = 0; iter < 3000; iter++) {
    const rads = radii(path), count = path.length, mask = new Array(count).fill(false);
    let bad = 0;
    const reach = Math.round(6 / step);
    for (let i = 0; i < count; i++)
      if (rads[i] < rMin) {
        bad++;
        for (let j = -reach; j <= reach; j++) mask[(i + j + count) % count] = true;
      }
    if (!bad) break;
    path = lap(path, 0.5, mask);
    if (iter % 20 === 19) path = resample(path);
  }
  return resample(path);
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

  // LOOKUP GRID (perf, 2026-10-03): segment indices per SUB_CELL m square of their padded box, so
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

// GHOST SEGMENT (point-to-point stages, user 2026-10-04: "rally stages are circular often — they
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
