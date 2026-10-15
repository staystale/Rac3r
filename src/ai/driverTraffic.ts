// ai/driverTraffic.ts: the circuit driver's reading of traffic and obstacles: cars ahead,
// alongside and behind, and loose objects on the road. Functions take the driver context.
import { debugValue } from "../core/debug.ts";
import { GRAVITY } from "../cars.ts";
import { OBST_CLEAR, carGrip, profileOf } from "./line.ts";
import type { AiCar, CarsAcc, CarsEnv, DriveCtx } from "./types.ts";
import type { Drv, AiPath } from "./driverCtx.ts";

// MEASURED (aidrivecheck, HB on/off, Realish + Real, hatch + 4x4): Slidden / Knobhill / Castle Cum
// within 0.1 s, Sweaty Lamb +0.2..+0.7 s, 6 pulls per 2 min at Slidden, 4 at Sweaty Lamb — it is
// FLAVOUR (the user's "drift and stuff"), not pace. A heading-error trigger fired ~never. m past
// the usual edge allowed to get round a car / a slow or stopped one
const WIDE = +(debugValue("WIDE") ?? 0.8), WIDE_SLOW = 2.5;
// m more room alongside a car while easing from the grid lane onto the line
const START_GAP = 1.3;

/** Steps round a loose obstacle (cone, tyre) in the way; the dodge target, or null. */
export function obstacleStep(drv: Drv, car: AiCar, ctx: DriveCtx, path: AiPath, nearIdx: number,
    idx: (pos: number) => number, speed: number, prec: number, lineOff: number,
    myLat: number, latLim: number, latT: number, dt: number) {
  const { line, main, state } = drv;
  const pts = path.pts, cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  let dodge: number | null = null;
  const onLine = path === main ? lineOff : 0;
  // ---- OBSTACLES (user: "AI need to see tyres and cones as obstacles — although
  // optional ones haha — but try and avoid them
  // on rally stages / tracks"): ctx.obstacles = loose objects near this car ({ x, y, r },
  // main.js). One in my path ahead, on the road ->
  // step round it on the side with room; no room -> drive through (optional). Cars come first:
  // only when no car is in the way. A more
  // precise driver sees it further ahead.
  if (ctx.obstacles) {
    const reach = 6 + speed * (0.6 + 0.6 * prec); let best = null;
    for (const obstacle of ctx.obstacles) {
      const relX = obstacle.x - car.x, relY = obstacle.y - car.y,
          fwd = relX * cosH + relY * sinH;
      if (fwd < 2 || fwd > reach) continue;
      const lat = -relX * sinH + relY * cosH; if (Math.abs(lat) > 8) continue;
      const pos = idx(nearIdx + Math.round(fwd / path.sp)), pathPt = pts[pos], obstLat = (
          obstacle.x - pathPt.x) * -Math.sin(pathPt.h) + (obstacle.y - pathPt.y) * Math.cos(
          pathPt.h);
      // off the road: not in the way
      if (Math.abs(onLine + obstLat) > (path === main ? line.hw + 0.5 : 6)) continue;
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
  const { traits, state } = drv;
  const { car, path, idx, speed, prec, prof, lineOff, latT, latLim, myLat, clear, gapF } = env;
  acc.conflict = true;
  // GO ROUND, DON'T QUEUE (user: "AI still seem to almost queue and wait
  // rather than overtake and avoid blocking cars,
  // even if it's slightly off track"): the room to pass may use WIDE m past the usual edge
  // (wheels on the grass), WIDE_SLOW for a
  // car that is much slower or stopped (spun, beached); once a side is chosen it no longer
  // matches the car ahead's speed unless
  // still overlapping it close up. (Was: room inside the edge only, and it slowed to
  // follow whenever within gapF + 4 m even with a
  // side chosen. The room test also subtracted latT — wrong whenever the driver was
  // wandering.)
  const slowBlock = vAlong < Math.min(0.7 * speed, speed - 4) || vAlong < 6;
  const wide = latLim + (slowBlock ? WIDE_SLOW : WIDE);
  const cands = [otherLat + clear, otherLat - clear].filter(
      (cand) => Math.abs(lineOff + cand) <= wide).sort(
      (first, second) => Math.abs(first - myLat) - Math.abs(second - myLat));
  if (cands.length && fwd > 3) {
    acc.dodgeT = cands[0] - latT;
    if (Math.abs(lineOff + cands[0]) > latLim) {
      state.wide = wide;
      state.wideUntil = state.t + 1.2;
    }
  }
  if (!cands.length || (fwd < gapF && Math.abs(otherLat - myLat) < 1.6)) {
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
    acc.followCap = Math.min(acc.followCap, capF);
  }
}

/** A car alongside (or just behind): remember its place and keep a gap from it. */
export function alongsideCar(drv: Drv, acc: CarsAcc, env: CarsEnv, fwd: number, otherLat: number) {
  const { latT, startK, myLat } = env;
  if (fwd > -2.5) acc.side = acc.side || Math.sign(otherLat - myLat);
  acc.alg.push(otherLat);
  const gapA = 2.4 + START_GAP * startK;
  if (Math.abs(otherLat - myLat) < gapA) {
    acc.conflict = true;
    acc.dodgeT = myLat + Math.sign(myLat - otherLat || 1) * (
        gapA - Math.abs(otherLat - myLat)) - latT;
  }
}

/** Notes the nearest car ahead (lead) and the nearest faster one close behind (threat). */
export function noteLeadThreat(drv: Drv, acc: CarsAcc, env: CarsEnv, other: AiCar, fwd: number,
    otherLat: number, vAlong: number) {
  const { speed, myLat, clear } = env;
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
  if (fwd > 2.5 && fwd < 5 && Math.abs(otherLat - env.myLat) < 1.5) acc.followCap = Math.min(
      acc.followCap, vAlong + 0.5);
  if (fwd < 4.5 && fwd > -4.5) acc.alg.push(otherLat);
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
  const acc: CarsAcc = {
    dodgeT: 0, followCap: Infinity, conflict: false, lead: null, threat: null, side: 0, alg: []
  };
  for (const other of others) {
    const relX = other.x - car.x, relY = other.y - car.y, fwd = relX * cosH + relY * sinH,
        lat = -relX * sinH + relY * cosH;
    if (fwd < -15 || fwd > 8 + speed * 1.1 || Math.abs(lat) > 8) continue;
    // its lateral place relative to MY path
    const closeIdx = closestPathIdx(drv, env, other, fwd);
    const point = path.pts[closeIdx], otherLat = (other.x - point.x) * -Math.sin(point.h) + (
        other.y - point.y) * Math.cos(point.h);
    const vAlong = other.vx * cosH + other.vy * sinH;
    noteLeadThreat(drv, acc, env, other, fwd, otherLat, vAlong);
    if (state.atk && other === state.atk.car) {
      attackedCar(drv, acc, env, fwd, otherLat, vAlong);
      continue;
    }
    if (fwd > 2.5) {
      // FOLLOWING only while closing, with a short gap: it rubs and bumps in braking zones
      // (aifieldcheck: ~6 s of contact per 3 laps of 6 cars at Realish). USER (after
      // testing it): "contact is ok … it felt ok before, put it back" — a strict speed-based gap
      // (zero contact, but a procession: 1 position change in 3 laps) was tried and REVERTED.
      if (speed - vAlong > -0.5 && Math.abs(otherLat - myLat) < clear) {
        followAhead(drv, acc, env, fwd, otherLat, vAlong, closeIdx);
      }
    } else if (fwd > -4) {
      alongsideCar(drv, acc, env, fwd, otherLat);
    } else if (!acc.conflict && traits.defence > 0.5 && vAlong > speed + 0.5 && fwd > -14) {
      acc.dodgeT = Math.max(-1.2, Math.min(1.2, (otherLat - latT) * 0.5)) * traits.defence;
    }
  }
  return acc;
}

/** OBSTACLES: the way round a loose object, when no car is in the way. */
export function obstacleAvoid(drv: Drv, car: AiCar, ctx: DriveCtx, path: AiPath, nearIdx: number,
    idx: (pos: number) => number, speed: number, prec: number, lineOff: number, myLat: number,
    latLim: number, latT: number, dt: number, cars: { dodgeT: number, conflict: boolean }) {
  let { dodgeT, conflict } = cars;
  // ---- OBSTACLES (user: "AI need to see tyres and cones as obstacles — although
  // optional ones haha — but try and avoid them
  // on rally stages / tracks"): ctx.obstacles = loose objects near this car ({ x, y, r },
  // main.js). One in my path ahead, on the road ->
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
