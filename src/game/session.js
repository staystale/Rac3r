// session.js — Session: lap timing, reset, restart, records and the race flow.
import { reset } from '../vehicle.ts';
import { resetHighway, roadFrame } from '../highway.js';
import { createHwFlow, hwGridSpan } from '../highwayrace.ts';
import { createRaceFlow } from '../raceflow.js';
import { repair, resetBill } from '../damage.js';
import { SPAWN, LEVEL } from "../world/state.ts";
import { clearWear } from "../world/wear.ts";
import { startWeather } from "../world/weather.ts";
import { resetRace, resetStage } from './rules.js';
import { findNearestSubtrackPoint, onTrack } from "../world/tyrewall.ts";
import { jokerLane, lanePose } from "../world/joker.ts";
import { resetCar, armStart, startHeld, startAtOf } from './order.js';
import { gridPos, spawnAI } from './grid.js';
import { shared, game } from './state.js';

/**
 * Updates the furthest point reached along the circuit, from the car's nearest track point.
 * @param {{dist: number}} closestPt the nearest track point
 * @param {object} car the car
 * @param {number} total the circuit length
 * @returns {number} the track distance of the nearest point
 */
export function advanceTrackProgress(closestPt, car, total) {
  const curDist = closestPt.dist;
  game.trackD = curDist;
  const off = (car.x - closestPt.x) * closestPt.nx + (car.y - closestPt.y) * closestPt.ny;
  if (Math.abs(off) <= LEVEL.subtrack.width / 2) shared.lastOnTrack = { dist: curDist, off };
  if (shared.trackProgress === 0 && curDist < total * 0.20) {
    shared.trackProgress = curDist;
  } else if (curDist > shared.trackProgress && curDist - shared.trackProgress < total * 0.30) {
    shared.trackProgress = curDist;
  }
  return curDist;
}

/**
 * Runs the lap timer: starts it, notes the halfway mark and counts the finish-line crossing.
 * @param {number} curDist the track distance of the car's nearest point
 * @param {number} total the circuit length
 * @param {number} speed the car's speed
 */
export function stepLapTiming(curDist, total, speed) {
  // Start timing when vehicle moves off the grid
  if (!shared.lapState.started && speed > 0.8 && !startHeld()) {
    shared.lapState.started = true;
    shared.lapState.lap = 1;
    shared.lapState.lapTime = 0;
  }

  if (shared.lapState.started) {
    if (shared.trackProgress > total * 0.45) {
      shared.lapState.halfway = true;
    }
    // Crossing start/finish line: car completed circuit (> 75%) and wraps back across line (<
    // 15%)
    if (shared.lapState.halfway && shared.trackProgress > total * 0.75 && curDist < total * 0.15) {
      shared.lapState.lastTime = shared.lapState.lapTime;
      if (shared.lapState.bestTime === null || shared.lapState.lapTime < shared.lapState.bestTime) {
        shared.lapState.bestTime = shared.lapState.lapTime;
      }
      shared.lapState.lap++;
      shared.lapState.lapTime = 0;
      shared.lapState.halfway = false;
      shared.trackProgress = curDist;
    }
  }
}

/**
 * Tracks the car's progress along the circuit and its lap timing.
 * @param {object} car the player car
 * @param {number} dt the step in seconds
 */
export function updateRecoveryTracking(car, dt) {
  const speed = Math.hypot(car.vx, car.vy);

  // 1. If level has a subtrack, update track progress (the furthest point reached along the
  // circuit)
  if (LEVEL.subtrack) {
    const pts = LEVEL.subtrack.pts;
    const total = LEVEL.subtrack.totalDist;
    let closestPt = null, closestD2 = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const point = pts[i];
      const dist2 = (car.x - point.x) ** 2 + (car.y - point.y) ** 2;
      if (dist2 < closestD2) {
        closestD2 = dist2;
        closestPt = point;
      }
    }
    if (closestPt && closestD2 < (LEVEL.subtrack.width * 1.6) ** 2) {
      const curDist = advanceTrackProgress(closestPt, car, total);
      stepLapTiming(curDist, total, speed);
    }

    if (shared.lapState.started) {
      shared.lapState.lapTime += dt;
    }
  }
}

export const RESET_BACK = 4;          // m behind the exit point
export const RESET_ANG = [5, 15];     // deg back toward the road, random in this range

/**
 * RESET IN THE JOKER LANE (?jokerfix=1; requirement: reset should put you back on the joker lane
 * where you last came off, like any other section of track): RESET_BACK m behind the last spot
 * the car was on the lane, centred on the edge it left by, nose turned back toward the lane. Was:
 * the circuit reset, which put the car back on the main road before the joker.
 * @param {(car: object, x: number, y: number, heading: number) => void} place puts the car down
 * @returns {boolean} true when the car was put back on the joker lane
 */
function resetOnJoker(place) {
  const lane = LEVEL.joker ? jokerLane(LEVEL) : null, spot = game.lastOnJoker;
  if (!shared.settings.jokerFix || !lane || !spot) return false;
  const side = Math.sign(spot.off) || (Math.random() < 0.5 ? -1 : 1), half = lane.width / 2;
  const along = Math.max(0, spot.along - RESET_BACK), pose = lanePose(lane, along);
  // the lane's +normal is (-ty, tx); a heading turned positive turns the nose toward it
  const x = pose.x - pose.ty * side * half, y = pose.y + pose.tx * side * half;
  const ang = (RESET_ANG[0] + Math.random() * (RESET_ANG[1] - RESET_ANG[0])) * Math.PI / 180;
  place(game.car, x, y, pose.heading - side * ang);
  game.lastOnJoker = { along, off: side * (half - 0.5) };
  // the jump is not a crossing of the joker line
  game.jokerPrev = { x, y };
  if (shared.renderer && shared.renderer.snap) shared.renderer.snap(game.car);
  return true;
}

/**
 * CIRCUITS (requirement: reset doesn't work nicely — always behind / in line with where the
 * player LEFT the track, half on half off as if corrected, a random close angle pointing back on,
 * NOT on the racing line). Was: the nearest CENTRELINE point, dead straight — on the racing line,
 * and sometimes level with or past where you went off. Now: RESET_BACK m behind the last
 * point the car was on the road, centre on the EDGE it left by (half on / half off), nose turned
 * RESET_ANG deg back toward the road. tools/resetcheck.mjs.
 * @param {(car: object, x: number, y: number, heading: number) => void} place puts the car down
 * @returns {boolean} true when the car was put back on the circuit
 */
function resetOnCircuit(place) {
  if (!LEVEL.subtrack) return false;
  const sub = LEVEL.subtrack;
  let rec = shared.lastOnTrack;
  if (!rec) {
    const point = findNearestSubtrackPoint(sub, game.car.x, game.car.y, shared.trackProgress);
    if (point) rec = { dist: point.dist,
      off: (game.car.x - point.x) * point.nx + (game.car.y - point.y) * point.ny };
  }
  if (!rec) return false;
  const side = Math.sign(rec.off) || (Math.random() < 0.5 ? -1 : 1);
  const dist = (rec.dist - RESET_BACK + sub.totalDist) % sub.totalDist;
  const point = onTrack(sub, dist, side * sub.width / 2, {});
  const ang = (RESET_ANG[0] + Math.random() * (RESET_ANG[1] - RESET_ANG[0])) * Math.PI / 180;
  // +heading turns the nose toward +normal, so a car on the +side turns by -ang to point back
  // across the road
  place(game.car, point.x, point.y, point.rot - side * ang);
  shared.lastOnTrack = { dist: dist, off: side * (sub.width / 2 - 0.5) };
  if (shared.renderer && shared.renderer.snap) shared.renderer.snap(game.car);
  return true;
}

export function doReset() {
  // Safe track/free-roam recovery: places car back on nearest track edge or recent clear spot
  game.car.prevWheels = null;
  repair(game.car);   // DAMAGE: RESET mends the car (user); the repair bill keeps counting
  // RESET KEEPS TYRE HEAT (step 2): vehicle.js reset starts the tyres cold, which is
  // right for RESTART and a new car, but RESET is a recovery — you have not stopped driving. Put
  // the temperatures back afterwards.
  const keepT = game.car.tyreT ? game.car.tyreT.slice() : null;
  const resetKeepingTyres = (car, x, y, heading) => {
    resetCar(car, x, y, heading);
    if (keepT) car.tyreT = keepT.slice();
  };
  if (resetOnJoker(resetKeepingTyres) || resetOnCircuit(resetKeepingTyres)) return;
  if (shared.breadcrumbs.length > 0) {
    const safe = shared.breadcrumbs[Math.max(0, shared.breadcrumbs.length - 5)];   // ~2 s back
    resetKeepingTyres(game.car, safe.x, safe.y, safe.heading);
    if (shared.renderer && shared.renderer.snap) shared.renderer.snap(game.car);
    return;
  }
  resetKeepingTyres(game.car, SPAWN.x, SPAWN.y, SPAWN.heading);
  if (shared.renderer && shared.renderer.snap) shared.renderer.snap(game.car);
}

/**
 * Clears every car's track-cut state at the start of a run.
 */
export function clearCutCounts() {
  for (const car of [game.car, ...game.ai.map((entry) => entry.car)]) {
    car._cut = null;
    car._cutPen = 0;
    car._cuts = 0;
  }
}
/**
 * Creates the race flow for the current level: the highway's, a stage's, or a lap race's.
 * @returns {object} the new flow
 */
export function buildFlow() {
  // the HIGHWAY: no laps — the race ends on the off-screen countdowns (highwayrace.js
  // createHwFlow); "on screen" = the renderer's real view
  if (LEVEL.endless) {
    return createHwFlow({ lv: LEVEL,
      cars: [{ car: game.car, player: true }, ...game.ai.map((entry) => ({ car: entry.car }))],
        visible: (car) => onScreen(car.x, car.y) });
  }
  if (LEVEL.stage) {
    return createRaceFlow({ cars: [{ car: game.car, player: true },
      ...game.ai.map((entry) => ({ car: entry.car }))], total: LEVEL.subtrack.totalDist, laps: 1,
        stage: { finish: LEVEL.stage.finish } });
  }
  const laps = shared.raceLaps || (LEVEL.joker && shared.race.on ? LEVEL.joker.laps || 5 : 3);
  shared.race.laps = laps;
  return createRaceFlow({ cars: [{ car: game.car, player: true },
    ...game.ai.map((entry) => ({ car: entry.car }))], total: LEVEL.subtrack.totalDist, laps,
      joker: shared.race.on ? LEVEL.joker : null });
}
// THE RACE (AI stage 4, src/raceflow.js): any VS AI or RX race on a lap circuit (not a stage).
// Laps: setup, else 3 / the RX laps.
export function startFlow() {
  game.flow = null;
  game.flowShown = false;
  game.car.num = 1;
  game.car._jokers = 0;
  game.car._slot = game.ai.length && !LEVEL.stage ? shared.gridSlot : 0;
  // your lights count to YOUR start
  if (LEVEL.stage && game.start.on) game.start.tGreen = startAtOf(game.car);
  clearCutCounts();
  if (shared.mode !== 'session' || !LEVEL.subtrack || !(game.ai.length || shared.race.on)) return;
  game.flow = buildFlow();
}
// NO storage writes in the frame loop: a synchronous localStorage write can stall a phone frame
// (judder). The highway best and the speed camera record live in memory while driving and are
// saved here at safe moments: pause, restart, leaving a level, page hidden / closed.
export function saveRecords() {
  try {
    if ((game.hwBest | 0) > (shared.savedHwBest | 0)) {
      localStorage.setItem('rac3r.hwbest', String(game.hwBest | 0));
      shared.savedHwBest = game.hwBest;
    }
    if (shared.camDirty) {
      localStorage.setItem('rac3r.cams', JSON.stringify(shared.camRecord));
      shared.camDirty = false;
    }
  } catch { /* private mode: fine */ }
}
// what the camera can see right now (+ a margin): traffic only appears / goes OUTSIDE it
export function onScreen(x, y) {
  const margin = 14 * shared.renderer.PPM, screenX = shared.renderer.toScreenX(x),
    screenY = shared.renderer.toScreenY(y);
  return screenX > -margin && screenX < shared.renderer.W + margin && screenY > -margin
    && screenY < shared.renderer.H + margin;
}
export function doRestart() {
  saveRecords();
  // the event's weather from its start (before the cars' tyres take the track temperature and the
  // AI plans its speeds for the wetness)
  startWeather(shared.weatherPlan || null);
  if (LEVEL.endless) {
    resetHighway(LEVEL);
    game.hwDist = 0;
    game.camFines = 0;
    game.camCount = 0;
    game.camCaught = null;
  }   // the same motorway from the start again
  // the FPS corner's 10 s LOW starts again: the level-load hitch is not a driving dip (MEASURED:
  // LOW 26 from the load)
  game.fpsClear = true;
  // Full level restart: resets car to spawn, stands cones up, clears marks and wear
  game.car._prog = undefined;
  game.position = 1;
  repair(game.car);
  resetBill(game.car);   // DAMAGE: a fresh car and a clean bill
  // the old field goes NOW: until the deferred spawnAI below builds the new grid, the last level's
  // AI (the menu demo's) stepped on this one - on a level with no racing line (the Lab family)
  // recoverAI threw on every step
  game.ai = [];
  setTimeout(() => {
    armStart();
    spawnAI();
    // any race grid puts YOU on your slot too — pole included (was gridSlot > 0: on pole you stayed
    // on the centreline spawn, out of formation)
    if (game.start.rolling || (game.ai.length && !LEVEL.stage)) {
      const slotPos = gridPos(game.ai.length ? shared.gridSlot : 0);
      reset(game.car, slotPos.x, slotPos.y, slotPos.h);
      if (shared.renderer && shared.renderer.snap) shared.renderer.snap(game.car);
    }
    game.traffic.reset(LEVEL.endless && shared.mode !== 'menu' ? LEVEL : null,
      shared.trafficDensity);
    if (LEVEL.endless && game.ai.length) {
      const [spanStart, spanEnd] = hwGridSpan(LEVEL, game.ai.length + 1);
      game.traffic.clearSpan(spanStart, spanEnd);
    }   // a clear road for the grid
    // the treadmill guard measures "dropped back" from the furthest point reached (the spawn): a
    // back-row grid slot is up to ~50 m behind it, which read as WRONG WAY 5 s into the race
    // (MEASURED, tools/_tfgame). Start the record where YOU start.
    if (LEVEL.endless && LEVEL._hw) {
      const frame = roadFrame(LEVEL, game.car.x, game.car.y, null);
      if (frame) LEVEL._hw.best = Math.min(LEVEL._hw.best, frame.s);
    }
    startFlow();
  }, 0);   // after this function has put the player on the spawn
  game.car.prevWheels = null;
  game.car.simTime = 0;
  shared.lapState.lap = 0;
  shared.lapState.lapTime = 0;
  shared.lapState.bestTime = null;
  shared.lapState.lastTime = null;
  shared.lapState.started = false;
  shared.lapState.halfway = false;
  reset(game.car, SPAWN.x, SPAWN.y, SPAWN.heading);
  if (shared.renderer && shared.renderer.snap) shared.renderer.snap(game.car);
  game.cones.reset();
  game.marks.clear();
  clearWear();
  // open on the whole level, then ease in to the car. Not behind the menu (?menufast=0 = it is):
  // MEASURED on the owner's phone (?report=1, the menu's first 1.5 s) the fly-in nobody sees there
  // cost a 113 ms frame (the whole-level picture) and a 121 ms one (28 GPU uploads at the handover)
  const behindMenu = shared.mode === 'menu' && shared.settings.menuFast;
  if (shared.renderer && shared.renderer.flyIn && !behindMenu) shared.renderer.flyIn();
  shared.trackProgress = 0;
  shared.lastOnTrack = null;
  resetRace(game);
  resetStage(game);
  shared.breadcrumbs.length = 0;
}
