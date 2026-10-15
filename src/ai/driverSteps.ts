// ai/driverSteps.ts: the circuit driver's steering, speed, handbrake and slide steps.
// Closures over one driver's state, racing line, traits and random stream (circuit.ts).
import { debugValue } from "../core/debug.ts";
import { GRAVITY } from "../cars.ts";
import { K_BRAKE, carGrip } from "./line.ts";
import type { profileOf } from "./line.ts";
import type { AiCar, CircuitState, RacingLine, Traits } from "./types.ts";

// handbrake turns: apex R (m, + HB_LOOSE on loose ground), corner turn (rad), pull (s).
const HB_R = 25, HB_LOOSE = 8, HB_TURN = 1.4, HB_T = 0.25;
// + only in corners with an apex tighter than DRIFT_R m (hairpins / junctions)   // rad: the rear
// slip a drifting AI holds, and where it gives up and catches it
export const DRIFT_SLIP = 0.22, DRIFT_MAX = 0.4, DRIFT_R = 35;
const EDGE_DRIFT = 2.0;

type AiPath = CircuitState["path"];

/** Stanley steering aim at the front axle: heading error, demand, lock and cap. */
export function steerAim(car: AiCar, path: AiPath, nearIdx: number,
    idx: (pos: number) => number, speed: number, latT: number) {
  const pts = path.pts, spec = car.spec;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const frontX = car.x + cosH * spec.lf, frontY = car.y + sinH * spec.lf;
  let frontIdx = nearIdx, frontDist2 = Infinity;
  for (let offset = -2; offset <= 10; offset++) {
    const pos = idx(nearIdx + offset), dist2 = (pts[pos].x - frontX) ** 2 + (
        pts[pos].y - frontY) ** 2;
    if (dist2 < frontDist2) {
      frontDist2 = dist2;
      frontIdx = pos;
    }
  }
  const look = Math.round((2 + speed * 0.15) / path.sp), ahead = pts[idx(frontIdx + look)],
      frontPt = pts[frontIdx];
  let psi = ahead.h - car.heading; psi = Math.atan2(Math.sin(psi), Math.cos(psi));
  const cross = (frontX - frontPt.x) * -Math.sin(frontPt.h) + (frontY - frontPt.y) * Math.cos(
      frontPt.h) - latT;
  const deltaS = psi + Math.atan2(-1.2 * cross, speed + 2) - 0.03 * (
      car.yawRate - speed * Math.tan(car.delta) / spec.L);
  const muHere = car.surface.mu * spec.mu;
  // cap: the kinematic angle for the grip-limited turn + a front slip allowance (the bench cap
  // pinned at ~0.1 at 35 m/s: ran wide)
  const LOCK = spec.steerMax || 0.56;
  const cap = Math.min(
      1, (1.3 * spec.L * muHere * GRAVITY / Math.max(4, speed * speed) + 0.12) / LOCK);
  return { psi, deltaS, LOCK, cap };
}

/** The profile speed over the look-ahead, cut for the bends ahead when off the line. */
export function profileSpeed(line: RacingLine, car: AiCar, path: AiPath, nearIdx: number,
    idx: (pos: number) => number, speed: number, prof: ReturnType<typeof profileOf>,
    latT: number, lineOff: number) {
  const pts = path.pts, spec = car.spec;
let targetSpeed = Infinity; const span = Math.round((3 + speed * 0.25) / path.sp);
for (let offset = 0; offset <= span; offset++) targetSpeed = Math.min(
    targetSpeed, prof[idx(nearIdx + offset)]);
if (path === line && Math.abs(latT) > 0.3) {
  const brakeDecel = (debugValue("AI_KB") as number || K_BRAKE) * pts[nearIdx].mu * carGrip(
      spec).brakeG * GRAVITY, far = Math.round(
      (speed * speed / (2 * brakeDecel) + 15) / path.sp);
  for (let offset = 0; offset <= far; offset += 2) {
    const pos = idx(nearIdx + offset), bend = pts[pos], x = (
        lineOff + latT - bend.off!) * bend.turn;
    if (x > 0.3 && bend.R < 400) {
      const bendSpeed = prof[pos] * Math.sqrt(Math.max(0.4, (bend.R - x) / bend.R));
      targetSpeed = Math.min(
          targetSpeed, Math.sqrt(bendSpeed * bendSpeed + 2 * brakeDecel * offset * path.sp));
    }
    }
}
  return targetSpeed;
}

type Corner = RacingLine["corners"][number];

/** Builds the handbrake-turn step over one driver's state, racing line, traits and random. */
export function createHandbrakeStep(
  state: CircuitState, line: RacingLine, traits: Traits, rnd: () => number,
) {
  const main = line, count = line.n;

  /** The total turn of a corner (rad), summed once along its run and kept on the corner. */
  function cornerAngle(path: AiPath, corner: Corner, cornerId: number) {
    if (corner.angle !== undefined) return;
    const pts = path.pts;
    let sum = 0;
    for (let i = corner.start; line.cid[i] === cornerId; i = (i + 1) % count) {
      const step = pts[(i + 1) % count].h - pts[i].h;
      sum += Math.atan2(Math.sin(step), Math.cos(step));
    }
    corner.angle = Math.abs(sum);
  }

  /** Arms one handbrake pull when a tight, big corner is about to be turned into. */
  function hairpinPull(path: AiPath, nearIdx: number, speed: number, loose: number,
      corner: Corner | null, cornerId: number) {
    const pts = path.pts;
    const toApex = ((corner ? corner.apex : nearIdx) - nearIdx + count) % count;
    if (corner && corner.angle! > HB_TURN && pts[corner.apex].R < HB_R + HB_LOOSE * loose &&
        toApex < count / 2 && toApex * line.sp < 0.8 * speed + 6 &&
        state.hbCorner !== cornerId) {
      state.hbCorner = cornerId;
      if (rnd() < 0.5 + 0.5 * traits.skill) state.hbUntil = state.t + HB_T;
    }
  }

  /** HANDBRAKE TURN: one pull per hairpin, before the apex; 1 while the pull is on. */
  function handbrakeStep(path: AiPath, nearIdx: number, speed: number, loose: number) {
    if (path === main && speed > 6 && (debugValue("HB") ?? 1)) {
      const cornerId = line.cid[nearIdx], corner = cornerId >= 0 ? line.corners[cornerId] : null;
      // turn-in: a corner that turns > HB_TURN rad in all (summed once along its run) with an apex
      // tighter than HB_R (+ HB_LOOSE on loose
      // ground), the apex within ~0.8 s
      if (corner) cornerAngle(path, corner, cornerId);
      hairpinPull(path, nearIdx, speed, loose, corner, cornerId);
      if (state.t < state.hbUntil) {
        state.hbN = (state.hbN || 0) + 1;
        return 1;
      }
    }
    return 0;
  }

  return handbrakeStep;
}

/** Builds the slide step over one driver's state, racing line, traits and random stream. */
export function createSlideStep(
  state: CircuitState, line: RacingLine, traits: Traits, rnd: () => number,
) {
  const main = line;

  /** A bolder driver drifts more often: decided once per corner. */
  function decideDrift(nearIdx: number) {
    if (state.driftCorner !== line.cid[nearIdx]) {
      state.driftCorner = line.cid[nearIdx];
      state.driftOn = state.t > (state.driftBan || 0) && rnd() < (
          debugValue("DRIFT") as number ?? (0.45 + 0.5 * traits.aggression));
    }
  }

  /** DRIFT HOLD: held on loose ground, in a corner, in a rear-driven car, away from the edge. */
  function driftHold(car: AiCar, path: AiPath, nearIdx: number, speed: number,
      lineOff: number, loose: number, slipRear: number) {
    const pts = path.pts, spec = car.spec;
    // DRIFT HOLD (requirement: really need AI to drift and handbrake sometimes / aggressive
    // off-road driving): on loose ground, in a corner, in a car with the drive at the back (RWD
    // / rear-biased AWD), a slide is HELD — the rear kept near DRIFT_SLIP with the throttle,
    // countersteer free — instead of caught at 0.18 rad (which lifted and tiptoed). Past
    // DRIFT_MAX it is caught as before. A bolder driver (aggression) drifts more often (decided
    // per corner).
    const inCorner = path === main && line.cid[nearIdx] >= 0;
    if (inCorner) decideDrift(nearIdx);
    // ... and never near the road edge (a held drift there ran a Rally car off Sweaty Lamb 12 s a
    // lap): within EDGE_DRIFT m it catches m from the car to the nearer edge
    const nearPt = pts[nearIdx], edgeRoom = path === main ? line.hw - Math.abs(
        lineOff + (car.x - nearPt.x) * -Math.sin(nearPt.h) + (car.y - nearPt.y) * Math.cos(
        nearPt.h)) : 0;
    const drifting = state.driftOn && inCorner && loose > 0.3 && (spec.drive ?? 1) < 0.5 &&
        slipRear > 0.12 && slipRear < DRIFT_MAX && speed > 6 && edgeRoom > EDGE_DRIFT && pts[
        line.corners[line.cid[nearIdx]].apex].R < DRIFT_R;
    return { drifting, edgeRoom };
  }

  /** Slip, the held drift (per corner, never near the edge), over / understeer and the steer. */
  function slideStep(car: AiCar, path: AiPath, nearIdx: number, speed: number,
      lineOff: number, aim: { deltaS: number, LOCK: number, cap: number }) {
    const { deltaS, LOCK, cap } = aim;
    const loose = Math.max(0, Math.min(1, (1 - car.surface.mu) / 0.5));
    const slipFront = Math.abs(car.t.slipF || 0), slipRear = Math.abs(car.t.slipR || 0);
    const { drifting, edgeRoom } = driftHold(car, path, nearIdx, speed, lineOff, loose, slipRear);
    const over = slipRear > 0.18 && speed > 5 && !drifting,
        under = slipFront > 0.14 + 0.06 * loose && speed > 5 && !over && !drifting;
    const steer = over || drifting ? Math.max(-1, Math.min(1, deltaS / LOCK)) : Math.max(
        -cap, Math.min(cap, deltaS / LOCK));
    state.cap = cap;
    return { loose, slipRear, drifting, edgeRoom, over, under, steer };
  }

  return slideStep;
}
