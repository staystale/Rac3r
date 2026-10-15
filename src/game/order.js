// order.js — The start lights, the rolling start, track cuts and the race order.
import { reset, PHYSICS_STEP_SECONDS } from '../vehicle.ts';
import { createAutoDriver } from '../ai/autodrive.ts';
import { HW_GREEN } from '../highwayrace.ts';
import { createAIDriver } from '../ai/circuit.ts';
import { aiTraits } from '../ai/traits.ts';

import { LEVEL } from "../world/state.ts";
import { onTrack, querySubtrack } from "../world/tyrewall.ts";
import { STAGE_GAP_S } from './grid.js';
import { shared, game } from './state.js';

export const resetCar = reset;
// START LIGHTS (requirement: all races started by lights that clearly go red to green, maybe a
// countdown); "circuits with ROLLING starts: the game controls ALL cars, AI and player, until the
// start, then releases them"). Any race (VS AI or the RX race): three reds light one per second
// with 3-2-1, then GREEN + GO!. Every car is held until GREEN - START_EARLY ("free to go at green
// or a split second before", the same for player and AI). Rolling start (LEVEL.rollingStart, the
// ovals): the grid starts 120 m further back, the game drives every car at ROLL_PACE in grid order
// behind red lights, and it goes green as the front car crosses the line. Sim time (rule 5: what
// the cars do). Solo practice: no lights.
export const START_STEP = 1.0, START_EARLY = 0.12, ROLL_PACE = 16, ROLL_BACK = 120;
export function armStart() {
  // 4 = top
  shared.autoDrv = shared.settings.autopilot
    ? createAIDriver(LEVEL, aiTraits(4, 0, 1)) : null;
  const active = shared.mode !== 'menu' && (shared.race.on || shared.aiCount > 0),
    isRolling = active && (!!LEVEL.rollingStart || !!LEVEL.endless) && !!LEVEL.subtrack;
  game.start = { on: active, t: 0, tGreen: isRolling ? Infinity : 4 * START_STEP,
    tGreen0: isRolling ? undefined : 4 * START_STEP, rolling: isRolling, green: !active,
    drv: isRolling ? (LEVEL.endless ? createAIDriver(LEVEL, aiTraits(4, 0, 1))
      : createAutoDriver(LEVEL.subtrack)) : null };
  // the HIGHWAY's rolling start has no line to cross: green HW_GREEN s in, everyone already rolling
  // in formation (highwayrace.js)
  if (isRolling && LEVEL.endless) game.start.tGreen = game.start.tGreen0 = HW_GREEN;
}
export const startHeld = () => game.start.on && !game.start.green
  && game.start.t < game.start.tGreen - START_EARLY;
// a car's own release: everyone at the green, except a RALLY STAGE: a later starter (slot k > 0
// behind you) goes k x STAGE_GAP_S after your green
export const startAtOf = (car) => (game.start.tGreen0 ?? game.start.tGreen) + (LEVEL.stage
  ? (car._slot || 0) * STAGE_GAP_S : 0);
export const carHeld = (car) => game.start.on && !game.start.rolling
  && game.start.t < startAtOf(car) - START_EARLY;
// cap a driver's output at the rolling-start pace
export function atPace(out, car) {
  const speed = Math.hypot(car.vx, car.vy);
  return { ...out, throttle: speed > ROLL_PACE ? 0 : Math.min(out.throttle, 0.55),
    brake: speed > ROLL_PACE + 2 ? 0.25 : 0, handbrake: 0, reverse: 0 };
}
export function stepStart(dt) {
  // the clock keeps running after green so the HUD can take the lights away 1.2 s later
  // (requirement: race start lights don't vanish) — it stopped at green)
  const startState = game.start;
  if (!startState.on) return;
  startState.t += dt;
  if (startState.green) return;
  if (startState.rolling && !LEVEL.endless) {
    // green as the FRONT car (the player, pole) crosses the line; reds shown from 1 s
    const pole = game.poleCar || game.car, total = LEVEL.subtrack.totalDist,
      dist = pole === game.car ? game.trackD
        : querySubtrack(LEVEL.subtrack, pole.x, pole.y).trackDist;
    if (startState.prevD != null && dist != null && startState.prevD > total - 60 && dist < 60
      && startState.t > 2) startState.tGreen = startState.t;
    startState.prevD = dist;
  }
  if (startState.t >= startState.tGreen) startState.green = true;
}
// RACE ORDER (requirement: the lap counter area should keep track of what place you are).
// Each car's distance round the lap, UNWRAPPED across the line (a car behind the line on the grid
// starts slightly negative), from the nearest centreline point; ranked.
export function progressOf(car) {
  const sub = LEVEL.subtrack, total = sub.totalDist, near = querySubtrack(sub, car.x, car.y),
    along = near.trackDist;
  if (car._prog === undefined) {
    if (near.dist > sub.width / 2 + 2) return undefined;   // not on the lap yet
    car._prog = along > total / 2 ? along - total : along;
    car._lastQ = along;
    return car._prog;
  }
  // out of the track's range (querySubtrack: dist Infinity, trackDist 0 — that 0 dragged the
  // progress back to the line): hold it there
  if (!isFinite(near.dist)) {
    trackCut(car, near, 0);
    return car._prog;
  }
  let delta = along - car._lastQ;
  if (delta > total / 2) delta -= total;
  if (delta < -total / 2) delta += total;
  // (no jump guard: crossing an infield, the nearest centreline point JUMPS to the far side in one
  // step — that jump IS the cut)
  if (trackCut(car, near, delta) === 'reset') return car._prog;
  if (near.dist <= sub.width / 2 && near.seg != null) {
    const point = sub.pts[near.seg];
    car._lastOn = { dist: along, off: (car.x - point.x) * point.nx + (car.y - point.y) * point.ny };
  }
  car._prog += delta;
  car._lastQ = along;
  return car._prog;
}
// TRACK CUTS (requirement: a time penalty for skipping track in rally / rallycross — and a forced
// reset when skipping too large of a section in normal races). While a car is wholly OFF the road
// (centre > half width + CUT_OFF) it banks the track progress it gains BEYOND the distance
// it actually drives — the NET over the whole excursion, so going wide 50 m and cutting 50 m back
// gains nothing (a clamp at 0 lost a 300 m Thruston cut: the progress only jumps on rejoining,
// after the drive had been subtracted). Back on the road: gain >= CUT_MIN -> a cut. RX race / rally
// stage (timed): +1 s per CUT_PER_S m gained, at least 2 s, into the result. A circuit race: gain
// >= CUT_RESET -> the car is put back where it left the road, progress and all; smaller cuts pass.
// Free practice: nothing. CUT_MIN 8 -> 15 m: normal racing clipped one Castle Cum / Thruston inside
// at 8-10 m (~0.3 s), MEASURED (racecheck4) — not a cut
export const CUT_OFF = 1.0, CUT_MIN = 15, CUT_RESET = 25, CUT_PER_S = 5;
export function onLane(x, y) {
  for (const lane of LEVEL.lanes || []) {
    const pts = lane.pts, reach2 = (lane.width / 2 + 1) ** 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const [startX, startY] = pts[i], [endX, endY] = pts[i + 1], vx = endX - startX,
        vy = endY - startY, len2 = vx * vx + vy * vy || 1;
      const frac = Math.max(0, Math.min(1, ((x - startX) * vx + (y - startY) * vy) / len2)),
        missX = startX + vx * frac - x, missY = startY + vy * frac - y;
      if (missX * missX + missY * missY < reach2) return true;
    }
  }
  return false;
}
/**
 * Whether track cuts count for this car right now (race flow running, or the stage underway).
 * @param {object} car the car
 * @returns {boolean} true when a cut would be judged
 */
export function cutsLive(car) {
  return game.flow ? game.flow.state !== 'done'
    && game.start.t >= (game.start.tGreen0 ?? game.start.tGreen) : LEVEL.stage && car === game.car
      && shared.stage.state === 'running';
}
/**
 * Charges a finished cut as a time penalty (race or stage).
 * @param {object} car the car that cut
 * @param {{gain: number}} cut the finished excursion
 */
export function penaliseCut(car, cut) {
  const pen = Math.max(2, Math.round(cut.gain / CUT_PER_S));
  car._cutPen = (car._cutPen || 0) + pen;
  if (car === game.car) {
    if (LEVEL.stage) shared.stage.pen += pen;
    game.notice = { text: 'TRACK CUT +' + pen + ' s', at: performance.now() };
  }
}
/**
 * Puts a car that cut big back where it left the road (free practice).
 * @param {object} car the car that cut
 * @param {{q: number, prog: number}} cut the finished excursion
 */
export function putBackCut(car, cut) {
  const point = onTrack(LEVEL.subtrack, cut.q, 0, {});
  resetCar(car, point.x, point.y, point.rot);
  car._prog = cut.prog;
  car._lastQ = cut.q;
  if (car === game.car) {
    shared.lastOnTrack = { dist: cut.q, off: 0 };
    if (shared.renderer && shared.renderer.snap) shared.renderer.snap(car);
    game.notice = { text: 'TRACK CUT — PUT BACK', at: performance.now() };
  }
  else {
    const entry = game.ai.find((x) => x.car === car);
    if (entry) entry.drv.relocate();
  }
}
/**
 * Judges a car's excursion off the road: tracks it, and penalises or puts back on return.
 * @param {object} car the car
 * @param {{dist: number}} near the car's nearest-road query
 * @param {number} delta the progress jump this step
 * @returns {string|undefined} 'reset' when the car was put back
 */
export function trackCut(car, near, delta) {
  if (!cutsLive(car)) {
    car._cut = null;
    return;
  }
  // LANES ARE NOT CUTS (requirement: the track cut triggers on joker laps — it shouldn't, a
  // specific exclusion; the only time penalty there is the event's, for missing or multiple
  // jokers): on the joker lane, the RX start lane or a pit lane the car is on a legal road, and an
  // excursion that touched one is dropped whole.
  if (onLane(car.x, car.y)) {
    car._cut = null;
    return;
  }
  if (near.dist > LEVEL.subtrack.width / 2 + CUT_OFF) {
    // where it left the road
    if (!car._cut) car._cut = { gain: 0, prog: car._prog, q: car._lastQ };
    car._cut.gain += delta - Math.hypot(car.vx, car.vy) * PHYSICS_STEP_SECONDS;
    return;
  }
  const cut = car._cut;
  car._cut = null;
  // the step back onto the road (often the big jump)
  if (cut) cut.gain += delta - Math.hypot(car.vx, car.vy) * PHYSICS_STEP_SECONDS;
  if (!cut || cut.gain < CUT_MIN) return;
  car._cuts = (car._cuts || 0) + 1;
  // [m gained, where] for the tools
  (car._cutLog || (car._cutLog = [])).push([+cut.gain.toFixed(1), Math.round(cut.q)]);
  if (shared.race.on || LEVEL.stage) penaliseCut(car, cut);
  else if (cut.gain >= CUT_RESET) {
    putBackCut(car, cut);
    return 'reset';
  }
}
export function stepOrder() {
  const all = [game.car, ...game.ai.map((entry) => entry.car)];
  for (const car of all) progressOf(car);
  // still on the start lane = behind everyone on the lap, ordered by how far down the lane they are
  const spawn = LEVEL.spawn,
    key = (car) => (car._prog === undefined
      ? -1e6 + (car.x - spawn.x) * Math.cos(spawn.heading)
        + (car.y - spawn.y) * Math.sin(spawn.heading)
      : car._prog);
  const mine = key(game.car);
  game.position = 1 + all.filter((car) => car !== game.car && key(car) > mine).length;
}
