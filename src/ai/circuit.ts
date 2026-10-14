// ai/circuit.js — the racing AI driver for circuits: createAIDriver (split from aidriver.js).
// The cautious BENCH driver stays in autodrive.js (lap tools, menu demo, pace car).
//
// USER SPEC (2026-10-04): AI know RACING LINES and how to overtake; SURFACE AWARENESS (stay on
// faster / grippier ground when quicker); the difficulty is the CENTRE of a GRADIENT across the
// field ("some drive better, some quicker, some more defensive, some more aggressive"); VARIATION
// OFF THE LINE grows as difficulty drops ("worse AI more random, better AI like a professional:
// fast and on line"); difficulty comes from "how fast, how few mistakes, racing lines, tactics like
// pit stops and joker laps, deviation from the line"; the AI should feel like it's SCRABBLING for
// victory or making GENUINE SUBTLE DRIVING ERRORS that lead to crashes and / or slower laps; take
// JOKER laps randomly / tactically; AVOID waiting for or crashing into other cars, deviating from
// its chosen path to do it; on Slidden Hill take the TRADITIONAL START (the RX start straight), not
// a dash to the nearest bit of lap.
//
// 4. DRIVING: Stanley steering onto the path + a lateral target (wander, mistakes, avoidance),
// target speed = profile x pace.
import { parkMiller } from "../core/random.ts";
import { aiTraits } from "./traits.ts";
import { racingLine } from "./line.ts";
import { roadDriver } from "./weaver.ts";
import { createAttackSteps, createRaceMoves } from "./racecraft.ts";
import { createHandbrakeStep, createSlideStep } from "./driverSteps.ts";
import { drive as driveTick } from "./driverDrive.ts";
import type { Drv } from "./driverCtx.ts";
import type { Level } from "../world/types.ts";
import type {
  AiCar, CircuitState, DriveCtx, HighwayLevel,
} from "./types.ts";

// ---------------------------------------------------------------- the driver
// drive(car, dt, ctx): ctx = { cars: [other car objects], lap: current lap (1-based), laps: race
// length }. Other cars may carry _jokers (jokers taken) for the joker tactics.
export function createAIDriver(level: Level, traits = aiTraits(4, 0, 1)) {
  // the ENDLESS highway has no closed lap to plan a line round: the same driver reads the road
  // frame instead (roadDriver above) (cast: an endless Level is the highway's level, whose road
  // fields ai/types.ts HighwayLevel describes)
  if (level.endless) {
    return roadDriver(
      level as unknown as HighwayLevel, traits,
      parkMiller(((traits.seed || 4242) * 31 + 7) % 2147483647 || 1),
    );
  }
  // (! : racingLine has just made the branches)
  const line = racingLine(level), main = line, branches = level._branches!, count = line.n;
  const rnd = parkMiller(traits.seed || 4242);
  const wanderPhaseA = rnd() * 6.28, wanderPhaseB = rnd() * 6.28;
  const jLaps = (level.joker && level.joker.laps) || 5;
  // the joker PLAN: a lap drawn from a spread (rarely the first, when the field is packed),
  // tactics can override it on the day
  const jPlan = (() => {
      const roll = rnd(), cum = [0.12, 0.35, 0.6, 0.82, 1.0]; for (
      let band = 0; band < cum.length; band++) if (roll < cum[band]) return Math.min(
      jLaps, band + 1); return jLaps; })();
  const state: CircuitState = {
    path: main, i: null, vT: 0, t: 0, lap: 0, jokers: 0, jPlan, jWant: false, jDecLap: -1, jForget:
        rnd() < (traits.slip || 0),
    mist: null, mistCorner: -1, dodge: 0, follow: false, cap: 0, lastDist: 0, pushing: false,
        thrUntil: 0,
    atk: null, atkCorner: -1, hbCorner: -1, hbUntil: 0, cover: null, covCorner: -1, leadCar: null,
        behindT: 0
    };

  const attack = createAttackSteps(state, line, traits, rnd);
  const moves = createRaceMoves(state, line, traits, rnd, attack.beyondApex);
  const handbrakeStep = createHandbrakeStep(state, line, traits, rnd);
  const slideStep = createSlideStep(state, line, traits, rnd);
  const drv: Drv = {
    level, traits, rnd, line, main, branches, count, state, attack, moves, handbrakeStep,
    slideStep, wanderPhaseA, wanderPhaseB, jLaps,
  };

  const drive = (car: AiCar, dt = 1 / 120, ctx: DriveCtx = {}) => (
      driveTick(drv, car, dt, ctx));
  // put back on the road by the game (stuck / broken): find its place again, forget the dodge and
  // any mistake in progress
  const relocate = () => {
    state.i = null;
    state.path = main;
    state.dodge = 0;
    state.mist = null;
    state.thrUntil = 0;
    state.revUntil = 0;
    state.slowT = 0;
    state.outN = 0;
    state.giveUp = false;
  };
  return { drive, state: state, total: line.total, traits, relocate };
}
export type AIDriver = ReturnType<typeof createAIDriver>;
