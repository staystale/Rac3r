// highway.js — HIGHWAY TO HULL: the ENDLESS motorway. User: "how about an infinite
// highway level with procedural turns and terrain". v2 THE TREADMILL (user: "act like a
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
import { readSettings } from "./core/settings.ts";
import { createSubtrack, ghostSegment } from "./world/subtrack.ts";
import { meterEvent } from "./ui/meter.ts";
import { SURFACES } from "./world/surfaces.ts";
import { LEVELS } from "./world/levels/index.ts";
import { prepBumps, clearNaturalCache } from "./world/terrain.ts";
import { prepBarriersOf, solidsFromProps } from "./world/barriers.ts";
import { onTrack } from "./world/tyrewall.ts";
import { zoneSurfaceAt, pruneWear } from "./world/wear.ts";
import { HW_PRESETS, HW_NAMES, STEP, AHEAD, BEHIND, SPAWN_S, UP_HEADING, rng }
  from "./highway/presets.js";
import { laneGeo, stateOf, growTo, locate, roadFrame } from "./highway/road.js";
import { syncCovers, SIDE_W_HALF } from "./highway/cuts.js";
import { dress } from "./highway/dress.js";
export { HW_PRESETS, HW_NAMES } from "./highway/presets.js";
export { laneGeo, roadFrame, roadPose, roadSpan } from "./highway/road.js";
// THE GUARD (user: "go backwards should reset you"): rolling BACK down the road faster than BACK_V
// for BACK_T s, or BACK_M m behind the furthest you have got, or OFF_M m past the road edge (out of
// the scenery band, where the treadmill has no road on screen) -> put back in the LEFT lane at the
// furthest point, with a HUD notice saying why (never unexplained, CLAUDE.md §1) GOING WIDE (user,
// "can going wide be WIDER / have a TIMER so you have a chance to return"): was a hard
// reset 35 m past the edge. Now OFF_SOFT m past the edge starts an OFF_T s countdown on the HUD
// (back within it = cancelled); only OFF_HARD m out resets at once (the road would be leaving the
// view). LONGER + HELD NEAR THE ROAD (user: "the off road timer should be longer / turn
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
  // the first window's loose objects ARE the level's cones (cones.js reset reads lv.cones on
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
// SPEED CAMERAS (user: "cameras on the gantries: flash + 'CAUGHT 187 km/h' in the HUD
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
 * @param {object} loc where the car is on the road (locate)
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
 * @param {object} loc where the car is on the road (locate)
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
// ROAD TYPE (user: "how do I test the lane presets — I don't see any buttons"): Test
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

