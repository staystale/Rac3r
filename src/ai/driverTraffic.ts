// ai/driverTraffic.ts: the circuit driver's reading of traffic and obstacles: cars ahead,
// alongside and behind, and loose objects on the road. Functions take the driver context.
import { debugValue } from "../core/debug.ts";
import { FIX } from "../core/fixes.ts";
import { GRAVITY } from "../cars.ts";
import { OBST_CLEAR, carGrip, profileOf } from "./line.ts";
import type { AiCar, CarsAcc, CarsEnv, DriveCtx } from "./types.ts";
import type { Drv, AiPath } from "./driverCtx.ts";
import { OBJECT_MORE, clearOf, matchSpeed, reachOf, readBraking, swerveCap } from "./dodge.ts";
import { blockOn, gapLine, seeCar } from "./gapPick.ts";
import type { SeenCar } from "./gapPick.ts";

// MEASURED (aidrivecheck, HB on/off, Realish + Real, hatch + 4x4): Slidden / Knobhill / Castle Kum
// within 0.1 s, Sweaty Lamb +0.2..+0.7 s, 6 pulls per 2 min at Slidden, 4 at Sweaty Lamb — it is
// FLAVOUR (the user's "drift and stuff"), not pace. A heading-error trigger fired ~never. m past
// the usual edge allowed to get round a car / a slow or stopped one
const WIDE = +(debugValue("WIDE") ?? 0.8), WIDE_SLOW = 2.5;
// m more room alongside a car while easing from the grid lane onto the line
const START_GAP = 1.3;
// m/s under the leading car's speed a car giving way to it drops to (alongsideCar)
const YIELD_V = 0.5;

/**
 * An obstacle off the road is not in the way - unless it is a standing post (a car off
 * the road steers round a lamp post too).
 * @param obstacle the obstacle
 * @param offCentre its m off the road's middle
 * @param edge m from the middle the road runs to
 * @returns true to pass it by
 */
const offRoadSkip = (obstacle: { fixed?: boolean }, offCentre: number, edge: number) =>
  !obstacle.fixed && Math.abs(offCentre) > edge;

/** Steps round a loose obstacle (cone, tyre) in the way; the dodge target, or null. */
export function obstacleStep(drv: Drv, car: AiCar, ctx: DriveCtx, path: AiPath, nearIdx: number,
    idx: (pos: number) => number, speed: number, prec: number, lineOff: number,
    myLat: number, latLim: number, latT: number, dt: number) {
  const { line, main, state } = drv;
  const pts = path.pts, cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  let dodge: number | null = null;
  const onLine = path === main ? lineOff : 0;
  // ---- OBSTACLES (requirement: AI need to see tyres and cones as obstacles — although optional
  // ones haha — but try and avoid them on rally stages / tracks): ctx.obstacles = loose objects
  // near this car ({ x, y, r }, main.ts). One in my path ahead, on the road ->
  // step round it on the side with room; no room -> drive through (optional). Cars come first:
  // only when no car is in the way. A more
  // precise driver sees it further ahead.
  if (ctx.obstacles) {
    const reach = 6 + speed * (0.6 + 0.6 * prec + OBJECT_MORE); let best = null;
    for (const obstacle of ctx.obstacles) {
      const relX = obstacle.x - car.x, relY = obstacle.y - car.y,
          fwd = relX * cosH + relY * sinH;
      if (fwd < 2 || fwd > reach) continue;
      const lat = -relX * sinH + relY * cosH; if (Math.abs(lat) > 8) continue;
      const pos = idx(nearIdx + Math.round(fwd / path.sp)), pathPt = pts[pos], obstLat = (
          obstacle.x - pathPt.x) * -Math.sin(pathPt.h) + (obstacle.y - pathPt.y) * Math.cos(
          pathPt.h);
      // off the road: not in the way (a standing post is, to a car off the road too)
      if (offRoadSkip(obstacle, onLine + obstLat, path === main ? line.hw + 0.5 : 6)) continue;
      if (Math.abs(obstLat - myLat) < obstacle.r + OBST_CLEAR && (
          !best || fwd < best.f)) best = {
        f: fwd, oc: obstLat, r: obstacle.r
      };
    }
    if (best) {
      const clearance = best.r + OBST_CLEAR + 0.2;
      const cands = [best.oc + clearance, best.oc - clearance].filter(
          (cand) => Math.abs(onLine + cand) <= latLim).sort(
          (first, second) => Math.abs(first - myLat) - Math.abs(second - myLat));
      if (cands.length) {
        dodge = cands[0] - latT;
        state.obst = (state.obst || 0) + dt;
      }
    }
  }
  return dodge;
}

/** The path index nearest to a car, searched from 16 m behind to just past it. */
export function closestPathIdx(drv: Drv, env: CarsEnv, other: AiCar, fwd: number) {
  const { path, nearIdx, idx } = env, pts = path.pts;
  let closeIdx = nearIdx, closeDist2 = Infinity;
  const span = Math.round((Math.max(0, fwd) + 12) / path.sp);
  for (let offset = -Math.round(16 / path.sp); offset <= span; offset += 1) {
    const slot = idx(nearIdx + offset), dist2 = (pts[slot].x - other.x) ** 2 + (
        pts[slot].y - other.y) ** 2;
    if (dist2 < closeDist2) {
      closeDist2 = dist2;
      closeIdx = slot;
    }
  }
  return closeIdx;
}

/** Goes round (or sits behind) a car ahead that is closing: the dodge target and gap cap. */
export function followAhead(drv: Drv, acc: CarsAcc, env: CarsEnv, fwd: number, otherLat: number,
    vAlong: number, closeIdx: number) {
  const { state } = drv;
  const { car, speed, lineOff, latT, latLim, myLat, clear, gapF } = env;
  acc.conflict = true;
  // GO ROUND, DON'T QUEUE (requirement: AI still seem to almost queue and wait rather than overtake
  // and avoid blocking cars, even if it's slightly off track): the room to pass may use WIDE m past
  // the usual edge (wheels on the grass), WIDE_SLOW for a
  // car that is much slower or stopped (spun, beached); once a side is chosen it no longer
  // matches the car ahead's speed unless
  // still overlapping it close up. (Was: room inside the edge only, and it slowed to
  // follow whenever within gapF + 4 m even with a
  // side chosen. The room test also subtracted latT — wrong whenever the driver was
  // wandering.)
  const slowBlock = vAlong < Math.min(0.7 * speed, speed - 4) || vAlong < 6;
  const wide = latLim + (slowBlock ? WIDE_SLOW : WIDE);
  // round it on the ROAD if there is room there - past the edge only when there is none
  // (MEASURED 11-04: on the highway every 90 km/h car was a "slow block" to a 200 km/h racer and
  // the racers went round on the verge with the lanes clear - off the road, wrecks)
  const both = [otherLat + clear, otherLat - clear];
  const onRoad = both.filter((cand) => Math.abs(lineOff + cand) <= latLim);
  // (past the edge only round a car stopped or crawling - offTrackOk)
  const cands = (onRoad.length || !offTrackOk(vAlong, speed) ? onRoad : both.filter(
      (cand) => Math.abs(lineOff + cand) <= wide)).sort(
      (first, second) => Math.abs(first - myLat) - Math.abs(second - myLat));
  if (cands.length && fwd > 3) {
    acc.dodgeT = cands[0] - latT;
    // no time to swerve at this speed -> brake until there is (ai/dodge.ts)
    {
      const room = fwd - (env.along ?? 2) - car.spec.len / 2;
      const cap = swerveCap(Math.abs(cands[0] - myLat), room, speed, vAlong);
      if (cap < Infinity) { acc.followCap = Math.min(acc.followCap, cap); acc.urgent = true; }
    }
    if (Math.abs(lineOff + cands[0]) > latLim) {
      state.wide = wide;
      state.wideUntil = state.t + 1.2;
    }
  }
  if (!cands.length || (fwd < gapF && Math.abs(otherLat - myLat) < 1.6)) {
    acc.followCap = Math.min(acc.followCap, followCapOf(drv, env, fwd, vAlong, closeIdx));
  }
}

/**
 * The speed to follow a car ahead at, with no way round it.
 * @param drv the driver context
 * @param env the cars' environment, sized to the car ahead
 * @param fwd m it is ahead
 * @param vAlong its m/s along my way
 * @param closeIdx its point on my path
 * @returns m/s
 */
function followCapOf(drv: Drv, env: CarsEnv, fwd: number, vAlong: number, closeIdx: number) {
  const { traits } = drv, { car, path, idx, prec, prof, gapF } = env;
  let capF = vAlong + Math.max(0, fwd - gapF) * 0.7;
  // ANTICIPATION (prec): the car ahead will slow to (about) the profile where it is now,
  // so arrive gapF behind at that speed
  // instead of reacting once it brakes — the nose-to-tail hits in braking zones
  // (aifieldsuite: ~40 % of contact events)
  if (prec > 0) {
    const leadSpeed = Math.min(
        vAlong, prof[idx(closeIdx + Math.round(6 / path.sp))] * traits.pace),
        brakeDecel = 0.6 * carGrip(car.spec).brakeG * GRAVITY * (car.surface.mu || 1);
    capF = Math.min(capF, capF * (1 - prec) + prec * Math.sqrt(
        leadSpeed * leadSpeed + 2 * brakeDecel * Math.max(0, fwd - gapF)));
  }
  // no way round - keep a speed I can still match it by while it brakes
  if (env.dec) {
    const brakeDecel = 0.6 * carGrip(car.spec).brakeG * GRAVITY * (car.surface.mu || 1);
    capF = Math.min(capF, matchSpeed(vAlong, env.dec, brakeDecel, fwd - gapF));
  }
  return capF;
}

/** A car alongside (or just behind): remember its place and keep a gap from it. */
export function alongsideCar(drv: Drv, acc: CarsAcc, env: CarsEnv, fwd: number, otherLat: number,
    vAlong: number) {
  const { latT, startK, myLat } = env;
  if (fwd > -2.5) acc.side = acc.side || Math.sign(otherLat - myLat);
  acc.alg.push(otherLat);
  const gapA = 2.4 + START_GAP * startK;
  // who OWNS THE LINE (passed 11-04; owner: "if a car has the lead (half a car) over another car
  // they have the priority on racing line and the car behind even if it's side by side still
  // yields to it")
  const half = env.car.spec.len / 2, side = Math.sign(otherLat - myLat) || 1;
  if (fwd <= -half) {
    // I lead: my line - only no chopping across it (I hold where I am if my line closes on it)
    if (Math.abs(otherLat - myLat) < gapA && Math.sign(latT - myLat) === side) {
      acc.conflict = true;
      acc.dodgeT = myLat - latT;
    }
    return;
  }
  if (fwd >= half && Math.sign(latT - myLat) === side) {
    // it leads and my line is across it: give way - drop in behind it, then take the line
    acc.followCap = Math.min(acc.followCap, vAlong - YIELD_V);
  }
  if (Math.abs(otherLat - myLat) < gapA) {
    acc.conflict = true;
    acc.dodgeT = myLat + Math.sign(myLat - otherLat || 1) * (
        gapA - Math.abs(otherLat - myLat)) - latT;
  }
}

/**
 * A car not racing - stopped or crawling against my speed (a crash, a spin).
 * @param vAlong its m/s along my way
 * @param speed my m/s
 * @returns true when it is not racing
 */
const racingNot = (vAlong: number, speed: number) => vAlong < Math.max(5, 0.5 * speed);

/**
 * Whether a car may go past the track's edge to get round this one: only a car stopped
 * or crawling (racingNot) - a racing car is passed on the track or followed until there is room.
 * MEASURED (tools/scratch/_wide.mjs, the stock car oval, 20 AI): with the track full every way
 * round went onto the grass - 4.7 % of the race off the track (6 AI: 1.2 %), most of it the
 * first bend in the first 40 s.
 * @param vAlong its m/s along my way
 * @param speed my m/s
 * @returns true when the edge may be crossed for it
 */
const offTrackOk = (vAlong: number, speed: number) => racingNot(vAlong, speed);

/** Notes the nearest car ahead (lead) and the nearest faster one close behind (threat). */
export function noteLeadThreat(drv: Drv, acc: CarsAcc, env: CarsEnv, other: AiCar, fwd: number,
    otherLat: number, vAlong: number) {
  const { speed, myLat, clear } = env;
  // a stopped or crawling car is a hazard to go round, not a car to attack (MEASURED: the
  // attack committed to a side INTO a car stopped across the road, at racing pace)
  if (racingNot(vAlong, speed)) return;
  if (fwd > 2.5 && fwd < 22 && Math.abs(otherLat - myLat) < clear + 0.8 && (
      !acc.lead || fwd < acc.lead.f)) acc.lead = {
    c: other, f: fwd, oc: otherLat, vAlong
  };
  if (fwd < -3 && fwd > -16 && vAlong > speed - 1 && (!acc.threat || fwd > acc.threat.f)) {
    acc.threat = {
      c: other, f: fwd, oc: otherLat
    };
  }
}

/** The car being ATTACKED: no following gap once we are moving over (only overlap holds us). */
export function attackedCar(drv: Drv, acc: CarsAcc, env: CarsEnv, fwd: number, otherLat: number,
    vAlong: number) {
  acc.atkLat = otherLat;
  if (fwd > 2.5 && fwd < 5 && Math.abs(otherLat - env.myLat) < 1.5) acc.followCap = Math.min(
      acc.followCap, vAlong + 0.5);
  if (fwd < 4.5 && fwd > -4.5) acc.alg.push(otherLat);
}

/**
 * The cars' environment with the other car's real size across my path (not a point).
 * @param env the cars' environment
 * @param car my car
 * @param other the other car
 * @param pathH my path's heading by it
 * @returns the environment to read it with
 */
function sizedEnv(env: CarsEnv, car: AiCar, other: AiCar, pathH: number): CarsEnv {
  const reach = reachOf(other, pathH);
  return { ...env, clear: clearOf(car, reach.across), along: reach.along };
}


// s of travel a driver reads the cars ahead in, skill 0 / skill 1 (the highway driver's;
// at 240 km/h against 90 km/h traffic 0.8 .. 2.1 s hit it in 17-19 of 45 weavecheck scenarios)
const GAP_LOOK_WEAK = 2.6, GAP_LOOK_TOP = 3.8;
// boxed in: the share of full braking planned (late: going round is tried first, braking only
// once it must - owner 11-04: "avoid it not just brake... it should brake too if it needs to"),
// and the m kept behind the car
const BOXED_BRAKE = 0.9, BOXED_GAP_M = 3;
// m beside my line a crawling car counts as in my way
const MARGIN_WAY = 1;

/**
 * The speed a driver reads a car ahead at (?passcare=1: one coming at me at the closing speed -
 * MEASURED, hwracecheck on Deaf Valley both ways: read at my own speed, the other way's car was
 * met 1.7 s after it was seen; else my own speed).
 * @param speed my m/s
 * @param vAlong its m/s along my way
 * @returns m/s
 */
const readSpeed = (speed: number, vAlong: number) =>
  (FIX.passcare ? Math.max(speed, speed - vAlong) : speed);

/** The s of travel the gap spotter reads the cars ahead in, by skill. */
function gapLook(skill: number) {
  return GAP_LOOK_WEAK + (GAP_LOOK_TOP - GAP_LOOK_WEAK) * Math.max(0, Math.min(1, skill));
}

/** Reads the cars around: who leads, who threatens, who is alongside; the dodge and gap cap. */
export function carsStep(drv: Drv, car: AiCar, others: AiCar[], path: AiPath, nearIdx: number,
    idx: (pos: number) => number, speed: number, prec: number, prof: ReturnType<typeof profileOf>,
    lineOff: number, latT: number, startK: number, latLim: number, myLat: number) {
  const { traits, state } = drv;
  const clear = 2.3 - 0.4 * traits.aggression, gapF = (
      6.5 - 2.5 * traits.aggression) * (1.15 - 0.35 * prec);
  const env: CarsEnv = {
    car, path, nearIdx, idx, speed, prec, prof, lineOff, latT, startK, latLim, myLat, clear, gapF
  };
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  // the s ahead it reads the cars in, by skill (was 1.1 for everyone; ai/dodge.ts)
  // (the gap spotter's reading, the highway driver's 2.6 .. 3.8 s - ai/gapPick.ts)
  const look = gapLook(traits.skill);
  const acc: CarsAcc = {
    dodgeT: 0, followCap: Infinity, conflict: false, lead: null, threat: null, side: 0, alg: []
  };
  const seen: SeenCar[] = [];
  for (const other of others) {
    const relX = other.x - car.x, relY = other.y - car.y, fwd = relX * cosH + relY * sinH,
        lat = -relX * sinH + relY * cosH;
    // (cars to 60 m behind too - the gap picker's mirror; ?passcare=1: ahead, read as far in time
    // as a car going my way - one coming at me at the closing speed)
    if (fwd < -60 || fwd > 8 + readSpeed(speed, other.vx * cosH + other.vy * sinH) * look
      || Math.abs(lat) > 8) continue;
    // its lateral place relative to MY path
    const closeIdx = closestPathIdx(drv, env, other, fwd);
    const point = path.pts[closeIdx], otherLat = (other.x - point.x) * -Math.sin(point.h) + (
        other.y - point.y) * Math.cos(point.h);
    const vAlong = other.vx * cosH + other.vy * sinH;
    const envO = sizedEnv(env, car, other, point.h);
    envO.dec = readBraking(state.seenV ??= new WeakMap(), other, vAlong, state.t, traits.skill);
    // (not the car I am attacking: the attack is passing it - going round it as traffic undid the
    // pass, MEASURED circuit fields 118 -> 83 passes)
    const attacked = state.atk && other === state.atk.car;
    if (!attacked) seen.push({ ...seeCar(other, fwd, otherLat, vAlong, point.h),
      dec: envO.dec });
    noteLeadThreat(drv, acc, env, other, fwd, otherLat, vAlong);
    reactTo(drv, acc, [env, envO], { fwd, otherLat, vAlong, closeIdx, attacked: !!attacked });
  }
  gapStep(drv, car, acc, seen, { myLat, latT, lineOff, latLim, speed, look });
  acc.seen = seen;
  return acc;
}

/**
 * How I take one car I see: attacking it, following it, alongside it, or defending from it.
 * @param drv the driver context
 * @param acc the cars' read so far
 * @param envs the cars' environment, and it sized to the car (following reads its size)
 * @param seenAs where it is (m ahead, m off my path), its m/s along my way, its path point, and
 *   whether I am attacking it
 */
function reactTo(drv: Drv, acc: CarsAcc, envs: [CarsEnv, CarsEnv], seenAs: { fwd: number;
  otherLat: number;
  vAlong: number; closeIdx: number; attacked: boolean }) {
  const { traits } = drv, [env, envO] = envs, { speed, myLat, latT } = env;
  const { fwd, otherLat, vAlong, closeIdx, attacked } = seenAs;
  if (attacked) { attackedCar(drv, acc, env, fwd, otherLat, vAlong); return; }
  if (fwd > 2.5) {
    // FOLLOWING only while closing, with a short gap: it rubs and bumps in braking zones
    // (aifieldcheck: ~6 s of contact per 3 laps of 6 cars at Realish). USER (after
    // testing it): "contact is ok … it felt ok before, put it back" — a strict speed-based gap
    // (zero contact, but a procession: 1 position change in 3 laps) was tried and REVERTED.
    if (speed - vAlong > -0.5 && Math.abs(otherLat - myLat) < envO.clear) {
      followAhead(drv, acc, envO, fwd, otherLat, vAlong, closeIdx);
    }
  } else if (fwd > -4) {
    alongsideCar(drv, acc, env, fwd, otherLat, vAlong);
  } else if (!acc.conflict && traits.defence > 0.5 && vAlong > speed + 0.5 && fwd > -14) {
    acc.dodgeT = Math.max(-1.2, Math.min(1.2, (otherLat - latT) * 0.5)) * traits.defence;
  }
}

/**
 * GAP SPOTTING (ai/gapPick.ts) - when a car is in the way of my line, the best line through
 * all the cars I see, not round the one I saw last.
 * @param drv the driver context
 * @param car my car
 * @param acc the cars' read so far (its dodge is set)
 * @param seen the cars seen, my path's frame
 * @param mine my place, target, the line's offset, the room, m/s and the s I read ahead
 */
function gapStep(drv: Drv, car: AiCar, acc: CarsAcc, seen: SeenCar[], mine: { myLat: number;
  latT: number; lineOff: number; latLim: number; speed: number; look: number }) {
  const { state } = drv, { myLat, latT, lineOff, latLim, speed, look } = mine;
  const half = car.spec.wid / 2, len = car.spec.len;
  // picking while any car is ahead within reading distance - not only while one is on my line
  // (once the swerve began the car was off it, and the pick let go back into it, MEASURED)
  const ahead = seen.some((other) => other.fwd > 0
    && other.fwd < readSpeed(speed, other.v) * look + 8);
  if (!ahead) { state.gapBase = null; return; }
  if (!blockOn(seen, myLat, half, len) && state.gapBase == null) return;
  // (the room past the edge only with a car stopped or crawling IN MY WAY - offTrackOk;
  // "anywhere ahead" let the whole field onto the grass after a first-bend crash, MEASURED)
  const room = latLim + (seen.some((other) => other.fwd > 0 && other.fwd < speed * look + 8
    && Math.abs(other.lat - myLat) < other.across + half + MARGIN_WAY && offTrackOk(other.v, speed))
    ? WIDE : 0);
  const line = gapLine(seen, { lat: myLat, base: state.gapBase ?? myLat, half, len, speed, look,
    lo: -room - lineOff, hi: room - lineOff, edge: latLim, centre: lineOff,
    lanes: drv.state.path === drv.main ? drv.line.lanes : undefined });
  state.gapBase = line;
  acc.dodgeT = line - latT;
  acc.conflict = true;
  // BOXED IN: a car still on the best line - brake to arrive behind it at its speed (MEASURED
  // pacesuite: a pack abreast at 185 km/h kept its foot down to 9 m from 90 km/h traffic, wrecks)
  const block = blockOn(seen, line, half, len);
  if (block && !block.side) {
    const decel = BOXED_BRAKE * carGrip(car.spec).brakeG * GRAVITY * (car.surface.mu || 1);
    acc.followCap = Math.min(acc.followCap, Math.sqrt(Math.max(0, block.v) ** 2
      + 2 * decel * Math.max(0, block.gap - BOXED_GAP_M)));
    // and as it slows (ai/dodge.ts matchSpeed)
    if (block.dec) {
      acc.followCap = Math.min(acc.followCap, matchSpeed(Math.max(0, block.v), block.dec, decel,
        block.gap - BOXED_GAP_M));
    }
  }
  if (Math.abs(lineOff + line) > latLim) { state.wide = room; state.wideUntil = state.t + 1.2; }
}

/** OBSTACLES: the way round a loose object, when no car is in the way. */
export function obstacleAvoid(drv: Drv, car: AiCar, ctx: DriveCtx, path: AiPath, nearIdx: number,
    idx: (pos: number) => number, speed: number, prec: number, lineOff: number, myLat: number,
    latLim: number, latT: number, dt: number, cars: { dodgeT: number, conflict: boolean }) {
  let { dodgeT, conflict } = cars;
  // ---- OBSTACLES (requirement: AI need to see tyres and cones as obstacles — although optional
  // ones haha — but try and avoid them on rally stages / tracks): ctx.obstacles = loose objects
  // near this car ({ x, y, r }, main.ts). One in my path ahead, on the road ->
  // step round it on the side with room; no room -> drive through (optional). Cars come first:
  // only when no car is in the way. A more
  // precise driver sees it further ahead.
  if (!conflict) {
    const around = obstacleStep(drv, car, ctx, path, nearIdx, idx, speed, prec, lineOff, myLat,
        latLim, latT, dt);
    if (around !== null) {
      conflict = true;
      dodgeT = around;
    }
  }
  return { dodgeT, conflict };
}
