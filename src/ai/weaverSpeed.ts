// ai/weaverSpeed.ts: the highway driver's speed and pedals: corner speed from the road's
// curvature, following what blocks it, running wide, and the throttle and brake.
import { GRAVITY, HWT } from "./weaverCtx.ts";
import type { Plan, Step, Wvr } from "./weaverCtx.ts";
import type { DriveInput, RoadBlock } from "./types.ts";

/** The speed the road ahead allows (v^2 = cornerK mu g R, with a braking allowance). */
export function cornerSpeed(wvr: Wvr, step: Step) {
  const { cornerK, brakeK } = wvr;
  const { pts, speed, grip, idx0 } = step;
  // ---- SPEED from the curvature ahead (v^2 = cornerK mu g R, with a brakeK mu g braking
  // allowance)
  let vTarget = 95;
  for (let dist = 4; dist < 30 + speed * 2.6; dist += 8) {
    const i = Math.min(pts.length - 1, idx0 + Math.round(dist / 4));
    if (i < 0) continue;
    const radius = 1 / Math.max(1e-5, Math.abs(pts[i].curv || 0)),
      vCurve = Math.sqrt(cornerK * grip * GRAVITY * radius);
    vTarget = Math.min(vTarget, Math.sqrt(vCurve * vCurve + 2 * brakeK * grip * GRAVITY * dist));
  }
  return vTarget;
}

/** What one blocker asks: the speed that keeps its gap, and the braking if a crash is close. */
function followBlocker(step: Step, blocker: RoadBlock, plan: Plan) {
  const { vAl, hold, grip } = step;
  let { vTarget, brakeX } = plan;
  const want = 2.5 + (hold ? 0.6 : (HWT.wt ?? 0.22)) * Math.max(0, vAl),
    brakeDecel = (HWT.aB ?? 0.55) * grip * GRAVITY, room = blocker.gap - want;
  if (!plan.fol || blocker.gap < plan.fol.gap) plan.fol = blocker;
  vTarget = Math.min(vTarget, room > 0
    ? Math.sqrt(Math.max(0, blocker.v) ** 2 + 2 * brakeDecel * room)
    : Math.max(HWT.fl != null ? blocker.v * HWT.fl : 0, blocker.v + room * (HWT.rk ?? 0.7)));
  const close = vAl - blocker.v;
  if (close > 0.5) {
    const ttc = blocker.gap / close;
    if (ttc < 1.3) brakeX = Math.max(brakeX, Math.min(1, (1.3 - ttc) / 1.0));
  }
  plan.vTarget = vTarget;
  plan.brakeX = brakeX;
}

/** Brakes only for what is still in the way where we are or are going; the speed plan. */
export function followStep(
  wvr: Wvr, step: Step, here: RoadBlock | null, vCorner: number,
): Plan {
  const { state } = wvr;
  const { frame, vAl, grip, blockOn } = step;
  const plan: Plan = { vTarget: vCorner, vCorner, vFollow: vCorner, brakeX: 0, fol: null };
  // ---- BRAKE only for what is still in the way where we are / are going (braking-distance
  // following; MEASURED in v1: a linear law
  // asked ~2 g at a 140 km/h closing speed -> lock-ups and spins)
  // where we ARE only counts if the swerve cannot get us clear before we arrive (MEASURED
  // weavecheck: braking for the car 120 m ahead
  // in the lane we were LEAVING cost 60 km/h on every pass): time to clear = the sideways
  // distance still to go / the swerve rate
  // (the swerve's real time: from rest at aLat, d = a t^2 / 2 -> t = sqrt(2 d / a), + reaction)
  const now = blockOn(frame.off), dGo = Math.abs(state.line! - frame.off),
    tClear = dGo > 0.3 ? 0.3 + Math.sqrt(2 * dGo / (0.25 * grip * GRAVITY)) : Infinity;
  for (const blocker of [here, now && now.gap / Math.max(1, vAl - now.v) < tClear ? now : null]) {
    if (!blocker || blocker.side) continue;
    followBlocker(step, blocker, plan);
  }
  plan.vFollow = plan.vTarget;
  return plan;
}
/** Lifts when running wide and caps the speed on the grass. */
export function limitStep(step: Step, plan: Plan) {
  const { frame, vAl, geo, vLo, vHi } = step;
  const { fol } = plan;
  let { vTarget } = plan;
  // RUNNING WIDE (past the line limits): lift, as a driver would - 3 m/s under what it is doing
  // per metre out (on a verge dodge the limit is the verge line; the grass itself already costs
  // grip, so only past THAT)
  {
    const lim = frame.off < 0 ? -vLo : vHi, out = Math.abs(frame.off) - lim;
    if (out > 0.3) vTarget = Math.min(vTarget, vAl - 3 * out);
  }
  // on the grass: no more than VERGE_V m/s faster than the car being passed (a dodge, not a lap
  // of the field)
  if (Math.abs(frame.off) > geo.hw - 0.6 && fol)
    vTarget = Math.min(vTarget, Math.max(fol.v + (HWT.vgv ?? 8), vAl - 2));
  plan.vTarget = vTarget;
}

/** The throttle and brake: eased in a swerve and while the rear slides. */
export function pedalCmd(
  wvr: Wvr, step: Step, plan: Plan, steer: number, yawRoad: number,
): DriveInput {
  const { state, thrMax } = wvr;
  const { car, speed, vAl, grip } = step;
  const { vTarget, vCorner, vFollow, brakeX, fol } = plan;
  // brake eased while steering (autodrive.js: a 35 % floor), so an emergency stop in a swerve
  // does not lock it into a slide
  const speedGap = vTarget - vAl,
    brake = Math.max(brakeX, speedGap < -1 ? Math.min(1, -speedGap * 0.15) : 0)
      * Math.max(0.35, 1 - Math.abs(steer) / 0.25);
  // ease off while the rear slides
  const slide = Math.abs((car.t && car.t.slipR) || 0), feel = slide > 0.12 ? 0.4 : 1;
  // GAS IN A SWERVE: a rear-drive car at full throttle mid-swerve steps out (MEASURED
  // weavecheck, Real difficulty, 200 km/h: rear slip
  // 0.3-0.8 rad in 9 of 45 scenarios); the throttle is capped by how hard it is turning, as a
  // driver would feather it
  const turn = (HWT.tx ?? 1)
    ? Math.min(1, Math.max(
      Math.abs(car.yawRate - yawRoad) * Math.max(1, speed) / ((HWT.tn ?? 0.8) * grip * GRAVITY),
      (Math.abs(car.yawRate) * Math.max(1, speed) - (HWT.tc ?? 0.45) * grip * GRAVITY)
        / (0.3 * grip * GRAVITY)))
    : Math.min(1,
      Math.abs(car.yawRate) * Math.max(1, speed) / ((HWT.tn ?? 0.5) * grip * GRAVITY)),
    thrCap = thrMax * (1 - 0.6 * turn);
  // (read by the node tools only)
  state.dbg = { fol, vT: vTarget, vCorner, vFollow, brakeX, thrCap, turn, e: speedGap, feel };
  return {
    steer,
    throttle: brake > 0 || speedGap <= 0 ? 0 : Math.min(thrCap, speedGap * 0.35) * feel,
    brake,
    handbrake: 0,
    reverse: 0,
  };
}
