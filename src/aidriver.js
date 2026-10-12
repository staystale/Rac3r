// aidriver.js — THE RACING AI (stage 2, 2026-10-04). (src/autodrive.js stays as the cautious, consistent BENCH driver — the lap tools,
// the menu demo and the rolling-start pace car.)
//
// USER SPEC (2026-10-04): AI know RACING LINES and how to overtake; SURFACE AWARENESS (stay on faster / grippier ground when quicker);
// the difficulty is the CENTRE of a GRADIENT across the field ("some drive better, some quicker, some more defensive, some more
// aggressive"); VARIATION OFF THE LINE grows as difficulty drops ("worse AI more random, better AI like a professional: fast and on line");
// difficulty comes from "how fast, how few mistakes, racing lines, tactics like pit stops and joker laps, deviation from the line"; the AI
// should feel like it's SCRABBLING for victory or making GENUINE SUBTLE DRIVING ERRORS that lead to crashes and / or slower laps; take
// JOKER laps randomly / tactically; AVOID waiting for or crashing into other cars, deviating from its chosen path to do it; on Slidden
// Hill take the TRADITIONAL START (the RX start straight), not a dash to the nearest bit of lap.
//
// 1. RACING LINE, once per level (cached): lateral offsets from the centreline by MINIMUM-CURVATURE descent inside the road
//    (half width - LINE_MARGIN; the inside of a hairpin limited to 0.6 of its radius so the line cannot fold), biased off any
//    cross-section offset whose grip is well below the best there (SURFACE AWARENESS). Corners found on it (runs with R < CORNER_R).
// 2. BRANCH PATHS: the JOKER lane (main line -> joker -> merge back onto the line) and the START lane (an RX start straight off the lap),
//    resampled and rounded, each with its own speed profile.
// 3. SPEED PROFILE per car model (cached per path): sqrt(K_CORNER x mu x gripG x g x R) from the car's MEASURED grip (carstats.js),
//    then a backward braking pass, so the target at any point already brakes for everything ahead.
// 4. DRIVING: Stanley steering onto the path + a lateral target (wander, mistakes, avoidance), target speed = profile x pace.
import { parkMiller } from "./core/random.ts";
import { debugValue, envValue } from "./core/debug.ts";
import "./world/load.ts";   // the world is set up before this file runs (as importing lab.js did)
import { groundAt } from "./world/wear.ts";
import { querySubtrack } from "./world/tyrewall.ts";
import { GRAVITY } from './cars.js';
import { CAR_STATS } from './carstats.js';
import { roadFrame, roadPose, roadSpan } from './highway.js';

const LINE_MARGIN = 1.6;     // m kept from the road edge (car half width ~0.9 + room)
const K_CORNER = 0.88;       // fraction of the measured cornering grip a PRO uses (calibrated: tools/aidrivecheck.mjs, clean at 0.88)
const K_BRAKE = 0.70;        // fraction of grip planned for braking (0.80 arrived 4 m/s hot into Sweaty Lamb's S on gravel, MEASURED)
const R_TIGHT = 6;           // m: hairpins get less of the grip, kC x R / (R + R_TIGHT) (Slidden's R 10 hairpin: full lock, still wide)
const WANDER_EDGE = 1.1;     // m: the lateral target never puts the car's centre closer than this to the road edge
const ATK_KB = 0.12;         // extra braking grip planned while ATTACKING (late braking into the corner)
const YIELD = 0.05;          // speed given up to a car alongside on the inside (x 1.2 - defence)
const ALONG_GAP = 2.7;       // m kept from a car alongside by an attack or a cover move
const HB_R = 25, HB_LOOSE = 8, HB_TURN = 1.4, HB_T = 0.25;   // handbrake turns: apex R (m, + HB_LOOSE on loose ground), corner turn (rad), pull (s).
// MEASURED (aidrivecheck, HB on/off, Realish + Real, hatch + 4x4): Slidden / Knobhill / Castle Cum within 0.1 s, Sweaty Lamb +0.2..+0.7 s,
// 6 pulls per 2 min at Slidden, 4 at Sweaty Lamb — it is FLAVOUR (the user's "drift and stuff"), not pace. A heading-error trigger fired ~never.
const WIDE = +(debugValue("WIDE") ?? 0.8), WIDE_SLOW = 2.5;   // m past the usual edge allowed to get round a car / a slow or stopped one
const OBST_LINE = 1.6;     // m from an object on the road to the racing line (car half width 0.9 + tracking error)
const OBST_CLEAR = 1.1;      // m: a loose object closer than r + this to my lateral target is in the way (half a car + margin)
const UNDER_LOOSE = 0.35;    // throttle kept through a front slide on loose ground (off road, dirt, gravel)
const MU_SMOOTH = 20;   // m: the grip map is averaged along the track this far each way for the line's surface bias
// MEASURED (aifieldsuite Realish, 24 races): before start-contacts 765, contact 231 s, resets 14, passes 118; 6 s / 0.8 m: 564, 258 s, 17,
// 219; 9 s / 1.3 m (kept): 492, 212 s, 9, 192 (off-road +12 %)
const START_BLEND = 9, START_GAP = 1.3;   // s to ease from the grid lane onto the line; m more room alongside then
const DRIFT_SLIP = 0.22, DRIFT_MAX = 0.4, DRIFT_R = 35;   // + only in corners with an apex tighter than DRIFT_R m (hairpins / junctions)   // rad: the rear slip a drifting AI holds, and where it gives up and catches it
const EDGE_DRIFT = 2.0, DRIFT_BAN = 60;
// NEVER WAIT (user, 2026-10-07: "patience they should never really wait imo, just try harder and go faster"): seconds of being held up before
// a pass is tried were 0.3-1.5 s (by aggression), now 0.15-0.6; the chance to commit to one per corner 30-90 % -> 60-100 %; and sat behind
// a car it PUSHES HARDER, up to HARDER faster the longer it is held.
const DRIVE_OUT_T = 1.2, HARDER = 0.03, HARDER_T = 4;
const CORNER_R = 70;         // m: line radius under which a stretch counts as a corner (mistakes are drawn per corner)

// ---- the 5 difficulties (PLAN.md §4): the CENTRE of the field's spread. pace = fraction of the profile; lineQ = how much of the racing
// line's width they use (the rest: nearer the middle); wander = m of slow drift off it; mistake = chance per corner of an error;
// slip = chance of a joker-tactics blunder (forgetting it, so +30 s).
export const DIFFICULTIES = [
  { id: 'mobile', name: 'Mobile game', pace: 0.80, lineQ: 0.55, wander: 1.8, mistake: 0.20, slip: 0.12 },
  { id: 'game', name: 'Game', pace: 0.86, lineQ: 0.72, wander: 1.2, mistake: 0.12, slip: 0.06 },
  { id: 'realish', name: 'Realish', pace: 0.91, lineQ: 0.86, wander: 0.7, mistake: 0.07, slip: 0.02 },
  { id: 'rich', name: "Real but you're rich", pace: 0.95, lineQ: 0.94, wander: 0.35, mistake: 0.035, slip: 0.005 },
  { id: 'real', name: 'Real', pace: 0.985, lineQ: 1.0, wander: 0.12, mistake: 0.015, slip: 0 },
];
// the GRADIENT: each AI is one PERSONALITY (user: "some drive better / some quicker / some more defensive / some more aggressive"),
// dealt round the field from a seed, plus a little noise, all centred on the chosen difficulty.
const PERSONAS = [
  { id: 'quick', pace: +0.02, skill: -0.15, aggression: 0.6, defence: 0.4 },        // faster, ragged
  { id: 'steady', pace: -0.015, skill: +0.3, aggression: 0.3, defence: 0.5 },      // drives better: on line, few errors
  { id: 'aggressive', pace: +0.01, skill: -0.05, aggression: 0.9, defence: 0.3 },  // goes for gaps, follows close, bumps
  { id: 'defensive', pace: -0.005, skill: +0.1, aggression: 0.25, defence: 0.9 },  // covers the inside, hard to pass
  { id: 'balanced', pace: 0, skill: 0, aggression: 0.5, defence: 0.5 },
];
export function aiTraits(diffIndex, i, n, seed = 1) {
  const D = DIFFICULTIES[Math.max(0, Math.min(4, diffIndex | 0))];
  let sd = (seed * 48271 + i * 7919 + 13) % 2147483647 || 1; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const P = PERSONAS[(i + Math.floor(seed)) % PERSONAS.length];
  const skill = Math.max(0, Math.min(1, 0.5 + P.skill + (rnd() - 0.5) * 0.3));
  const loose = 1.4 - skill * 0.8;   // 0.6 (skill 1) .. 1.4 (skill 0)
  return {
    diff: D.id, persona: P.id, skill,
    // PRECISION (user, 2026-10-04: "a little bit messy is good, but tighter, faster driving at harder difficulty, like real life";
    // "crashing should reduce with higher difficulty"): 0 Mobile .. 1 Real, nudged by skill. Tighter gaps, and the car ahead's braking
    // for the corner is ANTICIPATED (below) instead of reacted to.
    prec: Math.max(0, Math.min(1, (diffIndex | 0) / 4 + (skill - 0.5) * 0.2)),
    pace: Math.min(1, D.pace * (1 + P.pace + (rnd() - 0.5) * 0.01)),
    lineQ: Math.min(1, D.lineQ + (skill - 0.5) * 0.1),
    wander: D.wander * loose, mistake: D.mistake * loose, slip: D.slip * loose,
    aggression: Math.max(0, Math.min(1, P.aggression + (rnd() - 0.5) * 0.2)),
    defence: Math.max(0, Math.min(1, P.defence + (rnd() - 0.5) * 0.2)),
    seed: sd,
  };
}

// ---------------------------------------------------------------- paths
// headings, radius over ~8 m, surface mu at every point
function finishPath(pts, closed, total) {
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

export function racingLine(level) {
  if (level._line) return level._line;
  const sub = level.subtrack, P = sub.pts, n = P.length, hw = sub.width / 2, b = Math.max(0.5, hw - LINE_MARGIN);
  // grip across the road at every point (1 m lateral steps): mu of whatever is there
  const lat = []; for (let o = -b; o <= b + 1e-6; o += 1) lat.push(+o.toFixed(2));
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
  const smooth = (k, iters) => {
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
  const pts = P.map((p, i) => ({ x: p.x + p.nx * off[i], y: p.y + p.ny * off[i], nx: p.nx, ny: p.ny, dist: p.dist, off: off[i] }));
  const path = finishPath(pts, true, sub.totalDist);
  // CORNERS: runs of R < CORNER_R (scanning from a straight so a corner across the line is one run); apex = tightest point
  const cid = new Int32Array(n).fill(-1), corners = [];
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
function openPath(xy, rounds = 40) {
  const out = [];
  for (let s = 0; s < xy.length - 1; s++) {
    const [ax, ay] = xy[s], [bx, by] = xy[s + 1], L = Math.hypot(bx - ax, by - ay); if (L < 1e-3) continue;
    for (let t = 0; t < L; t += 1) out.push({ x: ax + (bx - ax) * t / L, y: ay + (by - ay) * t / L });
  }
  out.push({ x: xy[xy.length - 1][0], y: xy[xy.length - 1][1] });
  for (let r = 0; r < rounds; r++) for (let i = 1; i < out.length - 1; i++) { out[i].x = 0.5 * out[i].x + 0.25 * (out[i - 1].x + out[i + 1].x); out[i].y = 0.5 * out[i].y + 0.25 * (out[i - 1].y + out[i + 1].y); }
  let total = 0; for (let i = 1; i < out.length; i++) total += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
  return { pts: out, total };
}
const nearestIdx = (pts, x, y) => { let bi = 0, bd = Infinity; for (let i = 0; i < pts.length; i++) { const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
// a BRANCH: (main line for preM metres before entryI) -> the lane -> (merge onto the main line postA..postB metres after exitI)
function branch(L, laneXY, entryI, exitI, preM = 25, postA = 15, postB = 35, rounds = 40) {
  const n = L.n, sp = L.sp, M = L.pts, raw = [];
  if (entryI >= 0) for (let d = preM; d > 0; d -= 1) { const p = M[(entryI - Math.round(d / sp) + n * 4) % n]; raw.push([p.x, p.y]); }
  raw.push(...laneXY);
  for (let d = postA; d <= postB; d += 1) { const p = M[(exitI + Math.round(d / sp)) % n]; raw.push([p.x, p.y]); }
  const o = openPath(raw, rounds), path = finishPath(o.pts, false, o.total);
  path.switchI = entryI >= 0 ? (entryI - Math.round(preM / sp) + n * 4) % n : -1;   // the main-line index where it leaves
  path.rejoin = (exitI + Math.round(postB / sp)) % n;
  return path;
}
function branches(level, L) {
  const out = {}, lanes = level.lanes || [], hw = level.subtrack.width / 2;
  const laneDist = (lane, x, y) => { let bd = Infinity; const P = lane.pts; for (let i = 0; i < P.length - 1; i++) { const [ax, ay] = P[i], [bx, by] = P[i + 1], vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2)); bd = Math.min(bd, Math.hypot(ax + vx * t - x, ay + vy * t - y)); } return bd; };
  const J = level.joker;
  if (J) {
    const lane = lanes.find((l) => laneDist(l, J.gate.x, J.gate.y) < l.width / 2 + 1);
    if (lane) { const P = lane.pts, xy = P.map(([x, y]) => [x, y]);
      out.joker = branch(L, xy, nearestIdx(L.pts, P[0][0], P[0][1]), nearestIdx(L.pts, P[P.length - 1][0], P[P.length - 1][1]), 25, 15, 35, 25); }
  }
  // the START lane: the lane the spawn sits on, when the spawn is off the lap (Slidden Hill's RX start straight)
  const s = level.spawn;
  if (s && querySubtrack(level.subtrack, s.x, s.y).dist > hw) {
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
export function lineRun(level, spec, pace, T, toDist = Infinity) {
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
export function aiPaths(level) { const L = racingLine(level); return { line: L, ...level._branches }; }

// ---------------------------------------------------------------- the speed profile (per path, per car model)
// from the car's MEASURED numbers (src/carstats.js, lab surface mu 1.0): gripG = steady cornering g, brake100 = metres from 100 km/h
function carGrip(spec) {
  const id = String(spec.id).split('#')[0], cs = CAR_STATS[id] || {};
  const gripG = cs.gripG || spec.mu * 0.9, brakeG = cs.brake100 ? (27.78 * 27.78) / (2 * cs.brake100) / GRAVITY : gripG * 0.8;
  return { id, gripG, brakeG };
}
function profileOf(path, spec, main, kBo) {
  const { id, gripG, brakeG } = carGrip(spec);
  // aiK (cars.js, optional): a per-car confidence on the plan — a front-heavy AWD road car on loose gravel ran 3 m/s hot into Sweaty Lamb
  // corners and slid off 22 s a lap at Real with the roster's numbers (MEASURED, aidrivecheck; the Subaroo WRZ)
  const ak = spec.aiK || 1, kC = (debugValue("AI_K") || K_CORNER) * ak, kB = (kBo || debugValue("AI_KB") || K_BRAKE) * ak, key = id + ':' + kC + ':' + kB;
  if (path.prof[key]) return path.prof[key];
  const n = path.n, v = new Float64Array(n), ds = path.sp, P = path.pts;
  for (let i = 0; i < n; i++) { const r = P[i].R; v[i] = Math.min(95, Math.sqrt(kC * (r / (r + R_TIGHT)) * P[i].mu * gripG * GRAVITY * r)); }
  if (!path.closed && main) v[n - 1] = Math.min(v[n - 1], profileOf(main, spec)[path.rejoin]);
  // backward braking pass (twice round a closed path so it wraps)
  for (let pass = 0; pass < (path.closed ? 2 : 1); pass++) for (let i = (path.closed ? n - 1 : n - 2); i >= 0; i--) {
    const nx = v[(i + 1) % n], a = kB * P[i].mu * brakeG * GRAVITY;
    v[i] = Math.min(v[i], Math.sqrt(nx * nx + 2 * a * ds));
  }
  path.prof[key] = v;
  return v;
}

// ---------------------------------------------------------------- DRIVE ITSELF OUT (both roads)
// Nearly still for DRIVE_OUT_T s after the green (nose in a wall, beached, tangled) -> REVERSE ~1-1.5 s with the wheel turned to swing
// the nose back toward the road direction roadH(); three tries inside 15 s and still stuck -> st.giveUp: main.js resets it (last resort).
// Returns the reversing controls, or null = drive on. (NOOUT=1 env: node A/B only - proves the highway merge changed nothing else)
const NOOUT = !!envValue("NOOUT");
function driveOut(st, car, v, dt, ctx, rnd, roadH) {
  if (ctx.hold || !(st.t > 3) || NOOUT) return null;
  if (st.t < (st.revUntil || 0)) {
    let e = roadH() - car.heading; e = Math.atan2(Math.sin(e), Math.cos(e));
    return { steer: -Math.sign(e || 1), throttle: 0, brake: 0, handbrake: 0, reverse: 1 };
  }
  st.slowT = v < 1.5 ? (st.slowT || 0) + dt : 0;
  if (st.slowT > DRIVE_OUT_T) { st.slowT = 0; st.revUntil = st.t + 1 + 0.5 * rnd(); st.nOut = (st.nOut || 0) + 1;
    st.outN = st.t - (st.outAt ?? -99) < 15 ? (st.outN || 0) + 1 : 1; st.outAt = st.t; if (st.outN >= 3) st.giveUp = true; }
  return null;
}

// ---------------------------------------------------------------- THE HIGHWAY (endless level): the road read through highway.js
// AI ROUND 2 stage 1 (user, 2026-10-07: "same ai"; CLAUDE.md ONE SYSTEM NOT TWO THEN ONE): this was hwrace.js createHwDriver. It is now
// this file's road reader for levels with no closed lap (level.endless), behind the ONE entry point createAIDriver; moved UNCHANGED
// (MEASURED: weavecheck + pacesuite identical to before with __NOOUT) plus the shared drive-out. Later stages share more (mistakes, skill).
const LAT_R = 3.0;                    // m/s the lateral target moves (x1.8 in an emergency); traffic changes lane at 0.9
const G = 9.81;
const IDLE = { steer: 0, throttle: 0, brake: 0.3, handbrake: 0, reverse: 0 };
// the RACER — v2, a WEAVER (user, 2026-10-05: "AI on highways should IGNORE LANES and go FAST, DODGING traffic and WEAVING through like
// the player would"). No lanes: across the whole carriageway (hard shoulder included) it tries N_LINES lateral lines a few times a
// second and scores each by how much free road it has: every car ahead within 220 m whose body (+ a margin) overlaps the line blocks
// it at its gap; the line with the most road wins, with a cost for a big swerve and a bonus for staying put (no dithering), and never a
// line on the far side of a car right alongside. It steers for that line (Stanley, as autodrive.js — the controller that holds this
// road), the lateral target moving at LAT_R so a swerve is a car's swerve. Speed: corner speed from the road's curvature, flat out
// otherwise; it brakes only while its line is still blocked (braking-distance following), and hard when a crash is close.
// traits = aidriver.js aiTraits (pace, prec, wander, aggression). ctx = { cars: everyone else (with _hwf), hold: keep station (the
// rolling start: follow, no swerving) }
const N_LINES = 11, MARGIN = 0.55, LOOK_T = 3.2, EDGE_M = 1.8;
// A/B tuning from the node tools only (HWT='{"kC":0.5}'); the browser has no process -> {}
const HWT = envValue("HWT") ? JSON.parse(envValue("HWT")) : {};
function roadDriver(lv, traits, rnd) {
  const st = { line: null, tgt: null, think: 0, ph: (traits.seed || 1) % 100, t: 0 };
  const pace01 = Math.max(0, Math.min(1, (traits.pace - 0.8) / 0.185));
  // CORNER GRIP: a share of tarmac mu x the car's mu (the bench driver's 0.40; 0.38 Mobile .. 0.50 Real). MEASURED (hwracecheck): 0.6 x
  // gripG planned 0.8 g at 230 km/h on an R 500 and the field ran wide - the car's real grip at that speed is lower
  // RACING, NOT A SUNDAY DRIVE (user, 2026-10-06: "they seem slow ... make them faster and just try n handle it"; MEASURED pacesuite, 18
  // races, vs the mirror-only build: mean 133.4 -> 138.2 km/h, under-130 40 -> 35 %, bad races 2 -> 1; weavecheck 0 spins, 1-2 of 45
  // close passes clip at 150 km/h): throttle floor 0.85 (was 0.6), corner share 0.42-0.54 (was 0.33-0.42), follow decel 0.55 g share,
  // turn feathering only for yaw BEYOND the road's own bend, lane-changing traffic blocks the lane it is going to, verge dodges
  const thrMax = (HWT.thr ?? 0.85) + (1 - (HWT.thr ?? 0.85)) * pace01, kC = (HWT.kC ?? 0.42) + (HWT.kCp ?? 0.12) * (traits.prec ?? 0.5), kB = (HWT.kB ?? 0.45) + 0.15 * (traits.prec ?? 0.5);
  const agg = traits.aggression ?? 0.5, margin = MARGIN + 0.25 * (1 - (traits.prec ?? 0.5));   // sloppier drivers leave more room
  function drive(c, dt = 1 / 120, ctx = {}) {
    if (!lv._hw) return IDLE;
    const f = c._hwf; if (!f) return IDLE;
    const P = lv._hw.pts, v = Math.hypot(c.vx, c.vy), vAl = f.v, hold = !!ctx.hold;
    const { s0, s1 } = roadSpan(lv);
    if (f.s > s1 - 40 || f.s < s0 + 20) return IDLE;   // past the road that exists (only once a race has ended)
    st.t += dt;
    // DRIVE ITSELF OUT (shared with the circuit driver: driveOut) - the highway had none before AI ROUND 2
    { const o = driveOut(st, c, v, dt, ctx, rnd, () => roadPose(lv, f.s, 0).h); if (o) return o; }
    // the hard shoulder is road too, as for a player; lines stay EDGE_M inside the edges (MEASURED hwracecheck: a 1 m margin on the
    // outside of an R 730 at 227 km/h ran 1.5 m wide onto the grass)
    const geo = lv._hw.geo, lo = -geo.hw + EDGE_M, hi = geo.hw - EDGE_M;
    // THE VERGE DODGE (user, 2026-10-06: "ai should go off road to dodge if its quicker, just not too far obviously"): two more lines,
    // VERGE m past each edge (half the car on the grass), only worth taking when the road is blocked: VERGE_COST + the grip it costs.
    // Never on the outside of a bend (armco there at hw + 1.8: highway.js) or on a walled preset. vLo / vHi = how far the line may go.
    const kNow = (P[Math.max(0, Math.min(P.length - 1, Math.round((f.s - P[0].s) / 4) + Math.round(vAl * 1.5 / 4)))] || {}).curv || 0;
    const vgOK = (HWT.verge ?? 1) && !lv._cfg.walls && !hold, vLo = vgOK && Math.abs(kNow) < 1 / 1500 ? -geo.hw + (HWT.vgm ?? 0.9) : lo, vHi = vgOK && Math.abs(kNow) < 1 / 1500 ? geo.hw - (HWT.vgm ?? 0.9) : hi;
    if (st.line == null) { st.line = st.base = Math.max(lo, Math.min(hi, f.off)); st.tgt = st.line; }
    const cars = ctx.cars || [], myW = c.spec.wid / 2;
    // ---- SPEED from the curvature ahead (v^2 = kC mu g R, with a kB mu g braking allowance)
    const mu = 0.94 * (c.spec.mu || 1), i0 = Math.round((f.s - P[0].s) / 4);
    let vT = 95;
    for (let d = 4; d < 30 + v * 2.6; d += 8) { const i = Math.min(P.length - 1, i0 + Math.round(d / 4)); if (i < 0) continue;
      const R = 1 / Math.max(1e-5, Math.abs(P[i].curv || 0)), vc = Math.sqrt(kC * mu * G * R); vT = Math.min(vT, Math.sqrt(vc * vc + 2 * kB * mu * G * d)); }
    const vCorner = vT;
    // what blocks a lateral line `off`: the nearest car ahead whose body (+ margin) overlaps it -> { gap, v } (gap 0 = alongside), or
    // a car right beside us on that side (side: we cannot swerve through it)
    const blockOn = (off) => {
      let B = null;
      for (const o of cars) { const g = o._hwf; if (!g) continue; const ds = g.s - f.s; if (ds < -6 || ds > 220) continue;
        // WHERE IT WILL BE (HWT.pred): a lane-changing traffic car blocks its target lane too, from now (it is going there)
        const tr = (HWT.pred ?? 1) && o._trOff != null && Math.abs(o._trOff - g.off) > 0.3 ? o._trOff : null;
        if (tr != null && ds > (c.spec.len + o.spec.len) / 2 + 1) { const hw2 = myW + o.spec.wid / 2 + margin; if (Math.abs(tr - off) < hw2 && Math.abs(g.off - off) >= hw2) { const gp = ds - (c.spec.len + o.spec.len) / 2; if (!B || gp < B.gap) B = { gap: gp, v: g.v, o }; } }
        // the margin GROWS with the closing speed (MEASURED weavecheck, Real: 0.55 m margin + ~0.5 m tracking error = a car's line that clips
      // the slow car at 75 km/h closing): 0.4 m more per 10 m/s closing
      const halfW = myW + o.spec.wid / 2 + margin + Math.min(HWT.mcap ?? 99, 0.04 * Math.max(0, vAl - g.v)), beside = ds < (c.spec.len + o.spec.len) / 2 + 1;
        if (beside) {
          const side = Math.sign(g.off - f.off), far = Math.sign(off - f.off) === side && Math.abs(off - f.off) > Math.abs(g.off - f.off) - halfW;
          if (far || Math.abs(g.off - off) < halfW) return { gap: 0, v: g.v, side: far, o };
          continue;
        }
        const gap = ds - (c.spec.len + o.spec.len) / 2;
        if (Math.abs(g.off - off) < halfW && (!B || gap < B.gap)) B = { gap, v: g.v, o };
      }
      return B;
    };
    // THE MIRROR: a FASTER car coming up from behind blocks a line it is on if it would arrive within MIR_T s (MEASURED hwracecheck seed 77,
    // Realish: a racer at 145 km/h moved 4.4 m left into the line of one 18 m back at 177 km/h - the one behind braked on the hard shoulder,
    // spun, and both left the road; the driver only ever looked at cars ahead, > 6 m back did not exist)
    const mirT = HWT.mir ?? 2.5;   // (MEASURED pacesuite, 18 races: bad runs 7 -> 2, off-road car-steps 13079 -> 4006, mean 126.7 -> 133.4 km/h)
    const mirror = (off) => {
      if (!mirT) return false;
      for (const o of cars) { const g = o._hwf; if (!g) continue; const ds = g.s - f.s, len = (c.spec.len + o.spec.len) / 2; if (ds > len + 1 || ds < -60) continue;
        const close = g.v - vAl; if (close < 0.5 && ds < -len) continue;
        if (ds < -len && (-ds - len) / close > mirT) continue;
        if (Math.abs(g.off - off) < myW + o.spec.wid / 2 + margin) return true; }
      return false;
    };
    // how far across one decision may take us: ~0.6 g sideways at low speed, falling with speed (2.5 m at 240 km/h)
    const reach = Math.max(2.5, Math.min(hi - lo, (14 - v * 0.17) * (HWT.rch ?? 1)));
    // ---- CHOOSE A LINE a few times a second (not while holding station)
    if ((st.think -= dt) <= 0) {
      st.think = 0.08 + 0.14 * (1 - agg);
      if (!hold) {
        let best = st.line, bestScore = -Infinity, bestRaw = 0; st.free = null; const wy = { raw: -Infinity, off: 0, why: '' };
        for (let k = 0; k <= N_LINES + 2; k++) {
          const off = k === N_LINES ? st.base : k === N_LINES + 1 ? vLo : k === N_LINES + 2 ? vHi : lo + (hi - lo) * k / (N_LINES - 1);
          if (k > N_LINES && (off === lo || off === hi)) continue;
          const B = blockOn(off);
          // free road along it: unblocked = LOOK_T s of road (+ a bonus); blocked = the gap + what is kept of the blocker's speed
          let score = B ? (B.side ? -999 : Math.min(B.gap, vAl * LOOK_T) + Math.max(0, B.v) * 1.2) : vAl * LOOK_T + 60;
          // NO QUEUEING BEHIND A RIVAL (HWT.rp): a line whose blocker is ANOTHER RACER close ahead is worth less, so it pulls out and
          // races it side by side instead of sitting in its slipstream
          // (user, 2026-10-06: "they tend to que in lanes on the highway still ... weave through traffic like a real street racer").
          // OFF BY DEFAULT - not proven (HANDOVER §3). MEASURED pacesuite, 9 races x seed sets A (4242,77,1234) / B (31,555,9001):
          // baseline 151.0 / 139.3 km/h; rp 40 + cm 12 + mvk 0.6 = 154.0 / 136.1, 0 bad, BUT weavecheck 9 of 45 hit (baseline 0)
          if (B && !B.side && B.o && !B.o.traffic && B.gap < 60) score -= (HWT.rp ?? 0) * (1 - B.gap / 60);
          // (MEASURED weavecheck: costed from where the car IS, any tracking lag dragged the plan after it - toward the car being passed)
          const move = Math.abs(off - st.base) + 0.3 * Math.abs(off - f.off), raw = score;
          if (raw > wy.raw) { wy.raw = raw; wy.off = off; wy.why = Math.abs(off - f.off) > reach ? 'reach' : 'cost'; }
          // REACH: no line further across than a swerve can make in ~1.5 s at this speed (MEASURED weavecheck: a 7 m jump asked at 240 km/h
          // put the car 18 deg to the road and into the grass)
          // a line FURTHER than reach is headed for in reach-sized STEPS (the plan re-thinks every ~0.15 s), if the step point is clear
          let aim = off;
          if (Math.abs(off - f.off) > reach) { if (!HWT.step) continue; aim = f.off + Math.sign(off - f.off) * reach;
            const Sb = blockOn(aim); if (Sb && (Sb.side || Sb.gap < 4 + 2 * Math.max(0, vAl - Sb.v))) continue; }
          // swerving costs; the line already chosen is worth a lot (COMMIT: MEASURED weavecheck, a 6 m bonus let it flip between two lines
          // 3 m apart every 0.2 s and slalom into the car it was passing)
          // swerve cost x HWT.mvk, commit bonus HWT.cm (defaults = the shipped behaviour). A looser setting was tried (2026-10-06, the
          // queueing) - MEASURED weavecheck hits of 45: cm 12 / mvk 0.6 = 9, cm 25 / mvk 0.6 = 8, cm 25 / mvk 0.8 = 2, default = 0
          score -= move * (1.5 + v * 0.05) * (HWT.mvk ?? 1) - (Math.abs(off - st.base) < 0.6 ? (HWT.cm ?? 25) : 0);
          if (off < -geo.hw + lv._cfg.shoulder) score -= 8;                              // the hard shoulder: a last resort
          if (off < lo - 0.1 || off > hi + 0.1) score -= (HWT.vgc ?? 40);              // the verge: only when it is clearly quicker
          if (Math.abs(aim - f.off) > 1.2) { const mid = blockOn((aim + f.off) / 2); if (mid && mid.gap < 1) { score -= 400; if (wy.off === off) wy.why = 'mid'; } }
          if (Math.abs(aim - f.off) > (HWT.mth ?? 1.2) && (mirror(aim) || mirror((aim + f.off) / 2))) { score -= 400; if (wy.off === off) wy.why = 'mirror'; }
          if (aim !== off && wy.off === off) wy.why = 'stepped';   // the way across must be open
          if (!B && (!st.free || Math.abs(off - f.off) < Math.abs(st.free.off - f.off))) st.free = { off, score };
          if (score > bestScore) { bestScore = score; best = aim; bestRaw = raw; }
        }
        st.base = best; st.why = { ...wy, chosen: best, chosenRaw: bestRaw };
      }
    }
    // a little WANDER (difficulty) on top of the plan - NOT folded into it (MEASURED weavecheck: added to the plan at every re-think it
    // accumulated and walked the line into the car being passed)
    // ABORT a swerve already under way when the mirror shows a car closing on the side it is moving to (MEASURED hwracecheck seed 1234,
    // Real: the line was chosen while the road was clear; a car 30 km/h quicker came up into it 0.3 s later and they touched side to side)
    if (mirT && (HWT.abort ?? 1) && Math.abs(st.tv || 0) > 0.2 && mirror(st.tgt + Math.sign(st.tv) * 0.6)) { st.base = st.tgt; st.think = Math.min(st.think, 0.05); }
    st.line = Math.max(vLo, Math.min(vHi, st.base + Math.sin(st.t * 0.4 + st.ph) * Math.min(0.4, (traits.wander || 0) * 0.2)));
    // the lateral target eases toward the chosen line at LAT_R (faster when a crash is close: a real swerve)
    const here = blockOn(st.tgt), urgent = here && here.gap < 6 + Math.max(0, vAl - here.v) * 0.8;
    // A SWERVE HAS INERTIA: the target's sideways speed ramps at aLat (a share of grip) and eases in to stop on the line. MEASURED
    // (hwracecheck, Real difficulty): an instant 6.5 m/s sideways step spun cars at 150 km/h on a straight (rear slip 0.6 rad)
    const latR = LAT_R * (urgent ? 1.6 : 1) * (0.8 + 0.4 * agg), aLat = (urgent ? 0.3 : 0.18) * mu * G, d = st.line - st.tgt;
    const vWant = Math.sign(d) * Math.min(latR, Math.sqrt(2 * aLat * Math.abs(d)));
    st.tv = (st.tv || 0) + Math.max(-aLat * dt, Math.min(aLat * dt, vWant - (st.tv || 0)));
    st.tgt += st.tv * dt; if (Math.abs(d) < 0.02 && Math.abs(st.tv) < 0.2) { st.tgt = st.line; st.tv = 0; }
    // ---- BRAKE only for what is still in the way where we are / are going (braking-distance following; MEASURED in v1: a linear law
    // asked ~2 g at a 140 km/h closing speed -> lock-ups and spins)
    let brakeX = 0;
    // where we ARE only counts if the swerve cannot get us clear before we arrive (MEASURED weavecheck: braking for the car 120 m ahead
    // in the lane we were LEAVING cost 60 km/h on every pass): time to clear = the sideways distance still to go / the swerve rate
    // (the swerve's real time: from rest at aLat, d = a t^2 / 2 -> t = sqrt(2 d / a), + reaction)
    const now = blockOn(f.off), dGo = Math.abs(st.line - f.off), tClear = dGo > 0.3 ? 0.3 + Math.sqrt(2 * dGo / (0.25 * mu * G)) : Infinity;
    let fol = null;
    for (const B of [here, now && now.gap / Math.max(1, vAl - now.v) < tClear ? now : null]) { if (!B || B.side) continue;
      const want = 2.5 + (hold ? 0.6 : (HWT.wt ?? 0.22)) * Math.max(0, vAl), aB = (HWT.aB ?? 0.55) * mu * G, room = B.gap - want;
      if (!fol || B.gap < fol.gap) fol = B;
      vT = Math.min(vT, room > 0 ? Math.sqrt(Math.max(0, B.v) ** 2 + 2 * aB * room) : Math.max(HWT.fl != null ? B.v * HWT.fl : 0, B.v + room * (HWT.rk ?? 0.7)));
      const close = vAl - B.v; if (close > 0.5) { const ttc = B.gap / close; if (ttc < 1.3) brakeX = Math.max(brakeX, Math.min(1, (1.3 - ttc) / 1.0)); } }
    const offT = Math.max(vLo, Math.min(vHi, st.tgt)), vFollow = vT;
    // RUNNING WIDE (past the line limits): lift, as a driver would - 3 m/s under what it is doing per metre out (on a verge dodge the
    // limit is the verge line; the grass itself already costs grip, so only past THAT)
    { const lim = f.off < 0 ? -vLo : vHi, out = Math.abs(f.off) - lim; if (out > 0.3) vT = Math.min(vT, vAl - 3 * out); }
    // on the grass: no more than VERGE_V m/s faster than the car being passed (a dodge, not a lap of the field)
    if (Math.abs(f.off) > geo.hw - 0.6 && fol) vT = Math.min(vT, Math.max(fol.v + (HWT.vgv ?? 8), vAl - 2));
    // ---- STEER: the STANLEY controller of autodrive.js on the target line: heading error to the road a little ahead + the front
    // axle's cross-track error + yaw damping. MEASURED (hwracecheck, v1): pure pursuit weaved +-1 m and ran 7 m wide out of an R 500.
    // (the front axle's road frame from the car's own frame + its heading: a SECOND roadFrame search per step snapped to the wrong
    // road point and read the car 2 m off where it was - MEASURED weavecheck: the car drifted onto a car it had chosen to pass)
    const hRoad = roadPose(lv, f.s, 0).h, rel = c.heading - hRoad, ff = { s: f.s + Math.cos(rel) * c.spec.lf, off: f.off + Math.sin(rel) * c.spec.lf };
    const ah = roadPose(lv, ff.s + 2 + v * 0.15, offT);
    // + the swerve's own sideways speed as a FEED-FORWARD heading (without it the car lagged the moving target, then overshot: spins)
    // (an extra AIM term at the line ahead was tried: MEASURED weavecheck, spins in 17 of 45 scenarios - Stanley's own gain stays)
    // COURSE, not heading (MEASURED weavecheck: in a bend the car's sideslip, ~1 deg at 180 km/h, left a steady 0.5 m drift off the line
    // that Stanley's heading term never saw - and it drifted into the car it was passing): the angle the car is actually TRAVELLING at
    const course = v > 3 ? Math.atan2(c.vy, c.vx) : c.heading;
    let psi = ah.h + Math.atan2(st.tv || 0, v + 1) - course; psi = Math.atan2(Math.sin(psi), Math.cos(psi));
    const cross = ff.off - offT, LOCK = c.spec.steerMax || 0.56;
    // the HEADING to the road is capped by speed (a swerve at 240 km/h is a few degrees, not 18), and the car's own sideways speed across
    // the road is damped toward the target's (MEASURED weavecheck: lateral momentum carried it 30 m into the grass)
    const relH = Math.atan2(Math.sin(c.heading - hRoad), Math.cos(c.heading - hRoad)), hMax = Math.max(0.05, Math.min(0.35, 4 / Math.max(1, v)));
    // YAW DAMPING on the ACTUAL yaw rate vs the road's (MEASURED weavecheck, Real: at 200 km/h the car rotated 0.4 rad/s through the
    // line while Stanley's psi still pointed across - yaw kept building into a 35 deg slide). The car should turn with the road plus
    // what the swerve needs; anything beyond that is countered.
    const latVel = vAl * Math.sin(relH), latErr = latVel - (st.tv || 0), yawRoad = vAl * (P[Math.max(0, Math.min(P.length - 1, i0))].curv || 0);
    let deltaS = psi + Math.atan2(-1.2 * cross, v + 2) - 0.03 * (c.yawRate - v * Math.tan(c.delta) / c.spec.L) - 0.02 * latErr - 0.12 * (c.yawRate - yawRoad);
    if (relH > hMax) deltaS = Math.min(deltaS, -(relH - hMax) * 2); else if (relH < -hMax) deltaS = Math.max(deltaS, (-hMax - relH) * 2);
    // COUNTER-STEER a sliding rear: the slip angle itself, as a driver catches it (and hold off the brakes, below)
    const sR = (c.t && c.t.slipR) || 0; if (Math.abs(sR) > 0.08) deltaS -= sR * 0.9;
    const cap = Math.min(1, (1.6 * c.spec.L * mu * G / Math.max(4, v * v)) / LOCK + 0.02);
    const steer = Math.max(-cap, Math.min(cap, deltaS / LOCK));
    // brake eased while steering (autodrive.js: a 35 % floor), so an emergency stop in a swerve does not lock it into a slide
    const e = vT - vAl, brake = Math.max(brakeX, e < -1 ? Math.min(1, -e * 0.15) : 0) * Math.max(0.35, 1 - Math.abs(steer) / 0.25);
    const slide = Math.abs((c.t && c.t.slipR) || 0), feel = slide > 0.12 ? 0.4 : 1;   // ease off while the rear slides
    // GAS IN A SWERVE: a rear-drive car at full throttle mid-swerve steps out (MEASURED weavecheck, Real difficulty, 200 km/h: rear slip
    // 0.3-0.8 rad in 9 of 45 scenarios); the throttle is capped by how hard it is turning, as a driver would feather it
    const turn = (HWT.tx ?? 1) ? Math.min(1, Math.max(Math.abs(c.yawRate - yawRoad) * Math.max(1, v) / ((HWT.tn ?? 0.8) * mu * G), (Math.abs(c.yawRate) * Math.max(1, v) - (HWT.tc ?? 0.45) * mu * G) / (0.3 * mu * G)))
      : Math.min(1, Math.abs(c.yawRate) * Math.max(1, v) / ((HWT.tn ?? 0.5) * mu * G)), thrCap = thrMax * (1 - 0.6 * turn);
    st.dbg = { fol, vT, vCorner, vFollow, brakeX, thrCap, turn, e, feel };   // (read by the node tools only)
    return { steer, throttle: brake > 0 || e <= 0 ? 0 : Math.min(thrCap, e * 0.35) * feel, brake, handbrake: 0, reverse: 0 };
  }
  return { drive, traits, state: st, relocate: () => { st.line = null; st.base = null; st.tgt = null; st.tv = 0; st.revUntil = 0; st.slowT = 0; st.outN = 0; st.giveUp = false; } };
}

// ---------------------------------------------------------------- the driver
// drive(car, dt, ctx): ctx = { cars: [other car objects], lap: current lap (1-based), laps: race length }. Other cars may carry
// _jokers (jokers taken) for the joker tactics.
export function createAIDriver(level, traits = aiTraits(4, 0, 1)) {
  // the ENDLESS highway has no closed lap to plan a line round: the same driver reads the road frame instead (roadDriver above)
  if (level.endless) { return roadDriver(level, traits, parkMiller(((traits.seed || 4242) * 31 + 7) % 2147483647 || 1)); }
  const L = racingLine(level), main = L, B = level._branches, n = L.n;
  const rnd = parkMiller(traits.seed || 4242);
  const w1 = rnd() * 6.28, w2 = rnd() * 6.28;
  const jLaps = (level.joker && level.joker.laps) || 5;
  // the joker PLAN: a lap drawn from a spread (rarely the first, when the field is packed), tactics can override it on the day
  const jPlan = (() => { const r = rnd(), cum = [0.12, 0.35, 0.6, 0.82, 1.0]; for (let k = 0; k < cum.length; k++) if (r < cum[k]) return Math.min(jLaps, k + 1); return jLaps; })();
  const st = { path: main, i: null, vT: 0, t: 0, lap: 0, jokers: 0, jPlan, jWant: false, jDecLap: -1, jForget: rnd() < (traits.slip || 0),
    mist: null, mistCorner: -1, dodge: 0, follow: false, cap: 0, lastDist: 0, pushing: false, thrUntil: 0,
    atk: null, atkCorner: -1, hbCorner: -1, hbUntil: 0, cover: null, covCorner: -1, leadCar: null, behindT: 0 };

  function advance(car) {
    const P = st.path, pts = P.pts, N = P.n;
    let bi = st.i, bd = Infinity;
    for (let o = -4; o <= 30; o++) {
      let i = st.i + o; if (P.closed) i = (i + N) % N; else if (i < 0 || i >= N) continue;
      const q = (pts[i].x - car.x) ** 2 + (pts[i].y - car.y) ** 2; if (q < bd) { bd = q; bi = i; }
    }
    if (P === main && st.i > N * 0.8 && bi < N * 0.2) st.lap++;
    st.i = bi; st.lastDist = Math.sqrt(bd);
    // off the end of a branch: back onto the line where it merged
    if (P !== main && bi >= N - 2) { st.path = main; st.i = P.rejoin; advance(car); }
  }
  function decideJoker(ctx, lap, laps) {
    st.jDecLap = lap;
    if (!B.joker || st.jokers > 0) { st.jWant = false; return; }
    if (lap >= laps) { st.jWant = !st.jForget; return; }      // last chance (a low-skill driver may simply forget: +30 s)
    if (lap === st.jPlan) { st.jWant = true; return; }
    // TACTICS: stuck behind someone -> "jump" them with the joker (more likely the more aggressive); a rival right behind who has
    // already jokered -> cover them now before they gain the clean air (more likely the more defensive)
    const me = ctx.self; let ahead = false, coverIt = false;
    for (const c of ctx.cars || []) {
      const dx = c.x - me.x, dy = c.y - me.y, f = dx * Math.cos(me.heading) + dy * Math.sin(me.heading), d = Math.hypot(dx, dy);
      if (f > 0 && d < 30) ahead = true;
      if (f < 0 && d < 25 && (c._jokers || 0) > 0) coverIt = true;
    }
    st.jWant = (ahead && rnd() < 0.2 + 0.5 * traits.aggression) || (coverIt && rnd() < 0.2 + 0.5 * traits.defence);
  }
  function startMistake(cIdx) {
    const r = rnd(), kind = r < 0.4 ? 'late' : r < 0.65 ? 'early' : r < 0.85 ? 'throttle' : 'lift';
    st.mist = { kind, sev: Math.min(1, (0.3 + 0.7 * rnd()) * (1.2 - traits.skill)), corner: cIdx, inside: false, t: 0 };
  }

  function drive(car, dt = 1 / 120, ctx = {}) {
    st.t += dt;
    const sp = car.spec, v = Math.hypot(car.vx, car.vy);
    if (st.i === null) {
      // the START: a car sitting on the RX start straight drives it (user: "the traditional start"), else the line
      if (B.start && querySubtrack(level.subtrack, car.x, car.y).dist > L.hw && Math.hypot(...(() => { const k = nearestIdx(B.start.pts, car.x, car.y), p = B.start.pts[k]; return [p.x - car.x, p.y - car.y]; })()) < 12) {
        st.path = B.start; st.i = nearestIdx(B.start.pts, car.x, car.y);
      } else { st.path = main; st.i = nearestIdx(main.pts, car.x, car.y); }
    }
    advance(car);
    // ---- DRIVE ITSELF OUT (user, 2026-10-07: "it should try to drive it self out, if it falls super far behind / stays off track too long /
    // stays still / drives too slow for too long, ect it can reset"). Nearly still for DRIVE_OUT_T s after the green (nose in a wall, beached,
    // tangled with a car) -> REVERSE for ~1-1.5 s with the wheel turned to swing the nose back toward the road, then drive on. The game's
    // reset (main.js) is the LAST resort now: it waits longer, so this gets two or three tries first.
    { const o = driveOut(st, car, v, dt, ctx, rnd, () => st.path.pts[st.i].h); if (o) return o; }
    const lap = ctx.lap || Math.max(1, st.lap), laps = ctx.laps || jLaps;
    const P = st.path, pts = P.pts, N = P.n, idx = (k) => (P.closed ? ((k % N) + N) % N : Math.max(0, Math.min(N - 1, k)));
    const bi = st.i; let prof = profileOf(P, sp, main);
    const others = ctx.cars || [];
    // BATTLING (user: "scrabbling for victory"): a car within 25 m -> push a little harder, and err a little more
    st.pushing = others.some((c) => Math.hypot(c.x - car.x, c.y - car.y) < 25);
    const push = (st.pushing ? 1 + 0.02 * traits.aggression : 1) * (st.atk ? 1 + 0.02 * traits.aggression : 1) * (1 + HARDER * Math.min(1, (st.behindT || 0) / HARDER_T));

    // ---- JOKER: decide once per lap ~220 m before the branch; take it at the switch point
    let jCap = Infinity;
    if (B.joker && P === main) {
      const dSw = (((B.joker.switchI - bi) % n) + n) % n * L.sp;
      if (dSw < 220 && st.jDecLap !== lap) decideJoker({ ...ctx, self: car }, lap, laps);
      if (st.jWant) {
        const vJ = profileOf(B.joker, sp, main)[0], aB = K_BRAKE * carGrip(sp).brakeG * GRAVITY * 0.8;
        jCap = Math.sqrt(vJ * vJ + 2 * aB * dSw);
        if (dSw <= 3) { st.path = B.joker; st.i = 0; st.jokers++; st.jWant = false; }
      }
    }

    // ---- MISTAKES (user: "genuine subtle driving errors that lead to crashes and / or slower lap times"), drawn per corner ~45 m out
    let latT = 0, vMul = 1, thrForce = false;
    if (P === main) {
      const cA = L.cid[(bi + Math.round(45 / L.sp)) % n];
      if (cA >= 0 && cA !== st.mistCorner) { st.mistCorner = cA; st.mist = null; if (rnd() < traits.mistake * (st.pushing ? 1.6 : 1)) startMistake(cA); }
      const m = st.mist;
      if (m) {
        const C = L.corners[m.corner], inC = L.cid[bi] === m.corner, pastApex = inC && ((bi - C.apex + n) % n) < n / 2;
        if (inC) m.inside = true;
        if (m.inside && !inC) st.mist = null;    // through the corner: done
        else if (m.kind === 'late' && !pastApex) vMul = 1.06 + 0.14 * m.sev;                  // brakes late: runs wide, maybe off
        else if (m.kind === 'early' && !pastApex) latT += C.turn * (1 + 2 * m.sev);            // turns in early: clips the inside
        else if (m.kind === 'lift') vMul = 1 - (0.05 + 0.1 * m.sev);                           // hesitates: just slow
        else if (m.kind === 'throttle' && pastApex && !m.fired) { m.fired = true; st.thrUntil = st.t + 0.3 + 0.5 * m.sev; }   // too much, too soon: a slide
      }
    }
    if (st.t < st.thrUntil) thrForce = true;

    // ---- the line: less of its width for lower skill (lineQ), plus a slow WANDER, bigger for less skilled drivers
    const lineOff = P === main ? pts[bi].off : 0;
    latT += -lineOff * (1 - traits.lineQ);
    latT += traits.wander * (0.6 * Math.sin(st.t * 0.37 + w1) + 0.4 * Math.sin(st.t * 0.83 + w2));
    // THE START (user, 2026-10-04: "they aim for the racing line a bit too hard at the start of races and it causes crashes — increase crash
    // awareness a tiny bit, more willing to overtake / avoid, without slowing down"): from the moment it moves off, the car KEEPS ITS GRID
    // LANE (its offset from the line when it set off) and eases onto the line over START_BLEND s; in that phase cars alongside get more
    // room (START_GAP) and a car ahead is gone round rather than followed.
    if (st.goT == null && v > 2 && P === main) { st.goT = st.t; const p0 = pts[bi]; st.gridLat = (car.x - p0.x) * -Math.sin(p0.h) + (car.y - p0.y) * Math.cos(p0.h); }
    const startK = st.goT == null ? 1 : Math.max(0, 1 - (st.t - st.goT) / START_BLEND);
    if (startK > 0 && P === main && st.gridLat != null) latT += st.gridLat * startK;

    // ---- OTHER CARS (user: "avoid waiting for or crashing into other cars, deviating from its chosen path"): a car ahead in the way
    // -> pick the side with room and go round it (that IS the overtake); no room -> sit behind it, matching its speed; a car alongside
    // -> keep a gap; a faster car close behind -> a defensive driver covers its side a little
    const prec = traits.prec ?? 0.5, clear = 2.3 - 0.4 * traits.aggression, gapF = (6.5 - 2.5 * traits.aggression) * (1.15 - 0.35 * prec);
    const latLim = P === main ? L.hw - WANDER_EDGE : 2;
    const ch = Math.cos(car.heading), sh = Math.sin(car.heading);
    let dodgeT = 0, followCap = Infinity, conflict = false, lead = null, threat = null, side = 0; const alg = [];
    const myLat = st.dodge + latT;
    for (const c of others) {
      const rx = c.x - car.x, ry = c.y - car.y, f = rx * ch + ry * sh, l = -rx * sh + ry * ch;
      if (f < -15 || f > 8 + v * 1.1 || Math.abs(l) > 8) continue;
      // its lateral place relative to MY path
      let ci = bi, cd = Infinity; const span = Math.round((Math.max(0, f) + 12) / P.sp);
      for (let o = -Math.round(16 / P.sp); o <= span; o += 1) { const k = idx(bi + o), q = (pts[k].x - c.x) ** 2 + (pts[k].y - c.y) ** 2; if (q < cd) { cd = q; ci = k; } }
      const p = pts[ci], oc = (c.x - p.x) * -Math.sin(p.h) + (c.y - p.y) * Math.cos(p.h);
      const vAlong = c.vx * ch + c.vy * sh;
      if (f > 2.5 && f < 22 && Math.abs(oc - myLat) < clear + 0.8 && (!lead || f < lead.f)) lead = { c, f, oc, vAlong };
      if (f < -3 && f > -16 && vAlong > v - 1 && (!threat || f > threat.f)) threat = { c, f, oc };
      if (st.atk && c === st.atk.car) {
        // the car being ATTACKED: no following gap once we are moving over (only a real overlap close up holds us back)
        if (f > 2.5 && f < 5 && Math.abs(oc - myLat) < 1.5) followCap = Math.min(followCap, vAlong + 0.5);
        if (f < 4.5 && f > -4.5) alg.push(oc);
        continue;
      }
      if (f > 2.5) {
        // FOLLOWING only while closing, with a short gap: it rubs and bumps in braking zones (aifieldcheck: ~6 s of contact per 3 laps
        // of 6 cars at Realish). USER (2026-10-04, after testing it): "contact is ok … it felt ok before, put it back" — a strict
        // speed-based gap (zero contact, but a procession: 1 position change in 3 laps) was tried and REVERTED.
        if (v - vAlong > -0.5 && Math.abs(oc - myLat) < clear) {
          conflict = true;
          // GO ROUND, DON'T QUEUE (user, 2026-10-04: "AI still seem to almost queue and wait rather than overtake and avoid blocking cars,
          // even if it's slightly off track"): the room to pass may use WIDE m past the usual edge (wheels on the grass), WIDE_SLOW for a
          // car that is much slower or stopped (spun, beached); once a side is chosen it no longer matches the car ahead's speed unless
          // still overlapping it close up. (Was: room inside the edge only, and it slowed to follow whenever within gapF + 4 m even with a
          // side chosen. The room test also subtracted latT — wrong whenever the driver was wandering.)
          const slowBlock = vAlong < Math.min(0.7 * v, v - 4) || vAlong < 6;
          const wide = latLim + (slowBlock ? WIDE_SLOW : WIDE);
          const cands = [oc + clear, oc - clear].filter((o) => Math.abs(lineOff + o) <= wide).sort((a, b) => Math.abs(a - myLat) - Math.abs(b - myLat));
          if (cands.length && f > 3) { dodgeT = cands[0] - latT; if (Math.abs(lineOff + cands[0]) > latLim) { st.wide = wide; st.wideUntil = st.t + 1.2; } }
          if (!cands.length || (f < gapF && Math.abs(oc - myLat) < 1.6)) {
            let capF = vAlong + Math.max(0, f - gapF) * 0.7;
            // ANTICIPATION (prec): the car ahead will slow to (about) the profile where it is now, so arrive gapF behind at that speed
            // instead of reacting once it brakes — the nose-to-tail hits in braking zones (aifieldsuite: ~40 % of contact events)
            if (prec > 0) { const vL = Math.min(vAlong, prof[idx(ci + Math.round(6 / P.sp))] * traits.pace), aB = 0.6 * carGrip(sp).brakeG * GRAVITY * (car.surface.mu || 1);
              capF = Math.min(capF, capF * (1 - prec) + prec * Math.sqrt(vL * vL + 2 * aB * Math.max(0, f - gapF))); }
            followCap = Math.min(followCap, capF);
          }
        }
      } else if (f > -4) {
        if (f > -2.5) side = side || Math.sign(oc - myLat);
        alg.push(oc);
        const gapA = 2.4 + START_GAP * startK;
        if (Math.abs(oc - myLat) < gapA) { conflict = true; dodgeT = myLat + Math.sign(myLat - oc || 1) * (gapA - Math.abs(oc - myLat)) - latT; }
      } else if (!conflict && traits.defence > 0.5 && vAlong > v + 0.5 && f > -14) {
        dodgeT = Math.max(-1.2, Math.min(1.2, (oc - latT) * 0.5)) * traits.defence;
      }
    }
    // ---- OBSTACLES (user, 2026-10-04: "AI need to see tyres and cones as obstacles — although optional ones haha — but try and avoid them
    // on rally stages / tracks"): ctx.obstacles = loose objects near this car ({ x, y, r }, main.js). One in my path ahead, on the road ->
    // step round it on the side with room; no room -> drive through (optional). Cars come first: only when no car is in the way. A more
    // precise driver sees it further ahead.
    if (!conflict && ctx.obstacles && ctx.obstacles.length) {
      const reach = 6 + v * (0.6 + 0.6 * prec); let best = null;
      for (const o of ctx.obstacles) {
        const rx = o.x - car.x, ry = o.y - car.y, f = rx * ch + ry * sh; if (f < 2 || f > reach) continue;
        const l = -rx * sh + ry * ch; if (Math.abs(l) > 8) continue;
        const k = idx(bi + Math.round(f / P.sp)), q = pts[k], oc = (o.x - q.x) * -Math.sin(q.h) + (o.y - q.y) * Math.cos(q.h);
        if (Math.abs((P === main ? lineOff : 0) + oc) > (P === main ? L.hw + 0.5 : 6)) continue;   // off the road: not in the way
        if (Math.abs(oc - myLat) < o.r + OBST_CLEAR && (!best || f < best.f)) best = { f, oc, r: o.r };
      }
      if (best) {
        const w = best.r + OBST_CLEAR + 0.2;
        const cands = [best.oc + w, best.oc - w].filter((o) => Math.abs((P === main ? lineOff : 0) + o) <= latLim).sort((a, b) => Math.abs(a - myLat) - Math.abs(b - myLat));
        if (cands.length) { conflict = true; dodgeT = cands[0] - latT; st.obst = (st.obst || 0) + dt; }
      }
    }
    // ---- RACECRAFT (stage 3, 2026-10-04; user: "real overtakes, real defending, scrabbling for victory"). Stage 2 only went round a car
    // that was already in the way, so circuits were processions (aifieldsuite, Realish: 35 held passes in 12 six-car 3-lap races, Brands
    // and Naffcar ~0). ATTACK: sat behind the same car (longer for the cautious) with a corner coming -> commit to a side for that corner:
    // the INSIDE, unless the car ahead already covers it, then round the OUTSIDE for the switch-back; brake later (K_BRAKE + ATK_KB) and
    // push a little. Ends past the apex, once ahead, if it drops back or after 7 s. DEFENCE: a car closing behind with a corner coming ->
    // a defensive driver (chance = defence) moves over to COVER THE INSIDE once, and pays for the tighter line (3 % slower in the corner).
    if (P === main) {
      if (lead) st.nearT = (st.nearT || 0) + dt;
      if (lead && lead.c === st.leadCar) st.behindT += dt; else { st.leadCar = lead ? lead.c : null; st.behindT = 0; }
      const cur = L.cid[bi]; let nc = -1, nd = 0;
      for (let o = 1, m = Math.round(150 / L.sp); o < m; o++) { const c = L.cid[(bi + o) % n]; if (c >= 0 && c !== cur) { nc = c; nd = o * L.sp; break; } }
      const past = (pl) => pl.corner >= 0 && cur === pl.corner && ((bi - L.corners[pl.corner].apex + n) % n) < n / 2;
      if (st.atk) { const A = st.atk, f = (A.car.x - car.x) * ch + (A.car.y - car.y) * sh;
        if (f < -5 || f > 35 || st.t - A.t0 > (A.corner < 0 ? 9 : 7) || past(A)) st.atk = null; }
      if (!st.atk && lead && nc >= 0 && nc !== st.atkCorner && nd > 15 && nd < 140 && lead.vAlong < v + 2
        && st.behindT > Math.max(0.15, 0.6 - 0.5 * traits.aggression)) {
        st.atkCorner = nc;
        if (!debugValue("NOATK") && rnd() < 0.6 + 0.4 * traits.aggression) {
          const turn = L.corners[nc].turn, leadAbs = lineOff + lead.oc;
          const side = Math.sign(leadAbs) === turn && Math.abs(leadAbs) > 0.4 * latLim ? -turn : turn;
          st.atk = { car: lead.c, side, corner: nc, t0: st.t }; st.nAtk = (st.nAtk || 0) + 1;
        }
      }
      // TOW PASS (ovals, long straights: no corner close enough to brake into): in the slipstream of the same car for a while -> pull
      // out to the side with more room and drive past on the extra speed (contact.js slipstream)
      if (!st.atk && lead && (nc < 0 || nd > 140) && (car.dragMul ?? 1) < 0.85 && st.behindT > Math.max(0.3, 1 - 0.7 * traits.aggression)
        && st.t - (st.towT || -99) > 4) {
        st.towT = st.t;
        if (!debugValue("NOATK") && rnd() < 0.6 + 0.4 * traits.aggression) {
          const leadAbs = lineOff + lead.oc, ahead = pts[idx(bi + Math.round(80 / P.sp))].turn || 1;
          const sd = Math.abs(leadAbs) > 0.3 * latLim ? -Math.sign(leadAbs) : ahead;
          st.atk = { car: lead.c, side: sd, corner: -1, t0: st.t }; st.nAtk = (st.nAtk || 0) + 1;
        }
      }
      // GIVING ROOM: a car alongside on the INSIDE of the corner we are entering, and we are not attacking -> concede a little (a
      // defensive driver less), as real drivers do rather than turn in on it
      const insideOf = cur >= 0 ? L.corners[cur].turn : nc >= 0 && nd < 40 ? L.corners[nc].turn : 0;
      if (!st.atk && side && side === insideOf) vMul *= 1 - YIELD * (1.2 - traits.defence);
      if (st.cover && (past(st.cover) || st.t - st.cover.t0 > 6)) st.cover = null;
      if (!st.cover && !st.atk && threat && threat.f < -5 && nc >= 0 && nc !== st.covCorner && nd < 110) {
        st.covCorner = nc;
        if (!debugValue("NOCOV") && rnd() < (0.5 + 0.5 * (traits.prec ?? 0.5)) * traits.defence) st.cover = { side: L.corners[nc].turn, corner: nc, t0: st.t };
      }
      if (st.atk) { conflict = true; dodgeT = st.atk.side * (latLim - 1.0) - lineOff - latT; prof = profileOf(P, sp, main, K_BRAKE + ATK_KB); }
      else if (st.cover) { conflict = true; dodgeT = st.cover.side * 0.6 * latLim - lineOff - latT; }
      // never squeeze a car that is ALONGSIDE: the racecraft target keeps ALONG_GAP from it (attacks ignored it: side contact
      // 41 -> 110 events on one Thruston run, MEASURED)
      if (st.atk || st.cover) { let tg = latT + dodgeT; for (const a of alg) if (Math.abs(tg - a) < ALONG_GAP) tg = a + Math.sign(myLat - a || 1) * ALONG_GAP; dodgeT = tg - latT; }
      st.cc = cur >= 0 ? cur : nd < 80 ? nc : -1;
    } else { st.atk = null; st.cover = null; st.cc = -1; }
    const rate = st.atk ? 3.5 : 2.5;
    st.dodge += Math.max(-rate * dt, Math.min(rate * dt, dodgeT - st.dodge)) * (conflict ? 1 : 0.5);
    st.follow = followCap < Infinity;
    latT += st.dodge;
    const edge = st.t < (st.wideUntil || 0) ? st.wide : latLim;   // past the usual edge only while going round a car (above)
    latT = Math.max(-edge, Math.min(edge, lineOff + latT)) - lineOff;
    // OFF THE LINE INTO A CORNER (an attack, a cover, a dodge, a wander): the profile is for the racing line's radius; x m further INSIDE
    // at the apex is a radius R - x, so the corner speed drops by sqrt((R - x) / R). Without it attackers ran wide on the exit
    // (aifieldsuite Realish off-road 142 -> 299 car-s, MEASURED).
    // (applied in the SPEED section: every bend ahead within braking distance, not only the "corners" — Naffcar's banked turns are
    // wider than CORNER_R, and tow passes on their inside slid off: off-road 0 -> 14 car-s, MEASURED)

    // ---- steering: Stanley on the path + latT at the front axle (the bench driver's controller)
    const fx = car.x + ch * sp.lf, fy = car.y + sh * sp.lf;
    let fi = bi, fd = Infinity; for (let o = -2; o <= 10; o++) { const k = idx(bi + o), q = (pts[k].x - fx) ** 2 + (pts[k].y - fy) ** 2; if (q < fd) { fd = q; fi = k; } }
    const look = Math.round((2 + v * 0.15) / P.sp), ahead = pts[idx(fi + look)], p = pts[fi];
    let psi = ahead.h - car.heading; psi = Math.atan2(Math.sin(psi), Math.cos(psi));
    const cross = (fx - p.x) * -Math.sin(p.h) + (fy - p.y) * Math.cos(p.h) - latT;
    const deltaS = psi + Math.atan2(-1.2 * cross, v + 2) - 0.03 * (car.yawRate - v * Math.tan(car.delta) / sp.L);
    const muHere = car.surface.mu * sp.mu;
    // cap: the kinematic angle for the grip-limited turn + a front slip allowance (the bench cap pinned at ~0.1 at 35 m/s: ran wide)
    const LOCK = sp.steerMax || 0.56;
    const cap = Math.min(1, (1.3 * sp.L * muHere * GRAVITY / Math.max(4, v * v) + 0.12) / LOCK);
    // OVERSTEER (rear slip past ~10 deg): no cap, so it can countersteer; UNDERSTEER (front past ~8 deg): more lock only scrubs, so
    // lift and brake to get the front back (MEASURED: Sweaty Lamb's S at sF 0.27 rad, then a spin at sR -0.78)
    // LOOSE SURFACES (user, 2026-10-04: "slow down weirdly on surface changes, dirt to tarmac — they should predict it and speed up").
    // loose = 0 on tarmac (mu 1) .. 1 at mu 0.5. MEASURED (tools/aisurface, rally-4x4 Real): 19 of 26 Slidden surface changes lifted > 0.3 s
    // with the target still above the speed — mostly WHEELSPIN halving the throttle (normal on dirt), then the front-slip "understeer"
    // lift. On loose ground: no wheelspin cut, and 0.06 rad more front slip before the understeer lift -> 10 of 26; laps (Real) Knobhill
    // 47.6 -> 45.8 hatch / 41.5 -> 40.5 4x4, Sweaty Lamb 128.5 -> 125.2 / 114.4 -> 112.7, Slidden 55.9 -> 55.1, tarmac unchanged.
    // TRIED and REJECTED (same tool): more rear slip before lifting, a later slide catch and power through the slide — each alone harmless,
    // together the 4x4 left the road at Knobhill / Sweaty Lamb (16-31 s off a lap).
    const loose = Math.max(0, Math.min(1, (1 - car.surface.mu) / 0.5));
    const sF = Math.abs(car.t.slipF || 0), sR = Math.abs(car.t.slipR || 0);
    // DRIFT HOLD (user, 2026-10-04: "really need AI to drift and handbrake sometimes / aggressive off-road driving"): on loose ground, in a
    // corner, in a car with the drive at the back (RWD / rear-biased AWD), a slide is HELD — the rear kept near DRIFT_SLIP with the throttle,
    // countersteer free — instead of caught at 0.18 rad (which lifted and tiptoed). Past DRIFT_MAX it is caught as before. A bolder driver
    // (aggression) drifts more often (decided per corner).
    const inCorner = P === main && L.cid[bi] >= 0;
    if (inCorner && st.driftCorner !== L.cid[bi]) { st.driftCorner = L.cid[bi]; st.driftOn = st.t > (st.driftBan || 0) && rnd() < (debugValue("DRIFT") ?? (0.45 + 0.5 * traits.aggression)); }
    // ... and never near the road edge (a held drift there ran a Rally car off Sweaty Lamb 12 s a lap): within EDGE_DRIFT m it catches
    const pb = pts[bi], edgeRoom = P === main ? L.hw - Math.abs(lineOff + (car.x - pb.x) * -Math.sin(pb.h) + (car.y - pb.y) * Math.cos(pb.h)) : 0;   // m from the car to the nearer edge
    const drifting = st.driftOn && inCorner && loose > 0.3 && (sp.drive ?? 1) < 0.5 && sR > 0.12 && sR < DRIFT_MAX && v > 6 && edgeRoom > EDGE_DRIFT && pts[L.corners[L.cid[bi]].apex].R < DRIFT_R;
    const over = sR > 0.18 && v > 5 && !drifting, under = sF > 0.14 + 0.06 * loose && v > 5 && !over && !drifting;
    const steer = over || drifting ? Math.max(-1, Math.min(1, deltaS / LOCK)) : Math.max(-cap, Math.min(cap, deltaS / LOCK)); st.cap = cap;

    // ---- SPEED: the profile (it already brakes for what is ahead) x pace x mistakes, capped by the joker approach and traffic
    let vT = Infinity; const span = Math.round((3 + v * 0.25) / P.sp);
    for (let o = 0; o <= span; o++) vT = Math.min(vT, prof[idx(bi + o)]);
    if (P === main && Math.abs(latT) > 0.3) {
      const aB = (debugValue("AI_KB") || K_BRAKE) * pts[bi].mu * carGrip(sp).brakeG * GRAVITY, far = Math.round((v * v / (2 * aB) + 15) / P.sp);
      for (let o = 0; o <= far; o += 2) { const k = idx(bi + o), q = pts[k], x = (lineOff + latT - q.off) * q.turn;
        if (x > 0.3 && q.R < 400) { const vk = prof[k] * Math.sqrt(Math.max(0.4, (q.R - x) / q.R)); vT = Math.min(vT, Math.sqrt(vk * vk + 2 * aB * o * P.sp)); } }
    }
    vT = Math.min(vT * traits.pace * push * vMul, jCap, followCap);
    st.vT = vT;
    // (no WHEELSPIN cut any more: it halved the throttle on tarmac too, so a car coming off dirt with its wheels still spinning lifted at
    // the transition — the user's 'still slow down on transition change'. MEASURED without it (aidrivecheck, 6 levels x 3 cars x Realish +
    // Real): 0 to 0.6 s faster everywhere, nothing slower; aisurface Slidden 4x4: 8 -> 6 lifts at changes.)
    const slideR = sR, feel = Math.max(0, 1 - Math.max(0, slideR - 0.07) / 0.12);
    // OFF ROAD / LOOSE (user, 2026-10-04: "they still slow down like mad off road / changing surfaces"): on loose ground a sliding front
    // is the surface, not a mistake — keep driving (UNDER_LOOSE throttle) and never brake for it. MEASURED before (aifieldcheck SURF,
    // Brands + Castle Cum, 6 cars): on grass / dirt the AI braked 26-36 % and lifted 13-33 % of the time, front slip > 0.14 for 19-40 %.
    // ...only OFF THE PLANNED SURFACE (the car on clearly worse ground than its racing line: off the road, onto a loose patch). On a loose
    // line (Sweaty Lamb's gravel) the old lift + brake stays: applied there too, the 4x4 at Real left the stage 16 s a lap (MEASURED).
    const offPlan = P === main && car.surface.mu < 0.85 * (pts[bi].mu || 1);
    const looseUnder = under && loose > 0.3 && offPlan;
    if (drifting) { st.driftT = (st.driftT || 0) + dt; st.lastDrift = st.t; }
    // a drift that ran it OFF the road: it backs off drifting for DRIFT_BAN s (a driver who scares himself)
    if (edgeRoom < -0.5 && st.t - (st.lastDrift ?? -99) < 2) { st.driftOn = false; st.driftBan = st.t + DRIFT_BAN; }   // off within 2 s of a drift
    let throttle = drifting ? Math.max(0.25, Math.min(1, 0.6 + (DRIFT_SLIP - sR) * 3)) * (v < vT * 1.1 ? 1 : 0.4) : looseUnder ? Math.min(UNDER_LOOSE, v < vT ? (vT - v) * 0.6 : 0) : under ? 0 : over ? (v < vT ? Math.min(0.2, (vT - v) * 0.6) : 0) : v < vT ? Math.min(1, (vT - v) * 0.6) * feel : 0;
    if (thrForce && v < vT * 1.1) throttle = 1;
    let brake = v > vT + 0.3 ? Math.min(1, (v - vT) * 1.5) * Math.max(0.6, 1 - Math.abs(steer) / 0.5) : 0;
    if (under && !looseUnder && v > 0.85 * vT) brake = Math.max(brake, 0.35);
    if (over || drifting) brake = 0;
    // HANDBRAKE TURNS (user, 2026-10-04: "they should also use handbrake and drift and stuff"): into a HAIRPIN (apex R < HB_R) before the
    // apex, a big turn still ahead (> HB_TURN rad) and moving -> one pull of HB_T s per hairpin, off the throttle,
    // full lock that way: the rear steps out and the car pivots. The better driver times it (skill), a weaker one sometimes doesn't bother.
    let handbrake = 0;
    if (P === main && v > 6 && (debugValue("HB") ?? 1)) {
      const c = L.cid[bi], C = c >= 0 ? L.corners[c] : null;
      // turn-in: a corner that turns > HB_TURN rad in all (summed once along its run) with an apex tighter than HB_R (+ HB_LOOSE on loose
      // ground), the apex within ~0.8 s
      if (C && C.angle === undefined) { let sum = 0; for (let i = C.start; L.cid[i] === c; i = (i + 1) % n) { const d = pts[(i + 1) % n].h - pts[i].h; sum += Math.atan2(Math.sin(d), Math.cos(d)); } C.angle = Math.abs(sum); }
      const toApex = ((C ? C.apex : bi) - bi + n) % n;
      if (C && C.angle > HB_TURN && pts[C.apex].R < HB_R + HB_LOOSE * loose && toApex < n / 2 && toApex * L.sp < 0.8 * v + 6 && st.hbCorner !== c) {
        st.hbCorner = c; if (rnd() < 0.5 + 0.5 * traits.skill) st.hbUntil = st.t + HB_T;
      }
      if (st.t < st.hbUntil) { handbrake = 1; throttle = 0; brake = 0; st.hbN = (st.hbN || 0) + 1; }
    }
    return { steer: handbrake ? Math.sign(steer || psi) * Math.max(Math.abs(steer), 0.9) : steer, throttle, brake, handbrake };
  }
  // put back on the road by the game (stuck / broken): find its place again, forget the dodge and any mistake in progress
  const relocate = () => { st.i = null; st.path = main; st.dodge = 0; st.mist = null; st.thrUntil = 0; st.revUntil = 0; st.slowT = 0; st.outN = 0; st.giveUp = false; };
  return { drive, state: st, total: L.total, traits, relocate };
}
