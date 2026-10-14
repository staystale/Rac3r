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
import { racingLine, profileOf } from "./line.ts";
import { roadDriver, driveOut } from "./weaver.ts";
import { createAttackSteps, createRaceMoves } from "./racecraft.ts";
import { createHandbrakeStep, createSlideStep } from "./driverSteps.ts";
import { steerSlideStep, pedalStep } from "./driverPedals.ts";
import {
  advance, placeAtStart, mistakeStep, laneStep, battleStep, racecraftStep,
} from "./driverLane.ts";
import { jokerStep } from "./driverJoker.ts";
import { carsStep, obstacleAvoid } from "./driverTraffic.ts";
import type { Drv } from "./driverCtx.ts";
import type { Level } from "../world/types.ts";
import type {
  AiCar, CircuitState, DriveCtx, HighwayLevel,
} from "./types.ts";

// m: the lateral target never puts the car's centre closer than this to the road edge
const WANDER_EDGE = 1.1;
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

  function drive(car: AiCar, dt = 1 / 120, ctx: DriveCtx = {}) {
    state.t += dt;
    const spec = car.spec, speed = Math.hypot(car.vx, car.vy);
    if (state.i === null) placeAtStart(drv, car);
    advance(drv, car);
    // ---- DRIVE ITSELF OUT (user, 2026-10-07: "it should try to drive it self out, if it falls
    // super far behind / stays off track too long / stays still / drives too slow for too long, ect
    // it can reset"). Nearly still for DRIVE_OUT_T s after the green (nose in a wall, beached,
    // tangled with a car) -> REVERSE for ~1-1.5 s with the wheel turned to swing the nose back
    // toward the road, then drive on. The game's reset (main.js) is the LAST resort now: it waits
    // longer, so this gets two or three tries first. (! : st.i was set just above)
    {
      const out = driveOut(state, car, speed, dt, ctx, rnd, () => state.path.pts[state.i!].h);
      if (out) return out;
    }
    const lap = ctx.lap || Math.max(1, state.lap), laps = ctx.laps || jLaps;
    const path = state.path, size = path.n, idx = (pos: number) => (
        path.closed ? ((pos % size) + size) % size : Math.max(0, Math.min(size - 1, pos)));
    const nearIdx = state.i!; let prof = profileOf(path, spec, main);
    const others = ctx.cars || [];
    const push = battleStep(drv, car, others);
    // ---- JOKER: decide once per lap ~220 m before the branch; take it at the switch point
    const jCap = jokerStep(drv, car, ctx, path, nearIdx, lap, laps);

    // ---- MISTAKES (user: "genuine subtle driving errors that lead to crashes and / or slower lap
    // times"), drawn per corner ~45 m out
    const mistakes = mistakeStep(drv, path, nearIdx);
    let vMul = mistakes.vMul;
    const thrForce = mistakes.thrForce;

    // ---- the line, the wander and the start lane
    const lane = laneStep(drv, car, path, nearIdx, speed, mistakes.latT);
    let latT = lane.latT;
    const lineOff = lane.lineOff, startK = lane.startK;

    // ---- OTHER CARS (user: "avoid waiting for or crashing into other cars, deviating from its
    // chosen path"): a car ahead in the way -> pick the side with room and go round it (that IS the
    // overtake); no room -> sit behind it, matching its speed; a car alongside -> keep a gap; a
    // faster car close behind -> a defensive driver covers its side a little
    const prec = traits.prec ?? 0.5;
    const latLim = path === main ? line.hw - WANDER_EDGE : 2;
    const myLat = state.dodge + latT;
    const cars = carsStep(drv, car, others, path, nearIdx, idx, speed, prec, prof, lineOff, latT,
        startK, latLim, myLat);
    let dodgeT = cars.dodgeT, conflict = cars.conflict;
    const followCap = cars.followCap;
    const avoid = obstacleAvoid(drv, car, ctx, path, nearIdx, idx, speed, prec, lineOff, myLat,
        latLim, latT, dt, { dodgeT, conflict });
    ({ dodgeT, conflict } = avoid);
    // ---- RACECRAFT (stage 3, 2026-10-04; user: "real overtakes, real defending, scrabbling for
    // victory"). Stage 2 only went round a car that was already in the way, so circuits were
    // processions (aifieldsuite, Realish: 35 held passes in 12 six-car 3-lap races, Brands and
    // Naffcar ~0). ATTACK: sat behind the same car (longer for the cautious) with a corner coming
    // -> commit to a side for that corner: the INSIDE, unless the car ahead already covers it,
    // then round the OUTSIDE for the switch-back; brake later (K_BRAKE + ATK_KB) and push a
    // little. Ends past the apex, once ahead, if it drops back or after 7 s. DEFENCE: a car
    // closing behind with a corner coming -> a defensive driver (chance = defence) moves over to
    // COVER THE INSIDE once, and pays for the tighter line (3 % slower in the corner).
    if (path === main) {
      ({ vMul, dodgeT, conflict, prof } = racecraftStep(drv, car, path, nearIdx, idx, speed, dt,
          lineOff, latLim, latT, myLat, cars, vMul, dodgeT, conflict, prof));
    } else { state.atk = null; state.cover = null; state.cc = -1; }
    const rate = state.atk ? 3.5 : 2.5;
    state.dodge += Math.max(-rate * dt, Math.min(rate * dt, dodgeT - state.dodge)) * (
        conflict ? 1 : 0.5);
    state.follow = followCap < Infinity;
    latT += state.dodge;
    // past the usual edge only while going round a car (above)
    const edge = state.t < (state.wideUntil || 0) ? state.wide! : latLim;
    latT = Math.max(-edge, Math.min(edge, lineOff + latT)) - lineOff;
    // OFF THE LINE INTO A CORNER (an attack, a cover, a dodge, a wander): the profile is for the
    // racing line's radius; x m further INSIDE at the apex is a radius R - x, so the corner speed
    // drops by sqrt((R - x) / R). Without it attackers ran wide on the exit (aifieldsuite Realish
    // off-road 142 -> 299 car-s, MEASURED). (applied in the SPEED section: every bend ahead within
    // braking distance, not only the "corners" — Naffcar's banked turns are wider than CORNER_R,
    // and tow passes on their inside slid off: off-road 0 -> 14 car-s, MEASURED)
    const slide = steerSlideStep(drv, car, path, nearIdx, idx, speed, lineOff, latT);
    return pedalStep(drv, car, path, nearIdx, idx, speed, dt, prof, latT, lineOff,
        { push, vMul, jCap, followCap, thrForce }, slide);
  }
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
