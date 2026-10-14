// ai/driverLane.ts: the circuit driver's place on the path, its mistakes, its lateral lane
// (line share, wander, grid lane), the push of a battle and its racecraft. Functions take the
// driver context.
import { querySubtrack } from "../world/tyrewall.ts";
import { K_BRAKE, nearestIdx, profileOf } from "./line.ts";
import type { AiCar, CarsAcc, CircuitState } from "./types.ts";
import type { Drv, AiPath } from "./driverCtx.ts";

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

/** Finds the car place on its path (and counts laps) from where it was last time. */
export function advance(drv: Drv, car: AiCar) {
  const { main, state } = drv;
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
    advance(drv, car);
  }
}

/** Draws the kind and severity of a mistake for the corner ahead. */
export function startMistake(drv: Drv, cIdx: number) {
  const { traits, rnd, state } = drv;
  const roll = rnd(), kind = roll < 0.4 ? 'late' : roll < 0.65 ? 'early' : roll < 0.85 ?
      'throttle' : 'lift';
  state.mist = {
    kind, sev: Math.min(1, (0.3 + 0.7 * rnd()) * (1.2 - traits.skill)), corner: cIdx, inside:
        false, t: 0
  };
}

/** Puts a car that has no place yet on the RX start branch or the main line. */
export function placeAtStart(drv: Drv, car: AiCar) {
  const { level, line, main, branches, state } = drv;
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
export function applyMistake(drv: Drv, mist: NonNullable<CircuitState["mist"]>, nearIdx: number) {
  const { line, count, state } = drv;
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
export function mistakeStep(drv: Drv, path: AiPath, nearIdx: number) {
  const { traits, rnd, line, main, count, state } = drv;
  let latT = 0, vMul = 1;
  if (path === main) {
    const cornerAhead = line.cid[(nearIdx + Math.round(45 / line.sp)) % count];
    if (cornerAhead >= 0 && cornerAhead !== state.mistCorner) {
      state.mistCorner = cornerAhead;
      state.mist = null;
      if (rnd() < traits.mistake * (state.pushing ? 1.6 : 1)) startMistake(drv, cornerAhead);
    }
    const mist = state.mist;
    if (mist) ({ latT, vMul } = applyMistake(drv, mist, nearIdx));
  }
  return { latT, vMul, thrForce: state.t < state.thrUntil };
}

/** Shapes the lateral target: racing-line share, wander and the grid lane at the start. */
export function laneStep(drv: Drv, car: AiCar, path: AiPath, nearIdx: number, speed: number,
    latIn: number) {
  const { traits, main, state, wanderPhaseA, wanderPhaseB } = drv;
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
export function battleStep(drv: Drv, car: AiCar, others: AiCar[]) {
  const { traits, state } = drv;
  // BATTLING (user: "scrabbling for victory"): a car within 25 m -> push a little harder, and
  // err a little more
  state.pushing = others.some((other) => Math.hypot(other.x - car.x, other.y - car.y) < 25);
  return (state.pushing ? 1 + 0.02 * traits.aggression : 1) * (
      state.atk ? 1 + 0.02 * traits.aggression : 1) * (
      1 + HARDER * Math.min(1, (state.behindT || 0) / HARDER_T));
}

/** RACECRAFT on the main line: attack, tow pass, giving room, cover; the target it sets. */
export function racecraftStep(drv: Drv, car: AiCar, path: AiPath, nearIdx: number,
    idx: (pos: number) => number, speed: number, dt: number, lineOff: number, latLim: number,
    latT: number, myLat: number, cars: CarsAcc, vMulIn: number, dodgeIn: number,
    conflictIn: boolean, profIn: ReturnType<typeof profileOf>) {
  const { main, state, attack, moves } = drv;
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
