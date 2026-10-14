// ai/line.js — the racing line, branch paths and speed profiles (split from aidriver.js).
//
// 1. RACING LINE, once per level (cached): lateral offsets from the centreline by MINIMUM-CURVATURE
//    descent inside the road (half width - LINE_MARGIN; the inside of a hairpin limited to 0.6 of
//    its radius so the line cannot fold), biased off any cross-section offset whose grip is well
//    below the best there (SURFACE AWARENESS). Corners found on it (runs with R < CORNER_R).
// 2. BRANCH PATHS: the JOKER lane (main line -> joker -> merge back onto the line) and the START
//    lane (an RX start straight off the lap), resampled and rounded, each with its
//    own speed profile.
// 3. SPEED PROFILE per car model (cached per path): sqrt(K_CORNER x mu x gripG x g x R) from the
//    car's MEASURED grip (carstats.js), then a backward braking pass, so the target at any point
//    already brakes for everything ahead.
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
// fraction of the measured cornering grip a PRO uses
// (calibrated: tools/aidrivecheck.mjs, clean at 0.88)
const K_CORNER = 0.88;
// fraction of grip planned for braking (0.80 arrived 4 m/s hot into Sweaty Lamb's S on gravel,
// MEASURED)
export const K_BRAKE = 0.70;
// m: hairpins get less of the grip, kC x R / (R + R_TIGHT)
// (Slidden's R 10 hairpin: full lock, still wide)
const R_TIGHT = 6;
// m from an object on the road to the racing line (car half width 0.9 + tracking error)
const OBST_LINE = 1.6;
// m: a loose object closer than r + this to my lateral target is in the way (half a car + margin)
export const OBST_CLEAR = 1.1;
// m: the grip map is averaged along the track this far each way for the line's surface bias
const MU_SMOOTH = 20;
// m: line radius under which a stretch counts as a corner (mistakes are drawn per corner)
const CORNER_R = 70;

// ---------------------------------------------------------------- paths
// headings, radius over ~8 m, surface mu at every point
function finishPath<P extends PathPoint>(pts: P[], closed: boolean, total: number): Path<P> {
  const count = pts.length, step = total / (closed ? count : count - 1);
  for (let i = 0; i < count; i++) {
    const here = pts[i],
      next = closed ? pts[(i + 1) % count] : pts[Math.min(count - 1, i + 1)],
      prior = closed ? here : pts[Math.max(0, i - 1)];
    here.h = (closed || i < count - 1)
      ? Math.atan2(next.y - here.y, next.x - here.x)
      : Math.atan2(here.y - prior.y, here.x - prior.x);
  }
  const span = Math.max(2, Math.round(4 / Math.max(0.5, step)));
  for (let i = 0; i < count; i++) {
    const before = closed ? (i - span + count) % count : Math.max(0, i - span),
      after = closed ? (i + span) % count : Math.min(count - 1, i + span);
    let turnDelta = pts[after].h - pts[before].h;
    turnDelta = Math.atan2(Math.sin(turnDelta), Math.cos(turnDelta));
    const arc = Math.max(step, (closed ? 2 * span : after - before) * step);
    pts[i].R = arc / Math.max(1e-4, Math.abs(turnDelta));
    pts[i].turn = Math.sign(turnDelta);
  }
  for (const point of pts) {
    const ground = groundAt(point.x, point.y);
    point.mu = (ground.surface && ground.surface.mu) || 1;
  }
  return { pts, n: count, closed, total, sp: step, prof: {} };
}

export function racingLine(level: Level): RacingLine {
  if (level._line) return level._line;
  // (! : a level with a lap has its subtrack by the time the AI looks)
  const sub = level.subtrack!,
    centre = sub.pts,
    count = centre.length,
    halfWidth = sub.width / 2,
    reach = Math.max(0.5, halfWidth - LINE_MARGIN);
  // grip across the road at every point (1 m lateral steps): mu of whatever is there
  const lat: number[] = [];
  for (let offset = -reach; offset <= reach + 1e-6; offset += 1) lat.push(+offset.toFixed(2));
  const rawGrip = centre.map((point) => lat.map((offset) => {
    const ground = groundAt(point.x + point.nx * offset, point.y + point.ny * offset);
    return (ground.surface && ground.surface.mu) || 1;
  }));
  // SMOOTHED ALONG THE TRACK (+-MU_SMOOTH m) before the surface bias reads it (user, 2026-10-04:
  // "Slidden Hill dirt to tarmac, the AI still slows down!!"). Where a surface edge crosses the
  // road at an angle, a few cross-sections are half dirt / half tarmac and the bias jerked the line
  // sideways there: a KINK (R 19-26 m on a straight, R 150-2000 either side) that the speed profile
  // read as a corner — 20 -> 11 m/s at Slidden's dirt -> tarmac (d 363), the same at 3 of its 4
  // changes (MEASURED, line dump).
  const smoothSpan = Math.max(1, Math.round(MU_SMOOTH / (sub.totalDist / count)));
  const grip = rawGrip.map((row, i) => row.map((cell, col) => {
    let sum = 0;
    for (let shift = -smoothSpan; shift <= smoothSpan; shift++)
      sum += rawGrip[(i + shift + count) % count][col];
    return sum / (2 * smoothSpan + 1);
  }));
  const best = grip.map((row) => Math.max(...row));
  // the INSIDE of a hairpin: an offset toward the centre of a tight centreline turn past ~0.6 R
  // folds the line back on itself (MEASURED: Slidden's start hairpin, offsets flipping +3.8 / -3.3
  // m every 5 m, line R 4 m, the AI crawling at 5 m/s)
  const low = new Float64Array(count).fill(-reach), high = new Float64Array(count).fill(reach);
  {
    const span = Math.max(1, Math.round(4 / (sub.totalDist / count)));
    for (let i = 0; i < count; i++) {
      const before = centre[(i - span + count) % count],
        after = centre[(i + span) % count],
        headBefore = Math.atan2(centre[i].y - before.y, centre[i].x - before.x),
        headAfter = Math.atan2(after.y - centre[i].y, after.x - centre[i].x);
      let turn = headAfter - headBefore;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      const centreRadius = (2 * span * sub.totalDist / count) / Math.max(1e-4, Math.abs(turn)),
        lim = Math.max(0.5, 0.6 * centreRadius);
      // turning left (turn > 0) the centre is on the left; the normal (nx, ny) = left of travel
      // when cross(t, n) > 0
      const tanX = after.x - before.x,
        tanY = after.y - before.y,
        nLeft = tanX * centre[i].ny - tanY * centre[i].nx > 0;
      if ((turn > 0) === nLeft) high[i] = Math.min(reach, lim);
      else low[i] = Math.max(-reach, -lim);
    }
  }
  // OBJECTS ON THE ROAD narrow it for the line (user: "try and avoid tyres and cones"): a resting
  // cone / tyre / bale inside the road pushes that side's limit in to r + OBST_CLEAR from it, over
  // its length; skipped if it would leave under 3 m (then it is a chicane of cones the line runs
  // through anyway). MEASURED before: Sweaty Lamb's apex tyres (0-2 m inside the edge) — 54 knocked
  // in 2 laps.
  for (const obj of level.cones || []) {
    if (obj.kind === 'banger' || obj.kind === 'caravan') continue;
    const hit = querySubtrack(sub, obj.x, obj.y);
    if (!(hit.dist < halfWidth + 0.5) || hit.seg == null) continue;
    const radius = obj.kind === 'bale' ? 0.8
        : obj.kind === 'tyrestack' ? 0.48 : obj.kind === 'tyre' ? 0.42 : 0.3,
      segIdx = hit.seg,
      stepM = sub.totalDist / count;
    for (let shift = -Math.ceil((radius + 2) / stepM);
      shift <= Math.ceil((radius + 2) / stepM); shift++) {
      const i = (segIdx + shift + count) % count,
        point = centre[i],
        across = (obj.x - point.x) * point.nx + (obj.y - point.y) * point.ny;
      if (across > 0) {
        const edge = across - radius - OBST_LINE;
        if (edge - low[i] >= 3) high[i] = Math.min(high[i], edge);
      } else {
        const edge = across + radius + OBST_LINE;
        if (high[i] - edge >= 3) low[i] = Math.max(low[i], edge);
      }
    }
  }
  const off = new Float64Array(count),
    posX = new Float64Array(count),
    posY = new Float64Array(count),
    dx = new Float64Array(count),
    dy = new Float64Array(count);
  // energy = sum over i of |q(i-gap) - 2 q(i) + q(i+gap)|^2 (squared curvature at spacing gap);
  // gradient descent on each lateral offset, clamped to the road. (Neighbour-midpoint smoothing is
  // curve SHORTENING: it glued Naffcar's line to the inside all the way round.)
  // Coarse spacings first (whole-corner out-in-out shape), then fine, ending at gap = 1 (a coarser
  // gap couples only every gap-th point and the interleaved chains zig-zag against each other).
  const smooth = (gap: number, iters: number) => {
    for (let iter = 0; iter < iters; iter++) {
      for (let i = 0; i < count; i++) {
        posX[i] = centre[i].x + centre[i].nx * off[i];
        posY[i] = centre[i].y + centre[i].ny * off[i];
      }
      for (let i = 0; i < count; i++) {
        const before = (i - gap + count) % count, after = (i + gap) % count;
        dx[i] = posX[before] - 2 * posX[i] + posX[after];
        dy[i] = posY[before] - 2 * posY[i] + posY[after];
      }
      for (let i = 0; i < count; i++) {
        const before = (i - gap + count) % count, after = (i + gap) % count, point = centre[i];
        const gradX = dx[before] - 2 * dx[i] + dx[after],
          gradY = dy[before] - 2 * dy[i] + dy[after];
        let target = off[i] - 0.05 * (gradX * point.nx + gradY * point.ny);
        // SURFACE: if the line would sit on much worse grip than the best across this
        // cross-section, ease toward the nearest good offset
        const j = Math.max(0, Math.min(lat.length - 1, Math.round(target + reach)));
        if (grip[i][j] < 0.9 * best[i]) {
          let bestCol = -1, bestGap = Infinity;
          for (let col = 0; col < lat.length; col++)
            if (grip[i][col] >= 0.9 * best[i] && Math.abs(col - j) < bestGap) {
              bestGap = Math.abs(col - j);
              bestCol = col;
            }
          // a gentle bias (0.35 yanked the line into kinks at every patch edge)
          if (bestCol >= 0) target += 0.1 * (lat[bestCol] - target);
        }
        off[i] = Math.max(low[i], Math.min(high[i], target));
      }
    }
  };
  const step = sub.totalDist / count;   // m per point
  for (const metres of [40, 20, 10, 5, 2.5]) {
    const gap = Math.max(1, Math.round(metres / step));
    smooth(gap, 300);
  }
  smooth(1, 400);
  // (cast: finishPath, just below, sets h, R, turn and mu on these points)
  const pts = centre.map((point, i) => ({
    x: point.x + point.nx * off[i], y: point.y + point.ny * off[i],
    nx: point.nx, ny: point.ny, dist: point.dist, off: off[i],
  } as LinePoint));
  const path = finishPath(pts, true, sub.totalDist);
  // CORNERS: runs of R < CORNER_R (scanning from a straight so a corner across the line is one
  // run); apex = tightest point
  const cid = new Int32Array(count).fill(-1), corners: Corner[] = [];
  let startIdx = pts.findIndex((point) => point.R >= CORNER_R);
  if (startIdx < 0) startIdx = 0;
  for (let scan = 0; scan < count; scan++) {
    const i = (startIdx + scan) % count;
    if (pts[i].R >= CORNER_R) continue;
    const prev = (i - 1 + count) % count;
    if (cid[prev] < 0) corners.push({ start: i, apex: i, turn: 0 });
    const corner = corners[corners.length - 1];
    cid[i] = corners.length - 1;
    if (pts[i].R < pts[corner.apex].R) corner.apex = i;
    corner.turn += pts[i].turn;
  }
  for (const corner of corners) corner.turn = Math.sign(corner.turn);
  level._line = Object.assign(path, { hw: halfWidth, lat, mu: grip, best, cid, corners });
  level._branches = branches(level, level._line);
  return level._line;
}

// resample an open polyline at ~1 m and round its corners (ends fixed)
function openPath(coords: number[][], rounds = 40) {
  const out: PathPoint[] = [];
  for (let seg = 0; seg < coords.length - 1; seg++) {
    const [fromX, fromY] = coords[seg],
      [toX, toY] = coords[seg + 1],
      len = Math.hypot(toX - fromX, toY - fromY);
    if (len < 1e-3) continue;
    for (let along = 0; along < len; along += 1)
      out.push({
        x: fromX + (toX - fromX) * along / len, y: fromY + (toY - fromY) * along / len,
      } as PathPoint);
  }
  // (the two casts in openPath: finishPath sets h, R, turn and mu on these points)
  out.push({ x: coords[coords.length - 1][0], y: coords[coords.length - 1][1] } as PathPoint);
  for (let round = 0; round < rounds; round++)
    for (let i = 1; i < out.length - 1; i++) {
      out[i].x = 0.5 * out[i].x + 0.25 * (out[i - 1].x + out[i + 1].x);
      out[i].y = 0.5 * out[i].y + 0.25 * (out[i - 1].y + out[i + 1].y);
    }
  let total = 0;
  for (let i = 1; i < out.length; i++)
    total += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
  return { pts: out, total };
}
export const nearestIdx = (pts: PathPoint[], x: number, y: number) => {
  let bestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const dist = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2;
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }
  return bestIdx;
};
// a BRANCH: (main line for preM metres before entryI) -> the lane -> (merge onto the main line
// postA..postB metres after exitI)
export function branch(
  line: RacingLine, laneXY: number[][], entryI: number, exitI: number,
  preM = 25, postA = 15, postB = 35, rounds = 40,
): Path {
  const count = line.n, step = line.sp, main = line.pts, raw = [];
  if (entryI >= 0)
    for (let dist = preM; dist > 0; dist -= 1) {
      const point = main[(entryI - Math.round(dist / step) + count * 4) % count];
      raw.push([point.x, point.y]);
    }
  raw.push(...laneXY);
  for (let dist = postA; dist <= postB; dist += 1) {
    const point = main[(exitI + Math.round(dist / step)) % count];
    raw.push([point.x, point.y]);
  }
  const open = openPath(raw, rounds), path = finishPath(open.pts, false, open.total);
  // the main-line index where it leaves
  path.switchI = entryI >= 0 ? (entryI - Math.round(preM / step) + count * 4) % count : -1;
  path.rejoin = (exitI + Math.round(postB / step)) % count;
  return path;
}
function branches(level: Level, line: RacingLine): Branches {
  // (the two ! on level.subtrack: racingLine, our one caller, has already read it)
  const out: Branches = {}, lanes = level.lanes || [], halfWidth = level.subtrack!.width / 2;
  const laneDist = (lane: Lane, x: number, y: number) => {
    let bestDist = Infinity;
    const pts = lane.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const [fromX, fromY] = pts[i],
        [toX, toY] = pts[i + 1],
        vx = toX - fromX,
        vy = toY - fromY,
        lenSq = vx * vx + vy * vy || 1,
        frac = Math.max(0, Math.min(1, ((x - fromX) * vx + (y - fromY) * vy) / lenSq));
      bestDist = Math.min(bestDist, Math.hypot(fromX + vx * frac - x, fromY + vy * frac - y));
    }
    return bestDist;
  };
  const joker = level.joker;
  if (joker) {
    const lane = lanes.find(
      (cand) => laneDist(cand, joker.gate.x, joker.gate.y) < cand.width / 2 + 1,
    );
    if (lane) {
      const pts = lane.pts, laneXY = pts.map(([x, y]) => [x, y]);
      out.joker = branch(
        line, laneXY, nearestIdx(line.pts, pts[0][0], pts[0][1]),
        nearestIdx(line.pts, pts[pts.length - 1][0], pts[pts.length - 1][1]), 25, 15, 35, 25,
      );
    }
  }
  // the START lane: the lane the spawn sits on, when the spawn is off the lap (Slidden Hill's RX
  // start straight)
  const spawn = level.spawn;
  if (spawn && querySubtrack(level.subtrack!, spawn.x, spawn.y).dist > halfWidth) {
    const lane = lanes.find((cand) => laneDist(cand, spawn.x, spawn.y) < cand.width / 2 + 1);
    if (lane) {
      const pts = lane.pts,
        // room for the grid behind
        back = [pts[0][0] - Math.cos(spawn.heading) * 60, pts[0][1] - Math.sin(spawn.heading) * 60];
      out.start = branch(
        line, [back, ...pts.map(([x, y]) => [x, y])], -1,
        nearestIdx(line.pts, pts[pts.length - 1][0], pts[pts.length - 1][1]), 0, 10, 30, 60,
      );
      out.startLane = lane;
    }
  }
  return out;
}
// the racing line + its branches, for overlays and tools
// STAGE RUN (main.js: a rally stage with real start intervals): where a driver would be T s after
// leaving the start line from rest, or when it would reach toDist — its own speed profile x pace,
// with an acceleration limit (ACC_EST m/s^2, fading with speed) on a forward pass.
const ACC_EST = 4.5;
export function lineRun(
  level: Level, spec: AiCar["spec"], pace: number, seconds: number, toDist = Infinity,
) {
  const line = racingLine(level), prof = profileOf(line, spec, line),
    count = line.n, pts = line.pts;
  let startIdx = 0;
  // the start line (centreline distance 0)
  for (let i = 1; i < count; i++) if (pts[i].dist < pts[startIdx].dist) startIdx = i;
  let elapsed = 0, speed = 0;
  for (let step = 0; step < count; step++) {
    const target = Math.max(2, prof[startIdx] * pace),
      acc = Math.max(0.6, ACC_EST * (1 - speed / 70));
    speed = Math.min(target, Math.sqrt(speed * speed + 2 * acc * line.sp));
    elapsed += line.sp / Math.max(1, speed);
    startIdx = (startIdx + 1) % count;
    if (elapsed >= seconds || pts[startIdx].dist >= toDist) break;
  }
  const end = pts[startIdx];
  return { x: end.x, y: end.y, h: end.h, v: speed, t: elapsed, dist: end.dist };
}
export function aiPaths(level: Level) {
  const line = racingLine(level);
  return { line, ...level._branches };
}

// ------------------------------------------------ the speed profile (per path, per car model)
// from the car's MEASURED numbers (src/carstats.js, lab surface mu 1.0): gripG = steady cornering
// g, brake100 = metres from 100 km/h
export function carGrip(spec: AiCar["spec"]) {
  // (cast: carstats.js is generated JavaScript, indexed here by a string id)
  const carId = String(spec.id).split('#')[0],
    stats = (CAR_STATS as Record<string, CarStat>)[carId] || {};
  const gripG = stats.gripG || spec.mu * 0.9,
    brakeG = stats.brake100 ? (27.78 * 27.78) / (2 * stats.brake100) / GRAVITY : gripG * 0.8;
  return { id: carId, gripG, brakeG };
}
export function profileOf(
  path: Path, spec: AiCar["spec"], main?: Path, kBo?: number,
): SpeedProfile {
  const { id: carId, gripG, brakeG } = carGrip(spec);
  // aiK (cars.js, optional): a per-car confidence on the plan — a front-heavy AWD road car on loose
  // gravel ran 3 m/s hot into Sweaty Lamb corners and slid off 22 s a lap at Real with the roster's
  // numbers (MEASURED, aidrivecheck; the Subaroo WRZ)
  // (the two casts: debugValue is unknown; the tools set __AI_K / __AI_KB to numbers)
  const aiK = spec.aiK || 1,
    kCorner = (debugValue("AI_K") as number || K_CORNER) * aiK,
    kBrake = (kBo || debugValue("AI_KB") as number || K_BRAKE) * aiK,
    key = carId + ':' + kCorner + ':' + kBrake;
  if (path.prof[key]) return path.prof[key];
  const count = path.n, speed = new Float64Array(count), spacing = path.sp, pts = path.pts;
  for (let i = 0; i < count; i++) {
    const radius = pts[i].R;
    speed[i] = Math.min(95, Math.sqrt(
      kCorner * (radius / (radius + R_TIGHT)) * pts[i].mu * gripG * GRAVITY * radius,
    ));
  }
  if (!path.closed && main)
    speed[count - 1] = Math.min(speed[count - 1], profileOf(main, spec)[path.rejoin!]);
  // backward braking pass (twice round a closed path so it wraps)
  for (let pass = 0; pass < (path.closed ? 2 : 1); pass++)
    for (let i = (path.closed ? count - 1 : count - 2); i >= 0; i--) {
      const nx = speed[(i + 1) % count], decel = kBrake * pts[i].mu * brakeG * GRAVITY;
      speed[i] = Math.min(speed[i], Math.sqrt(nx * nx + 2 * decel * spacing));
    }
  path.prof[key] = speed;
  return speed;
}
