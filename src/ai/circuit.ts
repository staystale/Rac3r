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
import { querySubtrack } from "../world/tyrewall.ts";
import { aiTraits } from "./traits.ts";
import { K_BRAKE, racingLine, nearestIdx, profileOf } from "./line.ts";
import { roadDriver, driveOut } from "./weaver.ts";
import { createAttackSteps, createRaceMoves } from "./racecraft.ts";
import { createHandbrakeStep, createSlideStep } from "./driverSteps.ts";
import { steerSlideStep, pedalStep } from "./driverPedals.ts";
import { jokerStep } from "./driverJoker.ts";
import { carsStep, obstacleAvoid } from "./driverTraffic.ts";
import type { Drv } from "./driverCtx.ts";
import type { Level } from "../world/types.ts";
import type {
  AiCar, CarsAcc, CircuitState, DriveCtx, HighwayLevel,
} from "./types.ts";

// m: the lateral target never puts the car's centre closer than this to the road edge
const WANDER_EDGE = 1.1;
// extra braking grip planned while ATTACKING (late braking into the corner)
const ATK_KB = 0.12;
const ALONG_GAP = 2.7;       // m kept from a car alongside by an attack or a cover move
// MEASURED (aifieldsuite Realish, 24 races): before start-contacts 765, contact 231 s, resets 14,
// passes 118; 6 s / 0.8 m: 564, 258 s, 17, 219; 9 s / 1.3 m (kept): 492, 212 s, 9, 192 (off-road
// +12 %)
// s to ease from the grid lane onto the line (START_GAP, m more room alongside then, is in
// driverTraffic.ts)
const START_BLEND = 9;
// NEVER WAIT (user, 2026-10-07: "patience they should never really wait imo, just try harder and
// go faster"): seconds of being held up before
// a pass is tried were 0.3-1.5 s (by aggression), now 0.15-0.6; the chance to commit to one per
// corner 30-90 % -> 60-100 %; and sat behind
// a car it PUSHES HARDER, up to HARDER faster the longer it is held.
const HARDER = 0.03, HARDER_T = 4;

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

  function advance(car: AiCar) {
    const path = state.path, pts = path.pts, size = path.n;
    // (! : drive finds its place before it calls advance)
    let bestIdx = state.i!, bestDist2 = Infinity;
    for (let offset = -4; offset <= 30; offset++) {
      let i = state.i! + offset;
      if (path.closed) i = (i + size) % size;
      else if (i < 0 || i >= size) continue;
      const dist2 = (pts[i].x - car.x) ** 2 + (pts[i].y - car.y) ** 2;
      if (dist2 < bestDist2) {
        bestDist2 = dist2;
        bestIdx = i;
      }
    }
    if (path === main && state.i! > size * 0.8 && bestIdx < size * 0.2) state.lap++;
    state.i = bestIdx; state.lastDist = Math.sqrt(bestDist2);
    // off the end of a branch: back onto the line where it merged
    // (! : a branch always has rejoin)
    if (path !== main && bestIdx >= size - 2) {
      state.path = main;
      state.i = path.rejoin!;
      advance(car);
    }
  }
  function startMistake(cIdx: number) {
    const roll = rnd(), kind = roll < 0.4 ? 'late' : roll < 0.65 ? 'early' : roll < 0.85 ?
        'throttle' : 'lift';
    state.mist = {
      kind, sev: Math.min(1, (0.3 + 0.7 * rnd()) * (1.2 - traits.skill)), corner: cIdx, inside:
          false, t: 0
    };
  }

  /** Puts a car that has no place yet on the RX start branch or the main line. */
  function placeAtStart(car: AiCar) {
    // the START: a car sitting on the RX start straight drives it (user: "the traditional
    // start"), else the line
    if (branches.start && querySubtrack(level.subtrack!, car.x, car.y).dist > line.hw &&
        Math.hypot(...(() => {
        const nearest = nearestIdx(branches.start.pts, car.x, car.y), point = branches.start.pts[
        nearest]; return [point.x - car.x, point.y - car.y]; })()) < 12) {
      state.path = branches.start; state.i = nearestIdx(branches.start.pts, car.x, car.y);
    } else { state.path = main; state.i = nearestIdx(main.pts, car.x, car.y); }
  }

  /** Applies the running mistake to the line (latT) and the speed (vMul); may arm the throttle. */
  function applyMistake(mist: NonNullable<typeof state.mist>, nearIdx: number) {
    let latT = 0, vMul = 1;
    const corner = line.corners[mist.corner], inC = line.cid[nearIdx] === mist.corner,
        pastApex = inC && ((nearIdx - corner.apex + count) % count) < count / 2;
    if (inC) mist.inside = true;
    if (mist.inside && !inC) state.mist = null;    // through the corner: done
    // brakes late: runs wide, maybe off
    else if (mist.kind === 'late' && !pastApex) vMul = 1.06 + 0.14 * mist.sev;
    // turns in early: clips the inside
    else if (mist.kind === 'early' && !pastApex) latT += corner.turn * (1 + 2 * mist.sev);
    // hesitates: just slow
    else if (mist.kind === 'lift') vMul = 1 - (0.05 + 0.1 * mist.sev);
    // too much, too soon: a slide
    else if (mist.kind === 'throttle' && pastApex && !mist.fired) {
      mist.fired = true;
      state.thrUntil = state.t + 0.3 + 0.5 * mist.sev;
    }
    return { latT, vMul };
  }

  /** Draws a mistake per corner ~45 m out and applies the running one: line, speed, throttle. */
  function mistakeStep(path: typeof state.path, nearIdx: number) {
    let latT = 0, vMul = 1;
    if (path === main) {
      const cornerAhead = line.cid[(nearIdx + Math.round(45 / line.sp)) % count];
      if (cornerAhead >= 0 && cornerAhead !== state.mistCorner) {
        state.mistCorner = cornerAhead;
        state.mist = null;
        if (rnd() < traits.mistake * (state.pushing ? 1.6 : 1)) startMistake(cornerAhead);
      }
      const mist = state.mist;
      if (mist) ({ latT, vMul } = applyMistake(mist, nearIdx));
    }
    return { latT, vMul, thrForce: state.t < state.thrUntil };
  }

  /** Shapes the lateral target: racing-line share, wander and the grid lane at the start. */
  function laneStep(car: AiCar, path: typeof state.path, nearIdx: number, speed: number,
      latIn: number) {
    const pts = path.pts;
    let latT = latIn;
    // ---- the line: less of its width for lower skill (lineQ), plus a slow WANDER, bigger for less
    // skilled drivers
    // (! : the racing line has off at every point)
    const lineOff = path === main ? pts[nearIdx].off! : 0;
    latT += -lineOff * (1 - traits.lineQ);
    latT += traits.wander * (
        0.6 * Math.sin(state.t * 0.37 + wanderPhaseA) + 0.4 * Math.sin(
        state.t * 0.83 + wanderPhaseB));
    // THE START (user, 2026-10-04: "they aim for the racing line a bit too hard at the start of
    // races and it causes crashes — increase crash awareness a tiny bit, more willing to overtake /
    // avoid, without slowing down"): from the moment it moves off, the car KEEPS ITS GRID LANE (its
    // offset from the line when it set off) and eases onto the line over START_BLEND s; in that
    // phase cars alongside get more room (START_GAP) and a car ahead is gone round rather than
    // followed.
    if (state.goT == null && speed > 2 && path === main) {
      state.goT = state.t;
      const here = pts[nearIdx];
      state.gridLat = (car.x - here.x) * -Math.sin(here.h) + (car.y - here.y) * Math.cos(here.h);
    }
    const startK = state.goT == null ? 1 : Math.max(0, 1 - (state.t - state.goT) / START_BLEND);
    if (startK > 0 && path === main && state.gridLat != null) latT += state.gridLat * startK;
    return { latT, lineOff, startK };
  }

  /** Flags a battle (car within 25 m); returns the push factor on the pace. */
  function battleStep(car: AiCar, others: AiCar[]) {
    // BATTLING (user: "scrabbling for victory"): a car within 25 m -> push a little harder, and
    // err a little more
    state.pushing = others.some((other) => Math.hypot(other.x - car.x, other.y - car.y) < 25);
    return (state.pushing ? 1 + 0.02 * traits.aggression : 1) * (
        state.atk ? 1 + 0.02 * traits.aggression : 1) * (
        1 + HARDER * Math.min(1, (state.behindT || 0) / HARDER_T));
  }

  /** RACECRAFT on the main line: attack, tow pass, giving room, cover; the target it sets. */
  function racecraftStep(car: AiCar, path: typeof state.path, nearIdx: number,
      idx: (pos: number) => number, speed: number, dt: number, lineOff: number, latLim: number,
      latT: number, myLat: number, cars: CarsAcc, vMulIn: number, dodgeIn: number,
      conflictIn: boolean, profIn: ReturnType<typeof profileOf>) {
    const { lead, threat, side, alg } = cars, pts = path.pts, spec = car.spec;
    let vMul = vMulIn, dodgeT = dodgeIn, conflict = conflictIn, prof = profIn;
    const nxt = attack.scanCorners(lead, nearIdx, dt);
    const { cur, nextCorner, nextDist } = nxt;
    attack.endAttack(car, nearIdx, cur);
    attack.startAttack(lead, nxt, speed, lineOff, latLim);
    moves.towPass(car, lead, nxt, lineOff, latLim,
        pts[idx(nearIdx + Math.round(80 / path.sp))].turn);
    vMul = moves.yieldRoom(side, nxt, vMul);
    moves.coverStep(threat, nxt, nearIdx);
    if (state.atk) {
      conflict = true;
      dodgeT = state.atk.side * (latLim - 1.0) - lineOff - latT;
      prof = profileOf(path, spec, main, K_BRAKE + ATK_KB);
    }
    else if (state.cover) {
      conflict = true;
      dodgeT = state.cover.side * 0.6 * latLim - lineOff - latT;
    }
    // never squeeze a car that is ALONGSIDE: the racecraft target keeps ALONG_GAP from it
    // (attacks ignored it: side contact 41 -> 110 events on one Thruston run, MEASURED)
    if (state.atk || state.cover) {
      let target = latT + dodgeT;
      for (const alongOther of alg) if (
          Math.abs(target - alongOther) < ALONG_GAP) target = alongOther + Math.sign(
          myLat - alongOther || 1) * ALONG_GAP;
      dodgeT = target - latT;
    }
    state.cc = cur >= 0 ? cur : nextDist < 80 ? nextCorner : -1;
    return { vMul, dodgeT, conflict, prof };
  }

  function drive(car: AiCar, dt = 1 / 120, ctx: DriveCtx = {}) {
    state.t += dt;
    const spec = car.spec, speed = Math.hypot(car.vx, car.vy);
    if (state.i === null) placeAtStart(car);
    advance(car);
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
    const push = battleStep(car, others);
    // ---- JOKER: decide once per lap ~220 m before the branch; take it at the switch point
    const jCap = jokerStep(drv, car, ctx, path, nearIdx, lap, laps);

    // ---- MISTAKES (user: "genuine subtle driving errors that lead to crashes and / or slower lap
    // times"), drawn per corner ~45 m out
    const mistakes = mistakeStep(path, nearIdx);
    let vMul = mistakes.vMul;
    const thrForce = mistakes.thrForce;

    // ---- the line, the wander and the start lane
    const lane = laneStep(car, path, nearIdx, speed, mistakes.latT);
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
      ({ vMul, dodgeT, conflict, prof } = racecraftStep(car, path, nearIdx, idx, speed, dt, lineOff,
          latLim, latT, myLat, cars, vMul, dodgeT, conflict, prof));
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
