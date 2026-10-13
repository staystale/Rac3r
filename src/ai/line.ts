// ai/line.js — the racing line, branch paths and speed profiles (split from aidriver.js).
//
// 1. RACING LINE, once per level (cached): lateral offsets from the centreline by MINIMUM-CURVATURE descent inside the road
//    (half width - LINE_MARGIN; the inside of a hairpin limited to 0.6 of its radius so the line cannot fold), biased off any
//    cross-section offset whose grip is well below the best there (SURFACE AWARENESS). Corners found on it (runs with R < CORNER_R).
// 2. BRANCH PATHS: the JOKER lane (main line -> joker -> merge back onto the line) and the START lane (an RX start straight off the lap),
//    resampled and rounded, each with its own speed profile.
// 3. SPEED PROFILE per car model (cached per path): sqrt(K_CORNER x mu x gripG x g x R) from the car's MEASURED grip (carstats.js),
//    then a backward braking pass, so the target at any point already brakes for everything ahead.
import { debugValue } from "../core/debug.ts";
import { groundAt } from "../world/wear.ts";
import { querySubtrack } from "../world/tyrewall.ts";
import { GRAVITY } from "../cars.ts";
import { CAR_STATS } from "../carstats.js";
import type { Level, Lane } from "../world/types.ts";
import type {
  AiCar, Branches, CarStat, Corner, LinePoint, Path, PathPoint, RacingLine, SpeedProfile,
} from "./types.ts";

const LINE_MARGIN = 1.6;     // m kept from the road edge (car half width ~0.9 + room)
const K_CORNER = 0.88;       // fraction of the measured cornering grip a PRO uses (calibrated: tools/aidrivecheck.mjs, clean at 0.88)
export const K_BRAKE = 0.70;        // fraction of grip planned for braking (0.80 arrived 4 m/s hot into Sweaty Lamb's S on gravel, MEASURED)
const R_TIGHT = 6;           // m: hairpins get less of the grip, kC x R / (R + R_TIGHT) (Slidden's R 10 hairpin: full lock, still wide)
const OBST_LINE = 1.6;     // m from an object on the road to the racing line (car half width 0.9 + tracking error)
export const OBST_CLEAR = 1.1;      // m: a loose object closer than r + this to my lateral target is in the way (half a car + margin)
const MU_SMOOTH = 20;   // m: the grip map is averaged along the track this far each way for the line's surface bias
const CORNER_R = 70;         // m: line radius under which a stretch counts as a corner (mistakes are drawn per corner)

// ---------------------------------------------------------------- paths
// headings, radius over ~8 m, surface mu at every point
function finishPath<P extends PathPoint>(pts: P[], closed: boolean, total: number): Path<P> {
  const n = pts.length, sp = total / (closed ? n : n - 1);
  for (let i = 0; i < n; i++) { const a = pts[i], b = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)], c = closed ? a : pts[Math.max(0, i - 1)];
    a.h = (closed || i < n - 1) ? Math.atan2(b.y - a.y, b.x - a.x) : Math.atan2(a.y - c.y, a.x - c.x); }
  const k = Math.max(2, Math.round(4 / Math.max(0.5, sp)));
  for (let i = 0; i < n; i++) {
    const ia = closed ? (i - k + n) % n : Math.max(0, i - k), ic = closed ? (i + k) % n : Math.min(n - 1, i + k);
    let dh = pts[ic].h - pts[ia].h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const ds = Math.max(sp, (closed ? 2 * k : ic - ia) * sp); pts[i].R = ds / Math.max(1e-4, Math.abs(dh)); pts[i].turn = Math.sign(dh);
  }
  for (const p of pts) { const g = groundAt(p.x, p.y); p.mu = (g.surface && g.surface.mu) || 1; }
  return { pts, n, closed, total, sp, prof: {} };
}

export function racingLine(level: Level): RacingLine {
  if (level._line) return level._line;
  // (! : a level with a lap has its subtrack by the time the AI looks)
  const sub = level.subtrack!, P = sub.pts, n = P.length, hw = sub.width / 2, b = Math.max(0.5, hw - LINE_MARGIN);
  // grip across the road at every point (1 m lateral steps): mu of whatever is there
  const lat: number[] = []; for (let o = -b; o <= b + 1e-6; o += 1) lat.push(+o.toFixed(2));
  const mu0 = P.map((p) => lat.map((o) => { const g = groundAt(p.x + p.nx * o, p.y + p.ny * o); return (g.surface && g.surface.mu) || 1; }));
  // SMOOTHED ALONG THE TRACK (+-MU_SMOOTH m) before the surface bias reads it (user, 2026-10-04: "Slidden Hill dirt to tarmac, the AI
  // still slows down!!"). Where a surface edge crosses the road at an angle, a few cross-sections are half dirt / half tarmac and the
  // bias jerked the line sideways there: a KINK (R 19-26 m on a straight, R 150-2000 either side) that the speed profile read as a
  // corner — 20 -> 11 m/s at Slidden's dirt -> tarmac (d 363), the same at 3 of its 4 changes (MEASURED, line dump).
  const wS = Math.max(1, Math.round(MU_SMOOTH / (sub.totalDist / n)));
  const mu = mu0.map((row, i) => row.map((_, q) => { let s = 0; for (let k = -wS; k <= wS; k++) s += mu0[(i + k + n) % n][q]; return s / (2 * wS + 1); }));
  const best = mu.map((row) => Math.max(...row));
  // the INSIDE of a hairpin: an offset toward the centre of a tight centreline turn past ~0.6 R folds the line back on itself
  // (MEASURED: Slidden's start hairpin, offsets flipping +3.8 / -3.3 m every 5 m, line R 4 m, the AI crawling at 5 m/s)
  const lo = new Float64Array(n).fill(-b), hi = new Float64Array(n).fill(b);
  { const k = Math.max(1, Math.round(4 / (sub.totalDist / n)));
    for (let i = 0; i < n; i++) {
      const a = P[(i - k + n) % n], c = P[(i + k) % n], ha = Math.atan2(P[i].y - a.y, P[i].x - a.x), hc = Math.atan2(c.y - P[i].y, c.x - P[i].x);
      let dh = hc - ha; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      const Rc = (2 * k * sub.totalDist / n) / Math.max(1e-4, Math.abs(dh)), lim = Math.max(0.5, 0.6 * Rc);
      // turning left (dh > 0) the centre is on the left; P's normal (nx, ny) = left of travel when cross(t, n) > 0
      const tx = c.x - a.x, ty = c.y - a.y, nLeft = tx * P[i].ny - ty * P[i].nx > 0;
      if ((dh > 0) === nLeft) hi[i] = Math.min(b, lim); else lo[i] = Math.max(-b, -lim);
    }
  }
  // OBJECTS ON THE ROAD narrow it for the line (user: "try and avoid tyres and cones"): a resting cone / tyre / bale inside the road
  // pushes that side's limit in to r + OBST_CLEAR from it, over its length; skipped if it would leave under 3 m (then it is a chicane of
  // cones the line runs through anyway). MEASURED before: Sweaty Lamb's apex tyres (0-2 m inside the edge) — 54 knocked in 2 laps.
  for (const o of level.cones || []) {
    if (o.kind === 'banger' || o.kind === 'caravan') continue;
    const q = querySubtrack(sub, o.x, o.y); if (!(q.dist < hw + 0.5) || q.seg == null) continue;
    const r = o.kind === 'bale' ? 0.8 : o.kind === 'tyrestack' ? 0.48 : o.kind === 'tyre' ? 0.42 : 0.3, i0 = q.seg, sp0 = sub.totalDist / n;
    for (let k = -Math.ceil((r + 2) / sp0); k <= Math.ceil((r + 2) / sp0); k++) {
      const i = (i0 + k + n) % n, p = P[i], oc = (o.x - p.x) * p.nx + (o.y - p.y) * p.ny;
      if (oc > 0) { const h = oc - r - OBST_LINE; if (h - lo[i] >= 3) hi[i] = Math.min(hi[i], h); }
      else { const l = oc + r + OBST_LINE; if (hi[i] - l >= 3) lo[i] = Math.max(lo[i], l); }
    }
  }
  const off = new Float64Array(n), qx = new Float64Array(n), qy = new Float64Array(n), dx = new Float64Array(n), dy = new Float64Array(n);
  // energy = sum over i of |q(i-k) - 2 q(i) + q(i+k)|^2 (squared curvature at spacing k); gradient descent on each lateral offset,
  // clamped to the road. (Neighbour-midpoint smoothing is curve SHORTENING: it glued Naffcar's line to the inside all the way round.)
  // Coarse spacings first (whole-corner out-in-out shape), then fine, ending at k = 1 (coarser k couples only every k-th point and
  // the interleaved chains zig-zag against each other).
  const smooth = (k: number, iters: number) => {
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < n; i++) { qx[i] = P[i].x + P[i].nx * off[i]; qy[i] = P[i].y + P[i].ny * off[i]; }
      for (let i = 0; i < n; i++) { const a = (i - k + n) % n, c = (i + k) % n; dx[i] = qx[a] - 2 * qx[i] + qx[c]; dy[i] = qy[a] - 2 * qy[i] + qy[c]; }
      for (let i = 0; i < n; i++) {
        const a = (i - k + n) % n, c = (i + k) % n, p = P[i];
        const gx = dx[a] - 2 * dx[i] + dx[c], gy = dy[a] - 2 * dy[i] + dy[c];
        let o = off[i] - 0.05 * (gx * p.nx + gy * p.ny);
        // SURFACE: if the line would sit on much worse grip than the best across this cross-section, ease toward the nearest good offset
        const j = Math.max(0, Math.min(lat.length - 1, Math.round(o + b)));
        if (mu[i][j] < 0.9 * best[i]) {
          let bj = -1, bd = Infinity; for (let q = 0; q < lat.length; q++) if (mu[i][q] >= 0.9 * best[i] && Math.abs(q - j) < bd) { bd = Math.abs(q - j); bj = q; }
          if (bj >= 0) o += 0.1 * (lat[bj] - o);   // a gentle bias (0.35 yanked the line into kinks at every patch edge)
        }
        off[i] = Math.max(lo[i], Math.min(hi[i], o));
      }
    }
  };
  const sp = sub.totalDist / n;   // m per point
  for (const m of [40, 20, 10, 5, 2.5]) { const k = Math.max(1, Math.round(m / sp)); smooth(k, 300); }
  smooth(1, 400);
  // (cast: finishPath, just below, sets h, R, turn and mu on these points)
  const pts = P.map((p, i) => ({ x: p.x + p.nx * off[i], y: p.y + p.ny * off[i], nx: p.nx, ny: p.ny, dist: p.dist, off: off[i] } as LinePoint));
  const path = finishPath(pts, true, sub.totalDist);
  // CORNERS: runs of R < CORNER_R (scanning from a straight so a corner across the line is one run); apex = tightest point
  const cid = new Int32Array(n).fill(-1), corners: Corner[] = [];
  let s0 = pts.findIndex((p) => p.R >= CORNER_R); if (s0 < 0) s0 = 0;
  for (let q = 0; q < n; q++) {
    const i = (s0 + q) % n; if (pts[i].R >= CORNER_R) continue;
    const prev = (i - 1 + n) % n;
    if (cid[prev] < 0) corners.push({ start: i, apex: i, turn: 0 });
    const c = corners[corners.length - 1]; cid[i] = corners.length - 1;
    if (pts[i].R < pts[c.apex].R) c.apex = i; c.turn += pts[i].turn;
  }
  for (const c of corners) c.turn = Math.sign(c.turn);
  level._line = Object.assign(path, { hw, lat, mu, best, cid, corners });
  level._branches = branches(level, level._line);
  return level._line;
}

// resample an open polyline at ~1 m and round its corners (ends fixed)
function openPath(xy: number[][], rounds = 40) {
  const out: PathPoint[] = [];
  for (let s = 0; s < xy.length - 1; s++) {
    const [ax, ay] = xy[s], [bx, by] = xy[s + 1], L = Math.hypot(bx - ax, by - ay); if (L < 1e-3) continue;
    for (let t = 0; t < L; t += 1) out.push({ x: ax + (bx - ax) * t / L, y: ay + (by - ay) * t / L } as PathPoint);
  }
  // (the two casts in openPath: finishPath sets h, R, turn and mu on these points)
  out.push({ x: xy[xy.length - 1][0], y: xy[xy.length - 1][1] } as PathPoint);
  for (let r = 0; r < rounds; r++) for (let i = 1; i < out.length - 1; i++) { out[i].x = 0.5 * out[i].x + 0.25 * (out[i - 1].x + out[i + 1].x); out[i].y = 0.5 * out[i].y + 0.25 * (out[i - 1].y + out[i + 1].y); }
  let total = 0; for (let i = 1; i < out.length; i++) total += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
  return { pts: out, total };
}
export const nearestIdx = (pts: PathPoint[], x: number, y: number) => { let bi = 0, bd = Infinity; for (let i = 0; i < pts.length; i++) { const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
// a BRANCH: (main line for preM metres before entryI) -> the lane -> (merge onto the main line postA..postB metres after exitI)
export function branch(
  L: RacingLine, laneXY: number[][], entryI: number, exitI: number,
  preM = 25, postA = 15, postB = 35, rounds = 40,
): Path {
  const n = L.n, sp = L.sp, M = L.pts, raw = [];
  if (entryI >= 0) for (let d = preM; d > 0; d -= 1) { const p = M[(entryI - Math.round(d / sp) + n * 4) % n]; raw.push([p.x, p.y]); }
  raw.push(...laneXY);
  for (let d = postA; d <= postB; d += 1) { const p = M[(exitI + Math.round(d / sp)) % n]; raw.push([p.x, p.y]); }
  const o = openPath(raw, rounds), path = finishPath(o.pts, false, o.total);
  path.switchI = entryI >= 0 ? (entryI - Math.round(preM / sp) + n * 4) % n : -1;   // the main-line index where it leaves
  path.rejoin = (exitI + Math.round(postB / sp)) % n;
  return path;
}
function branches(level: Level, L: RacingLine): Branches {
  // (the two ! on level.subtrack: racingLine, our one caller, has already read it)
  const out: Branches = {}, lanes = level.lanes || [], hw = level.subtrack!.width / 2;
  const laneDist = (lane: Lane, x: number, y: number) => { let bd = Infinity; const P = lane.pts; for (let i = 0; i < P.length - 1; i++) { const [ax, ay] = P[i], [bx, by] = P[i + 1], vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2)); bd = Math.min(bd, Math.hypot(ax + vx * t - x, ay + vy * t - y)); } return bd; };
  const J = level.joker;
  if (J) {
    const lane = lanes.find((l) => laneDist(l, J.gate.x, J.gate.y) < l.width / 2 + 1);
    if (lane) { const P = lane.pts, xy = P.map(([x, y]) => [x, y]);
      out.joker = branch(L, xy, nearestIdx(L.pts, P[0][0], P[0][1]), nearestIdx(L.pts, P[P.length - 1][0], P[P.length - 1][1]), 25, 15, 35, 25); }
  }
  // the START lane: the lane the spawn sits on, when the spawn is off the lap (Slidden Hill's RX start straight)
  const s = level.spawn;
  if (s && querySubtrack(level.subtrack!, s.x, s.y).dist > hw) {
    const lane = lanes.find((l) => laneDist(l, s.x, s.y) < l.width / 2 + 1);
    if (lane) { const P = lane.pts, back = [P[0][0] - Math.cos(s.heading) * 60, P[0][1] - Math.sin(s.heading) * 60];   // room for the grid behind
      out.start = branch(L, [back, ...P.map(([x, y]) => [x, y])], -1, nearestIdx(L.pts, P[P.length - 1][0], P[P.length - 1][1]), 0, 10, 30, 60);
      out.startLane = lane; }
  }
  return out;
}
// the racing line + its branches, for overlays and tools
// STAGE RUN (main.js: a rally stage with real start intervals): where a driver would be T s after leaving the start line from rest, or
// when it would reach toDist — its own speed profile x pace, with an acceleration limit (ACC_EST m/s^2, fading with speed) on a forward pass.
const ACC_EST = 4.5;
export function lineRun(
  level: Level, spec: AiCar["spec"], pace: number, T: number, toDist = Infinity,
) {
  const L = racingLine(level), prof = profileOf(L, spec, L), n = L.n, P = L.pts;
  let k = 0; for (let i = 1; i < n; i++) if (P[i].dist < P[k].dist) k = i;   // the start line (centreline distance 0)
  let t = 0, v = 0;
  for (let s = 0; s < n; s++) {
    const vt = Math.max(2, prof[k] * pace), acc = Math.max(0.6, ACC_EST * (1 - v / 70));
    v = Math.min(vt, Math.sqrt(v * v + 2 * acc * L.sp));
    t += L.sp / Math.max(1, v); k = (k + 1) % n;
    if (t >= T || P[k].dist >= toDist) break;
  }
  const p = P[k]; return { x: p.x, y: p.y, h: p.h, v, t, dist: p.dist };
}
export function aiPaths(level: Level) { const L = racingLine(level); return { line: L, ...level._branches }; }

// ---------------------------------------------------------------- the speed profile (per path, per car model)
// from the car's MEASURED numbers (src/carstats.js, lab surface mu 1.0): gripG = steady cornering g, brake100 = metres from 100 km/h
export function carGrip(spec: AiCar["spec"]) {
  // (cast: carstats.js is generated JavaScript, indexed here by a string id)
  const id = String(spec.id).split('#')[0], cs = (CAR_STATS as Record<string, CarStat>)[id] || {};
  const gripG = cs.gripG || spec.mu * 0.9, brakeG = cs.brake100 ? (27.78 * 27.78) / (2 * cs.brake100) / GRAVITY : gripG * 0.8;
  return { id, gripG, brakeG };
}
export function profileOf(
  path: Path, spec: AiCar["spec"], main?: Path, kBo?: number,
): SpeedProfile {
  const { id, gripG, brakeG } = carGrip(spec);
  // aiK (cars.js, optional): a per-car confidence on the plan — a front-heavy AWD road car on loose gravel ran 3 m/s hot into Sweaty Lamb
  // corners and slid off 22 s a lap at Real with the roster's numbers (MEASURED, aidrivecheck; the Subaroo WRZ)
  // (the two casts: debugValue is unknown; the tools set __AI_K / __AI_KB to numbers)
  const ak = spec.aiK || 1, kC = (debugValue("AI_K") as number || K_CORNER) * ak, kB = (kBo || debugValue("AI_KB") as number || K_BRAKE) * ak, key = id + ':' + kC + ':' + kB;
  if (path.prof[key]) return path.prof[key];
  const n = path.n, v = new Float64Array(n), ds = path.sp, P = path.pts;
  for (let i = 0; i < n; i++) { const r = P[i].R; v[i] = Math.min(95, Math.sqrt(kC * (r / (r + R_TIGHT)) * P[i].mu * gripG * GRAVITY * r)); }
  if (!path.closed && main) v[n - 1] = Math.min(v[n - 1], profileOf(main, spec)[path.rejoin!]);
  // backward braking pass (twice round a closed path so it wraps)
  for (let pass = 0; pass < (path.closed ? 2 : 1); pass++) for (let i = (path.closed ? n - 1 : n - 2); i >= 0; i--) {
    const nx = v[(i + 1) % n], a = kB * P[i].mu * brakeG * GRAVITY;
    v[i] = Math.min(v[i], Math.sqrt(nx * nx + 2 * a * ds));
  }
  path.prof[key] = v;
  return v;
}
