// highway.js — HIGHWAY TO HULL: the ENDLESS motorway. User, 2026-10-05: "how about an infinite
// highway level with procedural turns and terrain". v2 THE TREADMILL (user, 2026-10-05: "act like a
// treadmill ... always line up nicely to the previous section ... spawn ahead and vanish behind,
// always off screen ... the pace is the player's car so it can never drive off the screen ... going
// backwards should reset you ... top to bottom on mobile / PC"; camera stays FIXED and upright,
// "more extreme on the angle but it should vary obviously"). v1 (wandered in any compass direction,
// curvature stepped 0 -> 1/R) is in _archive/pre-treadmill/.
//
// HOW: the road is generated AHEAD of you and dropped BEHIND, in a WINDOW (AHEAD 1100 / BEHIND 450
// m — both far past the edge of the view, which is at most ~170 m tall). Every time the window
// moves the road's subtrack is rebuilt from the window's points, its loop closed by ONE ghost
// segment (lab.js ghostSegment: never drawn, never road). Distances in the rebuilt subtrack are
// relative to the window start: stepHighway returns how far that start moved, and main.js shifts
// what it remembers (the reset point) by it.
// UP THE SCREEN: the heading never strays more than cfg.maxDeg from straight UP (-y), so the road
// always climbs the screen and cannot cross itself. SMOOTH JOINS: every element starts and ends at
// ZERO curvature and ramps linearly in between (a clothoid), so heading AND curvature are
// continuous across every join — straight -> sweeper -> S-bend -> straight, no kinks, no sudden
// steering. LANES are config (HW_PRESETS): a UK motorway, a wide interstate, a skinny dual
// carriageway — the same generator for later flavour levels.
import { lcg } from "./core/random.ts";
import { envValue } from "./core/debug.ts";
import { readSettings } from "./core/settings.ts";
import { createSubtrack, ghostSegment } from "./world/subtrack.ts";
import { meterEvent } from "./ui/meter.ts";
import { SURFACES } from "./world/surfaces.ts";
import { LEVELS } from "./world/levels/index.ts";
import { prepBumps, clearNaturalCache } from "./world/terrain.ts";
import { prepBarriersOf, solidsFromProps } from "./world/barriers.ts";
import { onTrack } from "./world/tyrewall.ts";
import { zoneSurfaceAt, pruneWear } from "./world/wear.ts";

// lanes / laneW / shoulder (left, hard shoulder; a solid line inside it when >= 2 m) / edge (right
// margin) in m; maxDeg off straight up; sweep / bend = radius ranges (m); pStraight / pBend =
// chance an element is a straight / a tight bend (else a sweeper)
export const HW_PRESETS = {
  motorway: {
    lanes: 3,
    laneW: 3.65,
    shoulder: 3.3,
    edge: 0.7,
    maxDeg: 60,
    sweep: [350, 900],
    bend: [180, 300],
    pStraight: 0.34,
    pBend: 0.2,
  },
  interstate: {
    lanes: 4,
    laneW: 3.7,
    shoulder: 3.0,
    edge: 1.2,
    maxDeg: 45,
    sweep: [600, 1400],
    bend: [350, 500],
    pStraight: 0.45,
    pBend: 0.1,
  },
  dual: {
    lanes: 2,
    laneW: 3.4,
    shoulder: 0.6,
    edge: 0.6,
    maxDeg: 60,
    sweep: [250, 600],
    bend: [120, 200],
    pStraight: 0.3,
    pBend: 0.25,
  },
  // WALLED IN (user, 2026-10-05: "some levels that use this mechanic should be more walled in"):
  // `walls` = a continuous barrier kind both sides, `wallGap` m off the road edge; no trees / barns
  // inside the walls
  walled: {
    lanes: 3,
    laneW: 3.65,
    shoulder: 1.0,
    edge: 1.0,
    maxDeg: 50,
    sweep: [400, 900],
    bend: [220, 320],
    pStraight: 0.3,
    pBend: 0.2,
    walls: "wall",
    wallGap: 1.2,
  },
};
export const HW_NAMES = {
  motorway: "MOTORWAY",
  interstate: "INTERSTATE",
  dual: "DUAL C/WAY",
  walled: "WALLED",
};
// SPAWN_S 40 -> 300 (MEASURED 2026-10-05, treadmillcheck: the road's raw START was only 40 m behind
// the car at spawn, inside a zoomed-out view); K_RATE = the fastest curvature change, 1/m per m (a
// clothoid; 5e-5 = a 0 -> R 200 ramp over 100 m)
const STEP = 4, AHEAD = 1100, BEHIND = 450, SPAWN_S = 300, UP_HEADING = -Math.PI / 2, K_RATE = 5e-5;
// THE GUARD (user: "go backwards should reset you"): rolling BACK down the road faster than BACK_V
// for BACK_T s, or BACK_M m behind the furthest you have got, or OFF_M m past the road edge (out of
// the scenery band, where the treadmill has no road on screen) -> put back in the LEFT lane at the
// furthest point, with a HUD notice saying why (never unexplained, CLAUDE.md §1) GOING WIDE (user,
// 2026-10-05: "can going wide be WIDER / have a TIMER so you have a chance to return"): was a hard
// reset 35 m past the edge. Now OFF_SOFT m past the edge starts an OFF_T s countdown on the HUD
// (back within it = cancelled); only OFF_HARD m out resets at once (the road would be leaving the
// view). LONGER + HELD NEAR THE ROAD (user, 2026-10-06: "the off road timer should be longer / turn
// off if youre close to the road (about to get back)"): OFF_T 6 -> 10 s; it does not run while you
// are within OFF_NEAR m of the edge or heading back to it faster than BACK_IN m/s.
const BACK_V = 3,
  BACK_T = 1.2,
  BACK_M = 30,
  OFF_SOFT = 8,
  OFF_T = 10,
  OFF_HARD = 70,
  OFF_NEAR = 16,
  BACK_IN = 1.5;
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const rng = (seed) => lcg((seed >>> 0) || 1);
// SILLY SIGNS (the distance to Hull goes UP — you never get there)
const SIGNS = [
  "SERVICES 2 MI (CLOSED)",
  "SPEED CAMERA (BROKEN)",
  "NO CHIPS FOR 300 MI",
  "CONES NEXT 40 MI",
  "WELCOME TO NOWHERE",
  "HULL: TWINNED WITH HULL",
  "ARE WE NEARLY THERE?",
  "BEWARE OF THE SHEEP",
  "ROADWORKS ENDED 1987",
  "SLOW DOWN (OR DON'T)",
  "SKID PAN 5 MI",
  "LAST TOILET: BEHIND YOU",
];

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
function stateOf(level) {
  return level._hw;
}
// the next road element: a STRAIGHT, a SWEEPER or a tighter BEND. A curve turns back toward
// straight-up once the heading has wandered past half the limit, and its total turn is capped so
// the heading never passes the limit; turning back it may swing right across to the other side (the
// "vary obviously" swings). LEAN TARGET (user, 2026-10-05, phone: "it always aims diagonally LEFT —
// it should go left AND right and vary"). MEASURED (tools/headingcheck): the old rule only turned
// back past HALF the limit, so the road could sit on one side for km — the live seed leaned LEFT
// (-16..-58 deg) from 0.5 to 4.5 km, seed 7 for 12.9 km. Now the road steers toward a TARGET LEAN
// that ALTERNATES sides (35-100 % of the limit) and is held for 0.5-1.6 km; near the target it runs
// straight or throws a small S-wiggle.
function nextElement(state, cfg) {
  // the road's SHAPE has its own stream (st.grnd, 2026-10-06): it used to share st.rnd with the
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
  // changes no faster than K_RATE per m (MEASURED 2026-10-05, tools/treadmillcheck: a 30 m minimum
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
function growTo(level, sTarget) {
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
// ---- SLIP ROADS, BRIDGES, CHEEKY EXTRAS. Each is ONE prop (render.ts draws it, physics reads it):
// no new system. OFF-SLIP (kind 'slip'): leaves the LEFT edge (the hard shoulder side) at SLIP_DEG,
// a tapering lane 5 m wide, SLIP_LEN m long, ending in a field gate; its surface is tarmac (lab.js
// zoneAt reads lv.lanes - the existing pit-lane ribbons), a SLIP sign + a countdown board (3 / 2 /
// 1 bars) before it. Driving up it is off the motorway (the guard's OFF countdown applies, by
// design: it goes nowhere). BRIDGES (kind 'bridge'): drawn OVER everything (render.ts OVERHEAD),
// deck across the road at an angle, with what it carries: 'road' (a lane + a car or two, parapets),
// 'rail' (sleepers + rails, no trains), 'foot' (narrow, people). UNDER the motorway: kind 'river'
// (water band across, the motorway on a viaduct: parapets both sides) - drawn under the road, never
// on it. Only their PIERS / abutments are solid, and those stand SLIP_CLEAR m outside the tarmac (+
// off the verge strip the AI dodges on). EXTRAS (rare): a COW on a road bridge, a CONE on a
// footbridge, a small BOAT stuck under a river bridge, a SMILEY SOLAR FARM. v2 (user, 2026-10-06:
// "bridges / slip roads should extend off the screen ... slip roads should lead off screen not just
// stop, although some can... and some can follow along side the main motorway and has a chance to
// rejoin, as a secret chance path"; "all the types of highway should have bridges and slip roads
// you can take"; "make the cars n stuff move across if you can"):
// - every off-slip looks the same from the motorway (signs, exit board). 1 in 4 stops at a gate
// after SLIP_LEN; 1 in 2 runs LONG (SLIP_LONG m, curving away) to a gate off screen; 1 in 4 is the
// SECRET SIDE ROAD (sideStep): alongside, SIDE_GAP m out, following the motorway's bends, then
// merging back into the hard shoulder. The side road counts as ON the road (highwayGuard); on any
// other slip the off-road countdown waits and only the far-out reset ends it ("EXIT TAKEN").
// - road / rail / foot bridges get APPROACHES (approaches()): a lane ribbon (tarmac / gravel
// ballast / dirt path) APP_LEN m out each side along the deck axis; render.ts drawBridge draws
// their markings and the MOVING cars / walkers / trains (wall clock, no physics).
// - a RIVER (river()) is a real 'wet' COVER (the same water as every puddle: grip, spray, drawn
// into the ground tiles) with dirt banks (zones), cut out where the motorway crosses on its
// parapets (cover.cut: lab.js coverAt + render.ts coverCells), APP_LEN m each side.
// - anything long that leaves the road (approach, river, long slip) is CUT SHORT
// where the road later swings back across it (cuts).
// - the WALLED preset gets them too: a gap in the left wall / armco where a slip leaves or the side
// road runs (P[j].gapL). All the new random choices draw from st.xrnd, so the road's own shape
// stream (st.rnd) is unchanged by them.
const SLIP_EVERY = [2000, 4000],
  BRIDGE_EVERY = [1100, 2400],
  SLIP_LEN = 150,
  SLIP_DEG = 9,
  SLIP_W = 5,
  PIER = 6;
const SIDE_W_HALF = 2.5,
  SLIP_LONG = [300, 420],
  SIDE_GAP = 14,
  SIDE_OUT = 140,
  SIDE_IN = 140,
  SIDE_RUN = [250, 750],
  APP_LEN = 150,
  APP_STEP = 8;
const straightAt = (road, i, back, fwd = back) => {
  for (let j = Math.max(0, i - back); j < Math.min(road.length, i + fwd); j++)
    if (Math.abs(road[j].curv || 0) > 1 / 900) return false;
  return true;
};
const ease = (prog) => (prog <= 0 ? 0 : prog >= 1 ? 1 : prog * prog * (3 - 2 * prog));
// KEEP-OUT areas for scenery (trees, rocks, barns, solar farms): rects { x, y, ax, ay (unit axis),
// hu, hv }
function blocked(keep, x, y, radius) {
  for (const rect of keep) {
    const dx = x - rect.x,
      dy = y - rect.y,
      along = dx * rect.ax + dy * rect.ay,
      across = -dx * rect.ay + dy * rect.ax;
    if (Math.abs(along) < rect.hu + radius && Math.abs(across) < rect.hv + radius) return true;
  }
  return false;
}
const SCENERY = { tree: 3, rock: 3, block: 8, solarfarm: 16 };
function keepOut(level, rect, dist) {
  // a feature that needs the GROUND (approach, river, slip) drops any field / village under it,
  // whole (scenery, fieldsA below)
  if (rect.field == null) clearFields(level, rect);
  rect._s = dist;
  level._hw.keep.push(rect);
  const kept = level.props.filter(
    (prop) => !SCENERY[prop.kind] || !blocked([rect], prop.x, prop.y, SCENERY[prop.kind])
  );
  if (kept.length !== level.props.length) {
    level.props.length = 0;
    level.props.push(...kept);
  }
}
// CUT SHORT. c = { pts (outward polyline, truncated in place), s, w, skip: [s0, s1] (road distances
// never tested: its own stretch), after() }. A road point within reach of a polyline point (k >= 1)
// cuts the polyline before that point.
const cutSkips = (cut, dist) => dist >= cut.skip[0] && dist <= cut.skip[1];
function cutBy(level, cut, x, y) {
  const thr = (level._hw.geo.hw + cut.w / 2 + 3) ** 2, road = cut.pts;
  for (let idx = 1; idx < road.length; idx++)
    if ((road[idx][0] - x) ** 2 + (road[idx][1] - y) ** 2 < thr) {
      road.length = idx;
      cut.after();
      return;
    }
}
function addCut(level, cut) {
  const state = level._hw;
  cut._s = cut.s;
  state.cuts.push(cut);
  for (let j = 0; j < state.pts.length; j += 2)
    if (!cutSkips(cut, state.pts[j].s)) cutBy(level, cut, state.pts[j].x, state.pts[j].y);
}
// THE SECRET SIDE ROAD, one road point at a time (built with the road, so it follows every bend):
// stores its centre's offset to the LEFT of the centreline as P[i].sideOff (the guard reads it).
// Pieces are flushed at the end of each dress() call (sideFlush).
function sideStep(level, i, pointAt) {
  const state = level._hw,
    sideRoad = state.side;
  if (!sideRoad) return;
  const road = state.pts,
    along = road[i].s - sideRoad.s0,
    halfWidth = state.geo.hw,
    total = SIDE_OUT + sideRoad.run + SIDE_IN;
  if (along > total) {
    sideFlush(level, true);
    state.side = null;
    state.nextBridge = Math.max(state.nextBridge, road[i].s + 150);
    return;
  }
  const blend =
    along < SIDE_OUT
      ? ease(along / SIDE_OUT)
      : along < SIDE_OUT + sideRoad.run
        ? 1
        : 1 - ease((along - SIDE_OUT - sideRoad.run) / SIDE_IN);
  const off = halfWidth - 2.6 + (SIDE_GAP + 2.6) * blend;
  road[i].sideOff = off;
  road[i].gapL = 1;
  if (i % 3 === 0 || along + STEP > total) {
    const pos = pointAt(i, -off);
    sideRoad.pts.push([pos.x, pos.y]);
    if (off > halfWidth + 2.5) sideRoad.mpts.push([pos.x, pos.y]);
  }
  // ~100 m pieces, so each is dropped behind with its own stretch of road (one long piece would
  // vanish while its end was on screen)
  if (sideRoad.pts.length >= 9) sideFlush(level, false, road[i].s);
}
function sideFlush(level, end, sNext) {
  const state = level._hw,
    sideRoad = state.side;
  if (!sideRoad) return;
  if (sideRoad.pts.length >= 2)
    level.lanes.push({
      pts: sideRoad.pts,
      width: SLIP_W,
      surface: SURFACES.tarmac,
      _s: sideRoad.sPiece,
    });
  // its edge lines (render.ts drawSlip), only where it has left the motorway's tarmac
  if (sideRoad.mpts.length >= 2)
    level.props.push({
      kind: "slip",
      line: sideRoad.mpts,
      w: SLIP_W,
      nose: false,
      x: sideRoad.mpts[0][0],
      y: sideRoad.mpts[0][1],
      _s: sideRoad.sPiece,
    });
  // the next piece starts on this one's last point (no seam); sPiece = the road distance it is
  // dropped behind with
  const last = sideRoad.pts[sideRoad.pts.length - 1],
    lastM = sideRoad.mpts[sideRoad.mpts.length - 1];
  sideRoad.pts = end || !last ? [] : [last];
  sideRoad.mpts = end || !lastM ? [] : [lastM];
  sideRoad.sPiece = sNext ?? state.pts[state.pts.length - 1].s;
}
// a bridge's APPROACHES: straight on along the deck axis from the outer face of each abutment (cut
// short where the road comes back)
function approaches(level, bridge, dist) {
  const half = bridge.wid / 2,
    carries = bridge.carries,
    axisX = Math.cos(bridge.rot),
    axisY = Math.sin(bridge.rot);
  const width = carries === "road" ? 7 : carries === "rail" ? 5.5 : 2.4,
    surface =
      carries === "road" ? SURFACES.tarmac : carries === "rail" ? SURFACES.gravel : SURFACES.dirt;
  bridge.appL = [APP_LEN, APP_LEN];
  bridge.appW = width;
  bridge.reach = half + 3 + APP_LEN;
  keepOut(
    level,
    { x: bridge.x, y: bridge.y, ax: axisX, ay: axisY, hu: half + 4 + APP_LEN, hv: width / 2 + 4 },
    dist
  );
  [-1, 1].forEach((sign, sideIdx) => {
    const pts = [];
    for (let along = 0; along <= APP_LEN + 1e-6; along += APP_STEP) {
      const offset = sign * (half + 3 + along);
      pts.push([bridge.x + axisX * offset, bridge.y + axisY * offset]);
    }
    const lane = { pts, width: width, surface, _s: dist };
    level.lanes.push(lane);
    addCut(level, {
      pts,
      s: dist,
      w: width,
      skip: [dist - 80, dist + 80],
      after: () => {
        lane._segs = null;
        bridge.appL[sideIdx] = Math.max(0, (pts.length - 1) * APP_STEP);
      },
    });
  });
}
// a RIVER under the motorway: per side, one water cover + two dirt bank strips, from just inside
// the parapet to APP_LEN m beyond it. The cover's `cut` removes the part under the motorway exactly
// (lab.js coverAt + render.ts coverCells): in the river's frame the road edges are u = v tan(skew)
// +- e.
function river(level, bridge, dist) {
  const state = level._hw,
    riverW = bridge.ww,
    tanSkew = Math.tan(bridge.skew),
    roadEdge = bridge.roadHw / Math.cos(bridge.skew),
    axisX = Math.cos(bridge.rot),
    axisY = Math.sin(bridge.rot);
  const coverStart = Math.max(1, roadEdge - Math.abs(tanSkew) * (riverW / 2 + 1.2) - 0.5);
  bridge.reach = roadEdge + APP_LEN;
  keepOut(
    level,
    {
      x: bridge.x,
      y: bridge.y,
      ax: axisX,
      ay: axisY,
      hu: roadEdge + APP_LEN + 2,
      hv: riverW / 2 + 5,
    },
    dist
  );
  for (const sign of [-1, 1]) {
    const water = {
      cover: "wet",
      shape: "rect",
      rot: bridge.rot,
      h: riverW,
      cut: { ox: bridge.x, oy: bridge.y, tn: tanSkew, e: roadEdge },
      _s: dist,
    };
    const banks = [-1, 1].map((bankSide) => ({
      surface: SURFACES.dirt,
      rot: bridge.rot,
      h: 1.2,
      _s: dist,
      sv: bankSide,
    }));
    const put = (len) => {
      const along = sign * (coverStart + len / 2);
      Object.assign(water, { x: bridge.x + axisX * along, y: bridge.y + axisY * along, w: len });
      delete water._cells;
      // the banks start at the parapet line (never on the motorway's tarmac)
      for (const bank of banks) {
        const across = bank.sv * (riverW / 2 + 0.6),
          alongBank =
            sign *
            (roadEdge +
              Math.abs(tanSkew) * (riverW / 2 + 1.2) +
              (len - (roadEdge - coverStart)) / 2);
        Object.assign(bank, {
          x: bridge.x + axisX * alongBank - axisY * across,
          y: bridge.y + axisY * alongBank + axisX * across,
          w: Math.max(0.5, len - (roadEdge - coverStart)),
        });
      }
      state.coversDirty = true;
    };
    put(roadEdge - coverStart + APP_LEN);
    state.covers.push(water);
    level.zones.push(...banks);
    const pts = [];
    for (let along = 0; along <= APP_LEN + 1e-6; along += 10) {
      const offset = sign * (roadEdge + along);
      pts.push([bridge.x + axisX * offset, bridge.y + axisY * offset]);
    }
    addCut(level, {
      pts,
      s: dist,
      w: riverW,
      skip: [dist - 80, dist + 80],
      after: () => put(Math.max(0.5, roadEdge - coverStart + 10 * (pts.length - 1) - 6)),
    });
  }
}
// the level's covers = the highway's own (rivers) + the level's generated inclusions; a NEW array
// so render.ts re-merges them
function syncCovers(level) {
  const state = level._hw;
  state.coversDirty = false;
  level._coversBase = state.covers;
  level.covers = [...state.covers, ...((level._incl && level._incl.covers) || [])];
}
// ---- SCENERY v2 (user, 2026-10-06: "i thought we were going to vary sceneary along side the road
// more like farms or long grass hedges and small towns"; "yeah scenery too please"). In the FARM
// stretches: a PATCHWORK of FIELDS each side - rotated zones (lab.js zoneAt / render.ts drawZones,
// so what you see is what you drive on): WHEAT and RAPESEED (drive as long grass, drawn as crops:
// zone.art), MEADOW (long grass), PASTURE (grass, sheep / cows), PLOUGHED (dirt, furrows), now and
// then a FARMYARD (gravel, barns, bales). Each is ringed by a LONG GRASS border (HEDGE_W m, a zone
// you drive through - user, 2026-10-06: "hedges around fields ... should be long grass"; the first
// cut was a solid 'hedge' barrier, which beached spun racers: pacesuite 2/9 -> 3/9 BAD), a tree or
// two in it. Now and then a VILLAGE: a lane following the road ~40 m out, houses both sides, a
// church. Each field / village is a keep rect in st.keep with a `field` id: anything placed LATER
// that needs the ground (a bridge approach, a river, a slip) drops it whole (dropField); later
// scenery avoids it (blocked). The left side starts past the secret side road's band. Random
// choices: st.frnd (own stream). Cost per field: one zone + 2 polylines.
const FIELD_T = [
  ["wheat", 0.24],
  ["plough", 0.18],
  ["rapeseed", 0.12],
  ["meadow", 0.2],
  ["pasture", 0.18],
  ["yard", 0.08],
];
// [physics surface, look]. Looks REUSE the grass / long grass / mud textures, recoloured (user:
// "jsut reuse mud and grass or long grass textures for field, and maybe colour them"; render.ts
// SURFACE_ART wheat / rapeseed / pastureG / plough). Ploughed = MUD: look = grip.
const FIELD_SURF = {
  wheat: ["grassLong", "wheat"],
  rapeseed: ["grassLong", "rapeseed"],
  meadow: ["grassLong", null],
  plough: ["mud", "plough"],
  pasture: ["grass", "pastureG"],
  yard: ["gravel", null],
};
const HEDGE_W = 2.5;
const ROOFS = ['#8a3a2e', '#9a4a36', '#6e6a5e', '#5b626b', '#7a5a48', '#8a3a2e'];
// SAT overlap of two keep rects { x, y, ax, ay (unit axis), hu, hv }
function overlap(rectA, rectB) {
  const dx = rectB.x - rectA.x, dy = rectB.y - rectA.y;
  for (const [axisU, axisV] of [
    [rectA.ax, rectA.ay],
    [-rectA.ay, rectA.ax],
    [rectB.ax, rectB.ay],
    [-rectB.ay, rectB.ax],
  ]) {
    const radA =
      rectA.hu * Math.abs(rectA.ax * axisU + rectA.ay * axisV) +
      rectA.hv * Math.abs(-rectA.ay * axisU + rectA.ax * axisV);
    const radB =
      rectB.hu * Math.abs(rectB.ax * axisU + rectB.ay * axisV) +
      rectB.hv * Math.abs(-rectB.ay * axisU + rectB.ax * axisV);
    if (Math.abs(dx * axisU + dy * axisV) > radA + radB) return false;
  }
  return true;
}
// a later feature k (a keep rect) that needs the ground: drop every field / village it overlaps,
// whole
function clearFields(level, rect) {
  const ids = new Set(
    level._hw.keep
      .filter((other) => other.field != null && overlap(other, rect))
      .map((other) => other.field)
  );
  if (!ids.size) return;
  const survives = (item) => item.field == null || !ids.has(item.field);
  // (+ its animals, S-C: loose objects not yet handed to the game; the live ones go via goneFields
  // -> main.js game.cones.cull)
  for (const list of [
    level.zones,
    level.barriers,
    level.props,
    level.lanes,
    level._hw.keep,
    level.cones,
    level._hw.looseNew || [],
  ]) {
    const kept = list.filter(survives);
    if (kept.length !== list.length) {
      list.length = 0;
      list.push(...kept);
    }
  }
  level.solidsDirty = true;
  const gone = (level._hw.goneFields ||= new Set());
  for (const fieldId of ids) gone.add(fieldId);
}
const pickW = (rand, table) => {
  let roll = rand() * table.reduce((sum, entry) => sum + entry[1], 0);
  for (const [kind, weight] of table) if ((roll -= weight) <= 0) return kind;
  return table[0][0];
};
// is rect k clear of the road (r m past its edge, the side road too) and of every keep rect?
function roomFor(state, rect, clear, margin) {
  if (state.keep.some((other) => overlap(other, rect))) return false;
  const nx = -rect.ay, ny = rect.ax;
  for (const [fracU, fracV] of [
    [0, 0],
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
    [0, -1],
    [0, 1],
    [-0.5, -1],
    [0.5, -1],
  ])
    if (
      !clear(
        rect.x + rect.ax * fracU * rect.hu + nx * fracV * rect.hv,
        rect.y + rect.ay * fracU * rect.hu + ny * fracV * rect.hv,
        margin
      )
    )
      return false;
  return true;
}
function village(level, i, pointAt, clear) {
  const state = level._hw,
    road = state.pts,
    halfWidth = state.geo.hw,
    rand = state.frnd,
    dist = road[i].s;
  const side = rand() < 0.5 ? -1 : 1,
    span = 110 + rand() * 70,
    count = Math.ceil(span / STEP),
    mid = side < 0 ? halfWidth + 46 : halfWidth + 38;
  if (i + count >= road.length) return;
  state.villageNext = dist + 3000 + rand() * 4000;
  const centreIdx = i + (count >> 1),
    centre = pointAt(centreIdx, side * mid),
    fieldId = ++state.fieldId;
  const rect = {
    x: centre.x,
    y: centre.y,
    ax: Math.cos(centre.rot),
    ay: Math.sin(centre.rot),
    hu: span / 2 + 6,
    hv: 15,
    field: fieldId,
  };
  if (!roomFor(state, rect, clear, 6)) return;
  keepOut(level, rect, dist);
  const pts = [];
  for (let j = i; j <= i + count; j += 2) {
    const pos = pointAt(j, side * mid);
    pts.push([pos.x, pos.y]);
  }
  level.lanes.push({ pts, width: 5, surface: SURFACES.tarmac, field: fieldId, _s: dist });
  const churchIdx = centreIdx + (rand() < 0.5 ? -6 : 6);
  for (let j = i + 2; j < i + count - 1; j += 3) for (const houseSide of [-1, 1]) {
    // the churchyard
    if (houseSide === side && Math.abs(j - churchIdx) < 5) continue;
    if (rand() > 0.75) continue;
    const pos = pointAt(j, side * mid + houseSide * 7.5);
    level.props.push({
      kind: "block",
      x: pos.x,
      y: pos.y,
      w: 6.5 + rand() * 2.5,
      h: 5.5 + rand() * 1.5,
      rot: pos.rot,
      roof: ROOFS[(rand() * ROOFS.length) | 0],
      house: true,
      field: fieldId,
      _s: dist,
    });
  }
  {
    const pos = pointAt(churchIdx, side * (mid + 9));
    level.props.push({
      kind: "block",
      x: pos.x,
      y: pos.y,
      w: 15,
      h: 6.5,
      rot: pos.rot,
      roof: "#6e6a5e",
      church: true,
      field: fieldId,
      _s: dist,
    });
  }
}
/**
 * A point on a field plot, `along` its length and `across` its depth (the sign follows the
 * side the plot is on, so positive is away from the road).
 * @param {object} plot the field plot (centre, axis, normal, side)
 * @param {number} along metres along the field's long axis
 * @param {number} across metres across it, away from the road
 * @returns {number[]} [x, y]
 */
function fieldCorner(plot, along, across) {
  const { centre, axisX, axisY, nx, ny, side } = plot;
  return [
    centre.x + axisX * along + nx * across * side,
    centre.y + axisY * along + ny * across * side,
  ];
}
/**
 * A random point well inside a field plot (draws two random numbers: along, then across).
 * @param {object} plot the field plot
 * @param {() => number} rand the field random stream
 * @param {number} margin metres kept clear of the edges
 * @returns {number[]} [x, y]
 */
function fieldInside(plot, rand, margin) {
  const { fieldLen, depth } = plot;
  return fieldCorner(
    plot,
    (rand() - 0.5) * (fieldLen - 2 * margin),
    (rand() - 0.5) * (depth - 2 * margin)
  );
}
/**
 * Add a field's surface zone and, after it, the bigger long-grass hedge zone round it.
 * @param {object} level the highway level
 * @param {object} plot the field plot
 * @returns {void}
 */
function addFieldZones(level, plot) {
  const { centre, fieldLen, depth, heading, fieldId, type, dist } = plot;
  const [phys, art] = FIELD_SURF[type];
  // the field FIRST (zones: the first listed wins, and is painted last), then its long-grass
  // border: one zone HEDGE_W bigger all round
  level.zones.push({
    x: centre.x,
    y: centre.y,
    w: fieldLen,
    h: depth,
    rot: heading,
    surface: SURFACES[phys],
    art,
    field: fieldId,
    _s: dist,
  });
  level.zones.push({
    x: centre.x,
    y: centre.y,
    w: fieldLen + 2 * HEDGE_W,
    h: depth + 2 * HEDGE_W,
    rot: heading,
    surface: SURFACES.grassLong,
    art: "hedgerow",
    hedge: true,
    field: fieldId,
    _s: dist,
  });
}
/**
 * Add the hedgerow trees on a field's far edge (1 to 3, random).
 * @param {object} level the highway level
 * @param {object} plot the field plot
 * @param {() => number} rand the field random stream
 * @returns {void}
 */
function addFieldTrees(level, plot, rand) {
  const { fieldLen, depth, fieldId, dist } = plot;
  const far = depth / 2 + HEDGE_W / 2;
  for (let treeIdx = 0, treeCount = 1 + ((rand() * 2.4) | 0); treeIdx < treeCount; treeIdx++) {
    const [x, y] = fieldCorner(plot, (rand() - 0.5) * (fieldLen - 10), far);
    level.props.push({
      kind: "tree",
      x,
      y,
      s: 4.5 + rand() * 2.5,
      seed: (fieldId * 7 + treeIdx) | 0,
      field: fieldId,
      _s: dist,
    });
  }
}
/**
 * Wheat field: now and then a scatter of bales.
 * @param {object} level the highway level
 * @param {object} plot the field plot
 * @param {() => number} rand the field random stream
 * @returns {void}
 */
function addFieldBales(level, plot, rand) {
  const { fieldId, type, dist } = plot;
  if (type === "wheat" && rand() < 0.45)
    for (let num = 3 + ((rand() * 4) | 0); num > 0; num--) {
      const [x, y] = fieldInside(plot, rand, 5);
      level.props.push({ kind: "bale", x, y, field: fieldId, _s: dist });
    }
}
/**
 * Pasture: a flock of sheep or a herd of cows (loose objects, not props).
 * @param {object} plot the field plot
 * @param {() => number} rand the field random stream
 * @param {object[]} loose where the loose objects go
 * @returns {void}
 */
function addFieldStock(plot, rand, loose) {
  const { fieldId, type, dist } = plot;
  if (type === "pasture") {
    const species = rand() < 0.6 ? "sheep" : "cow";
    for (let num = (species === "sheep" ? 5 : 3) + ((rand() * 5) | 0); num > 0; num--) {
      const [x, y] = fieldInside(plot, rand, 4);
      loose.push({ kind: species, x, y, rot: rand() * 6.28, field: fieldId, _s: dist });
    }
  }
}
/**
 * Farm yard: two sheds and a few bales.
 * @param {object} level the highway level
 * @param {object} plot the field plot
 * @param {() => number} rand the field random stream
 * @returns {void}
 */
function addFieldYard(level, plot, rand) {
  const { fieldLen, depth, heading, fieldId, type, dist } = plot;
  if (type === 'yard') {
    for (let num = 0; num < 2; num++) {
      const [x, y] = fieldCorner(plot, (num ? 1 : -1) * fieldLen * 0.22, depth * 0.12);
      level.props.push({
        kind: "block",
        x,
        y,
        w: Math.min(16, fieldLen * 0.3),
        h: Math.min(10, depth * 0.3),
        rot: heading,
        roof: ["#8a3a2e", "#2c2f33", "#6e6a5e"][(rand() * 3) | 0],
        field: fieldId,
        _s: dist,
      });
    }
    for (let num = 2 + ((rand() * 4) | 0); num > 0; num--) {
      const [x, y] = fieldCorner(plot, (rand() - 0.5) * fieldLen * 0.5, -depth * 0.28);
      level.props.push({ kind: "bale", x, y, field: fieldId, _s: dist });
    }
  }
}
/**
 * Lay one strip of fields beside the road: one or two rows, each a field with its zones, trees
 * and contents. A row that has no room (roomFor) is skipped.
 * @param {object} level the highway level
 * @param {object} strip {side, i, dist, fieldLen, count}: side, road index / distance, size
 * @param {Function} pointAt road point at (index, offset)
 * @param {object} clear the areas already built on
 * @param {object[]} loose where loose objects (livestock) go
 * @returns {void}
 */
function layFieldRows(level, strip, pointAt, clear, loose) {
  const state = level._hw, halfWidth = state.geo.hw, rand = state.frnd;
  const { side, i, dist, fieldLen, count } = strip;
  const centreIdx = i + (count >> 1),
    heading = pointAt(centreIdx, 0).rot,
    axisX = Math.cos(heading),
    axisY = Math.sin(heading),
    nx = -axisY,
    ny = axisX;
  let offset = (side < 0 ? halfWidth + 25 : halfWidth + 11) + rand() * 6;
  for (let row = 0, rows = rand() < 0.55 ? 2 : 1; row < rows; row++) {
    const depth = 38 + rand() * 45,
      centre = pointAt(centreIdx, side * (offset + depth / 2)),
      fieldId = ++state.fieldId,
      type = pickW(rand, FIELD_T);
    offset += depth + 5 + rand() * 6;
    const rect = {
      x: centre.x,
      y: centre.y,
      ax: axisX,
      ay: axisY,
      hu: fieldLen / 2 + HEDGE_W,
      hv: depth / 2 + HEDGE_W,
      field: fieldId,
    };
    if (!roomFor(state, rect, clear, 4)) continue;
    keepOut(level, rect, dist);
    const plot = {
      side, dist, fieldLen, depth, centre, heading, axisX, axisY, nx, ny, fieldId, type,
    };
    addFieldZones(level, plot);
    addFieldTrees(level, plot, rand);
    addFieldBales(level, plot, rand);
    addFieldStock(plot, rand, loose);
    addFieldYard(level, plot, rand);
  }
}
/**
 * Scenery v2 fields beside the road on a farm biome: starts the village schedule, builds a
 * village when due, and lays a strip of fields on each side when the last one has ended.
 * @param {object} level the highway level
 * @param {number} i road point index
 * @param {Function} pointAt road point at (index, offset)
 * @param {object} clear the areas already built on
 * @param {string} biome the biome here
 * @param {object[]} loose where loose objects (livestock) go
 * @returns {void}
 */
function fields(level, i, pointAt, clear, biome, loose) {
  const state = level._hw,
    road = state.pts,
    rand = state.frnd,
    dist = road[i].s;
  if (!state.fieldNext) {
    state.fieldNext = { "-1": 0, 1: 0 };
    state.villageNext = 1200 + rand() * 2000;
  }
  if (biome !== "farm" || level._cfg.walls) {
    state.fieldNext[-1] = Math.max(state.fieldNext[-1], dist);
    state.fieldNext[1] = Math.max(state.fieldNext[1], dist);
    return;
  }
  if (dist >= state.villageNext) village(level, i, pointAt, clear);
  for (const side of [-1, 1]) {
    if (dist < state.fieldNext[side]) continue;
    const fieldLen = 70 + rand() * 70, count = Math.ceil(fieldLen / STEP);
    if (i + count + 2 >= road.length) continue;
    state.fieldNext[side] = dist + fieldLen + 5 + rand() * 8;
    layFieldRows(level, { side, i, dist, fieldLen, count }, pointAt, clear, loose);
  }
}
/**
 * The signs before an off-slip, the SAME for every type: 180 / 120 / 60 m posts + the exit board.
 * @param {object} level the highway level
 * @param {number} i road point index of the slip
 * @param {Function} pointAt road point at (index, offset)
 * @param {Function} mark stamps a prop with its road distance
 * @param {string} label the place name on the board
 * @returns {void}
 */
function addSlipSigns(level, i, pointAt, mark, label) {
  const halfWidth = level._hw.geo.hw;
  // the signs before it, the SAME for every type (you cannot tell which one comes back): 180 /
  // 120 / 60 m posts + the exit board
  for (const [delta, bars] of [
    [-180, 3],
    [-120, 2],
    [-60, 1],
  ]) {
    const j = i + Math.round(delta / STEP);
    if (j < 0) continue;
    const pos = pointAt(j, -(halfWidth + 3));
    level.props.push(mark({ kind: "slipcount", x: pos.x, y: pos.y, rot: pos.rot, bars }));
  }
  {
    const j = i - Math.round(90 / STEP);
    if (j >= 0) {
      const pos = pointAt(j, -(halfWidth + 6));
      level.props.push(
        mark({
          kind: "board",
          x: pos.x,
          y: pos.y,
          rot: pos.rot,
          label: "EXIT \u2192 " + label,
          blue: true,
        })
      );
    }
  }
}
/**
 * The centreline of an off-slip: along the road, drifting out at SLIP_DEG (eased in over 60 m);
 * a long one then bends on away after 80 m.
 * @param {object} start the slip's first point {x, y, rot}
 * @param {number} len slip length in metres
 * @param {number} away degrees off the motorway at the end
 * @returns {number[][]} the line, a point every 10 m
 */
function slipCentreline(start, len, away) {
  let x = start.x,
    y = start.y,
    heading = start.rot;
  const line = [[x, y]];
  for (let along = 10; along <= len; along += 10) {
    heading =
      start.rot -
      ((SLIP_DEG * Math.min(1, along / 60) +
        (away - SLIP_DEG) * ease((along - 80) / Math.max(1, len - 80))) *
        Math.PI) /
        180;
    x += Math.cos(heading) * 10;
    y += Math.sin(heading) * 10;
    line.push([x, y]);
  }
  return line;
}
/**
 * The gate at the end of a slip, in a field (it moves back if the slip is cut short by the road
 * coming back).
 * @param {object} level the highway level
 * @param {number[][]} line the slip's centreline
 * @param {Function} mark stamps a prop with its road distance
 * @returns {Function} putGate: places the gate at the current end of the line
 */
function addSlipGate(level, line, mark) {
  const gate = mark({ kind: 'gate', x: 0, y: 0, rot: 0 });
  const putGate = () => {
    const count = line.length,
      [endX, endY] = line[count - 1],
      [prevX, prevY] = line[Math.max(0, count - 2)],
      endHeading = Math.atan2(endY - prevY, endX - prevX);
    Object.assign(gate, {
      x: endX + Math.cos(endHeading) * 3,
      y: endY + Math.sin(endHeading) * 3,
      rot: endHeading + Math.PI / 2,
    });
  };
  putGate();
  level.props.push(gate);
  return putGate;
}
/**
 * A long slip that the road swings back across is cut short there.
 * @param {object} level the highway level
 * @param {object} slip {line, lane, slip, putGate, len, dist}: the built slip
 * @returns {void}
 */
function addSlipCut(level, slip) {
  const { line, lane, prop, putGate, len, dist } = slip;
  addCut(level, {
    pts: line,
    s: dist,
    w: SLIP_W,
    skip: [dist - 40, dist + len + 40],
    after: () => {
      lane.pts.length = line.length;
      lane._segs = null;
      prop._bb = null;
      putGate();
      level.solidsDirty = true;
    },
  });
}
/**
 * An off-slip: signs, then a side road (type "side") or a slip lane with its gate, keep-out
 * area and, for a long one, the cut where the road swings back across it.
 * @param {object} level the highway level
 * @param {number} i road point index
 * @param {number} dist road distance at i
 * @param {Function} pointAt road point at (index, offset)
 * @param {Function} mark stamps a prop with its road distance
 * @returns {void}
 */
function buildSlip(level, i, dist, pointAt, mark) {
  const state = level._hw,
    road = state.pts,
    halfWidth = state.geo.hw,
    rand = state.xrnd,
    walled = !!level._cfg.walls;
  state.nextSlip = dist + SLIP_EVERY[0] + rand() * (SLIP_EVERY[1] - SLIP_EVERY[0]);
  const roll = rand(), type = roll < 0.25 ? 'side' : roll < 0.75 ? 'long' : 'short';
  // keep a bridge (and its approaches) clear of the slip; after a side road the next bridge waits
  // for its end (sideStep)
  if (dist > state.nextBridge - 450) state.nextBridge = dist + 450;
  const label = SLIP_NAMES[(Math.floor(dist / 1000) + state.seed) % SLIP_NAMES.length];
  addSlipSigns(level, i, pointAt, mark, label);
  if (type === "side") {
    state.side = {
      s0: dist,
      run: SIDE_RUN[0] + rand() * (SIDE_RUN[1] - SIDE_RUN[0]),
      pts: [],
      mpts: [],
      sPiece: dist,
    };
    sideStep(level, i, pointAt);
    return;
  }
  // a gap in the left wall (walled preset) where it leaves
  if (walled)
    for (let j = Math.max(0, i - 4); j < Math.min(road.length, i + 28); j++) road[j].gapL = 1;
  const len = type === 'long' ? SLIP_LONG[0] + rand() * (SLIP_LONG[1] - SLIP_LONG[0]) : SLIP_LEN;
  // degrees off the motorway at the end: a long one bends away, off screen
  const away = type === "long" ? 18 + rand() * 22 : SLIP_DEG;
  const start = pointAt(i, -halfWidth), rot = start.rot - SLIP_DEG * Math.PI / 180;
  const line = slipCentreline(start, len, away);
  const [x, y] = line[line.length - 1];
  const prop = mark({
    kind: "slip",
    x: start.x,
    y: start.y,
    rot,
    line,
    w: SLIP_W,
    len,
    label,
    type,
  });
  level.props.push(prop);
  // the tarmac: a lane ribbon (lab.js laneAt + render.ts drawLanes, as the pit lanes), starting
  // 12 m back and 2.6 m INSIDE the edge so its round end lies under the motorway ribbon
  // (PHOTOGRAPHED 2026-10-06: starting outside the edge left a stub in the verge)
  const lanePt = pointAt(Math.max(0, i - 3), -halfWidth + 2.6),
    lane = {
      pts: [[lanePt.x, lanePt.y], ...line.slice(1)],
      width: SLIP_W,
      surface: SURFACES.tarmac,
      _s: dist,
    };
  level.lanes.push(lane);
  const putGate = addSlipGate(level, line, mark);
  keepOut(
    level,
    {
      x: (start.x + x) / 2,
      y: (start.y + y) / 2,
      ax: Math.cos(Math.atan2(y - start.y, x - start.x)),
      ay: Math.sin(Math.atan2(y - start.y, x - start.x)),
      hu: Math.hypot(x - start.x, y - start.y) / 2 + 6,
      hv: len > 200 ? 30 : 8,
    },
    dist
  );
  if (type === "long") addSlipCut(level, { line, lane, prop, putGate, len, dist });
}
/**
 * Add the motorway's own parapets either side of a river bridge (lab walls).
 * @param {object} level the highway level
 * @param {number} i road point index at the bridge
 * @param {number} dist road distance at i
 * @param {Function} pointAt road point at (index, offset)
 * @returns {void}
 */
function addRiverParapets(level, i, dist, pointAt) {
  const road = level._hw.pts, halfWidth = level._hw.geo.hw;
  for (const side of [-1, 1]) {
    const pts = [];
    for (let step = -6; step <= 6; step++) {
      const j = Math.max(0, Math.min(road.length - 1, i + step)),
        pos = pointAt(j, side * (halfWidth + 1.2));
      pts.push([pos.x, pos.y]);
    }
    level.barriers.push({ kind: "wall", pts, _s: dist });
  }
}
/**
 * A bridge: over (road / rail / foot) or the motorway over a river, with its cheeky extras and
 * what moves across it, then the approaches (or the river and its parapets).
 * @param {object} level the highway level
 * @param {number} i road point index
 * @param {number} dist road distance at i
 * @param {Function} pointAt road point at (index, offset)
 * @param {Function} mark stamps a prop with its road distance
 * @returns {void}
 */
function buildBridge(level, i, dist, pointAt, mark) {
  const state = level._hw,
    halfWidth = state.geo.hw,
    rand = state.xrnd,
    walled = !!level._cfg.walls;
  state.nextBridge = dist + BRIDGE_EVERY[0] + rand() * (BRIDGE_EVERY[1] - BRIDGE_EVERY[0]);
  // no slip under a bridge's approach
  if (dist > state.nextSlip - 400) state.nextSlip = dist + 400;
  const roll = rand(),
    kind = roll < 0.38 ? "road" : roll < 0.62 ? "rail" : roll < 0.82 ? "foot" : "river";
  // walled: the wall stands wallGap off the edge - the span and the parapets clear it
  const wallOff = walled ? level._cfg.wallGap : 0,
    centre = pointAt(i, 0),
    skew = (rand() - 0.5) * 0.5,
    span = 2 * halfWidth + 2 * PIER + 6 + 2 * wallOff;
  const bridge = mark({
    kind: kind === "river" ? "river" : "bridge",
    carries: kind,
    x: centre.x,
    y: centre.y,
    rot: centre.rot + Math.PI / 2 + skew,
    wid: span,
    seed: dist | 0,
    skew,
    roadHw: halfWidth + 1.2 + wallOff,
  });
  // CHEEKY EXTRAS, rare (each ~1 in 6 of its bridge type)
  const extra = rand() < 1 / 6;
  if (kind === "road") {
    bridge.cars = 1 + ((rand() * 2) | 0);
    bridge.cow = extra;
  }
  if (kind === "foot") {
    bridge.cone = extra;
    bridge.people = 1 + ((rand() * 3) | 0);
  }
  if (kind === "river") {
    bridge.boat = extra;
    bridge.ww = 10 + rand() * 8;
  }
  // what MOVES across it (render.ts drawBridge, wall clock, no physics): road traffic both ways,
  // walkers, a train now and then
  bridge.phase = rand() * 1000;
  if (kind === 'rail') bridge.trainEvery = 14 + rand() * 16;
  level.props.push(bridge);
  if (kind === 'river') {
    // the motorway's own parapets over it (lab walls); on the walled preset its wall is already
    // there
    if (!walled) addRiverParapets(level, i, dist, pointAt);
    river(level, bridge, dist);
  } else approaches(level, bridge, dist);
}
/**
 * Everything the road adds beside itself at one point, from its own random stream (state.xrnd,
 * not the road's: adding / changing an extra never re-rolls the road's shape): an off-slip, or
 * else a bridge, or else (rarely) a smiley solar farm.
 * @param {object} level the highway level
 * @param {number} i road point index
 * @param {number} dist road distance at i
 * @param {Function} pointAt road point at (index, offset)
 * @param {Function} mark stamps a prop with its road distance
 * @returns {void}
 */
function extras(level, i, dist, pointAt, mark) {
  // every random choice here draws from st.xrnd (not the road's st.rnd): adding / changing an extra
  // never re-rolls the road's shape
  const state = level._hw,
    road = state.pts,
    halfWidth = state.geo.hw,
    rand = state.xrnd,
    walled = !!level._cfg.walls;
  if (state.nextSlip == null) {
    state.nextSlip = 900 + rand() * 900;
    state.nextBridge = 500 + rand() * 500;
  }
  // OFF-SLIP: needs 60 m of straight before (signs) and 150 m after; never while the side road is
  // running
  if (
    dist >= state.nextSlip &&
    !state.side &&
    i > 20 &&
    i < road.length - 50 &&
    straightAt(road, i, 15, 38)
  ) {
    buildSlip(level, i, dist, pointAt, mark);
    return;
  }
  // BRIDGES: over (road / rail / foot) or the motorway over a river. Not while the side road runs
  // beside the motorway.
  if (dist >= state.nextBridge && !state.side && i < road.length - 20 && straightAt(road, i, 12)) {
    buildBridge(level, i, dist, pointAt, mark);
    return;
  }
  // SMILEY SOLAR FARM: rare, well off the road (not on walled: nothing grows inside the walls)
  if (!walled && i % 200 === 0 && rand() < 0.15) {
    const side = rand() < 0.5 ? -1 : 1,
      pos = pointAt(i, side * (halfWidth + 45 + rand() * 30));
    if (!blocked(state.keep, pos.x, pos.y, 16))
      level.props.push(mark({ kind: "solarfarm", x: pos.x, y: pos.y, rot: pos.rot + Math.PI / 2 }));
  }
}
// the roadside debris mix (weights by repetition: pallets / boxes / tarps are what really ends up
// on a hard shoulder) + paint for bins, barrels, bumpers, tarps
const DEBRIS_PICK = [
  "pallet",
  "pallet",
  "box",
  "box",
  "crate",
  "bin",
  "sandbag",
  "barrel",
  "exhaust",
  "bumper",
  "tarp",
  "tarp",
];
const DEBRIS_COL = ['#2f5d3a', '#2b56b5', '#c8302c', '#3a3f47', '#d6a21e', '#2f6fb0'];
const SLIP_NAMES = [
  "GOOLE",
  "SCUNTHORPE",
  "NOWHERE",
  "BRIGG",
  "SERVICES (SHUT)",
  "HOWDEN",
  "A NICE FIELD",
  "SOMEWHERE",
  "HULL (NOT REALLY)",
  "THE NORTH",
];
/**
 * Build the shared context of one dress() call: the road window and the two helpers every step
 * uses (pointAt, clear).
 * @param {object} level the highway level
 * @param {number} firstIdx first road point to dress
 * @param {number} endIdx end (exclusive) road point
 * @param {object[]|null} loose where loose objects go
 * @returns {object} the dress context
 */
function makeDressContext(level, firstIdx, endIdx, loose) {
  const state = stateOf(level), rand = state.rnd, halfWidth = state.geo.hw, road = state.pts;
  const pointAt = (i, off) => {
    const before = road[Math.max(0, i - 1)],
      after = road[Math.min(road.length - 1, i + 1)],
      heading = Math.atan2(after.y - before.y, after.x - before.x);
    return {
      x: road[i].x - Math.sin(heading) * off,
      y: road[i].y + Math.cos(heading) * off,
      rot: heading,
    };
  };
  // clear of the road AND of every approach / river / slip (st.keep) AND of the secret side road
  // (its points carry sideOff)
  const clear = (x, y, radius) => {
    for (let j = Math.max(0, firstIdx - 60); j < Math.min(road.length, endIdx + 60); j += 2) {
      const dist2 = (road[j].x - x) ** 2 + (road[j].y - y) ** 2;
      if (
        dist2 < (halfWidth + radius) ** 2 ||
        (road[j].sideOff && dist2 < (road[j].sideOff + SLIP_W / 2 + radius) ** 2)
      )
        return false;
    }
    return !blocked(state.keep, x, y, radius);
  };
  return { level, state, rand, halfWidth, road, firstIdx, endIdx, loose, pointAt, clear };
}

/**
 * Half the road is FARMLAND now (fields, hedges, villages: fields() above), was a third.
 * @param {number} dist road distance
 * @returns {string} the biome name there
 */
function biomeAtDist(dist) {
  return ["farm", "forest", "farm", "rocky", "farm", "forest"][Math.floor(dist / 2200) % 6];
}

/**
 * Trees (and, on rocky ground, rocks) beside the road at point i (every third point).
 * @param {object} ctx the dress context
 * @param {number} i road point index
 * @param {number} dist road distance at i
 * @param {string} biomeName biome at i
 * @param {Function} mark tags an object with its road distance
 * @returns {void}
 */
function layRoadsideTrees(ctx, i, dist, biomeName, mark) {
  const { level, rand, halfWidth, pointAt, clear } = ctx;
  if (i % 3 === 0) for (const side of [-1, 1]) {
    const dens = biomeName === 'forest' ? 0.75 : biomeName === 'farm' ? 0.18 : 0.25;
    if (rand() < dens) {
      const pos = pointAt(
        i,
        side * (halfWidth + 10 + rand() * (biomeName === "forest" ? 40 : 25))
      );
      if (clear(pos.x, pos.y, 8))
        level.props.push(
          mark({ kind: "tree", x: pos.x, y: pos.y, s: 4 + rand() * 3, seed: (dist | 0) * 2 + 1 })
        );
    }
    if (biomeName === "rocky" && rand() < 0.3) {
      const pos = pointAt(i, side * (halfWidth + 6 + rand() * 30));
      if (clear(pos.x, pos.y, 5))
        level.props.push(
          mark({ kind: "rock", x: pos.x, y: pos.y, s: 2 + rand() * 4, seed: (dist | 0) + 7 })
        );
    }
  }
}

/**
 * A farm building block now and then (every 40th point on farmland).
 * @param {object} ctx the dress context
 * @param {number} i road point index
 * @param {string} biomeName biome at i
 * @param {Function} mark tags an object with its road distance
 * @returns {void}
 */
function layFarmBlock(ctx, i, biomeName, mark) {
  const { level, rand, halfWidth, pointAt, clear } = ctx;
  if (biomeName === "farm" && i % 40 === 0 && rand() < 0.4) {
    const side = rand() < 0.5 ? -1 : 1,
      pos = pointAt(i, side * (halfWidth + 30 + rand() * 25));
    if (clear(pos.x, pos.y, 12))
      level.props.push(
        mark({
          kind: "block",
          x: pos.x,
          y: pos.y,
          w: 14,
          h: 8,
          rot: pos.rot + rand(),
          roof: ["#8a3a2e", "#6e6a5e", "#3f5a3a"][(rand() * 3) | 0],
        })
      );
  }
}

/**
 * GANTRY every ~3 km, a SIGN every ~700 m (the distance to Hull GOES UP) (never with a leg /
 * board on a slip, an approach or the side road: a gantry there moves on 40 m, a board swaps
 * sides or is left out).
 * @param {object} ctx the dress context
 * @param {number} i road point index
 * @param {number} dist road distance at i
 * @param {Function} mark tags an object with its road distance
 * @returns {void}
 */
function layGantryAndSign(ctx, i, dist, mark) {
  const { level, state, halfWidth, road, pointAt } = ctx;
  const freeAt = (j, off, radius) => {
    const pos = pointAt(j, off);
    return !(road[j].sideOff && off < 0) && !blocked(state.keep, pos.x, pos.y, radius)
      ? pos
      : null;
  };
  if (Math.floor(dist / 3000) !== Math.floor((dist - STEP) / 3000)) state.gantryDue = true;
  if (state.gantryDue && freeAt(i, -(halfWidth + 3), 2) && freeAt(i, halfWidth + 3, 2)) {
    state.gantryDue = false;
    const pos = pointAt(i, 0);
    level.props.push(
      mark({
        kind: "gantry",
        x: pos.x,
        y: pos.y,
        rot: pos.rot + Math.PI / 2,
        wid: state.geo.width + 6,
      })
    );
  }
  if (Math.floor(dist / 700) !== Math.floor((dist - STEP) / 700)) {
    const count = Math.floor(dist / 700),
      sideSign = count % 2 ? 1 : -1,
      label =
        count % 3 === 0
          ? `HULL ${412 + count * 3} MI`
          : SIGNS[(count * 7 + state.seed) % SIGNS.length];
    const pos =
      freeAt(i, sideSign * (halfWidth + 6), 10) || freeAt(i, -sideSign * (halfWidth + 6), 10);
    if (pos) level.props.push(mark({ kind: 'board', x: pos.x, y: pos.y, rot: pos.rot, label }));
  }
}

/**
 * ROLLING HILLS: a broad hump beside the road every ~250 m (the road climbs its flank).
 * @param {object} ctx the dress context
 * @param {number} i road point index
 * @param {string} biomeName biome at i
 * @param {Function} mark tags an object with its road distance
 * @returns {void}
 */
function layHump(ctx, i, biomeName, mark) {
  const { level, rand, pointAt } = ctx;
  if (i % 60 === 0 && rand() < 0.6) {
    const pos = pointAt(i, (rand() < 0.5 ? -1 : 1) * (30 + rand() * 90));
    level.bumps.push(
      mark({
        kind: "hump",
        x: pos.x,
        y: pos.y,
        r: 110 + rand() * 160,
        h: (biomeName === "rocky" ? 6 : 3) + rand() * 8,
      })
    );
  }
}

/**
 * ARMCO on the OUTSIDE of the tighter bends: runs of points with |curv| > 1/400 (+curv = a
 * right-hander -> outside = the -normal side).
 * @param {object} ctx the dress context
 * @returns {void}
 */
function layArmco(ctx) {
  const { level, halfWidth, road, firstIdx, endIdx, pointAt } = ctx;
  let run = null;
  for (let i = firstIdx; i <= (level._cfg.walls ? -1 : endIdx); i++) {
    const curv = i < endIdx ? road[i].curv : 0, active = Math.abs(curv) > 1 / 400;
    if (active && !run) run = { a: i, side: -Math.sign(curv) };
    // (left-side armco breaks where a slip leaves or the side road runs: P[j].gapL)
    if ((!active || i === endIdx) && run) {
      let pts = [];
      const flush = () => {
        if (pts.length > 2) level.barriers.push({ kind: "armco", pts, _s: road[run.a].s });
        pts = [];
      };
      for (let j = Math.max(0, run.a - 8); j < Math.min(road.length, i + 8); j += 2) {
        if (run.side < 0 && road[j].gapL) {
          flush();
          continue;
        }
        const pos = pointAt(j, run.side * (halfWidth + 1.8));
        pts.push([pos.x, pos.y]);
      }
      flush();
      run = null;
    }
  }
}

/**
 * A chevron sign on the outside of a tight bend (one per 48 m, 4.5 m off the edge).
 * @param {object} ctx the dress context
 * @param {Function} addLoose adds a loose object tagged with its road distance
 * @param {number} i road point index
 * @param {number} dist road distance at i
 * @returns {void}
 */
function layChevron(ctx, addLoose, i, dist) {
  const { road, halfWidth, pointAt } = ctx;
  const curv = road[i].curv;
  if (Math.abs(curv) > 1 / 650 && i % 12 === 0) {
    const dir = Math.sign(curv),
      pos = pointAt(i, -dir * (halfWidth + 4.5));
    addLoose({ kind: "chevron", x: pos.x, y: pos.y, rot: pos.rot + (dir * Math.PI) / 2 }, dist);
  }
}

/**
 * Lone litter on both verges (~0.8 per 10 m), now and then on the hard shoulder.
 * @param {object} ctx the dress context
 * @param {object} loot the loose helpers (looseRand, addLoose, chance)
 * @param {number} i road point index
 * @param {number} dist road distance at i
 * @returns {void}
 */
function layVergeLitter(ctx, loot, i, dist) {
  const { halfWidth, pointAt } = ctx, cfg = ctx.level._cfg;
  const { looseRand, addLoose, chance } = loot;
  // ~0.8 per 10 m of verge (screenshot: 0.18 per 20 m read as bare)
  if (i % 4 === 0)
    for (const side of [-1, 1])
      if (looseRand() < chance(0.32)) {
        const onShoulder = side < 0 && cfg.shoulder >= 2 && looseRand() < 0.15,
          off = onShoulder
            ? -halfWidth + 0.4 + looseRand() * (cfg.shoulder - 0.8)
            : side * (halfWidth + 0.8 + looseRand() * 6);
        // (2026-10-06, user: "I want to SEE some debris"): ~1 in 2 of the litter (and of the
        // scatters) is ROADSIDE DEBRIS (cones.js DEBRIS kinds), the rest tyres + cones
        const pos = pointAt(i, off),
          roll = looseRand();
        addLoose(
          roll < 0.45
            ? {
                kind: DEBRIS_PICK[(looseRand() * DEBRIS_PICK.length) | 0],
                x: pos.x,
                y: pos.y,
                rot: looseRand() * 6.28,
                col: DEBRIS_COL[(looseRand() * DEBRIS_COL.length) | 0],
              }
            : roll < 0.7
              ? { kind: "tyre", x: pos.x, y: pos.y, rot: looseRand() * 6.28 }
              : { kind: "cone", x: pos.x, y: pos.y, rot: looseRand() * 6.28 },
          dist
        );
      }
}

/**
 * DEBRIS SCATTERS (2026-10-05 screenshots: lone 0.8 m tyres barely read at the treadmill
 * zoom): ~1 per 130 m, 4-7 mixed tyres + cones spread over 8 m of one verge, a few spilling
 * up to the edge line.
 * @param {object} ctx the dress context
 * @param {object} loot the loose helpers (looseRand, addLoose, chance)
 * @param {number} i road point index
 * @returns {void}
 */
function layDebrisScatter(ctx, loot, i) {
  const { halfWidth, road, pointAt } = ctx;
  const { looseRand, addLoose, chance } = loot;
  if (i % 8 === 0 && looseRand() < chance(0.25)) {
    const side = looseRand() < 0.5 ? -1 : 1,
      count = 4 + ((looseRand() * 4) | 0);
    for (let idx = 0; idx < count; idx++) {
      const j = Math.min(road.length - 1, i + ((looseRand() * 3) | 0)),
        pos = pointAt(j, side * (halfWidth + 0.6 + looseRand() * 7));
      {
        const roll2 = looseRand();
        addLoose(
          roll2 < 0.4
            ? {
                kind: DEBRIS_PICK[(looseRand() * DEBRIS_PICK.length) | 0],
                x: pos.x,
                y: pos.y,
                rot: looseRand() * 6.28,
                col: DEBRIS_COL[(looseRand() * DEBRIS_COL.length) | 0],
              }
            : roll2 < 0.75
              ? { kind: "tyre", x: pos.x, y: pos.y, rot: looseRand() * 6.28 }
              : { kind: "cone", x: pos.x, y: pos.y, rot: looseRand() * 6.28 },
          road[j].s
        );
      }
    }
  }
}

/**
 * A stray TYRE STACK pile now and then (every 50th point).
 * @param {object} ctx the dress context
 * @param {object} loot the loose helpers (looseRand, addLoose, chance)
 * @param {number} i road point index
 * @param {number} dist road distance at i
 * @returns {void}
 */
function layTyreStacks(ctx, loot, i, dist) {
  const { halfWidth, pointAt } = ctx;
  const { looseRand, addLoose, chance } = loot;
  if (i % 50 === 0 && looseRand() < chance(0.22)) {
    const side = looseRand() < 0.5 ? -1 : 1,
      base = pointAt(i, side * (halfWidth + 3 + looseRand() * 4));
    const count = 3 + ((looseRand() * 4) | 0);
    for (let idx = 0; idx < count; idx++)
      addLoose(
        {
          kind: "tyrestack",
          x: base.x + (looseRand() - 0.5) * 2.4,
          y: base.y + (looseRand() - 0.5) * 2.4,
        },
        dist
      );
  }
}

/**
 * A CONE TAPER closing the hard shoulder every ~1.6 km.
 * @param {object} ctx the dress context
 * @param {object} loot the loose helpers (addLoose, density)
 * @param {number} i road point index
 * @param {number} dist road distance at i
 * @returns {void}
 */
function layConeTaper(ctx, loot, i, dist) {
  const { halfWidth, road, pointAt } = ctx, cfg = ctx.level._cfg;
  const { addLoose, density } = loot;
  if (
    density > 0 &&
    cfg.shoulder >= 2 &&
    Math.floor(dist / 1600) !== Math.floor((dist - STEP) / 1600) &&
    dist > 600
  )
    for (let idx = 0; idx < 8; idx++) {
      const j = Math.min(road.length - 1, i + idx * 2),
        pos = pointAt(j, -halfWidth + 0.4 + (cfg.shoulder - 0.6) * (idx / 7));
      addLoose({ kind: "cone", x: pos.x, y: pos.y, rot: 0 }, road[j].s);
    }
}

/**
 * LOOSE ROADSIDE (user, 2026-10-05: "as it's open sided, be LITTERED with TYRES and CONES and
 * have appropriate CHEVRON signs for the corners"): knockable cones.js objects into `loose` (the
 * level's cones at a restart, else streamed in by main.js), open presets only. CHEVRONS on the
 * outside of every bend tighter than R 650, one per 48 m, 4.5 m off the edge (behind the armco
 * where there is one), arrows pointing the way it turns; LITTER on both verges (a lone tyre, a
 * cone, now and then on the hard shoulder); a stray TYRE STACK pile now and then; and a CONE
 * TAPER closing the hard shoulder every ~1.6 km.
 * @param {object} ctx the dress context
 * @returns {void}
 */
function layLooseRoadside(ctx) {
  const { level, state, road, firstIdx, endIdx, loose } = ctx;
  if (!level._cfg.walls && loose) {
    const looseRand = state.lrnd,
      addLoose = (obj, dist) => {
        obj._s = dist;
        loose.push(obj);
        return obj;
      };
    // LITTER DENSITY (user, 2026-10-05: "they should be RANDOM and also have a SLIDER for frequency
    // / density"; default 1 = as tested and seen): lv.litter x every litter chance (setup's LITTER
    // slider, 0 = none .. 3 = a scrapyard); chevrons are signs, not litter
    const density = level.litter ?? 1, chance = (prob) => Math.min(0.95, prob * density);
    const loot = { looseRand, addLoose, chance, density };
    for (let i = firstIdx; i < endIdx; i++) {
      const dist = road[i].s;
      layChevron(ctx, addLoose, i, dist);
      layVergeLitter(ctx, loot, i, dist);
      layDebrisScatter(ctx, loot, i);
      layTyreStacks(ctx, loot, i, dist);
      layConeTaper(ctx, loot, i, dist);
    }
  }
}

/**
 * WALLS (cfg.walls): both sides, in ~120 m pieces (each dropped behind with the rest),
 * overlapping by one point so there is no gap ... with a GAP in the left wall where a slip leaves
 * or the side road runs (P[j].gapL).
 * @param {object} ctx the dress context
 * @returns {void}
 */
function layWalls(ctx) {
  const { level, halfWidth, road, firstIdx, endIdx, pointAt } = ctx, cfg = level._cfg;
  if (cfg.walls)
    for (let startIdx = Math.max(0, firstIdx - 1); startIdx < endIdx; startIdx += 30)
      for (const side of [-1, 1]) {
        let pts = [];
        const flush = () => {
          if (pts.length > 1) level.barriers.push({ kind: cfg.walls, pts, _s: road[startIdx].s });
          pts = [];
        };
        // (beside the SECRET SIDE ROAD the left wall swings out with it, to its far edge - it
        // starts and ends at the normal line)
        for (let j = startIdx; j <= Math.min(road.length - 1, startIdx + 30); j++) {
          const sideOffset = side < 0 && road[j].sideOff;
          if (!sideOffset && side < 0 && road[j].gapL) {
            flush();
            continue;
          }
          const pos = pointAt(
            j,
            sideOffset
              ? -Math.max(halfWidth + cfg.wallGap, sideOffset + SLIP_W / 2 + cfg.wallGap)
              : side * (halfWidth + cfg.wallGap)
          );
          pts.push([pos.x, pos.y]);
        }
        flush();
      }
}

/**
 * Scenery for road points [firstIdx, endIdx): placed in WORLD coordinates (stays put when the
 * window moves); loose objects go into `loose`.
 * @param {object} level the highway level
 * @param {number} firstIdx first road point to dress
 * @param {number} endIdx end (exclusive) road point
 * @param {object[]|null} loose where loose objects go
 * @returns {void}
 */
function dress(level, firstIdx, endIdx, loose) {
  const ctx = makeDressContext(level, firstIdx, endIdx, loose);
  const { state, road, pointAt, clear } = ctx;
  // a long road can come back across what was laid beside an EARLIER stretch: every new point cuts
  // the approaches / rivers / slips
  for (let j = firstIdx; j < endIdx; j += 2)
    for (const cut of state.cuts)
      if (!cutSkips(cut, road[j].s)) cutBy(level, cut, road[j].x, road[j].y);
  for (let i = firstIdx; i < endIdx; i++) {
    const dist = road[i].s,
      biomeName = biomeAtDist(dist),
      mark = (obj) => {
        obj._s = dist;
        return obj;
      };
    // the side road's offset here first, so the trees below keep off it
    sideStep(level, i, pointAt);
    if (!NOF) fields(level, i, pointAt, clear, biomeName, loose);
    layRoadsideTrees(ctx, i, dist, biomeName, mark);
    layFarmBlock(ctx, i, biomeName, mark);
    // SLIP ROADS + BRIDGES (user, 2026-10-05: "off-slip every 2-4 km (tapering lane, sign, ends in
    // fields; drivable)"; "bridges over a road, a river and a railway + a footbridge"; "rare cheeky
    // extras"): planned on the road's own distance, placed only on near-straight road (|curv| <
    // 1/900 over the stretch), never on top of each other. extras(lv, i, s) below. (every preset
    // since 2026-10-06, user: "all the types of highway should have bridges and slip roads you can
    // take")
    if (!NOX) extras(level, i, dist, pointAt, mark);
    layGantryAndSign(ctx, i, dist, mark);
    layHump(ctx, i, biomeName, mark);
  }
  sideFlush(level, false);
  if (state.coversDirty) syncCovers(level);
  layArmco(ctx);
  layLooseRoadside(ctx);
  layWalls(ctx);
}
function rebuild(level) {
  const state = stateOf(level), road = state.pts;
  const sub = createSubtrack(
    road.map((point) => [point.x, point.y]),
    state.geo.width,
    [{ startDist: 0, endDist: 1e9, surface: SURFACES.tarmac }],
    [],
    true
  );
  // the closing segment, end -> start: never road
  ghostSegment(sub, road.length - 1);
  sub.laneDash = state.geo.dashes;
  sub.laneSolid = state.geo.solid;
  sub.sBase = road[0].s;
  // a new ROAD TYPE on the same seed is a different road: layoutId tells render.ts its cached
  // ground tiles are out of date
  sub.layoutId = level._layout || 0;
  level.subtrack = sub;
  prepBumps(level.bumps.filter((bump) => bump.reach2 == null));
  level._bumpGridOf = null;
  prepBarriersOf(level);
  const propSolids = solidsFromProps(level.props);
  level.solids.length = 0;
  level.solids.push(...propSolids);
}
// where the car is along the window: nearest road point (searched round last step's index first),
// absolute road distance s, signed offset (+ = driver's right) and the road direction there
function locate(state, x, y) {
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
// ROAD FRAME for ANY car (traffic.js, later the highway AI): like locate() but with the caller's
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
// first window (also RESTART: the same seed builds the same motorway, so cached ground tiles stay
// right)
export function resetHighway(level) {
  const rand = rng(level.seed);
  level._hw = {
    seed: level.seed,
    rnd: rand,
    grnd: rng((level.seed ^ 0x7f4a7c15) >>> 0),
    geo: laneGeo(level._cfg),
    pts: [],
    plan: [{ len: SPAWN_S + 150, k: 0, ramp: 0, hold: 0 }],
    x: 0,
    y: 0,
    hdg: UP_HEADING,
    s: 0,
    dressed: 0,
    target: 0,
    tUntil: 0,
    tSide: 0,
    offT: 0,
    warn: null,
    ci: 0,
    best: SPAWN_S,
    driven: 0,
    backT: 0,
    q: null,
    camDir: { x: 0, y: -1 },
    // the LOOSE ROADSIDE draws from its OWN stream: sharing rnd made every litter tweak re-roll the
    // road shape itself
    lrnd: rng((level.seed ^ 0x5bd1e995) >>> 0),
    // slips / bridges / extras draw from their OWN stream too; keep = scenery keep-out areas, cuts
    // = what a returning road cuts short, covers = the rivers' water (lv.covers via syncCovers),
    // side = the secret side road being built
    xrnd: rng((level.seed ^ 0x2c1b3c6d) >>> 0),
    frnd: rng((level.seed ^ 0x1b873593) >>> 0),
    fieldId: 0,
    fieldNext: null,
    keep: [],
    cuts: [],
    covers: [],
    side: null,
    coversDirty: true,
  };
  level.props.length = 0;
  level.bumps.length = 0;
  level.barriers.length = 0;
  level.solids.length = 0;
  level.lanes.length = 0;
  level.zones.length = 0;
  const state = level._hw;
  state.pts.push({ x: 0, y: 0, s: 0, curv: 0 });
  // the first window's loose objects ARE the level's cones (cones.js reset() reads lv.cones on
  // every restart)
  level.cones.length = 0;
  growTo(level, AHEAD + 300);
  dress(level, 0, state.pts.length, level.cones);
  state.dressed = state.pts.length;
  syncCovers(level);
  rebuild(level);
  state.looseNew = [];
  state.looseCut = null;
  // the LEFT lane (UK motorway)
  const pos = onTrack(level.subtrack, SPAWN_S, state.geo.centres[0], {});
  Object.assign(level.spawn, { x: pos.x, y: pos.y, heading: pos.rot });
  state.ci = Math.round(SPAWN_S / STEP);
  level.solidsDirty = true;
}
// call every physics step with the car: tracks progress + the camera's road direction, extends
// ahead / drops behind when the car has moved on. Returns the distance the window start moved
// (subtract it from any remembered road distance), or 0.
export function stepHighway(level, car) {
  const state = stateOf(level), loc = locate(state, car.x, car.y), road = state.pts;
  state.q = loc;
  state.driven = Math.max(state.driven, loc.s - SPAWN_S);
  state.best = Math.max(state.best, loc.s);
  // the CAMERA's lead direction (render.ts follow): the chord over the next ~60 m of road, so it
  // leans INTO a bend before you reach it
  {
    const here = road[loc.i],
      there = road[Math.min(road.length - 2, loc.i + 15)],
      span = Math.hypot(there.x - here.x, there.y - here.y);
    if (span > 1) state.camDir = { x: (there.x - here.x) / span, y: (there.y - here.y) / span };
  }
  if (road[road.length - 1].s - loc.s > AHEAD) return 0;
  // extend 300 m, dress it, drop what is BEHIND, rebuild loose objects for the new stretch wait in
  // st.looseNew, and st.looseCut is the road distance behind which main.js drops them
  // (game.cones.spawn / cull — the live objects belong to the game, not the level)
  growTo(level, state.s + 300);
  meterEvent('slide');
  dress(level, state.dressed, road.length, state.looseNew);
  state.dressed = road.length;
  let cut = 0;
  while (cut < road.length && road[cut].s < loc.s - BEHIND) cut++;
  const moved = road[cut].s - road[0].s;
  road.splice(0, cut);
  state.dressed -= cut;
  state.ci = Math.max(0, state.ci - cut);
  loc.i = state.ci;
  const startDist = road[0].s - 60;
  state.looseCut = startDist;
  const keep = (obj) => obj._s == null || obj._s >= startDist;
  for (const listKey of ["props", "bumps", "barriers", "lanes", "zones"]) {
    const list = level[listKey],
      kept = list.filter(keep);
    list.length = 0;
    list.push(...kept);
  }
  for (const listKey of ["keep", "cuts"]) {
    const list = state[listKey],
      kept = list.filter(keep);
    list.length = 0;
    list.push(...kept);
  }
  {
    const count = state.covers.length;
    state.covers = state.covers.filter(keep);
    if (count !== state.covers.length) state.coversDirty = true;
  }
  if (state.coversDirty) syncCovers(level);
  rebuild(level);
  // ?nonat=1 (judder test): a 9000-cell drop may force full GCs
  if (!settings.noNatClear) clearNaturalCache();
  level.solidsDirty = true;
  // wear left behind, or under ground that has changed, goes (lab.js pruneWear)
  pruneWear(car.x, car.y, BEHIND + AHEAD);
  return moved;
}
// SPEED CAMERAS (user, 2026-10-05: "cameras on the gantries: flash + 'CAUGHT 187 km/h' in the HUD
// top right, stored for missions / achievements later"; HANDOVER: "flash ONLY over 70 mph; YOU GOT
// CAUGHT + your speed + a fine (-$) scaling with how far over; store fastest catch + count"). Every
// gantry is a camera. speedCamera(lv, car) after stepHighway: the first step the car's road
// distance passes a gantry -> null (under the limit) or { kmh, mph, fine }. A fine: $100 + $10 per
// mph over, x2 past 100 mph over (UK-ish).
export const CAM_MPH = 70;
export function speedCamera(level, car) {
  const state = stateOf(level),
    loc = state.q;
  if (!loc) return null;
  const prev = state.camS ?? loc.s;
  state.camS = loc.s;
  if (loc.s <= prev) return null;
  for (const prop of level.props) {
    if (prop.kind !== "gantry" || prop._camHit) continue;
    const frame = roadFrame(level, prop.x, prop.y, loc.s);
    if (!frame || frame.s <= prev || frame.s > loc.s) continue;
    prop._camHit = 1;
    const mph = Math.hypot(car.vx, car.vy) * 2.23694;
    if (mph <= CAM_MPH) return null;
    const over = mph - CAM_MPH;
    prop._flash = performance.now();
    return {
      kmh: Math.round(mph * 1.609344),
      mph: Math.round(mph),
      fine: Math.round(((100 + 10 * over) * (over > 100 ? 2 : 1)) / 10) * 10,
    };
  }
  return null;
}
/**
 * Time the car driving backwards along the road; true when it has gone the wrong way for too long
 * (or is far behind the furthest point reached).
 * @param {object} state the highway state
 * @param {object} loc where the car is on the road (locate())
 * @param {object} car the car (vx, vy)
 * @param {number} dt step seconds
 * @returns {boolean} whether the car must be reset for going the wrong way
 */
function checkWrongWay(state, loc, car, dt) {
  const vAlong = car.vx * loc.dx + car.vy * loc.dy;
  state.backT = vAlong < -BACK_V ? state.backT + dt : 0;
  return state.backT > BACK_T || loc.s < state.best - BACK_M;
}

/**
 * How far the car is off the road edge, and whether it is on a tarmac lane off the motorway.
 * @param {object} state the highway state
 * @param {object} loc where the car is on the road (locate())
 * @param {object} car the car (x, y)
 * @returns {{out: number, onLane: boolean}} metres past the edge (0 on the side road) and lane flag
 */
function measureOffRoad(state, loc, car) {
  // THE SECRET SIDE ROAD is road (its points carry sideOff, the offset of its centre to the left);
  // any OTHER lane off the motorway (an off-slip, a bridge approach) holds the countdown and only
  // the far-out reset ends it, as "EXIT TAKEN" (user: "slip roads you can take")
  const pointHere = state.pts[loc.i],
    side =
      pointHere &&
      pointHere.sideOff &&
      loc.off < 0 &&
      Math.abs(-loc.off - pointHere.sideOff) < SIDE_W_HALF + 1;
  const out = side ? 0 : Math.abs(loc.off) - state.geo.hw;
  const onLane = out > OFF_SOFT && zoneSurfaceAt(car.x, car.y).id === 'tarmac';
  return { out, onLane };
}

/**
 * Run the off-road countdown one step: the speed back towards the road, the countdown, the
 * exit-taken flag and the warning text (st.warn).
 * @param {object} state the highway state
 * @param {number} out metres past the road edge
 * @param {boolean} onLane whether the car is on a tarmac lane off the motorway
 * @param {number} dt step seconds
 * @returns {void}
 */
function stepOffCountdown(state, out, onLane, dt) {
  const inRate = state.outPrev != null ? (state.outPrev - out) / dt : 0;
  state.outPrev = out;
  state.inV = (state.inV || 0) + (inRate - (state.inV || 0)) * Math.min(1, dt / 0.5);
  state.offT =
    out <= OFF_SOFT
      ? 0
      : out < OFF_NEAR || state.inV > BACK_IN || onLane
        ? state.offT
        : state.offT + dt;
  if (onLane) state.tookExit = true;
  else if (out <= OFF_SOFT) state.tookExit = false;
  state.warn =
    out > OFF_SOFT && !onLane
      ? `BACK TO THE ROAD  ${Math.max(1, Math.ceil(OFF_T - state.offT))}`
      : null;
}

/**
 * After stepHighway: null, or WHY the car must be put back (main.js shows it and calls
 * highwayRespawn). A runtime guard: wrong way for too long, or off the road too long / too far
 * (or having taken an exit), ends the run. st.warn = the off-road countdown text while one is
 * running (main.js shows it), else null.
 * @param {object} level the highway level
 * @param {object} car the car
 * @param {number} dt step seconds
 * @returns {string|null} the reset reason, or null
 */
export function highwayGuard(level, car, dt) {
  const state = stateOf(level),
    loc = state.q;
  if (!loc) return null;
  if (checkWrongWay(state, loc, car, dt)) return 'WRONG WAY — RESET';
  const { out, onLane } = measureOffRoad(state, loc, car);
  stepOffCountdown(state, out, onLane, dt);
  if (out > OFF_HARD || state.offT > OFF_T) {
    const exitTaken = state.tookExit;
    state.offT = 0;
    state.warn = null;
    state.tookExit = false;
    return exitTaken ? "EXIT TAKEN — BACK TO THE MOTORWAY" : "OFF THE MOTORWAY — RESET";
  }
  return null;
}
// the put-back pose: the LEFT lane, a few metres short of the furthest point reached, facing up the
// road
export function highwayRespawn(level) {
  const state = stateOf(level), dist = Math.max(0, state.best - 6 - state.pts[0].s);
  const pos = onTrack(level.subtrack, dist, state.geo.centres[0], {});
  state.backT = 0;
  state.ci = Math.min(state.pts.length - 1, Math.round(dist / STEP));
  state.q = null;
  return { x: pos.x, y: pos.y, h: pos.rot };
}
// ROAD TYPE (user, 2026-10-05: "how do I test the lane presets — I don't see any buttons"): Test
// Mode setup offers lv.roadTypes; the launch calls this before the restart builds the road.
// ?hw=interstate etc. still works for tools.
export function setHighwayPreset(level, preset) {
  if (!HW_PRESETS[preset] || level.roadType === preset) return;
  level.roadType = preset;
  level._cfg = HW_PRESETS[preset];
  level._layout = (level._layout || 0) + 1;
}
const settings = readSettings(typeof location !== 'undefined' ? location.search : '');
const QUERY_PRESET = typeof location !== 'undefined' ? settings.highwayDebug : null;
// node tools only: HWNOX=1 builds the road with NO slips / bridges / extras (an A/B of their effect
// on the AI, same roads)
const NOX = !!envValue("HWNOX");
// node only: no FIELDS (scenery v2 A/B)
const NOF = !!envValue("HWNOF");
export function createHighway(seed = 4242, preset = 'motorway') {
  if (!HW_PRESETS[preset]) preset = 'motorway';
  const level = {
    id: "highway",
    name: "Highway to Hull",
    endless: true,
    floor: 1000000,
    seed,
    _cfg: HW_PRESETS[preset],
    roadType: preset,
    roadTypes: HW_NAMES,
    base: SURFACES.grass,
    subtrack: null,
    camber: { maxDeg: 0, refR: 60, crown: 0.03, edge: 5, sections: [] },
    zones: [],
    bumps: [],
    covers: [],
    paint: [],
    boards: [],
    seams: false,
    cones: [],
    props: [],
    barriers: [],
    solids: [],
    lanes: [],
    spawn: { x: 0, y: 0, heading: 0 },
  };
  resetHighway(level);
  return level;
}
let highwayAdded = false;
// adds the endless motorway to LEVELS (called once, after the hand-made levels)
export function addHighwayLevel() {
  if (highwayAdded) return;
  highwayAdded = true;
  LEVELS.push(createHighway(4242, QUERY_PRESET || 'motorway'));
}
