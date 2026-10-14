// ai/weaver.js — the HIGHWAY driver (roadDriver) + driveOut (from aidriver.js).
import { envValue } from "../core/debug.ts";
import type {
  AiCar, DriveCtx, DriveInput, DriveOutState, HighwayLevel, RoadBlock, Traits, WeaverState,
} from "./types.ts";
import { roadPose, roadSpan } from "../highway.js";

// ---------------------------------------------------------------- DRIVE ITSELF OUT (both roads)
// Nearly still for DRIVE_OUT_T s after the green (nose in a wall, beached, tangled) -> REVERSE
// ~1-1.5 s with the wheel turned to swing the nose back toward the road direction roadH(); three
// tries inside 15 s and still stuck -> state.giveUp: main.js resets it (last resort). Returns the
// reversing controls, or null = drive on. (NOOUT=1 env: node A/B only - proves the highway merge
// changed nothing else)
const NOOUT = !!envValue("NOOUT");
const DRIVE_OUT_T = 1.2;
export function driveOut(
  state: DriveOutState, car: AiCar, speed: number, dt: number, ctx: DriveCtx,
  rnd: () => number, roadH: () => number,
) {
  if (ctx.hold || !(state.t > 3) || NOOUT) return null;
  if (state.t < (state.revUntil || 0)) {
    let headErr = roadH() - car.heading;
    headErr = Math.atan2(Math.sin(headErr), Math.cos(headErr));
    return { steer: -Math.sign(headErr || 1), throttle: 0, brake: 0, handbrake: 0, reverse: 1 };
  }
  state.slowT = speed < 1.5 ? (state.slowT || 0) + dt : 0;
  if (state.slowT > DRIVE_OUT_T) {
    state.slowT = 0;
    state.revUntil = state.t + 1 + 0.5 * rnd();
    state.nOut = (state.nOut || 0) + 1;
    state.outN = state.t - (state.outAt ?? -99) < 15 ? (state.outN || 0) + 1 : 1;
    state.outAt = state.t;
    if (state.outN >= 3) state.giveUp = true;
  }
  return null;
}

// ---------------------------------------------------------------- THE HIGHWAY (endless level): the
// road read through highway.js AI ROUND 2 stage 1 (user, 2026-10-07: "same ai"; CLAUDE.md ONE
// SYSTEM NOT TWO THEN ONE): this was hwrace.js createHwDriver. It is now this file's road reader
// for levels with no closed lap (level.endless), behind the ONE entry point createAIDriver; moved
// UNCHANGED (MEASURED: weavecheck + pacesuite identical to before with __NOOUT) plus the shared
// drive-out. Later stages share more (mistakes, skill). m/s the lateral target moves (x1.8 in an
// emergency); traffic changes lane at 0.9
const LAT_R = 3.0;
const GRAVITY = 9.81;
const IDLE = { steer: 0, throttle: 0, brake: 0.3, handbrake: 0, reverse: 0 };
// the RACER — v2, a WEAVER (user, 2026-10-05: "AI on highways should IGNORE LANES and go FAST,
// DODGING traffic and WEAVING through like the player would"). No lanes: across the whole
// carriageway (hard shoulder included) it tries N_LINES lateral lines a few times a second and
// scores each by how much free road it has: every car ahead within 220 m whose body (+ a margin)
// overlaps the line blocks it at its gap; the line with the most road wins, with a cost for a big
// swerve and a bonus for staying put (no dithering), and never a line on the far side of a car
// right alongside. It steers for that line (Stanley, as autodrive.js — the controller that holds
// this road), the lateral target moving at LAT_R so a swerve is a car's swerve. Speed: corner speed
// from the road's curvature, flat out otherwise; it brakes only while its line is still blocked
// (braking-distance following), and hard when a crash is close. traits = aidriver.js aiTraits
// (pace, prec, wander, aggression). ctx = { cars: everyone else (with _hwf), hold: keep station
// (the rolling start: follow, no swerving) }
const N_LINES = 11, MARGIN = 0.55, LOOK_T = 3.2, EDGE_M = 1.8;
// A/B tuning from the node tools only (HWT='{"kC":0.5}'); the browser has no process -> {}
// (the ! : envValue("HWT") was just seen to be set; JSON.parse returns any, which fits the Record)
const HWT: Record<string, number> = envValue("HWT")
  ? JSON.parse(envValue("HWT")!) : {};
export function roadDriver(level: HighwayLevel, traits: Traits, rnd: () => number) {
  const state: WeaverState = {
    line: null, tgt: null, think: 0, ph: (traits.seed || 1) % 100, t: 0,
  };
  const pace01 = Math.max(0, Math.min(1, (traits.pace - 0.8) / 0.185));
  // CORNER GRIP: a share of tarmac mu x the car's mu (the bench driver's 0.40; 0.38 Mobile .. 0.50
  // Real). MEASURED (hwracecheck): 0.6 x gripG planned 0.8 g at 230 km/h on an R 500 and the field
  // ran wide - the car's real grip at that speed is lower RACING, NOT A SUNDAY DRIVE (user,
  // 2026-10-06: "they seem slow ... make them faster and just try n handle it"; MEASURED pacesuite,
  // 18 races, vs the mirror-only build: mean 133.4 -> 138.2 km/h, under-130 40 -> 35 %, bad races 2
  // -> 1; weavecheck 0 spins, 1-2 of 45 close passes clip at 150 km/h): throttle floor 0.85 (was
  // 0.6), corner share 0.42-0.54 (was 0.33-0.42), follow decel 0.55 g share, turn feathering only
  // for yaw BEYOND the road's own bend, lane-changing traffic blocks the lane it is going to, verge
  // dodges
  const thrMax = (HWT.thr ?? 0.85) + (1 - (HWT.thr ?? 0.85)) * pace01,
    cornerK = (HWT.kC ?? 0.42) + (HWT.kCp ?? 0.12) * (traits.prec ?? 0.5),
    brakeK = (HWT.kB ?? 0.45) + 0.15 * (traits.prec ?? 0.5);
  // sloppier drivers leave more room
  const agg = traits.aggression ?? 0.5,
    margin = MARGIN + 0.25 * (1 - (traits.prec ?? 0.5));
  function drive(car: AiCar, dt = 1 / 120, ctx: DriveCtx = {}): DriveInput {
    if (!level._hw) return IDLE;
    const frame = car._hwf;
    if (!frame) return IDLE;
    const pts = level._hw.pts, speed = Math.hypot(car.vx, car.vy), vAl = frame.v, hold = !!ctx.hold;
    const { s0, s1 } = roadSpan(level);
    // past the road that exists (only once a race has ended)
    if (frame.s > s1 - 40 || frame.s < s0 + 20) return IDLE;
    state.t += dt;
    // DRIVE ITSELF OUT (shared with the circuit driver: driveOut) - the highway had none before AI
    // ROUND 2
    {
      const outCtl = driveOut(state, car, speed, dt, ctx, rnd, () => roadPose(level, frame.s, 0).h);
      if (outCtl) return outCtl;
    }
    // the hard shoulder is road too, as for a player; lines stay EDGE_M inside the edges (MEASURED
    // hwracecheck: a 1 m margin on the outside of an R 730 at 227 km/h ran 1.5 m wide onto the
    // grass)
    const geo = level._hw.geo, minOff = -geo.hw + EDGE_M, maxOff = geo.hw - EDGE_M;
    // THE VERGE DODGE (user, 2026-10-06: "ai should go off road to dodge if its quicker, just not
    // too far obviously"): two more lines, VERGE m past each edge (half the car on the grass), only
    // worth taking when the road is blocked: VERGE_COST + the grip it costs. Never on the outside
    // of a bend (armco there at hw + 1.8: highway.js) or on a walled preset. vLo / vHi = how far
    // the line may go.
    const kNow = (pts[Math.max(0, Math.min(pts.length - 1,
      Math.round((frame.s - pts[0].s) / 4) + Math.round(vAl * 1.5 / 4)))] || {}).curv || 0;
    const vgOK = (HWT.verge ?? 1) && !level._cfg.walls && !hold,
      vLo = vgOK && Math.abs(kNow) < 1 / 1500 ? -geo.hw + (HWT.vgm ?? 0.9) : minOff,
      vHi = vgOK && Math.abs(kNow) < 1 / 1500 ? geo.hw - (HWT.vgm ?? 0.9) : maxOff;
    if (state.line == null) {
      state.line = state.base = Math.max(minOff, Math.min(maxOff, frame.off));
      state.tgt = state.line;
    }
    const cars = ctx.cars || [], myW = car.spec.wid / 2;
    // ---- SPEED from the curvature ahead (v^2 = cornerK mu g R, with a brakeK mu g braking
    // allowance)
    const grip = 0.94 * (car.spec.mu || 1), idx0 = Math.round((frame.s - pts[0].s) / 4);
    let vTarget = 95;
    for (let dist = 4; dist < 30 + speed * 2.6; dist += 8) {
      const i = Math.min(pts.length - 1, idx0 + Math.round(dist / 4));
      if (i < 0) continue;
      const radius = 1 / Math.max(1e-5, Math.abs(pts[i].curv || 0)),
        vCurve = Math.sqrt(cornerK * grip * GRAVITY * radius);
      vTarget = Math.min(vTarget, Math.sqrt(vCurve * vCurve + 2 * brakeK * grip * GRAVITY * dist));
    }
    const vCorner = vTarget;
    // what blocks a lateral line `off`: the nearest car ahead whose body (+ margin) overlaps it ->
    // { gap, v } (gap 0 = alongside), or a car right beside us on that side (side: we cannot swerve
    // through it)
    const blockOn = (off: number) => {
      let block: RoadBlock | null = null;
      for (const other of cars) {
        const oFrame = other._hwf;
        if (!oFrame) continue;
        const ahead = oFrame.s - frame.s;
        if (ahead < -6 || ahead > 220) continue;
        // WHERE IT WILL BE (HWT.pred): a lane-changing traffic car blocks its target lane too,
        // from now (it is going there)
        const trOff = (HWT.pred ?? 1) && other._trOff != null
          && Math.abs(other._trOff - oFrame.off) > 0.3 ? other._trOff : null;
        if (trOff != null && ahead > (car.spec.len + other.spec.len) / 2 + 1) {
          const hw2 = myW + other.spec.wid / 2 + margin;
          if (Math.abs(trOff - off) < hw2 && Math.abs(oFrame.off - off) >= hw2) {
            const trGap = ahead - (car.spec.len + other.spec.len) / 2;
            if (!block || trGap < block.gap) block = { gap: trGap, v: oFrame.v, o: other };
          }
        }
        // the margin GROWS with the closing speed (MEASURED weavecheck, Real: 0.55 m margin + ~0.5
        // m tracking error = a car's line that clips
        // the slow car at 75 km/h closing): 0.4 m more per 10 m/s closing
        const halfW = myW + other.spec.wid / 2 + margin
          + Math.min(HWT.mcap ?? 99, 0.04 * Math.max(0, vAl - oFrame.v)),
          beside = ahead < (car.spec.len + other.spec.len) / 2 + 1;
        if (beside) {
          const side = Math.sign(oFrame.off - frame.off),
            far = Math.sign(off - frame.off) === side
              && Math.abs(off - frame.off) > Math.abs(oFrame.off - frame.off) - halfW;
          if (far || Math.abs(oFrame.off - off) < halfW)
            return { gap: 0, v: oFrame.v, side: far, o: other };
          continue;
        }
        const gap = ahead - (car.spec.len + other.spec.len) / 2;
        if (Math.abs(oFrame.off - off) < halfW && (!block || gap < block.gap))
          block = { gap, v: oFrame.v, o: other };
      }
      return block;
    };
    // THE MIRROR: a FASTER car coming up from behind blocks a line it is on if it would arrive
    // within MIR_T s (MEASURED hwracecheck seed 77, Realish: a racer at 145 km/h moved 4.4 m left
    // into the line of one 18 m back at 177 km/h - the one behind braked on the hard shoulder,
    // spun, and both left the road; the driver only ever looked at cars ahead, > 6 m back did not
    // exist) (MEASURED pacesuite, 18 races: bad runs 7 -> 2, off-road car-steps 13079 -> 4006, mean
    // 126.7 -> 133.4 km/h)
    const mirT = HWT.mir ?? 2.5;
    const mirror = (off: number) => {
      if (!mirT) return false;
      for (const other of cars) {
        const oFrame = other._hwf;
        if (!oFrame) continue;
        const ahead = oFrame.s - frame.s, len = (car.spec.len + other.spec.len) / 2;
        if (ahead > len + 1 || ahead < -60) continue;
        const close = oFrame.v - vAl;
        if (close < 0.5 && ahead < -len) continue;
        if (ahead < -len && (-ahead - len) / close > mirT) continue;
        if (Math.abs(oFrame.off - off) < myW + other.spec.wid / 2 + margin) return true;
      }
      return false;
    };
    // how far across one decision may take us: ~0.6 g sideways at low speed, falling with speed
    // (2.5 m at 240 km/h)
    const reach = Math.max(2.5, Math.min(maxOff - minOff, (14 - speed * 0.17) * (HWT.rch ?? 1)));
    // ---- CHOOSE A LINE a few times a second (not while holding station)
    if ((state.think -= dt) <= 0) {
      state.think = 0.08 + 0.14 * (1 - agg);
      if (!hold) {
        let best = state.line, bestScore = -Infinity, bestRaw = 0;
        state.free = null;
        const way = { raw: -Infinity, off: 0, why: '' };
        for (let lineNo = 0; lineNo <= N_LINES + 2; lineNo++) {
          const off = lineNo === N_LINES ? state.base!
            : lineNo === N_LINES + 1 ? vLo
            : lineNo === N_LINES + 2 ? vHi
            : minOff + (maxOff - minOff) * lineNo / (N_LINES - 1);
          if (lineNo > N_LINES && (off === minOff || off === maxOff)) continue;
          const block = blockOn(off);
          // free road along it: unblocked = LOOK_T s of road (+ a bonus); blocked = the gap + what
          // is kept of the blocker's speed
          let score = block
            ? (block.side ? -999 : Math.min(block.gap, vAl * LOOK_T) + Math.max(0, block.v) * 1.2)
            : vAl * LOOK_T + 60;
          // NO QUEUEING BEHIND A RIVAL (HWT.rp): a line whose blocker is ANOTHER RACER close ahead
          // is worth less, so it pulls out and
          // races it side by side instead of sitting in its slipstream
          // (user, 2026-10-06: "they tend to que in lanes on the highway still ... weave through
          // traffic like a real street racer").
          // OFF BY DEFAULT - not proven (HANDOVER §3). MEASURED pacesuite, 9 races x seed sets A
          // (4242,77,1234) / B (31,555,9001):
          // baseline 151.0 / 139.3 km/h; rp 40 + cm 12 + mvk 0.6 = 154.0 / 136.1, 0 bad, BUT
          // weavecheck 9 of 45 hit (baseline 0)
          if (block && !block.side && block.o && !block.o.traffic && block.gap < 60)
            score -= (HWT.rp ?? 0) * (1 - block.gap / 60);
          // (MEASURED weavecheck: costed from where the car IS, any tracking lag dragged the plan
          // after it - toward the car being passed)
          const move = Math.abs(off - state.base!) + 0.3 * Math.abs(off - frame.off), raw = score;
          if (raw > way.raw) {
            way.raw = raw;
            way.off = off;
            way.why = Math.abs(off - frame.off) > reach ? 'reach' : 'cost';
          }
          // REACH: no line further across than a swerve can make in ~1.5 s at this speed (MEASURED
          // weavecheck: a 7 m jump asked at 240 km/h
          // put the car 18 deg to the road and into the grass)
          // a line FURTHER than reach is headed for in reach-sized STEPS (the plan re-thinks every
          // ~0.15 s), if the step point is clear
          let aim = off;
          if (Math.abs(off - frame.off) > reach) {
            if (!HWT.step) continue;
            aim = frame.off + Math.sign(off - frame.off) * reach;
            const stepBlock = blockOn(aim);
            if (stepBlock && (stepBlock.side
              || stepBlock.gap < 4 + 2 * Math.max(0, vAl - stepBlock.v))) continue;
          }
          // swerving costs; the line already chosen is worth a lot (COMMIT: MEASURED weavecheck, a
          // 6 m bonus let it flip between two lines
          // 3 m apart every 0.2 s and slalom into the car it was passing)
          // swerve cost x HWT.mvk, commit bonus HWT.cm (defaults = the shipped behaviour). A
          // looser setting was tried (2026-10-06, the
          // queueing) - MEASURED weavecheck hits of 45: cm 12 / mvk 0.6 = 9, cm 25 / mvk 0.6 = 8,
          // cm 25 / mvk 0.8 = 2, default = 0
          score -= move * (1.5 + speed * 0.05) * (HWT.mvk ?? 1)
            - (Math.abs(off - state.base!) < 0.6 ? (HWT.cm ?? 25) : 0);
          // the hard shoulder: a last resort
          if (off < -geo.hw + level._cfg.shoulder) score -= 8;
          // the verge: only when it is clearly quicker
          if (off < minOff - 0.1 || off > maxOff + 0.1) score -= (HWT.vgc ?? 40);
          if (Math.abs(aim - frame.off) > 1.2) {
            const mid = blockOn((aim + frame.off) / 2);
            if (mid && mid.gap < 1) {
              score -= 400;
              if (way.off === off) way.why = 'mid';
            }
          }
          if (Math.abs(aim - frame.off) > (HWT.mth ?? 1.2)
            && (mirror(aim) || mirror((aim + frame.off) / 2))) {
            score -= 400;
            if (way.off === off) way.why = 'mirror';
          }
          // the way across must be open
          if (aim !== off && way.off === off) way.why = 'stepped';
          if (!block && (!state.free
            || Math.abs(off - frame.off) < Math.abs(state.free.off - frame.off)))
            state.free = { off, score };
          if (score > bestScore) {
            bestScore = score;
            best = aim;
            bestRaw = raw;
          }
        }
        state.base = best;
        state.why = { ...way, chosen: best, chosenRaw: bestRaw };
      }
    }
    // a little WANDER (difficulty) on top of the plan - NOT folded into it (MEASURED weavecheck:
    // added to the plan at every re-think it
    // accumulated and walked the line into the car being passed)
    // ABORT a swerve already under way when the mirror shows a car closing on the side it is
    // moving to (MEASURED hwracecheck seed 1234,
    // Real: the line was chosen while the road was clear; a car 30 km/h quicker came up into it
    // 0.3 s later and they touched side to side)
    if (mirT && (HWT.abort ?? 1) && Math.abs(state.tv || 0) > 0.2
      && mirror(state.tgt! + Math.sign(state.tv!) * 0.6)) {
      state.base = state.tgt;
      state.think = Math.min(state.think, 0.05);
    }
    state.line = Math.max(vLo, Math.min(vHi, state.base!
      + Math.sin(state.t * 0.4 + state.ph) * Math.min(0.4, (traits.wander || 0) * 0.2)));
    // the lateral target eases toward the chosen line at LAT_R (faster when a crash is close: a
    // real swerve)
    const here = blockOn(state.tgt!),
      urgent = here && here.gap < 6 + Math.max(0, vAl - here.v) * 0.8;
    // A SWERVE HAS INERTIA: the target's sideways speed ramps at aLat (a share of grip) and eases
    // in to stop on the line. MEASURED (hwracecheck, Real difficulty): an instant 6.5 m/s sideways
    // step spun cars at 150 km/h on a straight (rear slip 0.6 rad)
    const latR = LAT_R * (urgent ? 1.6 : 1) * (0.8 + 0.4 * agg),
      aLat = (urgent ? 0.3 : 0.18) * grip * GRAVITY, latDist = state.line - state.tgt!;
    const vWant = Math.sign(latDist) * Math.min(latR, Math.sqrt(2 * aLat * Math.abs(latDist)));
    state.tv = (state.tv || 0)
      + Math.max(-aLat * dt, Math.min(aLat * dt, vWant - (state.tv || 0)));
    state.tgt! += state.tv! * dt;
    if (Math.abs(latDist) < 0.02 && Math.abs(state.tv) < 0.2) {
      state.tgt = state.line;
      state.tv = 0;
    }
    // ---- BRAKE only for what is still in the way where we are / are going (braking-distance
    // following; MEASURED in v1: a linear law
    // asked ~2 g at a 140 km/h closing speed -> lock-ups and spins)
    let brakeX = 0;
    // where we ARE only counts if the swerve cannot get us clear before we arrive (MEASURED
    // weavecheck: braking for the car 120 m ahead
    // in the lane we were LEAVING cost 60 km/h on every pass): time to clear = the sideways
    // distance still to go / the swerve rate
    // (the swerve's real time: from rest at aLat, d = a t^2 / 2 -> t = sqrt(2 d / a), + reaction)
    const now = blockOn(frame.off), dGo = Math.abs(state.line - frame.off),
      tClear = dGo > 0.3 ? 0.3 + Math.sqrt(2 * dGo / (0.25 * grip * GRAVITY)) : Infinity;
    let fol: RoadBlock | null = null;
    for (const blocker of [here, now && now.gap / Math.max(1, vAl - now.v) < tClear ? now : null]) {
      if (!blocker || blocker.side) continue;
      const want = 2.5 + (hold ? 0.6 : (HWT.wt ?? 0.22)) * Math.max(0, vAl),
        brakeDecel = (HWT.aB ?? 0.55) * grip * GRAVITY, room = blocker.gap - want;
      if (!fol || blocker.gap < fol.gap) fol = blocker;
      vTarget = Math.min(vTarget, room > 0
        ? Math.sqrt(Math.max(0, blocker.v) ** 2 + 2 * brakeDecel * room)
        : Math.max(HWT.fl != null ? blocker.v * HWT.fl : 0, blocker.v + room * (HWT.rk ?? 0.7)));
      const close = vAl - blocker.v;
      if (close > 0.5) {
        const ttc = blocker.gap / close;
        if (ttc < 1.3) brakeX = Math.max(brakeX, Math.min(1, (1.3 - ttc) / 1.0));
      }
    }
    const offT = Math.max(vLo, Math.min(vHi, state.tgt!)), vFollow = vTarget;
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
    // ---- STEER: the STANLEY controller of autodrive.js on the target line: heading error to the
    // road a little ahead + the front axle's cross-track error + yaw damping. MEASURED
    // (hwracecheck, v1): pure pursuit weaved +-1 m and ran 7 m wide out of an R 500. (the front
    // axle's road frame from the car's own frame + its heading: a SECOND roadFrame search per step
    // snapped to the wrong road point and read the car 2 m off where it was - MEASURED weavecheck:
    // the car drifted onto a car it had chosen to pass)
    const hRoad = roadPose(level, frame.s, 0).h, rel = car.heading - hRoad,
      axle = {
        s: frame.s + Math.cos(rel) * car.spec.lf,
        off: frame.off + Math.sin(rel) * car.spec.lf,
      };
    const aheadPose = roadPose(level, axle.s + 2 + speed * 0.15, offT);
    // + the swerve's own sideways speed as a FEED-FORWARD heading (without it the car lagged the
    // moving target, then overshot: spins) (an extra AIM term at the line ahead was tried: MEASURED
    // weavecheck, spins in 17 of 45 scenarios - Stanley's own gain stays) COURSE, not heading
    // (MEASURED weavecheck: in a bend the car's sideslip, ~1 deg at 180 km/h, left a steady 0.5 m
    // drift off the line that Stanley's heading term never saw - and it drifted into the car it was
    // passing): the angle the car is actually TRAVELLING at
    const course = speed > 3 ? Math.atan2(car.vy, car.vx) : car.heading;
    let psi = aheadPose.h + Math.atan2(state.tv || 0, speed + 1) - course;
    psi = Math.atan2(Math.sin(psi), Math.cos(psi));
    const cross = axle.off - offT, LOCK = car.spec.steerMax || 0.56;
    // the HEADING to the road is capped by speed (a swerve at 240 km/h is a few degrees, not 18),
    // and the car's own sideways speed across
    // the road is damped toward the target's (MEASURED weavecheck: lateral momentum carried it 30
    // m into the grass)
    const relH = Math.atan2(Math.sin(car.heading - hRoad), Math.cos(car.heading - hRoad)),
      hMax = Math.max(0.05, Math.min(0.35, 4 / Math.max(1, speed)));
    // YAW DAMPING on the ACTUAL yaw rate vs the road's (MEASURED weavecheck, Real: at 200 km/h the
    // car rotated 0.4 rad/s through the line while Stanley's psi still pointed across - yaw kept
    // building into a 35 deg slide). The car should turn with the road plus what the swerve needs;
    // anything beyond that is countered.
    const latVel = vAl * Math.sin(relH), latErr = latVel - (state.tv || 0),
      yawRoad = vAl * (pts[Math.max(0, Math.min(pts.length - 1, idx0))].curv || 0);
    let deltaS = psi + Math.atan2(-1.2 * cross, speed + 2)
      - 0.03 * (car.yawRate - speed * Math.tan(car.delta) / car.spec.L)
      - 0.02 * latErr - 0.12 * (car.yawRate - yawRoad);
    if (relH > hMax) deltaS = Math.min(deltaS, -(relH - hMax) * 2);
    else if (relH < -hMax) deltaS = Math.max(deltaS, (-hMax - relH) * 2);
    // COUNTER-STEER a sliding rear: the slip angle itself, as a driver catches it (and hold off
    // the brakes, below)
    const slipRear = (car.t && car.t.slipR) || 0;
    if (Math.abs(slipRear) > 0.08) deltaS -= slipRear * 0.9;
    const cap = Math.min(1,
      (1.6 * car.spec.L * grip * GRAVITY / Math.max(4, speed * speed)) / LOCK + 0.02);
    const steer = Math.max(-cap, Math.min(cap, deltaS / LOCK));
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
  return {
    drive,
    traits,
    state,
    relocate: () => {
      state.line = null;
      state.base = null;
      state.tgt = null;
      state.tv = 0;
      state.revUntil = 0;
      state.slowT = 0;
      state.outN = 0;
      state.giveUp = false;
    },
  };
}
