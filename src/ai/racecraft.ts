// ai/racecraft.js: the circuit driver's racecraft steps (attack, tow pass, giving room, cover).
// Closures over one driver's state, racing line, traits and random stream (circuit.ts).
import { debugValue } from "../core/debug.ts";
import type { AiCar, CircuitState, Lead, Threat, Traits } from "./types.ts";
import type { RacingLine } from "./types.ts";

const YIELD = 0.05;          // speed given up to a car alongside on the inside (x 1.2 - defence)

export function createAttackSteps(
  state: CircuitState, line: RacingLine, traits: Traits, rnd: () => number,
) {
  const count = line.n;

  /** Whether the car has passed the apex of the corner it is in, of a planned attack or cover. */
  function beyondApex(plan: { corner: number }, cur: number, nearIdx: number) {
    return plan.corner >= 0 && cur === plan.corner && (
        (nearIdx - line.corners[plan.corner].apex + count) % count) < count / 2;
  }

  /** Times near / behind the lead; finds the corner we are in and the next one ahead. */
  function scanCorners(lead: Lead | null, nearIdx: number, dt: number) {
    if (lead) state.nearT = (state.nearT || 0) + dt;
    if (lead && lead.c === state.leadCar) state.behindT += dt;
    else {
      state.leadCar = lead ? lead.c : null;
      state.behindT = 0;
    }
    const cur = line.cid[nearIdx];
    let nextCorner = -1, nextDist = 0;
    for (let offset = 1, limit = Math.round(150 / line.sp); offset < limit; offset++) {
      const cid = line.cid[(nearIdx + offset) % count];
      if (cid >= 0 && cid !== cur) {
        nextCorner = cid;
        nextDist = offset * line.sp;
        break;
      }
    }
    return { cur, nextCorner, nextDist };
  }

  type Corners = ReturnType<typeof scanCorners>;

  /** Drops the attack once it is lost, done or too long. */
  function endAttack(car: AiCar, nearIdx: number, cur: number) {
    const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
    if (state.atk) {
      const attack = state.atk, fwd = (attack.car.x - car.x) * cosH + (
          attack.car.y - car.y) * sinH;
      if (fwd < -5 || fwd > 35 || state.t - attack.t0 > (attack.corner < 0 ? 9 : 7) ||
          beyondApex(attack, cur, nearIdx)) state.atk = null;
    }
  }

  /** ATTACK: sat behind the same car with a corner coming -> commit to a side for that corner. */
  function startAttack(lead: Lead | null, nxt: Corners, speed: number, lineOff: number,
      latLim: number) {
    const { nextCorner, nextDist } = nxt;
    if (!state.atk && lead && nextCorner >= 0 && nextCorner !== state.atkCorner &&
        nextDist > 15 && nextDist < 140 && lead.vAlong < speed + 2
      && state.behindT > Math.max(0.15, 0.6 - 0.5 * traits.aggression)) {
      state.atkCorner = nextCorner;
      if (!debugValue("NOATK") && rnd() < 0.6 + 0.4 * traits.aggression) {
        const turn = line.corners[nextCorner].turn, leadAbs = lineOff + lead.oc;
        const attackSide = Math.sign(leadAbs) === turn && Math.abs(leadAbs) > 0.4 * latLim ?
            -turn : turn;
        state.atk = {
          car: lead.c, side: attackSide, corner: nextCorner, t0: state.t
        };
        state.nAtk = (state.nAtk || 0) + 1;
      }
    }
  }

  return { beyondApex, scanCorners, endAttack, startAttack };
}

export type Corners = ReturnType<ReturnType<typeof createAttackSteps>["scanCorners"]>;

/** The moves that need no attack: the tow pass, giving room and the cover. */
export function createRaceMoves(
  state: CircuitState, line: RacingLine, traits: Traits, rnd: () => number,
  beyondApex: (plan: { corner: number }, cur: number, nearIdx: number) => boolean,
) {
  /** TOW PASS: in the slipstream of the same car on a long straight -> pull out and pass. */
  function towPass(car: AiCar, lead: Lead | null, nxt: Corners, lineOff: number,
      latLim: number, turnAhead: number) {
    const { nextCorner, nextDist } = nxt;
    // TOW PASS (ovals, long straights: no corner close enough to brake into): in the slipstream
    // of the same car for a while -> pull out to the side with more room and drive past on the
    // extra speed (contact.js slipstream)
    if (!state.atk && lead && (nextCorner < 0 || nextDist > 140) && (car.dragMul ?? 1) < 0.85 &&
        state.behindT > Math.max(0.3, 1 - 0.7 * traits.aggression)
      && state.t - (state.towT || -99) > 4) {
      state.towT = state.t;
      if (!debugValue("NOATK") && rnd() < 0.6 + 0.4 * traits.aggression) {
        const leadAbs = lineOff + lead.oc, ahead = turnAhead || 1;
        const passSide = Math.abs(leadAbs) > 0.3 * latLim ? -Math.sign(leadAbs) : ahead;
        state.atk = {
          car: lead.c, side: passSide, corner: -1, t0: state.t
        };
        state.nAtk = (state.nAtk || 0) + 1;
      }
    }
  }

  /** GIVING ROOM to a car alongside on the inside of the corner we are entering. */
  function yieldRoom(side: number, nxt: Corners, vMul: number) {
    const { cur, nextCorner, nextDist } = nxt;
    const insideOf = cur >= 0 ? line.corners[cur].turn : nextCorner >= 0 && nextDist < 40 ?
        line.corners[nextCorner].turn : 0;
    if (!state.atk && side && side === insideOf) return vMul * (
        1 - YIELD * (1.2 - traits.defence));
    return vMul;
  }

  /** DEFENCE: a car closing behind with a corner coming -> cover the inside once. */
  function coverStep(threat: Threat | null, nxt: Corners, nearIdx: number) {
    const { cur, nextCorner, nextDist } = nxt;
    if (state.cover && (
        beyondApex(state.cover, cur, nearIdx) || state.t - state.cover.t0 > 6)) state.cover = null;
    if (!state.cover && !state.atk && threat && threat.f < -5 && nextCorner >= 0 &&
        nextCorner !== state.covCorner && nextDist < 110) {
      state.covCorner = nextCorner;
      if (!debugValue("NOCOV") && rnd() < (
          0.5 + 0.5 * (traits.prec ?? 0.5)) * traits.defence) state.cover = {
        side: line.corners[nextCorner].turn, corner: nextCorner, t0: state.t
      };
    }
  }

  return { towPass, yieldRoom, coverStep };
}

