// session.ts — Session: lap timing, reset, restart, records and the race flow.
import { vergeBack } from '../highway/vergeback.ts';
import { hazardsAfterReset } from './resethazard.ts';
import { lineUpCrashBench } from './crashbench.ts';
import { hwLevel } from './state.ts';
import { reset } from '../vehicle.ts';
import { resetHighway, roadFrame, roadPose, roadSpan, highwayRespawn, rehome }
  from '../highway.ts';
import { bayBehind } from '../highway/laybys.ts';
import { shoulderOff } from '../highway/road.ts';
import { clearFinishLine, createHwFlow, hwGridSpan } from '../highwayrace.ts';
import { finishOf } from '../highway/finish.ts';
import { createRaceFlow } from '../raceflow.ts';
import { repair, resetBill } from '../damage.ts';
import { SPAWN, LEVEL } from "../world/state.ts";
import { clearWear } from "../world/wear.ts";
import { startWeather } from "../world/weather.ts";
import { resetTrackside } from "../world/barriers.ts";
import { resetPuddles } from "../world/puddles.ts";
import { resetCoverField } from "../world/coverfield.ts";
import { resetRace, resetStage } from './rules.ts';
import { onTrack } from "../world/tyrewall.ts";
import { clearOfUnder, trackSpotOf } from "../world/trackunder.ts";
import { jokerLane, lanePose } from "../world/joker.ts";
import { resetCar, armStart, startHeld, startAtOf } from './order.ts';
import { gridPos, spawnAI } from './grid.ts';
import { shared, game } from './state.ts';
import { saveProfile } from '../menu/profile.ts';
import type { GameCar, PlaceCar } from './state.ts';
import type { TrackPoint } from '../world/types.ts';

/**
 * Updates the furthest point reached along the circuit, from the car's nearest track point.
 * @param closestPt the nearest track point
 * @param car the car
 * @param total the circuit length
 * @returns the track distance of the nearest point
 */
export function advanceTrackProgress(closestPt: TrackPoint, car: GameCar, total: number) {
  const curDist = closestPt.dist;
  game.trackD = curDist;
  const off = (car.x - closestPt.x) * closestPt.nx + (car.y - closestPt.y) * closestPt.ny;
  if (Math.abs(off) <= LEVEL.subtrack!.width / 2) shared.lastOnTrack = { dist: curDist, off };
  if (shared.trackProgress === 0 && curDist < total * 0.20) {
    shared.trackProgress = curDist;
  } else if (curDist > shared.trackProgress && curDist - shared.trackProgress < total * 0.30) {
    shared.trackProgress = curDist;
  }
  return curDist;
}

/**
 * Runs the lap timer: starts it, notes the halfway mark and counts the finish-line crossing.
 * @param curDist the track distance of the car's nearest point
 * @param total the circuit length
 * @param speed the car's speed
 */
export function stepLapTiming(curDist: number, total: number, speed: number) {
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
 * @param car the player car
 * @param dt the step in seconds
 */
export function updateRecoveryTracking(car: GameCar, dt: number) {
  const speed = Math.hypot(car.vx, car.vy);

  // 1. If level has a subtrack, update track progress (the furthest point reached along the
  // circuit)
  if (LEVEL.subtrack) {
    const pts = LEVEL.subtrack!.pts;
    const total = LEVEL.subtrack!.totalDist;
    let closestPt = null, closestD2 = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const point = pts[i];
      const dist2 = (car.x - point.x) ** 2 + (car.y - point.y) ** 2;
      if (dist2 < closestD2) {
        closestD2 = dist2;
        closestPt = point;
      }
    }
    if (closestPt && closestD2 < (LEVEL.subtrack!.width * 1.6) ** 2) {
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
// RESET IN (passed 11-03; owner: "place cars just a tiny bit more on the road / track so f1 cars
// don't
// get stuck after resetting"): the centre moves in from the edge so all four wheels stand on the
// road - half the car's track, plus its rear's swing out at the reset angle, plus this margin
const RESET_IN_MARGIN = 0.15;

/**
 * How far in from the road's edge a reset puts the car's centre.
 * @param ang the reset angle, rad
 * @returns m in from the edge
 */
function resetInset(ang: number): number {
  const spec = game.car.spec;
  return (spec.trackWidth || 1.5) / 2 + spec.lr * Math.sin(ang) + RESET_IN_MARGIN;
}

/**
 * RESET IN THE JOKER LANE (requirement: reset should put you back on the joker lane
 * where you last came off, like any other section of track): RESET_BACK m behind the last spot
 * the car was on the lane, centred on the edge it left by, nose turned back toward the lane. Was:
 * the circuit reset, which put the car back on the main road before the joker.
 * @param place puts the car down
 * @returns true when the car was put back on the joker lane
 */
function resetOnJoker(place: PlaceCar) {
  const lane = LEVEL.joker ? jokerLane(LEVEL) : null, spot = game.lastOnJoker;
  if (!lane || !spot) return false;
  const side = Math.sign(spot.off) || (Math.random() < 0.5 ? -1 : 1), half = lane.width / 2;
  const along = Math.max(0, spot.along - RESET_BACK), pose = lanePose(lane, along);
  const ang = (RESET_ANG[0] + Math.random() * (RESET_ANG[1] - RESET_ANG[0])) * Math.PI / 180;
  const off = Math.max(0, half - resetInset(ang));
  // the lane's +normal is (-ty, tx); a heading turned positive turns the nose toward it
  const x = pose.x - pose.ty * side * off, y = pose.y + pose.tx * side * off;
  place(game.car, x, y, pose.heading - side * ang);
  game.lastOnJoker = { along, off: side * (half - 0.5) };
  // the jump is not a crossing of the joker line
  game.jokerPrev = { x, y };
  if (shared.renderer && shared.renderer.snap) shared.renderer.snap(game.car);
  return true;
}

/**
 * On the endless roads (owner 11-09, passed: "Resetting should start up in the hard shoulder
 * only"): back RESET_BACK m from where you are - from the other carriageway too - on our hard
 * shoulder, facing up the road, the traffic cleared from round it; too far off the road to say
 * where you are, the guard's spot (highway.ts highwayRespawn) - never the circuits' nearest edge,
 * which on a twin carriageway can be the other one's.
 * @param place puts the car
 * @returns true when it did (on an endless road, always)
 */
function resetOnShoulder(place: PlaceCar): boolean {
  if (!LEVEL.endless) return false;
  const level = hwLevel(), here = roadFrame(level, game.car.x, game.car.y, null);
  // (a road without a hard shoulder: the last lay-by behind)
  const bay = here && (vergeBack(level, here.s - RESET_BACK, roadSpan(level).s0 + 20)
    ?? bayBehind(level, here.s - RESET_BACK, undefined, roadSpan(level).s0 + 20));
  const pose = bay ? roadPose(level, bay.s, bay.off) : here
    ? roadPose(level, here.s - RESET_BACK, shoulderOff(level)) : highwayRespawn(level);
  if (here) rehome(level, bay ? bay.s : here.s - RESET_BACK);
  place(game.car, pose.x, pose.y, pose.h);
  game.traffic.clearAround(pose.x, pose.y, 30);
  shared.lastOnTrack = null;
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
 * @param place puts the car down
 * @returns true when the car was put back on the circuit
 */
function resetOnCircuit(place: PlaceCar) {
  if (!LEVEL.subtrack) return false;
  const sub = LEVEL.subtrack!;
  let rec = shared.lastOnTrack;
  if (!rec) {
    const point = trackSpotOf(sub, game.car.x, game.car.y, game.car, shared.trackProgress);
    if (point) rec = { dist: point.dist,
      off: (game.car.x - point.x) * point.nx + (game.car.y - point.y) * point.ny };
  }
  if (!rec) return false;
  const side = Math.sign(rec.off) || (Math.random() < 0.5 ? -1 : 1);
  const dist = clearOfUnder(sub, (rec.dist - RESET_BACK + sub.totalDist) % sub.totalDist);
  const ang = (RESET_ANG[0] + Math.random() * (RESET_ANG[1] - RESET_ANG[0])) * Math.PI / 180;
  const point = onTrack(sub, dist, side * Math.max(0, sub.width / 2 - resetInset(ang)), {});
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
  hazardsAfterReset(game.car);
  repair(game.car);   // DAMAGE: RESET mends the car (user); the repair bill keeps counting
  // RESET KEEPS TYRE HEAT (step 2): vehicle.js reset starts the tyres cold, which is
  // right for RESTART and a new car, but RESET is a recovery — you have not stopped driving. Put
  // the temperatures back afterwards.
  const keepT = game.car.tyreT ? game.car.tyreT.slice() : null;
  const resetKeepingTyres = (car: GameCar, x: number, y: number, heading: number) => {
    resetCar(car, x, y, heading);
    if (keepT) car.tyreT = keepT.slice();
  };
  if (resetOnJoker(resetKeepingTyres) || resetOnShoulder(resetKeepingTyres)
    || resetOnCircuit(resetKeepingTyres)) return;
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
 * @returns the new flow
 */
export function buildFlow() {
  // the HIGHWAY: no laps — the race ends on the off-screen countdowns (highwayrace.js
  // createHwFlow); "on screen" = the renderer's real view
  if (LEVEL.endless) {
    return createHwFlow({ lv: hwLevel(),
      cars: [{ car: game.car, player: true }, ...game.ai.map((entry) => ({ car: entry.car }))],
        visible: (car) => onScreen(car.x, car.y), finish: finishOf(shared.hwFinish) });
  }
  if (LEVEL.stage) {
    return createRaceFlow({ cars: [{ car: game.car, player: true },
      ...game.ai.map((entry) => ({ car: entry.car }))], total: LEVEL.subtrack!.totalDist, laps: 1,
        stage: { finish: LEVEL.stage.finish } });
  }
  const laps = shared.raceLaps || (LEVEL.joker && shared.race.on ? LEVEL.joker.laps || 5 : 3);
  shared.race.laps = laps;
  return createRaceFlow({ cars: [{ car: game.car, player: true },
    ...game.ai.map((entry) => ({ car: entry.car }))], total: LEVEL.subtrack!.totalDist, laps,
      joker: shared.race.on ? LEVEL.joker : null });
}
// THE RACE (AI stage 4, src/raceflow.ts): any VS AI or RX race on a lap circuit (not a stage).
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
  // (a highway run with a finish has its flow solo too)
  if (shared.mode !== 'session' || !LEVEL.subtrack || !(game.ai.length || shared.race.on
    || (LEVEL.endless && finishOf(shared.hwFinish)))) {
    if (LEVEL.endless) clearFinishLine(hwLevel());
    return;
  }
  game.flow = buildFlow();
}
// NO storage writes in the frame loop: a synchronous localStorage write can stall a phone frame
// (judder). The highway best and the speed camera record live in memory while driving and are
// saved here at safe moments: pause, restart, leaving a level, page hidden / closed.
// TYRE WEAR (the default): the player's set is kept per car in the profile; only
// the garage fits a new one. Only a set loaded from the profile is saved back (the menu's demo car
// never is), and only when the event is over (the results, back to the menu, another car): a
// RESTART puts the set back as it was at the event's start, a RESET keeps the race as it is
// (owner).
const carKey = (car: GameCar) => String(car.spec.id).split('#')[0];
/** Saves the player car's tyre wear into the profile. */
export function saveTyreWear() {
  const profile = shared.menu && shared.menu.profile, car = game.car;
  if (!profile || !car || !car.tyreWearOwned || !car.tyreWear) return;
  profile.tyreWear = profile.tyreWear || {};
  profile.tyreWear[carKey(car)] = car.tyreWear.map((wear) => Math.round(wear * 1000) / 1000);
  saveProfile(profile);
}
/**
 * Puts the profile's set of tyres (their wear) on the player's car.
 * @param car the player's car
 */
export function loadTyreWear(car: GameCar) {
  const profile = shared.menu && shared.menu.profile;
  const saved = profile && profile.tyreWear && profile.tyreWear[carKey(car)];
  car.tyreWear = saved ? [...saved] : [0, 0, 0, 0];
  car.tyreWearStart = [...car.tyreWear];
  car.tyreWearOwned = true;
}
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
export function onScreen(x: number, y: number) {
  const margin = 14 * shared.renderer.PPM, screenX = shared.renderer.toScreenX(x),
    screenY = shared.renderer.toScreenY(y);
  return screenX > -margin && screenX < shared.renderer.W + margin && screenY > -margin
    && screenY < shared.renderer.H + margin;
}
/**
 * The field for a (re)start, once the player is on the spawn: the start lights, the AI on the grid
 * and you on your slot, the highway's traffic, the race flow.
 */
function startField() {
  armStart();
  spawnAI();
  // any race grid puts YOU on your slot too — pole included (was gridSlot > 0: on pole you stayed
  // on the centreline spawn, out of formation)
  if (game.start.rolling || (game.ai.length && !LEVEL.stage)) {
    const slotPos = gridPos(game.ai.length ? shared.gridSlot : 0);
    reset(game.car, slotPos.x, slotPos.y, slotPos.h);
    if (shared.renderer && shared.renderer.snap) shared.renderer.snap(game.car);
  }
  // (the menu race too - owner 11-07: "no traffic on menu highway races?")
  game.traffic.reset(LEVEL.endless ? hwLevel() : null, shared.trafficDensity);
  if (LEVEL.endless && game.start.rolling) {
    const [spanStart, spanEnd] = hwGridSpan(hwLevel(), game.ai.length + 1);
    game.traffic.clearSpan(spanStart, spanEnd);
  }   // a clear road for the grid
  // the treadmill guard measures "dropped back" from the furthest point reached (the spawn): a
  // back-row grid slot is up to ~50 m behind it, which read as WRONG WAY 5 s into the race
  // (MEASURED, tools/_tfgame). Start the record where YOU start.
  if (LEVEL.endless && LEVEL._hw) {
    const frame = roadFrame(hwLevel(), game.car.x, game.car.y, null);
    if (frame) LEVEL._hw.best = Math.min(LEVEL._hw.best, frame.s);
  }
  startFlow();
}

export function doRestart() {
  saveRecords();
  // the event's weather from its start (before the cars' tyres take the track temperature and the
  // AI plans its speeds for the wetness)
  // a snowy level's theme biases its weather (weather only: world/weather.ts)
  startWeather(shared.weatherPlan && LEVEL.snowy ? { ...shared.weatherPlan, snowy: true }
    : shared.weatherPlan || null);
  resetTrackside();   // every lamp stands again, lit; every armco rail straight
  // a restart is the event from its start: the set as it was then (owner)
  if (game.car.tyreWearStart) game.car.tyreWear = [...game.car.tyreWearStart];
  if (LEVEL.endless) {
    resetHighway(hwLevel());
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
  // the field: the crash bench's (game/crashbench.ts, you in it), else the race grid
  setTimeout(() => { if (!lineUpCrashBench()) startField(); }, 0);   // after this function has put
  // the player on the spawn
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
  resetPuddles();   // the weather's puddles and snow at the start
  resetCoverField();   // or the cover field's, already settled (?coverfield=1)
  // open on the whole level, then ease in to the car. Not behind the menu:
  // MEASURED on the owner's phone (?report=1, the menu's first 1.5 s) the fly-in nobody sees there
  // cost a 113 ms frame (the whole-level picture) and a 121 ms one (28 GPU uploads at the handover)
  const behindMenu = shared.mode === 'menu';
  if (shared.renderer && shared.renderer.flyIn && !behindMenu) shared.renderer.flyIn();
  shared.trackProgress = 0;
  shared.lastOnTrack = null;
  resetRace(game);
  resetStage(game);
  shared.breadcrumbs.length = 0;
}
