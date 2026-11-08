// ai.ts — Stepping the AI cars: injury, driving, joker and stuck handling.
import { hwLevel } from './state.ts';
import { step, reset, assertFinite } from '../vehicle.ts';
import { hwPutBack } from '../highwayrace.ts';
import { hit, hitRoll, repair, tooInjured, applyBurst, stepDamage } from '../damage.ts';
import { rolling, tripCheck, stepRoll } from '../roll.ts';
import { LEVEL } from "../world/state.ts";
import { applyGround } from "../world/wear.ts";
import { clampWorld } from "../world/crossings.ts";
import { sameLevel } from "../world/crossinggeo.ts";
import { crossedJoker } from './rules.ts';
import { findNearestSubtrackPoint, onTrack } from "../world/tyrewall.ts";
import { startHeld, carHeld, atPace, formationWant } from './order.ts';
import { RESET_BACK, RESET_ANG } from './session.ts';
import { shared, game } from './state.ts';
import { activeLamps } from '../world/lamps.ts';
import type { AiEntry, HurtEntry } from './state.ts';
import type { CarInput } from '../vehicle.ts';
import type { RaceFlow } from '../raceflow.ts';

// AI RESET (requirement: reset AI should reset like the player's, at the edge of the track):
// RESET_BACK m behind the last point it was on the road, centred on the edge it left by (half on /
// half off), nose RESET_ANG deg back toward the road — as doReset does for you. No record (never on
// the road yet): the nearest centreline point, as before.
export function aiReset(entry: HurtEntry) {
  const car = entry.car, sub = LEVEL.subtrack!, rec = car._lastOn;
  // the HIGHWAY: 15 m back from where it was, in the lane with the most room, facing up the road,
  // rolling (highwayrace.js hwPutBack)
  if (LEVEL.endless) {
    const all = [game.car, ...game.ai.map((other) => other.car),
      ...game.traffic.cars].filter((other) => other !== car),
        point = hwPutBack(hwLevel(), (car._hwf ? car._hwf.s : 0) - 15, all);
    const speed = Math.max(12, 0.5 * Math.hypot(car.vx, car.vy));
    reset(car, point.x, point.y, point.h);
    car.vx = Math.cos(point.h) * speed;
    car.vy = Math.sin(point.h) * speed;
    car._hwf = null;
    entry.drv.relocate();
    repair(car);
    entry.hurtWait = null;
    return;
  }
  if (rec) {
    const side = Math.sign(rec.off) || (Math.random() < 0.5 ? -1 : 1),
      dist = (rec.dist - RESET_BACK + sub.totalDist) % sub.totalDist;
    const point = onTrack(sub, dist, side * sub.width / 2, {}),
      ang = (RESET_ANG[0] + Math.random() * (RESET_ANG[1] - RESET_ANG[0])) * Math.PI / 180;
    reset(car, point.x, point.y, point.rot - side * ang);
    car._lastOn = { dist: dist, off: side * (sub.width / 2 - 0.5) };
  } else {
    const nearest = findNearestSubtrackPoint(sub, car.x, car.y)!;   // a circuit has points
    reset(car, nearest.x, nearest.y, nearest.heading);
  }
  entry.drv.relocate();
  repair(car);
  entry.hurtWait = null;
}
/**
 * Starts the pause-then-reset of a too-injured AI car, and resets it when the pause is over.
 * @param entry the AI entry
 * @param dt the step in seconds
 */
export function stepAIInjury(entry: HurtEntry, dt: number) {
  const car = entry.car;
  // TOO INJURED (requirement: if an AI is too injured it should reset): back on the road, mended —
  // the bill keeps the cost
  // TOO INJURED: a pause before the reset so the crash PLAYS OUT (requirement: wait a moment, the
  // worse the damage the longer, max 2-3 s): 1 s + 2 s x severity (mean corner damage, + 0.4 for a
  // lost wheel), coasting on light brakes meanwhile
  if (entry.hurtWait == null && tooInjured(car)) {
    const dmg = car.dmg,
      sev = Math.min(1,
        (dmg[0] + dmg[1] + dmg[2] + dmg[3]) / 4 + (car.wheelOff && car.wheelOff.some(Boolean)
          ? 0.4 : 0));
    entry.hurtWait = 1 + 2 * sev;
    entry.hurtT = 0;
  }
  if (entry.hurtWait != null && (entry.hurtT = (entry.hurtT ?? 0) + dt) >= entry.hurtWait) {
    aiReset(entry);
    entry.hurtWait = null;
    car._dmgResets = (car._dmgResets || 0) + 1;
  }
}

/**
 * Refreshes the loose objects (cones, tyres, bales) near an AI car, every 0.25 s.
 * @param entry the AI entry
 * @param dt the step in seconds
 */
export function refreshAIObstacles(entry: AiEntry, dt: number) {
  const car = entry.car;
  // loose objects (cones, tyres, bales) within 45 m, refreshed every 0.25 s — the AI steps
  // round them when it can (aidriver OBSTACLES)
  if (!((entry.obsT ?? 0) > 0)) {
    entry.obsT = 0.25;
    const near2 = 45 * 45;
    entry.obs = game.cones.list
      .filter((obj) => (obj.x - car.x) ** 2 + (obj.y - car.y) ** 2 < near2
        && !(obj.kind === 'banger' || obj.kind === 'caravan'))
      .map((obj) => ({ x: obj.x, y: obj.y, r: obj.r }));
    // the standing lamp posts near it, steered round off the road too (owner 11-04: "make them
    // avoid lamppost too in case they end up off track")
    for (const lamp of activeLamps()) {
      if (lamp.down || (lamp.x - car.x) ** 2 + (lamp.y - car.y) ** 2 >= near2) continue;
      entry.obs.push({ x: lamp.x, y: lamp.y, r: lamp.solid.r ?? 0.3, fixed: true });
    }
  }
  entry.obsT! -= dt;
}

/**
 * Asks an AI driver for its controls this step.
 * @param entry the AI entry
 * @param dt the step in seconds
 * @returns the wanted controls
 */
export function aiWant(entry: AiEntry, dt: number) {
  const car = entry.car;
  // what the AI knows: the other cars (to avoid / pass / cover), its lap (from the race order's
  // progress) and the race length (jokers)
  const total = LEVEL.subtrack!.totalDist, lap = LEVEL.endless || car._prog === undefined ? 1
    : Math.max(1, Math.floor(car._prog / total) + 1);
  refreshAIObstacles(entry, dt);
  // (the highway racer also sees the TRAFFIC, and holds formation until the green)
  const want = entry.drv.drive(car, dt, () => (
    { obstacles: entry.obs,
      cars: [game.car, ...game.ai.map((other) => other.car),
        ...(LEVEL.endless ? game.traffic.cars : [])].filter((other) => other !== car
          && sameLevel(other, car)),
          hold: startHeld(), lap,
            laps: game.flow ? game.flow.laps : shared.race.on ? shared.race.laps
              : (LEVEL.joker && LEVEL.joker.laps) || 5 }));
  // waiting out the crash
  if (entry.hurtWait != null) return { steer: 0, throttle: 0, brake: 0.4, handbrake: 0 };
  return want;
}

/**
 * Steps an AI car's physics (or its roll), holding it on the grid before the start.
 * @param entry the AI entry
 * @param want the wanted controls
 * @param dt the step in seconds
 */
export function stepAIPhysics(entry: AiEntry, want: CarInput, dt: number) {
  const car = entry.car;
  const held = LEVEL.stage ? carHeld(car) : startHeld();
  if (rolling(car)) {
    stepRoll(car, dt, (kind, side, weight) => hitRoll(car, kind, side, weight));
    // an overturned AI, once it has stopped: back on its wheels on the road (as a marshal
    // would), mended
    if (car.roll && car.roll.phase !== 'rolling' && car.roll.still > 1.5) aiReset(entry);
  } else {
    const formed = held && game.start.rolling && formationWant(car, car._slot || 0, entry);
    step(car, formed || (held ? (game.start.rolling ? atPace(want, car)
      : { steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0 }) : want), dt);
    if (!held) tripCheck(car, dt);
    applyBurst(car);
  }   // start lights
  // the stingers, the tyres' air and metal on the ground, rolled or not
  stepDamage(car, dt);
}

/**
 * Counts an AI car through the joker gate, exactly as for the player (stepJoker).
 * @param entry the AI entry
 */
export function stepAIJoker(entry: AiEntry) {
  const car = entry.car;
  const joker = LEVEL.joker;
  // (the same LINE as the player's, stepJoker; once per lap of this car's own progress)
  if (joker) {
    const lapA = car._prog === undefined ? 0 : Math.floor(car._prog / LEVEL.subtrack!.totalDist);
    // a car reset earlier this step (a crash, a roll: reset() clears _p) was put there,
    // it did not cross the line - as the player's check (rules.ts: !!prev). MEASURED 11-03: on
    // Knobhill with 20 AI the null _p threw here, and recoverAI threw again on it out of the loop
    const prev = car._p;
    if (!prev) return;
    if (crossedJoker(joker, prev!.x, prev!.y, car.x, car.y) && entry.jLap !== lapA) {
      entry.jLap = lapA;
      car._jokers = car._jokers! + 1;   // (grid.ts zeroes it)
    }
  }
}

// m/s gained over the 3 s that says trying, not stuck (ai/driveOut.ts TRYING_GAIN)
const TRYING_GAIN = 0.08;

/**
 * Counts the seconds an AI car has been under 1 m/s (entry.stuckT); (A9) going forwards
 * and gaining since it went slow is TRYING (an icy start creeping away, its wheels spinning), not
 * stuck - MEASURED: a muscle car on ice crawls under 1 m/s for 4-7 s on its way off the grid.
 * @param entry the AI entry
 * @param held true while the start holds it
 * @param dt the step in seconds
 */
function noteStuck(entry: AiEntry, held: boolean, dt: number) {
  const car = entry.car, speed = Math.hypot(car.vx, car.vy);
  entry.stuckT = !held && speed < 1 ? entry.stuckT + dt : 0;
  if (!entry.stuckT) entry.stuckFrom = undefined;
  else if (entry.stuckFrom === undefined) entry.stuckFrom = speed;
  if (entry.stuckT > 3 && car.t.vLong > 0 && speed - entry.stuckFrom! > TRYING_GAIN) {
    entry.stuckT = 0;
    entry.stuckFrom = speed;
  }
}

/**
 * Resets an AI car that is stuck (beached, off the highway, or out of tries driving itself out).
 * @param entry the AI entry
 * @param dt the step in seconds
 */
export function stepAIStuck(entry: AiEntry, dt: number) {
  const car = entry.car;
  const held = LEVEL.stage ? carHeld(car) : startHeld();
  // STUCK (beached, nose in a wall, spun backwards): under 1 m/s for 3 s after the green ->
  // back on the road, as the player's RESET
  noteStuck(entry, held, dt);
  // the HIGHWAY: more than 8 m off the carriageway for 3 s (or 40 m out) also counts — there is
  // no lap to come back to
  if (LEVEL.endless && car._hwf) {
    const out = Math.abs(car._hwf.off) - hwLevel()._hw.geo.hw;
    entry.offT = out > 8 ? (entry.offT || 0) + dt : 0;
    if (entry.offT > 3 || out > 40) {
      entry.offT = 0;
      entry.stuckT = 4;
    }
  }
  // (an AI first tries to DRIVE ITSELF OUT - aidriver.js DRIVE OUT - and gives up after three
  // tries: then this resets it)
  if (entry.stuckT > 3 || entry.drv.state.giveUp) {
    aiReset(entry);
    entry.stuckT = 0;
  }
}

/**
 * Puts an AI car that broke back on the road, never allowing it to stop the game.
 * @param entry the AI entry
 */
export function recoverAI(entry: AiEntry) {
  const car = entry.car;
  // (reset this step, so no pose from before it - where it is now, the reset spot)
  const from = car._p ?? car;
  if (LEVEL.endless) {
    car.x = from.x;
    car.y = from.y;
    car.vx = car.vy = 0;
    try {
      aiReset(entry);
    } catch { /* next step */ }
    return;
  }
  const sub = LEVEL.subtrack!, nearest = findNearestSubtrackPoint(sub, from.x, from.y)!;
  reset(car, nearest.x, nearest.y, nearest.heading);
  entry.drv.relocate();
}

/**
 * Steps one AI car: clamps, injury, driver, physics, joker, stuck check.
 * @param entry the AI entry
 * @param dt the step in seconds
 */
export function stepAICar(entry: AiEntry, dt: number) {
  const car = entry.car;
  car._p = { x: car.x, y: car.y, h: car.heading };
  // DRIVER AIDS follow yours (requirement: in an event if you turn TCS on and off it should also
  // turn off for the AI): the same switch, on the cars that have that aid
  car.absOn = !!game.car.absOn && !!(car.spec.aids && car.spec.aids.abs);
  car.tcsOn = !!game.car.tcsOn && !!(car.spec.aids && car.spec.aids.tcs);
  try {
    const v0x = car.vx, v0y = car.vy;
    clampWorld(car);
    hit(car, v0x, v0y);
    stepAIInjury(entry, dt);
    applyGround(car, dt);
    const want = aiWant(entry, dt);
    // the AI's brake lights show its brakes
    car.brakeLight = want.brake;
    car.handbrakeOn = want.handbrake ? 1 : 0;
    stepAIPhysics(entry, want, dt);
    assertFinite(car);
    // the JOKER gate, counted for every AI exactly as for the player (stepJoker)
    stepAIJoker(entry);
    stepAIStuck(entry, dt);
  // an AI car that breaks is put back on the road, never allowed to stop the game
  } catch {
    recoverAI(entry);
  }
}

/**
 * Steps every AI car one physics step.
 * @param dt the step in seconds
 */
export function stepAI(dt: number) {
  // a RALLY STAGE: a car 3 s past the finish has gone through the stop control — off the road, so
  // it never drives back into the queue
  const flow = game.flow as RaceFlow | null;   // (a stage runs the race flow, not the highway's)
  if (LEVEL.stage && flow) game.ai = game.ai.filter((entry) => {
    const flowRow = flow.entries.find((x) => x.car === entry.car);
    return !(flowRow && flowRow.finish != null && flow.t - flowRow.finish > 3);
  });
  for (const entry of game.ai) stepAICar(entry, dt);
}
