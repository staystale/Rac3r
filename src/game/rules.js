// rules.js — the RX race, stage timing and joker rules, stepped on the fixed physics step.
// Every function takes the game state it works on; there is no module-level state here.
import { LEVEL } from '../world/state.ts';
import { querySubtrack } from '../world/tyrewall.ts';

/**
 * Clears the joker and RX-race state for a new run.
 * @param {object} game the game state
 */
export function resetRace(game) {
  const race = game.race;
  game.jokerPrev = null;
  game.jokerLap = null;
  game.jokerAt = 0;
  game.inJokerLane = false;
  game.jokerTaken = false;
  game.jokers = 0;
  game.inJokerGate = false;
  Object.assign(race,
    { t: 0, started: false, joker: false, done: false, total: 0, penalty: 0,
      laps: (LEVEL.joker && LEVEL.joker.laps) || 5 });
}
/**
 * Puts the stage timing back to READY.
 * @param {object} game the game state
 */
export function resetStage(game) {
  const stage = game.stage;
  stage.state = 'ready';
  stage.t = 0;
  stage.prevD = null;
  stage.pen = 0;
}
/**
 * Steps the point-to-point stage timer: start line, running, finish line.
 * @param {object} game the game state
 * @param {number} dt the step in seconds
 */
export function stepStage(game, dt) {
  const stage = game.stage;
  const stageDef = LEVEL.stage, dist = game.trackD;
  if (!stageDef || dist == null) return;
  const prev = stage.prevD;
  stage.prevD = dist;
  if (prev == null) return;
  const total = LEVEL.subtrack.totalDist, crossedStart = prev > total - 60 && dist < 60;
  if (stage.state !== 'running') {
    if (crossedStart) {
      stage.state = 'running';
      stage.t = 0;
      stage.pen = 0;
    }
    return;
  }
  stage.t += dt;
  if (prev < stageDef.finish && dist >= stageDef.finish && dist - prev < 30) {
    stage.state = 'done';
    stage.last = stage.t + (stage.pen || 0);
    if (stage.best == null || stage.t < stage.best) stage.best = stage.t;
  }
}
// JOKER DETECTION = A LINE, not a circle (requirement: Joker lane detection needs to be wider on
// knob hill - it's easy to come off the road shoot wide and cause a defection bug where it doesn't
// detect you've done it and then when you do it again it gives penalty for multiple jokers).
// MEASURED: the gate was a 7 m-radius circle at the lane's middle; the lane is 12 m wide and
// Knobhill's loop is easy to run wide of, so a joker driven a few metres out was never counted.
// Now: a LINE across the lane at the gate, the lane's half width + JOKER_SPAN m out each side,
// counted when the car CROSSES it (either way), and at most ONCE PER LAP (a second crossing in the
// same lap - reversing back over it - never makes a second joker). Not on the main road: the line
// stops JOKER_ROAD m short of the circuit's edge.
const JOKER_SPAN = 8, JOKER_ROAD = 1;
/**
 * The joker LINE across the lane at the gate, found once per level.
 * @param {object} joker the level's joker
 * @returns {object|null} the line ({ x, y, tx, ty, half }) or null when there is no lane
 */
function jokerLine(joker) {
  if (joker._line !== undefined) return joker._line;
  const lane = (LEVEL.lanes || []).find((cand) => cand.out == null
    && cand.pts.some(([x, y]) => (x - joker.gate.x) ** 2 + (y - joker.gate.y) ** 2
      < joker.gate.r * joker.gate.r * 4));
  if (!lane) return (joker._line = null);
  let nearest = 0, bestD2 = Infinity;
  lane.pts.forEach(([x, y], i) => {
    const distSq = (x - joker.gate.x) ** 2 + (y - joker.gate.y) ** 2;
    if (distSq < bestD2) {
      bestD2 = distSq;
      nearest = i;
    }
  });
  const before = lane.pts[Math.max(0, nearest - 2)],
    after = lane.pts[Math.min(lane.pts.length - 1, nearest + 2)],
      len = Math.hypot(after[0] - before[0], after[1] - before[1]) || 1;
  return (joker._line = { x: joker.gate.x, y: joker.gate.y, tx: (after[0] - before[0]) / len,
    ty: (after[1] - before[1]) / len, half: lane.width / 2 + JOKER_SPAN });
}
/**
 * Did the car cross the joker line between (prevX, prevY) and (x, y)? Exposed for
 * tools/_jokerline.mjs.
 * @param {object} joker the level's joker
 * @param {number} prevX the previous x
 * @param {number} prevY the previous y
 * @param {number} x the x now
 * @param {number} y the y now
 * @returns {boolean} true when it crossed
 */
export function crossedJoker(joker, prevX, prevY, x, y) {
  const line = jokerLine(joker);
  if (!line) return (x - joker.gate.x) ** 2 + (y - joker.gate.y) ** 2 < joker.gate.r * joker.gate.r
    && !((prevX - joker.gate.x) ** 2 + (prevY - joker.gate.y) ** 2 < joker.gate.r * joker.gate.r);
  const prevAlong = (prevX - line.x) * line.tx + (prevY - line.y) * line.ty,
    nowAlong = (x - line.x) * line.tx + (y - line.y) * line.ty;
  if ((prevAlong < 0) === (nowAlong < 0)) return false;
  const frac = prevAlong / (prevAlong - nowAlong || 1), crossX = prevX + (x - prevX) * frac,
    crossY = prevY + (y - prevY) * frac,
      side = (crossX - line.x) * -line.ty + (crossY - line.y) * line.tx;
  if (Math.abs(side) > line.half) return false;
  return querySubtrack(LEVEL.subtrack, crossX, crossY).dist > LEVEL.subtrack.width / 2 + JOKER_ROAD;
}
/**
 * Whether a car is within reach of a joker lane's centre line.
 * @param {{pts: number[][], width: number}} lane the joker lane
 * @param {{x: number, y: number}} car the car
 * @returns {boolean} true when the car is on the lane
 */
function nearLane(lane, car) {
  const pts = lane.pts, reach2 = (lane.width / 2 + 1) ** 2;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [startX, startY] = pts[i], [endX, endY] = pts[i + 1], vx = endX - startX,
      vy = endY - startY,
      frac = Math.max(0, Math.min(1,
        ((car.x - startX) * vx + (car.y - startY) * vy) / (vx * vx + vy * vy || 1)));
    if ((car.x - startX - frac * vx) ** 2 + (car.y - startY - frac * vy) ** 2 < reach2) return true;
  }
  return false;
}
/**
 * Tracks the joker gate and lane for the player car.
 * @param {object} game the game state
 * @param {object} car the player car
 */
export function stepJoker(game, car) {
  const joker = LEVEL.joker;
  if (!joker) return;
  const prev = game.jokerPrev;
  game.jokerPrev = { x: car.x, y: car.y };
  const inGate = !!prev && crossedJoker(joker, prev.x, prev.y, car.x, car.y);
  if (inGate && game.jokerLap !== game.lap.lap) {
    game.jokerLap = game.lap.lap;
    game.jokers = (game.jokers || 0) + 1;
    game.jokerTaken = true;
    game.jokerAt = performance.now();
  }
  // IN THE JOKER LANE (requirement: the joker HUD warning should switch and show joker taken when
  // taken): the gate sits mid-lane, so the HUD knows you are IN it from the moment you leave the
  // main road onto the lane (the lane through the gate; found once per level)
  if (joker._lane === undefined) joker._lane = (LEVEL.lanes || []).find((cand) => cand.out == null
    && cand.pts.some(([x, y]) => (x - joker.gate.x) ** 2 + (y - joker.gate.y) ** 2
      < joker.gate.r * joker.gate.r * 4)) || null;
  game.inJokerLane = false;
  if (joker._lane && querySubtrack(LEVEL.subtrack, car.x, car.y).dist > LEVEL.subtrack.width / 2) {
    game.inJokerLane = nearLane(joker._lane, car);
  }
  // the AI's joker tactics read it (covering a rival who has jokered)
  car._jokers = game.jokers || 0;
  game.inJokerGate = inGate;
}
/**
 * Steps the RX race: its clock, the finish and the penalties.
 * @param {object} game the game state
 * @param {object} car the player car
 * @param {number} dt the step in seconds
 */
export function stepRace(game, car, dt) {
  const race = game.race, lapState = game.lap;
  if (!race.on || race.done || !LEVEL.joker) return;
  // timed from the GREEN when there are lights (the results time from it too — raceflow.js); else
  // from the first move
  if (!race.started
    && (game.start.on ? game.start.green : Math.hypot(car.vx, car.vy) > 0.8)) race.started = true;
  if (!race.started) return;
  race.t += dt;
  race.joker = !!game.jokerTaken;
  race.jokers = game.jokers || 0;
  if (lapState.lap > race.laps) {
    race.done = true;
    race.penalty = LEVEL.joker.penalty * (race.jokers === 0 ? 1 : race.jokers - 1);
    race.penalty += game.car._cutPen || 0;
    race.total = race.t + race.penalty;
  }
}
