// ai/weaver.js — the HIGHWAY driver (roadDriver) + driveOut (from aidriver.js).
import { envValue } from "../core/debug.ts";
import { roadFrame, roadPose, roadSpan } from "../highway.js";

// ---------------------------------------------------------------- DRIVE ITSELF OUT (both roads)
// Nearly still for DRIVE_OUT_T s after the green (nose in a wall, beached, tangled) -> REVERSE ~1-1.5 s with the wheel turned to swing
// the nose back toward the road direction roadH(); three tries inside 15 s and still stuck -> st.giveUp: main.js resets it (last resort).
// Returns the reversing controls, or null = drive on. (NOOUT=1 env: node A/B only - proves the highway merge changed nothing else)
const NOOUT = !!envValue("NOOUT");
const DRIVE_OUT_T = 1.2;
export function driveOut(st, car, v, dt, ctx, rnd, roadH) {
  if (ctx.hold || !(st.t > 3) || NOOUT) return null;
  if (st.t < (st.revUntil || 0)) {
    let e = roadH() - car.heading; e = Math.atan2(Math.sin(e), Math.cos(e));
    return { steer: -Math.sign(e || 1), throttle: 0, brake: 0, handbrake: 0, reverse: 1 };
  }
  st.slowT = v < 1.5 ? (st.slowT || 0) + dt : 0;
  if (st.slowT > DRIVE_OUT_T) { st.slowT = 0; st.revUntil = st.t + 1 + 0.5 * rnd(); st.nOut = (st.nOut || 0) + 1;
    st.outN = st.t - (st.outAt ?? -99) < 15 ? (st.outN || 0) + 1 : 1; st.outAt = st.t; if (st.outN >= 3) st.giveUp = true; }
  return null;
}

// ---------------------------------------------------------------- THE HIGHWAY (endless level): the road read through highway.js
// AI ROUND 2 stage 1 (user, 2026-10-07: "same ai"; CLAUDE.md ONE SYSTEM NOT TWO THEN ONE): this was hwrace.js createHwDriver. It is now
// this file's road reader for levels with no closed lap (level.endless), behind the ONE entry point createAIDriver; moved UNCHANGED
// (MEASURED: weavecheck + pacesuite identical to before with __NOOUT) plus the shared drive-out. Later stages share more (mistakes, skill).
const LAT_R = 3.0;                    // m/s the lateral target moves (x1.8 in an emergency); traffic changes lane at 0.9
const G = 9.81;
const IDLE = { steer: 0, throttle: 0, brake: 0.3, handbrake: 0, reverse: 0 };
// the RACER — v2, a WEAVER (user, 2026-10-05: "AI on highways should IGNORE LANES and go FAST, DODGING traffic and WEAVING through like
// the player would"). No lanes: across the whole carriageway (hard shoulder included) it tries N_LINES lateral lines a few times a
// second and scores each by how much free road it has: every car ahead within 220 m whose body (+ a margin) overlaps the line blocks
// it at its gap; the line with the most road wins, with a cost for a big swerve and a bonus for staying put (no dithering), and never a
// line on the far side of a car right alongside. It steers for that line (Stanley, as autodrive.js — the controller that holds this
// road), the lateral target moving at LAT_R so a swerve is a car's swerve. Speed: corner speed from the road's curvature, flat out
// otherwise; it brakes only while its line is still blocked (braking-distance following), and hard when a crash is close.
// traits = aidriver.js aiTraits (pace, prec, wander, aggression). ctx = { cars: everyone else (with _hwf), hold: keep station (the
// rolling start: follow, no swerving) }
const N_LINES = 11, MARGIN = 0.55, LOOK_T = 3.2, EDGE_M = 1.8;
// A/B tuning from the node tools only (HWT='{"kC":0.5}'); the browser has no process -> {}
const HWT = envValue("HWT") ? JSON.parse(envValue("HWT")) : {};
export function roadDriver(lv, traits, rnd) {
  const st = { line: null, tgt: null, think: 0, ph: (traits.seed || 1) % 100, t: 0 };
  const pace01 = Math.max(0, Math.min(1, (traits.pace - 0.8) / 0.185));
  // CORNER GRIP: a share of tarmac mu x the car's mu (the bench driver's 0.40; 0.38 Mobile .. 0.50 Real). MEASURED (hwracecheck): 0.6 x
  // gripG planned 0.8 g at 230 km/h on an R 500 and the field ran wide - the car's real grip at that speed is lower
  // RACING, NOT A SUNDAY DRIVE (user, 2026-10-06: "they seem slow ... make them faster and just try n handle it"; MEASURED pacesuite, 18
  // races, vs the mirror-only build: mean 133.4 -> 138.2 km/h, under-130 40 -> 35 %, bad races 2 -> 1; weavecheck 0 spins, 1-2 of 45
  // close passes clip at 150 km/h): throttle floor 0.85 (was 0.6), corner share 0.42-0.54 (was 0.33-0.42), follow decel 0.55 g share,
  // turn feathering only for yaw BEYOND the road's own bend, lane-changing traffic blocks the lane it is going to, verge dodges
  const thrMax = (HWT.thr ?? 0.85) + (1 - (HWT.thr ?? 0.85)) * pace01, kC = (HWT.kC ?? 0.42) + (HWT.kCp ?? 0.12) * (traits.prec ?? 0.5), kB = (HWT.kB ?? 0.45) + 0.15 * (traits.prec ?? 0.5);
  const agg = traits.aggression ?? 0.5, margin = MARGIN + 0.25 * (1 - (traits.prec ?? 0.5));   // sloppier drivers leave more room
  function drive(c, dt = 1 / 120, ctx = {}) {
    if (!lv._hw) return IDLE;
    const f = c._hwf; if (!f) return IDLE;
    const P = lv._hw.pts, v = Math.hypot(c.vx, c.vy), vAl = f.v, hold = !!ctx.hold;
    const { s0, s1 } = roadSpan(lv);
    if (f.s > s1 - 40 || f.s < s0 + 20) return IDLE;   // past the road that exists (only once a race has ended)
    st.t += dt;
    // DRIVE ITSELF OUT (shared with the circuit driver: driveOut) - the highway had none before AI ROUND 2
    { const o = driveOut(st, c, v, dt, ctx, rnd, () => roadPose(lv, f.s, 0).h); if (o) return o; }
    // the hard shoulder is road too, as for a player; lines stay EDGE_M inside the edges (MEASURED hwracecheck: a 1 m margin on the
    // outside of an R 730 at 227 km/h ran 1.5 m wide onto the grass)
    const geo = lv._hw.geo, lo = -geo.hw + EDGE_M, hi = geo.hw - EDGE_M;
    // THE VERGE DODGE (user, 2026-10-06: "ai should go off road to dodge if its quicker, just not too far obviously"): two more lines,
    // VERGE m past each edge (half the car on the grass), only worth taking when the road is blocked: VERGE_COST + the grip it costs.
    // Never on the outside of a bend (armco there at hw + 1.8: highway.js) or on a walled preset. vLo / vHi = how far the line may go.
    const kNow = (P[Math.max(0, Math.min(P.length - 1, Math.round((f.s - P[0].s) / 4) + Math.round(vAl * 1.5 / 4)))] || {}).curv || 0;
    const vgOK = (HWT.verge ?? 1) && !lv._cfg.walls && !hold, vLo = vgOK && Math.abs(kNow) < 1 / 1500 ? -geo.hw + (HWT.vgm ?? 0.9) : lo, vHi = vgOK && Math.abs(kNow) < 1 / 1500 ? geo.hw - (HWT.vgm ?? 0.9) : hi;
    if (st.line == null) { st.line = st.base = Math.max(lo, Math.min(hi, f.off)); st.tgt = st.line; }
    const cars = ctx.cars || [], myW = c.spec.wid / 2;
    // ---- SPEED from the curvature ahead (v^2 = kC mu g R, with a kB mu g braking allowance)
    const mu = 0.94 * (c.spec.mu || 1), i0 = Math.round((f.s - P[0].s) / 4);
    let vT = 95;
    for (let d = 4; d < 30 + v * 2.6; d += 8) { const i = Math.min(P.length - 1, i0 + Math.round(d / 4)); if (i < 0) continue;
      const R = 1 / Math.max(1e-5, Math.abs(P[i].curv || 0)), vc = Math.sqrt(kC * mu * G * R); vT = Math.min(vT, Math.sqrt(vc * vc + 2 * kB * mu * G * d)); }
    const vCorner = vT;
    // what blocks a lateral line `off`: the nearest car ahead whose body (+ margin) overlaps it -> { gap, v } (gap 0 = alongside), or
    // a car right beside us on that side (side: we cannot swerve through it)
    const blockOn = (off) => {
      let B = null;
      for (const o of cars) { const g = o._hwf; if (!g) continue; const ds = g.s - f.s; if (ds < -6 || ds > 220) continue;
        // WHERE IT WILL BE (HWT.pred): a lane-changing traffic car blocks its target lane too, from now (it is going there)
        const tr = (HWT.pred ?? 1) && o._trOff != null && Math.abs(o._trOff - g.off) > 0.3 ? o._trOff : null;
        if (tr != null && ds > (c.spec.len + o.spec.len) / 2 + 1) { const hw2 = myW + o.spec.wid / 2 + margin; if (Math.abs(tr - off) < hw2 && Math.abs(g.off - off) >= hw2) { const gp = ds - (c.spec.len + o.spec.len) / 2; if (!B || gp < B.gap) B = { gap: gp, v: g.v, o }; } }
        // the margin GROWS with the closing speed (MEASURED weavecheck, Real: 0.55 m margin + ~0.5 m tracking error = a car's line that clips
      // the slow car at 75 km/h closing): 0.4 m more per 10 m/s closing
      const halfW = myW + o.spec.wid / 2 + margin + Math.min(HWT.mcap ?? 99, 0.04 * Math.max(0, vAl - g.v)), beside = ds < (c.spec.len + o.spec.len) / 2 + 1;
        if (beside) {
          const side = Math.sign(g.off - f.off), far = Math.sign(off - f.off) === side && Math.abs(off - f.off) > Math.abs(g.off - f.off) - halfW;
          if (far || Math.abs(g.off - off) < halfW) return { gap: 0, v: g.v, side: far, o };
          continue;
        }
        const gap = ds - (c.spec.len + o.spec.len) / 2;
        if (Math.abs(g.off - off) < halfW && (!B || gap < B.gap)) B = { gap, v: g.v, o };
      }
      return B;
    };
    // THE MIRROR: a FASTER car coming up from behind blocks a line it is on if it would arrive within MIR_T s (MEASURED hwracecheck seed 77,
    // Realish: a racer at 145 km/h moved 4.4 m left into the line of one 18 m back at 177 km/h - the one behind braked on the hard shoulder,
    // spun, and both left the road; the driver only ever looked at cars ahead, > 6 m back did not exist)
    const mirT = HWT.mir ?? 2.5;   // (MEASURED pacesuite, 18 races: bad runs 7 -> 2, off-road car-steps 13079 -> 4006, mean 126.7 -> 133.4 km/h)
    const mirror = (off) => {
      if (!mirT) return false;
      for (const o of cars) { const g = o._hwf; if (!g) continue; const ds = g.s - f.s, len = (c.spec.len + o.spec.len) / 2; if (ds > len + 1 || ds < -60) continue;
        const close = g.v - vAl; if (close < 0.5 && ds < -len) continue;
        if (ds < -len && (-ds - len) / close > mirT) continue;
        if (Math.abs(g.off - off) < myW + o.spec.wid / 2 + margin) return true; }
      return false;
    };
    // how far across one decision may take us: ~0.6 g sideways at low speed, falling with speed (2.5 m at 240 km/h)
    const reach = Math.max(2.5, Math.min(hi - lo, (14 - v * 0.17) * (HWT.rch ?? 1)));
    // ---- CHOOSE A LINE a few times a second (not while holding station)
    if ((st.think -= dt) <= 0) {
      st.think = 0.08 + 0.14 * (1 - agg);
      if (!hold) {
        let best = st.line, bestScore = -Infinity, bestRaw = 0; st.free = null; const wy = { raw: -Infinity, off: 0, why: '' };
        for (let k = 0; k <= N_LINES + 2; k++) {
          const off = k === N_LINES ? st.base : k === N_LINES + 1 ? vLo : k === N_LINES + 2 ? vHi : lo + (hi - lo) * k / (N_LINES - 1);
          if (k > N_LINES && (off === lo || off === hi)) continue;
          const B = blockOn(off);
          // free road along it: unblocked = LOOK_T s of road (+ a bonus); blocked = the gap + what is kept of the blocker's speed
          let score = B ? (B.side ? -999 : Math.min(B.gap, vAl * LOOK_T) + Math.max(0, B.v) * 1.2) : vAl * LOOK_T + 60;
          // NO QUEUEING BEHIND A RIVAL (HWT.rp): a line whose blocker is ANOTHER RACER close ahead is worth less, so it pulls out and
          // races it side by side instead of sitting in its slipstream
          // (user, 2026-10-06: "they tend to que in lanes on the highway still ... weave through traffic like a real street racer").
          // OFF BY DEFAULT - not proven (HANDOVER §3). MEASURED pacesuite, 9 races x seed sets A (4242,77,1234) / B (31,555,9001):
          // baseline 151.0 / 139.3 km/h; rp 40 + cm 12 + mvk 0.6 = 154.0 / 136.1, 0 bad, BUT weavecheck 9 of 45 hit (baseline 0)
          if (B && !B.side && B.o && !B.o.traffic && B.gap < 60) score -= (HWT.rp ?? 0) * (1 - B.gap / 60);
          // (MEASURED weavecheck: costed from where the car IS, any tracking lag dragged the plan after it - toward the car being passed)
          const move = Math.abs(off - st.base) + 0.3 * Math.abs(off - f.off), raw = score;
          if (raw > wy.raw) { wy.raw = raw; wy.off = off; wy.why = Math.abs(off - f.off) > reach ? 'reach' : 'cost'; }
          // REACH: no line further across than a swerve can make in ~1.5 s at this speed (MEASURED weavecheck: a 7 m jump asked at 240 km/h
          // put the car 18 deg to the road and into the grass)
          // a line FURTHER than reach is headed for in reach-sized STEPS (the plan re-thinks every ~0.15 s), if the step point is clear
          let aim = off;
          if (Math.abs(off - f.off) > reach) { if (!HWT.step) continue; aim = f.off + Math.sign(off - f.off) * reach;
            const Sb = blockOn(aim); if (Sb && (Sb.side || Sb.gap < 4 + 2 * Math.max(0, vAl - Sb.v))) continue; }
          // swerving costs; the line already chosen is worth a lot (COMMIT: MEASURED weavecheck, a 6 m bonus let it flip between two lines
          // 3 m apart every 0.2 s and slalom into the car it was passing)
          // swerve cost x HWT.mvk, commit bonus HWT.cm (defaults = the shipped behaviour). A looser setting was tried (2026-10-06, the
          // queueing) - MEASURED weavecheck hits of 45: cm 12 / mvk 0.6 = 9, cm 25 / mvk 0.6 = 8, cm 25 / mvk 0.8 = 2, default = 0
          score -= move * (1.5 + v * 0.05) * (HWT.mvk ?? 1) - (Math.abs(off - st.base) < 0.6 ? (HWT.cm ?? 25) : 0);
          if (off < -geo.hw + lv._cfg.shoulder) score -= 8;                              // the hard shoulder: a last resort
          if (off < lo - 0.1 || off > hi + 0.1) score -= (HWT.vgc ?? 40);              // the verge: only when it is clearly quicker
          if (Math.abs(aim - f.off) > 1.2) { const mid = blockOn((aim + f.off) / 2); if (mid && mid.gap < 1) { score -= 400; if (wy.off === off) wy.why = 'mid'; } }
          if (Math.abs(aim - f.off) > (HWT.mth ?? 1.2) && (mirror(aim) || mirror((aim + f.off) / 2))) { score -= 400; if (wy.off === off) wy.why = 'mirror'; }
          if (aim !== off && wy.off === off) wy.why = 'stepped';   // the way across must be open
          if (!B && (!st.free || Math.abs(off - f.off) < Math.abs(st.free.off - f.off))) st.free = { off, score };
          if (score > bestScore) { bestScore = score; best = aim; bestRaw = raw; }
        }
        st.base = best; st.why = { ...wy, chosen: best, chosenRaw: bestRaw };
      }
    }
    // a little WANDER (difficulty) on top of the plan - NOT folded into it (MEASURED weavecheck: added to the plan at every re-think it
    // accumulated and walked the line into the car being passed)
    // ABORT a swerve already under way when the mirror shows a car closing on the side it is moving to (MEASURED hwracecheck seed 1234,
    // Real: the line was chosen while the road was clear; a car 30 km/h quicker came up into it 0.3 s later and they touched side to side)
    if (mirT && (HWT.abort ?? 1) && Math.abs(st.tv || 0) > 0.2 && mirror(st.tgt + Math.sign(st.tv) * 0.6)) { st.base = st.tgt; st.think = Math.min(st.think, 0.05); }
    st.line = Math.max(vLo, Math.min(vHi, st.base + Math.sin(st.t * 0.4 + st.ph) * Math.min(0.4, (traits.wander || 0) * 0.2)));
    // the lateral target eases toward the chosen line at LAT_R (faster when a crash is close: a real swerve)
    const here = blockOn(st.tgt), urgent = here && here.gap < 6 + Math.max(0, vAl - here.v) * 0.8;
    // A SWERVE HAS INERTIA: the target's sideways speed ramps at aLat (a share of grip) and eases in to stop on the line. MEASURED
    // (hwracecheck, Real difficulty): an instant 6.5 m/s sideways step spun cars at 150 km/h on a straight (rear slip 0.6 rad)
    const latR = LAT_R * (urgent ? 1.6 : 1) * (0.8 + 0.4 * agg), aLat = (urgent ? 0.3 : 0.18) * mu * G, d = st.line - st.tgt;
    const vWant = Math.sign(d) * Math.min(latR, Math.sqrt(2 * aLat * Math.abs(d)));
    st.tv = (st.tv || 0) + Math.max(-aLat * dt, Math.min(aLat * dt, vWant - (st.tv || 0)));
    st.tgt += st.tv * dt; if (Math.abs(d) < 0.02 && Math.abs(st.tv) < 0.2) { st.tgt = st.line; st.tv = 0; }
    // ---- BRAKE only for what is still in the way where we are / are going (braking-distance following; MEASURED in v1: a linear law
    // asked ~2 g at a 140 km/h closing speed -> lock-ups and spins)
    let brakeX = 0;
    // where we ARE only counts if the swerve cannot get us clear before we arrive (MEASURED weavecheck: braking for the car 120 m ahead
    // in the lane we were LEAVING cost 60 km/h on every pass): time to clear = the sideways distance still to go / the swerve rate
    // (the swerve's real time: from rest at aLat, d = a t^2 / 2 -> t = sqrt(2 d / a), + reaction)
    const now = blockOn(f.off), dGo = Math.abs(st.line - f.off), tClear = dGo > 0.3 ? 0.3 + Math.sqrt(2 * dGo / (0.25 * mu * G)) : Infinity;
    let fol = null;
    for (const B of [here, now && now.gap / Math.max(1, vAl - now.v) < tClear ? now : null]) { if (!B || B.side) continue;
      const want = 2.5 + (hold ? 0.6 : (HWT.wt ?? 0.22)) * Math.max(0, vAl), aB = (HWT.aB ?? 0.55) * mu * G, room = B.gap - want;
      if (!fol || B.gap < fol.gap) fol = B;
      vT = Math.min(vT, room > 0 ? Math.sqrt(Math.max(0, B.v) ** 2 + 2 * aB * room) : Math.max(HWT.fl != null ? B.v * HWT.fl : 0, B.v + room * (HWT.rk ?? 0.7)));
      const close = vAl - B.v; if (close > 0.5) { const ttc = B.gap / close; if (ttc < 1.3) brakeX = Math.max(brakeX, Math.min(1, (1.3 - ttc) / 1.0)); } }
    const offT = Math.max(vLo, Math.min(vHi, st.tgt)), vFollow = vT;
    // RUNNING WIDE (past the line limits): lift, as a driver would - 3 m/s under what it is doing per metre out (on a verge dodge the
    // limit is the verge line; the grass itself already costs grip, so only past THAT)
    { const lim = f.off < 0 ? -vLo : vHi, out = Math.abs(f.off) - lim; if (out > 0.3) vT = Math.min(vT, vAl - 3 * out); }
    // on the grass: no more than VERGE_V m/s faster than the car being passed (a dodge, not a lap of the field)
    if (Math.abs(f.off) > geo.hw - 0.6 && fol) vT = Math.min(vT, Math.max(fol.v + (HWT.vgv ?? 8), vAl - 2));
    // ---- STEER: the STANLEY controller of autodrive.js on the target line: heading error to the road a little ahead + the front
    // axle's cross-track error + yaw damping. MEASURED (hwracecheck, v1): pure pursuit weaved +-1 m and ran 7 m wide out of an R 500.
    // (the front axle's road frame from the car's own frame + its heading: a SECOND roadFrame search per step snapped to the wrong
    // road point and read the car 2 m off where it was - MEASURED weavecheck: the car drifted onto a car it had chosen to pass)
    const hRoad = roadPose(lv, f.s, 0).h, rel = c.heading - hRoad, ff = { s: f.s + Math.cos(rel) * c.spec.lf, off: f.off + Math.sin(rel) * c.spec.lf };
    const ah = roadPose(lv, ff.s + 2 + v * 0.15, offT);
    // + the swerve's own sideways speed as a FEED-FORWARD heading (without it the car lagged the moving target, then overshot: spins)
    // (an extra AIM term at the line ahead was tried: MEASURED weavecheck, spins in 17 of 45 scenarios - Stanley's own gain stays)
    // COURSE, not heading (MEASURED weavecheck: in a bend the car's sideslip, ~1 deg at 180 km/h, left a steady 0.5 m drift off the line
    // that Stanley's heading term never saw - and it drifted into the car it was passing): the angle the car is actually TRAVELLING at
    const course = v > 3 ? Math.atan2(c.vy, c.vx) : c.heading;
    let psi = ah.h + Math.atan2(st.tv || 0, v + 1) - course; psi = Math.atan2(Math.sin(psi), Math.cos(psi));
    const cross = ff.off - offT, LOCK = c.spec.steerMax || 0.56;
    // the HEADING to the road is capped by speed (a swerve at 240 km/h is a few degrees, not 18), and the car's own sideways speed across
    // the road is damped toward the target's (MEASURED weavecheck: lateral momentum carried it 30 m into the grass)
    const relH = Math.atan2(Math.sin(c.heading - hRoad), Math.cos(c.heading - hRoad)), hMax = Math.max(0.05, Math.min(0.35, 4 / Math.max(1, v)));
    // YAW DAMPING on the ACTUAL yaw rate vs the road's (MEASURED weavecheck, Real: at 200 km/h the car rotated 0.4 rad/s through the
    // line while Stanley's psi still pointed across - yaw kept building into a 35 deg slide). The car should turn with the road plus
    // what the swerve needs; anything beyond that is countered.
    const latVel = vAl * Math.sin(relH), latErr = latVel - (st.tv || 0), yawRoad = vAl * (P[Math.max(0, Math.min(P.length - 1, i0))].curv || 0);
    let deltaS = psi + Math.atan2(-1.2 * cross, v + 2) - 0.03 * (c.yawRate - v * Math.tan(c.delta) / c.spec.L) - 0.02 * latErr - 0.12 * (c.yawRate - yawRoad);
    if (relH > hMax) deltaS = Math.min(deltaS, -(relH - hMax) * 2); else if (relH < -hMax) deltaS = Math.max(deltaS, (-hMax - relH) * 2);
    // COUNTER-STEER a sliding rear: the slip angle itself, as a driver catches it (and hold off the brakes, below)
    const sR = (c.t && c.t.slipR) || 0; if (Math.abs(sR) > 0.08) deltaS -= sR * 0.9;
    const cap = Math.min(1, (1.6 * c.spec.L * mu * G / Math.max(4, v * v)) / LOCK + 0.02);
    const steer = Math.max(-cap, Math.min(cap, deltaS / LOCK));
    // brake eased while steering (autodrive.js: a 35 % floor), so an emergency stop in a swerve does not lock it into a slide
    const e = vT - vAl, brake = Math.max(brakeX, e < -1 ? Math.min(1, -e * 0.15) : 0) * Math.max(0.35, 1 - Math.abs(steer) / 0.25);
    const slide = Math.abs((c.t && c.t.slipR) || 0), feel = slide > 0.12 ? 0.4 : 1;   // ease off while the rear slides
    // GAS IN A SWERVE: a rear-drive car at full throttle mid-swerve steps out (MEASURED weavecheck, Real difficulty, 200 km/h: rear slip
    // 0.3-0.8 rad in 9 of 45 scenarios); the throttle is capped by how hard it is turning, as a driver would feather it
    const turn = (HWT.tx ?? 1) ? Math.min(1, Math.max(Math.abs(c.yawRate - yawRoad) * Math.max(1, v) / ((HWT.tn ?? 0.8) * mu * G), (Math.abs(c.yawRate) * Math.max(1, v) - (HWT.tc ?? 0.45) * mu * G) / (0.3 * mu * G)))
      : Math.min(1, Math.abs(c.yawRate) * Math.max(1, v) / ((HWT.tn ?? 0.5) * mu * G)), thrCap = thrMax * (1 - 0.6 * turn);
    st.dbg = { fol, vT, vCorner, vFollow, brakeX, thrCap, turn, e, feel };   // (read by the node tools only)
    return { steer, throttle: brake > 0 || e <= 0 ? 0 : Math.min(thrCap, e * 0.35) * feel, brake, handbrake: 0, reverse: 0 };
  }
  return { drive, traits, state: st, relocate: () => { st.line = null; st.base = null; st.tgt = null; st.tv = 0; st.revUntil = 0; st.slowT = 0; st.outN = 0; st.giveUp = false; } };
}
