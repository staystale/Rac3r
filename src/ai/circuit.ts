// ai/circuit.js — the racing AI driver for circuits: createAIDriver.
// The cautious BENCH driver stays in autodrive.js (lap tools, menu demo, pace car).
//
// USER SPEC: AI know RACING LINES and how to overtake; SURFACE AWARENESS (stay on
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
// 4. DRIVING: Stanley steering onto the path + a lateral target (mistakes, avoidance),
// target speed = profile x pace.
import { parkMiller } from "../core/random.ts";
import { aiTraits } from "./traits.ts";
import { racingLine } from "./line.ts";
import { createAttackSteps, createRaceMoves } from "./racecraft.ts";
import { createHandbrakeStep, createSlideStep } from "./driverSteps.ts";
import { drive as driveTick, steerNow } from "./driverDrive.ts";
import { withReaction } from "./reaction.ts";
import type { Drv } from "./driverCtx.ts";
import { roadLine } from "./roadLine.ts";
import type { Level } from "../world/types.ts";
import type {
  AiCar, CircuitState, DriveCtx, DriveInput, HighwayLevel, RacingLine,
} from "./types.ts";

// ---------------------------------------------------------------- the driver
// drive(car, dt, ctx): ctx = { cars: [other car objects], lap: current lap (1-based), laps: race
// length }. Other cars may carry _jokers (jokers taken) for the joker tactics.
export function createAIDriver(level: Level, traits = aiTraits(4, 0, 1)) {
  // ONE AI (passed 11-04): the endless highway has no closed lap - its line is its lanes' middle,
  // made again as the road grows (ai/roadLine.ts), and it has no branches (cast: an endless Level
  // is the highway's level, whose road fields ai/types.ts HighwayLevel describes) (! : racingLine
  // has just made the branches)
  const highway = level.endless ? level as unknown as HighwayLevel : null;
  const line = highway ? roadLine(highway) : racingLine(level), main = line;
  const branches = highway ? {} : level._branches!, count = line.n;
  const rnd = parkMiller(traits.seed || 4242);
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
    slideStep, jLaps,
  };

  // on the highway the road grows - a new line for each new stretch, the car's place on
  // it found again (the two lines are the same road where they overlap: no jolt)
  const follow = () => {
    const now = highway && roadLine(highway);
    if (!now || now === drv.line) return;
    bindLine(drv, now);
  };
  const drive = (car: AiCar, dt = 1 / 120, ctx: DriveCtx = {}) => {
    follow();
    return driveTick(drv, car, dt, ctx);
  };
  // put back on the road by the game (stuck / broken): find its place again, forget the dodge and
  // any mistake in progress
  const relocate = () => {
    follow();
    state.i = null;
    state.path = drv.main;
    state.dodge = 0;
    state.mist = null;
    state.thrUntil = 0;
    state.revUntil = 0;
    state.slowT = 0;
    state.outN = 0;
    state.giveUp = false;
  };
  const steer = (car: AiCar) => steerNow(drv, car);
  return reacting({ drive, state: state, total: line.total, traits, relocate }, traits, steer);
}
export type AIDriver = ReturnType<typeof createAIDriver>;

/**
 * Hands a driver a new line (the highway's next stretch): its steps made for it, its
 * place found again, what it was doing about a corner of the old one forgotten.
 * @param drv the driver context
 * @param line the new line
 */
function bindLine(drv: Drv, line: RacingLine) {
  const { state, traits, rnd } = drv;
  drv.line = line; drv.main = line; drv.count = line.n;
  drv.attack = createAttackSteps(state, line, traits, rnd);
  drv.moves = createRaceMoves(state, line, traits, rnd, drv.attack.beyondApex);
  drv.handbrakeStep = createHandbrakeStep(state, line, traits, rnd);
  drv.slideStep = createSlideStep(state, line, traits, rnd);
  state.path = line; state.i = null;
  state.mist = null; state.mistCorner = -1; state.atk = null; state.atkCorner = -1;
  state.cover = null; state.covCorner = -1; state.hbCorner = -1; state.cc = -1;
  state.clCorner = undefined; state.steerHold = null; state.driftCorner = undefined;
}

/**
 * A driver as the game drives it: its drive takes the context or a maker of it (made only when
 * it thinks), with a reaction time by skill (ai/reaction.ts; the AI rework R1, passed 11-04) -
 * relocate also makes it think at once.
 * @param driver the circuit or highway driver
 * @param traits its traits (skill, seed)
 * @param steer the hands between thinks (the circuit driver), if it has them
 * @returns the driver with that drive
 */
function reacting<D extends { drive: (car: AiCar, dt?: number, ctx?: DriveCtx) => DriveInput;
  relocate: () => void }>(driver: D, traits: { skill: number; seed: number },
  steer?: (car: AiCar) => number | null) {
  const react = withReaction(driver.drive, traits.skill, traits.seed || 4242, steer);
  return { ...driver, drive: react.drive,
    relocate: () => { driver.relocate(); react.forget(); } };
}
