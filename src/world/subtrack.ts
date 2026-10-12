import { SURFACES } from "./surfaces.ts";
import { smoothPath } from "./course.ts";
import type {
  AutoKerbOptions, CurvedKerb, Point, Sector, SubSeg, Subtrack, Surface, TraceOptions,
  TrackPoint,
} from "./types.ts";
// =============================================================================================
// SUBTRACK SYSTEM (for circuit recovery / reset and lap progress tracking)
// AUTO KERBS (2026-10-03; user: "check the kerbs, they look a bit broken"). MEASURED on Thruston: kerbs placed by NAMED corner
// distances landed on the OUTSIDE of four corners and on a straight (a naming slip in the Complex shifted them). Now kerbs come
// from the track's own curvature: every corner tighter than maxR gets an INSIDE kerb over the part tighter than 1.6 x its
// tightest radius; corners tighter than exitR also get an OUTSIDE exit kerb after the apex. 'left' = +normal side = the
// inside of a RIGHT-hander (heading increasing, y-down).
// MERGE + MIN TURN (2026-10-04, Thruston re-trace): on a traced lap the curvature still ripples, so one sweeper came out as 3-6 kerbs
// with gaps. Corners turning less than minTurn deg get none (a kink is not a corner); same-side kerbs closer than mergeGap m join.
export function autoKerbs(st: Subtrack, {
  maxR = 70, exitR = 30, width = 2.4, h = 0.11, heavyR = 0, heavyW = 3.0, heavyH = 0.14,
  minTurn = 0, mergeGap = 0,
}: AutoKerbOptions = {}): CurvedKerb[] {
  const pts = st.pts, n = pts.length;
  const R: number[] = [], turn: number[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = pts[(i - 3 + n) % n], a1 = pts[(i + 3) % n];
    let dh = a1.heading - a0.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    R.push(Math.max(1, ((a1.dist - a0.dist) + st.totalDist) % st.totalDist) / Math.max(1e-4, Math.abs(dh)));
    turn.push(dh > 0 ? 1 : -1);
  }
  const kerbs: CurvedKerb[] = [];
  let i = 0;
  // start scanning at a point that is NOT in a corner, so a corner spanning the line is found whole
  let start = 0; while (start < n && R[start] < maxR) start++;
  for (let c = 0; c < n; c++) {
    const k = (start + c) % n;
    if (R[k] >= maxR) continue;
    // a corner: run while it stays tight in the SAME direction
    let e = c; const dir = turn[k]; let minR = Infinity, minAt = k;
    while (e < n && R[(start + e) % n] < maxR && turn[(start + e) % n] === dir) { const j = (start + e) % n; if (R[j] < minR) { minR = R[j]; minAt = j; } e++; }
    // the apex region: tighter than 1.6 x the minimum
    let a = minAt, b = minAt;
    while (R[(a - 1 + n) % n] < minR * 1.6 && a !== (start + c) % n) a = (a - 1 + n) % n;
    while (R[(b + 1) % n] < minR * 1.6 && b !== (start + e - 1) % n) b = (b + 1) % n;
    const heavy = minR < heavyR;
    const d0 = pts[a].dist, d1 = pts[b].dist + 4;
    let turnDeg = pts[(start + e - 1) % n].heading - pts[(start + c) % n].heading; turnDeg = Math.abs(Math.atan2(Math.sin(turnDeg), Math.cos(turnDeg))) * 180 / Math.PI;
    if (turnDeg < minTurn) { c = e; continue; }
    const inside = dir > 0 ? 'left' : 'right', outside = dir > 0 ? 'right' : 'left';
    // NO FANS (2026-10-04, photographed at Campbell / Club): a kerb on the inside of a tight corner has its inner edge at
    // R - half road - kerb width; at R 12.6 with a 3 m heavy kerb that was 2.6 m and the blocks fanned into wedges. Cap the
    // inside kerb so its inner edge stays >= 0.7 of its outer one.
    const capW = Math.max(1.2, 0.3 * (minR - st.width / 2));
    if (d1 - d0 > 3) kerbs.push({ side: inside, startDist: d0, endDist: d1, width: Math.min(capW, heavy ? heavyW : width), h: heavy ? heavyH : h });
    if (minR < exitR) kerbs.push({ side: outside, startDist: pts[b].dist, endDist: pts[b].dist + 18, width: heavy ? heavyW : width, h: heavy ? heavyH : h });
    c = e;
  }
  if (!mergeGap) return kerbs;
  // join same-side kerbs that nearly touch (the longer/heavier style wins); order by start
  kerbs.sort((p, q) => p.startDist - q.startDist);
  const out: CurvedKerb[] = [];
  for (const k of kerbs) {
    const prev = [...out].reverse().find((o) => o.side === k.side);
    if (prev && k.startDist - prev.endDist < mergeGap && k.startDist >= prev.startDist) {
      prev.endDist = Math.max(prev.endDist, k.endDist); prev.width = Math.max(prev.width, k.width); prev.h = Math.max(prev.h, k.h);
    } else out.push({ ...k });
  }
  return out;
}
// TRACE A REAL MAP INTO A DRIVABLE CENTRELINE (2026-10-04; user: Thruston "kerbs still broken on tight corners, not like the real
// corner"). The first re-lay pushed hand-read map points straight through Catmull-Rom and opened only the corners that FOLDED:
// MEASURED Campbell/Cobb ~R 11, Club R 9 (fold at 266 m), so a 3 m inside kerb had its inner edge ~1-4 m from the corner centre
// and drew as wedges (kerbside.mjs "kerb fans"). Now:
// map px -> metres, resample evenly, Taubin-smooth (no shrink), then open every corner tighter than rMin by smoothing only
// there, until the whole lap is >= rMin over an 8 m arc. Returns dense points for createSubtrack(..., dense = true).
// WHY rMin: the cars are full size but the lap is ~1/3 scale, so the real Complex / Club (R ~4 m at this scale) cannot carry a
// 14 m road — under half the width the ribbon FOLDS. rMin = half width + kerb + margin keeps the shape and never folds.
// CURVATURE NOISE: straight lines between the read points put ALL the turning at the points, so curvature flickered between
// "straight" and "tight" and autoKerbs laid ~55 fragments (MEASURED: 84 corner edges round the lap). A CENTRIPETAL Catmull-Rom
// through the points (alpha 0.5: no cusps or loops where points bunch, which is what kinked the uniform one) then smoothing
// over +-3 samples: 36 edges.
export function traceTrack(mapPts: Point[], {
  mpp = 0.47, cx = 480, cy = 338, step = 1.5, rMin = 12, passes = 10, kern = 3,
}: TraceOptions = {}): Point[] {
  const centripetal = (p: Point[]): Point[] => {
    const n = p.length, out: Point[] = [];
    const tj = (a: Point, b: Point) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-3;
    const L = (A: Point, B: Point, ta: number, tb: number, t: number): Point => [(A[0] * (tb - t) + B[0] * (t - ta)) / (tb - ta), (A[1] * (tb - t) + B[1] * (t - ta)) / (tb - ta)];
    for (let i = 0; i < n; i++) {
      const P0 = p[(i - 1 + n) % n], P1 = p[i], P2 = p[(i + 1) % n], P3 = p[(i + 2) % n];
      const t0 = 0, t1 = t0 + tj(P0, P1), t2 = t1 + tj(P1, P2), t3 = t2 + tj(P2, P3);
      const m = Math.max(4, Math.ceil(Math.hypot(P2[0] - P1[0], P2[1] - P1[1]) / 0.5));
      for (let j = 0; j < m; j++) {
        const t = t1 + (t2 - t1) * j / m;
        const A1 = L(P0, P1, t0, t1, t), A2 = L(P1, P2, t1, t2, t), A3 = L(P2, P3, t2, t3, t);
        out.push(L(L(A1, A2, t0, t2, t), L(A2, A3, t1, t3, t), t1, t2, t));
      }
    }
    return out;
  };
  const resample = (p: Point[]): Point[] => {
    const out: Point[] = []; const n = p.length; let carry = 0;
    for (let i = 0; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let t = carry; while (t < L) { out.push([a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L]); t += step; }
      carry = t - L;
    }
    return out;
  };
  const lap = (p: Point[], k: number, mask: boolean[] | null, w = 1): Point[] =>
    p.map((q, i): Point => {
    if (mask && !mask[i]) return q;
    const a = p[(i - w + p.length) % p.length], b = p[(i + w) % p.length];
    return [q[0] + k * ((a[0] + b[0]) / 2 - q[0]), q[1] + k * ((a[1] + b[1]) / 2 - q[1])];
  });
  // R over an 8 m arc from SEGMENT headings (chord-to-chord angles averaged a short sharp bend away: Club read 11.7 m by the
  // chords and 6.6 m by the 8 m arc that kerbside.mjs uses — the same measure now)
  const radii = (p: Point[]) => { const n = p.length, h = Math.max(1, Math.round(4 / step));
    const hd = p.map((q, i) => { const b = p[(i + 1) % n]; return Math.atan2(b[1] - q[1], b[0] - q[0]); });
    return p.map((_, i) => { let d = hd[(i + h) % n] - hd[(i - h + n) % n]; d = Math.atan2(Math.sin(d), Math.cos(d));
      return (2 * h * step) / Math.max(1e-4, Math.abs(d)); }); };
  let p = resample(centripetal(mapPts.map(([x, y]) => [(x - cx) * mpp, (y - cy) * mpp])));
  for (let k = 0; k < passes; k++) { p = lap(p, 0.5, null, kern); p = lap(p, -0.53, null, kern); }
  for (let it = 0; it < 3000; it++) {
    const R = radii(p), n = p.length, mask = new Array(n).fill(false); let bad = 0;
    const reach = Math.round(6 / step);
    for (let i = 0; i < n; i++) if (R[i] < rMin) { bad++; for (let j = -reach; j <= reach; j++) mask[(i + j + n) % n] = true; }
    if (!bad) break;
    p = lap(p, 0.5, mask);
    if (it % 20 === 19) p = resample(p);
  }
  return resample(p);
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
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const hdg = Math.atan2(dy, dx);
    sampled.push({
      x: a[0], y: a[1], dist: totalDist,
      dirX: dx / (len || 1), dirY: dy / (len || 1),
      nx: -dy / (len || 1), ny: dx / (len || 1),
      heading: hdg, width,
    });
    totalDist += len;
    // pad 5 -> 18 m past the edge: the camber eases off over 6 m and the Naffcar back slope over 16 m; at 5 the lookup
    // returned "no track" part-way down them and the ground stepped. The GRID below keeps the wider pad cheap.
    const pad = width / 2 + 18;
    segs.push({
      ax: a[0], ay: a[1], bx: b[0], by: b[1],
      dx, dy, l2: len * len, len,
      minX: Math.min(a[0], b[0]) - pad, maxX: Math.max(a[0], b[0]) + pad,
      minY: Math.min(a[1], b[1]) - pad, maxY: Math.max(a[1], b[1]) + pad,
    });
  }

  function sectorAt(dist: number): Sector | { surface: Surface } {
    if (!sectors.length) return { surface: SURFACES.tarmac };
    for (let i = 0; i < sectors.length; i++) {
      const s = sectors[i];
      if (s.startDist > s.endDist) {
        if (dist >= s.startDist || dist < s.endDist) return s;
      } else {
        if (dist >= s.startDist && dist < s.endDist) return s;
      }
    }
    return { surface: SURFACES.tarmac };
  }

  // LOOKUP GRID (perf, 2026-10-03): segment indices per SUB_CELL m square of their padded box, so querySubtrack checks a
  // handful of segments instead of every one. MEASURED: a shaded Test Track ground tile cost 34 ms at phone-ish CPU speed.
  const grid = new Map<number, number[]>();
  segs.forEach((g, i) => {
    for (let cx = Math.floor(g.minX / SUB_CELL); cx <= Math.floor(g.maxX / SUB_CELL); cx++)
      for (let cy = Math.floor(g.minY / SUB_CELL); cy <= Math.floor(g.maxY / SUB_CELL); cy++) {
        const k = cx * 100003 + cy; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(i);   // numeric key (string keys were slow: querySubtrack is the hottest function with AI cars)
      }
  });
  return { pts: sampled, segs, totalDist, width, sectors, sectorAt, curvedKerbs, grid };
}

// GHOST SEGMENT (point-to-point stages, user 2026-10-04: "rally stages are circular often — they should mostly be a LINE"). The engine's
// roads are closed loops (distances wrap at the start line); a point-to-point stage keeps that arithmetic by closing its loop with ONE
// invisible segment from the stop-zone end back to the run-up before the start. A ghost segment is not road: it is out of the lookup grid
// (querySubtrack never returns it, so physics / ground / resets / AI-progress never see it) and render.ts does not draw it.
export function ghostSegment(sub: Subtrack, i: number): Subtrack {
  sub.segs[i].ghost = true;
  for (const l of sub.grid.values()) { const k = l.indexOf(i); if (k >= 0) l.splice(k, 1); }
  sub.ghost = { d0: sub.pts[i].dist, d1: sub.pts[(i + 1) % sub.pts.length].dist || sub.totalDist };
  return sub;
}
