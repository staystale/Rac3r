// highway road: the centre-line generator (elements, curvature, growTo) and the readers of it
// (locate, roadFrame, roadPose, roadSpan). Split out of highway.js.
import { STEP, UP_HEADING, K_RATE, wrap } from "./presets.js";
// lateral offsets from the centreline: - = the driver's LEFT (the -normal side; lab.js normals
// point to the driver's right)
export function laneGeo(cfg) {
  const width = cfg.shoulder + cfg.lanes * cfg.laneW + cfg.edge,
    halfWidth = width / 2,
    base = -halfWidth + cfg.shoulder;
  return { width, hw: halfWidth,
    centres: Array.from({ length: cfg.lanes }, (item, i) => base + cfg.laneW * (i + 0.5)),
    dashes: Array.from({ length: cfg.lanes - 1 }, (item, idx) => base + cfg.laneW * (idx + 1)),
    solid: cfg.shoulder >= 2 ? [base] : [] };
}
export function stateOf(level) {
  return level._hw;
}
// the next road element: a STRAIGHT, a SWEEPER or a tighter BEND. A curve turns back toward
// straight-up once the heading has wandered past half the limit, and its total turn is capped so
// the heading never passes the limit; turning back it may swing right across to the other side (the
// "vary obviously" swings). LEAN TARGET (requirement: it always aims diagonally LEFT — it should go
// left AND right and vary). MEASURED (tools/headingcheck): the old rule only turned back past HALF
// the limit, so the road could sit on one side for km — the live seed leaned LEFT
// (-16..-58 deg) from 0.5 to 4.5 km, seed 7 for 12.9 km. Now the road steers toward a TARGET LEAN
// that ALTERNATES sides (35-100 % of the limit) and is held for 0.5-1.6 km; near the target it runs
// straight or throws a small S-wiggle.
function nextElement(state, cfg) {
  // the road's SHAPE has its own stream (st.grnd): it used to share st.rnd with the
  // dressing, so every scenery change re-rolled the road (MEASURED: moving the slips / bridges to
  // their own stream moved seed 4242's road at 6 km by 2 km sideways)
  const rand = state.grnd, max = cfg.maxDeg * Math.PI / 180, off = wrap(state.hdg - UP_HEADING);
  if (state.s >= state.tUntil) {
    state.tSide = -(state.tSide || (rand() < 0.5 ? 1 : -1));
    state.target = state.tSide * (0.35 + 0.65 * rand()) * max * 0.95;
    state.tUntil = state.s + 500 + rand() * 1100;
  }
  const gap = state.target - off, near = Math.abs(gap) < 4 * Math.PI / 180;
  if (near && rand() < cfg.pStraight * 1.6)
    return { len: 120 + rand() * 380, k: 0, ramp: 0, hold: 0 };
  const bend = rand() < cfg.pBend,
    [radMin, radMax] = bend ? cfg.bend : cfg.sweep,
    rad = radMin + rand() * (radMax - radMin);
  // toward the target (the whole gap, or in two bites if it is big); near it, a wiggle to whichever
  // side has room
  let dir, turn;
  if (!near) {
    dir = Math.sign(gap);
    turn =
      Math.abs(gap) > (50 * Math.PI) / 180 && rand() < 0.5 ? Math.abs(gap) * 0.55 : Math.abs(gap);
  } else {
    dir = rand() < 0.5 ? 1 : -1;
    if (Math.abs(off + dir * 0.2) > max) dir = -dir;
    turn = ((6 + rand() * 10) * Math.PI) / 180;
  }
  turn = Math.min(turn, Math.max(0.02, max - dir * off));
  // total turn = k * (ramp + hold); length = 2 ramp + hold. The RAMP is long enough that curvature
  // changes no faster than K_RATE per m (MEASURED, tools/treadmillcheck: a 30 m minimum
  // ramp gave the dual carriageway's R 120-200 bends a 5.7e-4 jump per 4 m step and the bench
  // driver ran wide out of an S-bend); a turn too small for that ramp is made WIDER (lower k),
  // never sharper.
  let curv = 1 / rad, ramp = Math.max(curv / K_RATE, Math.min(160, turn * rad * 0.35));
  if (curv * ramp > turn) {
    ramp = Math.max(ramp * 0.5, Math.sqrt(turn / K_RATE));
    curv = Math.min(curv, turn / ramp);
  }
  const hold = Math.max(0, turn / curv - ramp);
  return { len: 2 * ramp + hold, k: dir * curv, ramp, hold };
}
const curvAt = (elem, along) =>
  !elem.k
    ? 0
    : along < elem.ramp
      ? (elem.k * along) / elem.ramp
      : along < elem.ramp + elem.hold
        ? elem.k
        : (elem.k * Math.max(0, elem.len - along)) / elem.ramp;
export function growTo(level, sTarget) {
  const state = stateOf(level);
  while (state.s < sTarget) {
    if (!state.plan.length) state.plan.push(nextElement(state, level._cfg));
    const elem = state.plan[0], along = elem.done || 0;
    // midpoint curvature over the step: exact for a linear ramp, so the heading lands exactly where
    // the element says
    const headingStep = curvAt(elem, along + STEP / 2) * STEP;
    state.hdg += headingStep / 2;
    state.x += Math.cos(state.hdg) * STEP;
    state.y += Math.sin(state.hdg) * STEP;
    state.hdg += headingStep / 2;
    state.s += STEP;
    elem.done = along + STEP;
    state.pts.push({ x: state.x, y: state.y, s: state.s, curv: curvAt(elem, elem.done) });
    if (elem.done >= elem.len - 1e-6) state.plan.shift();
  }
}
export const straightAt = (road, i, back, fwd = back) => {
  for (let j = Math.max(0, i - back); j < Math.min(road.length, i + fwd); j++)
    if (Math.abs(road[j].curv || 0) > 1 / 900) return false;
  return true;
};
export const ease = (prog) => (prog <= 0 ? 0 : prog >= 1 ? 1 : prog * prog * (3 - 2 * prog));
// where the car is along the window: nearest road point (searched round last step's index first),
// absolute road distance s, signed offset (+ = driver's right) and the road direction there
export function locate(state, x, y) {
  const road = state.pts,
    count = road.length;
  let bestIdx = 0,
    bestD2 = Infinity;
  const scan = (begin, stop) => {
    for (let i = Math.max(0, begin); i < Math.min(count, stop); i++) {
      const dist2 = (road[i].x - x) ** 2 + (road[i].y - y) ** 2;
      if (dist2 < bestD2) {
        bestD2 = dist2;
        bestIdx = i;
      }
    }
  };
  scan(state.ci - 30, state.ci + 31);
  if (bestD2 > 400) {
    bestD2 = Infinity;
    scan(0, count);
  }
  state.ci = bestIdx;
  const prev = road[Math.max(0, bestIdx - 1)],
    next = road[Math.min(count - 1, bestIdx + 1)],
    span = Math.hypot(next.x - prev.x, next.y - prev.y) || 1,
    dx = (next.x - prev.x) / span,
    dy = (next.y - prev.y) / span;
  const offX = x - road[bestIdx].x, offY = y - road[bestIdx].y;
  return {
    i: bestIdx,
    s: road[bestIdx].s + offX * dx + offY * dy,
    off: -offX * dy + offY * dx,
    dx,
    dy,
  };
}
// ROAD FRAME for ANY car (traffic.js, later the highway AI): like locate but with the caller's
// own hint (an absolute road distance s, so it survives the window moving) -> { s, off (+ =
// driver's right), dx, dy } or null before the road exists
export function roadFrame(level, x, y, hintS) {
  const road = level._hw.pts,
    count = road.length;
  if (count < 2) return null;
  let bestIdx = 0, bestD2 = Infinity;
  const scan = (begin, stop) => {
    for (let i = Math.max(0, begin); i < Math.min(count, stop); i++) {
      const dist2 = (road[i].x - x) ** 2 + (road[i].y - y) ** 2;
      if (dist2 < bestD2) {
        bestD2 = dist2;
        bestIdx = i;
      }
    }
  };
  if (hintS != null) {
    const hintIdx = Math.round((hintS - road[0].s) / STEP);
    scan(hintIdx - 14, hintIdx + 15);
  }
  if (bestD2 > 400) {
    bestD2 = Infinity;
    scan(0, count);
  }
  const prev = road[Math.max(0, bestIdx - 1)],
    next = road[Math.min(count - 1, bestIdx + 1)],
    span = Math.hypot(next.x - prev.x, next.y - prev.y) || 1,
    dx = (next.x - prev.x) / span,
    dy = (next.y - prev.y) / span;
  const offX = x - road[bestIdx].x, offY = y - road[bestIdx].y;
  return { s: road[bestIdx].s + offX * dx + offY * dy, off: -offX * dy + offY * dx, dx, dy };
}
// a POSE on the road at absolute distance s (clamped into the window) and lateral offset off -> {
// x, y, h }
export function roadPose(level, dist, off) {
  const road = level._hw.pts,
    count = road.length,
    fracIdx = (dist - road[0].s) / STEP,
    i = Math.max(0, Math.min(count - 2, Math.floor(fracIdx))),
    blend = Math.max(0, Math.min(1, fracIdx - i));
  const prev = road[i], next = road[i + 1], heading = Math.atan2(next.y - prev.y, next.x - prev.x);
  return {
    x: prev.x + (next.x - prev.x) * blend - Math.sin(heading) * off,
    y: prev.y + (next.y - prev.y) * blend + Math.cos(heading) * off,
    h: heading,
  };
}
// the road that exists right now: [s0, s1] absolute
export function roadSpan(level) {
  const road = level._hw.pts;
  return { s0: road[0].s, s1: road[road.length - 1].s };
}
