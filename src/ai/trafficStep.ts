// ai/trafficStep.ts: one physics step of the highway traffic: everyone in road coordinates,
// recycling the cars that are out of view, the physics / kinematic choice, and driving each car.
import { roadFrame, roadSpan } from "../highway.ts";
import { rolling } from "../roll.ts";
import type { AiCar, TrafficCar, TrafficEnt } from "./types.ts";
import {
  HARD_BEHIND, PHYS_NEAR, RECYCLE_AHEAD, RECYCLE_BEHIND, geo,
} from "./trafficCtx.ts";
import type { TrafficCtx, VisFn } from "./trafficCtx.ts";
import { driveOne } from "./trafficDrive.ts";
import { cruise, dirOf, fresh, lanesOf, rebuildCars, setSpeed, spot } from "./trafficSpawn.ts";
import { applyKind, dealKind, kindSpeed } from "./trafficKinds.ts";
import type { Kind } from "./trafficKinds.ts";
import { mayPlaceBroken } from "./trafficBreak.ts";
import type { DriveEnv } from "./trafficLane.ts";
import { holdsOncoming } from "./trafficReset.ts";

/** The inputs of a step: you, the AI cars and the renderer's screen test. */
export interface StepArgs {
  player: AiCar;
  others?: AiCar[];
  visible?: VisFn;
  held?: boolean;   // the race not started yet (a single carriageway's other way waits)
}

/** Everyone in road coordinates: s along, off sideways (+ = right), v along the road. */
function collectEnts(ctx: TrafficCtx, args: StepArgs) {
  const level = ctx.level!, playerQ = level._hw.q!, player = args.player;
  const ents: TrafficEnt[] = [];
  for (const slot of ctx.list) {
    if (slot.parked) continue;
    const frame = roadFrame(level, slot.car.x, slot.car.y, slot.s);
    if (!frame) continue;
    slot.s = frame.s;
    slot.off = frame.off;
    // (vAl: its speed its own way; an entry's v: along the road, the other way's negative)
    const dir = dirOf(slot);
    slot.vAl = dir * (slot.car.vx * frame.dx + slot.car.vy * frame.dy);
    ents.push({ car: slot.car, s: slot.s, off: slot.off, v: dir * slot.vAl, t: slot });
  }
  ents.push({
    car: player, s: playerQ.s, off: playerQ.off,
    v: player.vx * playerQ.dx + player.vy * playerQ.dy, you: true,
  });
  for (const other of args.others || []) {
    const frame = roadFrame(level, other.x, other.y, other._hwS);
    if (!frame) continue;
    other._hwS = frame.s;
    ents.push({
      car: other, s: frame.s, off: frame.off,
      v: other.vx * frame.dx + other.vy * frame.dy, you: true,
    });
  }
  return ents;
}

/**
 * Whether a live car leaves: out of view and far behind / ahead or stopped long, or - seen or
 * not - about to fall off the road window.
 * @param slot the car
 * @param relS its road distance from you, m
 * @param seen on screen
 * @param span the road window
 * @returns away (out of view), forced (must go)
 */
function leaving(slot: TrafficCar, relS: number, seen: boolean,
  span: { s0: number; s1: number }, youV: number) {
  // (one stopped at the roadside ahead waits there for you)
  const waits = !!slot.broke && relS > 0;
  return {
    away: !seen && ((relS < -RECYCLE_BEHIND && !catchingUp(slot, youV)) || relS > RECYCLE_AHEAD
      || pullingAway(slot, relS, youV) || (slot.deadT > 6 && !waits)),
    forced: relS < -HARD_BEHIND || slot.s < span.s0 + 30 || slot.s > span.s1 - 30,
  };
}

// m/s faster than you a car of your way behind you must be going to
// count as catching you up
const CATCH_MS = 1;

/**
 * Whether a car of your way behind you is catching you up - kept,
 * out of sight, until it comes past (MEASURED, tools/scratch/_trafficsides.mjs, you held at 90
 * km/h for 90 s: with every one out of sight behind put back at once, the faster drivers put back
 * behind went again the next step - 0 cars overtook you on a two-way road, 1 on the motorway).
 * @param slot the car
 * @param youV your speed along the road, m/s
 * @returns catching you up
 */
const catchingUp = (slot: TrafficCar, youV: number) => dirOf(slot) > 0
  && slot.vAl > youV + CATCH_MS;

// m ahead of you past which a car of your way pulling away (out of
// sight) is put back: past where one is put back ahead (ai/trafficSpawn.ts OWN_AHEAD, to 300 m)
const PULL_AWAY_M = 400;

/**
 * Whether a car of your way is out ahead past PULL_AWAY_M pulling
 * away from you - you will not see it again, so it is put back where you will (MEASURED, tools/
 * scratch/_trafficsides.mjs, you at ~100 km/h on the motorway for 120 s: kept until 520 m ahead,
 * the quicker drivers that came past were rarely dealt again - 2 of 11 at the end, 1 came past).
 * @param slot the car
 * @param relS its road distance from you, m
 * @param youV your speed along the road, m/s
 * @returns pulling away
 */
const pullingAway = (slot: TrafficCar, relS: number, youV: number) => dirOf(slot) > 0
  && relS > PULL_AWAY_M && slot.vAl > youV + CATCH_MS;

// m/s faster than you a car put back behind you goes at the least
// (it comes past)
const PASS_MS = 3;

/**
 * Where a recycled car comes back: the other way's always ahead; yours dealt its driver (ai/
 * trafficKinds.ts), from behind when it is faster than you, else ahead.
 * @param ctx the traffic
 * @param dir its way (+1 yours)
 * @param youV your speed along the road, m/s
 * @returns ahead / behind, and its driver
 */
function putBack(ctx: TrafficCtx, dir: number, youV: number) {
  if (dir < 0) return { from: 'ahead', kind: 'cruise' as Kind };
  const kind = dealKind(ctx, dir);
  return { from: kindSpeed(kind) > youV + CATCH_MS ? 'behind' : 'ahead', kind };
}

/**
 * A car just put back made its driver (ai/trafficKinds.ts), or (cruising, ahead) now and then
 * one stopped at the roadside; its road entry (the last) follows it.
 * @param ctx the traffic
 * @param slot the car
 * @param back how it comes back (putBack)
 * @param ents everyone on the road
 */
function dealPutBack(ctx: TrafficCtx, slot: TrafficCar,
  back: { from: string; kind: Kind }, ents: TrafficEnt[], youV = 0) {
  applyKind(ctx, slot, back.kind);
  // (one put back behind you comes past)
  if (back.from === 'behind' && dirOf(slot) > 0 && slot.vWant < youV + PASS_MS) {
    slot.vWant = youV + PASS_MS;
    slot.quick = true;
    setSpeed(slot, slot.vWant);
  }
  if (back.kind === 'cruise' && back.from === 'ahead' && dirOf(slot) > 0)
    mayPlaceBroken(ctx, slot, ents);
  const ent = ents[ents.length - 1];
  ent.off = slot.off;
  ent.v = dirOf(slot) * slot.vAl;
}

/** RECYCLE (out of view only) + place the parked slots; true if the live cars changed. */
function recycle(ctx: TrafficCtx, ents: TrafficEnt[], playerS: number, vis: VisFn,
  held = false, youV = 0) {
  const span = roadSpan(ctx.level!);
  // (a single carriageway's other way joins only once the race has started)
  const waits = (dir: number) => dir < 0 && held && holdsOncoming(ctx);
  let changed = false;
  const drop = (slot: TrafficCar) => {
    const i = ents.findIndex((ent) => ent.t === slot);
    if (i >= 0) ents.splice(i, 1);
  };
  const join = (slot: TrafficCar, place: { s: number; lane: number }, dir: number) => {
    fresh(ctx, slot, place.s, place.lane, cruise(ctx, place.lane, lanesOf(ctx, dir).length), dir);
    ents.push({ car: slot.car, s: slot.s, off: slot.off, v: dir * slot.vAl, t: slot });
    changed = true;
  };
  for (const slot of ctx.list) {
    const dir = dirOf(slot);
    if (slot.parked) {
      if (waits(dir)) continue;
      const place = spot(ctx, ents, playerS, 'ahead', vis, dir);
      if (place) {
        join(slot, place, dir);
        dealPutBack(ctx, slot, { from: 'ahead', kind: dealKind(ctx, dir) }, ents);
        ctx.placed++;
      }
      continue;
    }
    const relS = slot.s - playerS, seen = vis(slot.car.x, slot.car.y, slot.s);
    const { away, forced } = leaving(slot, relS, seen, span, youV);
    if (!away && !forced) continue;
    if (forced && seen) ctx.visHits++;
    drop(slot);
    // (the other way's traffic always comes from ahead; yours dealt its driver, from behind when
    // it is faster than you; now and then one stopped ahead)
    const back = putBack(ctx, dir, youV);
    const place = spot(ctx, ents, playerS, back.from, vis, dir);
    if (place) {
      join(slot, place, dir);
      dealPutBack(ctx, slot, back, ents, youV);
      ctx.recycled++;
    } else {
      slot.parked = true;
      changed = true;
    }
  }
  return changed;
}

/**
 * Physics or kinematic (LOD, driveOne): within PHYS_NEAR of a real car, wrecked or
 * tumbling = physics. Being IN VIEW does not need it — a kinematic car on its lane line
 * looks the same; only something that can TOUCH it needs real physics.
 */
function assignPhys(ctx: TrafficCtx, ents: TrafficEnt[]) {
  const reals = ents.filter((ent) => ent.you), median = geo(ctx).median;
  // (a real car the far side of the central reservation's barrier cannot touch it)
  const sameSide = (off: number, other: number) => median == null
    || Math.sign(off - median) === Math.sign(other - median);
  for (const slot of ctx.list) {
    if (slot.parked) continue;
    slot.phys = slot.wreck || rolling(slot.car)
      || slot.car.dmg && slot.car.dmg.some((part) => part > 0.02)
      || reals.some((ent) => (
        Math.abs(ent.s - slot.s) < PHYS_NEAR && Math.abs(ent.off - slot.off) < 14
        && sameSide(ent.off, slot.off)
      ));
  }
}

/**
 * What each way's cars drive on: its lanes and the offsets they keep inside - ours from inside
 * the hard shoulder to our carriageway's edge, the other way's beyond our side to
 * inside its own hard shoulder.
 * @param ctx the traffic
 * @param dt the step, s
 * @param ents everyone on the road
 * @returns our way's and the other way's
 */
function driveEnvs(ctx: TrafficCtx, dt: number, ents: TrafficEnt[]): [DriveEnv, DriveEnv] {
  const geom = geo(ctx), shoulder = ctx.level!._cfg.shoulder;
  const farEdge = geom.median == null ? geom.hw : geom.hw - shoulder;
  return [
    { dt, ents, centres: geom.own, laneCount: geom.own.length,
      minOff: -geom.hw + shoulder + 1.0, maxOff: geom.ownR - 1.0 },
    { dt, ents, centres: geom.oncoming, laneCount: geom.oncoming.length,
      minOff: geom.oppL + 1.0, maxOff: farEdge - 1.0 },
  ];
}

/**
 * Your speed along the road (the cars behind catching you up stay).
 * @param ents everyone on the road
 * @param player your car
 * @returns m/s
 */
const speedOf = (ents: TrafficEnt[], player: AiCar) => ents.find((ent) => ent.car === player)?.v
  ?? 0;

/**
 * One physics step. player = your car; others = the AI cars; vis(x, y, s) = on screen right
 * now (main.ts: the renderer's view).
 */
export function stepTraffic(ctx: TrafficCtx, dt: number, args: StepArgs) {
  const level = ctx.level;
  if (!ctx.list.length || !level || !level._hw || !level._hw.q) return;
  const playerS = level._hw.q.s;
  const vis = args.visible || ((x, y, dist) => dist - playerS > -90 && dist - playerS < 270);
  const ents = collectEnts(ctx, args);
  let changed = recycle(ctx, ents, playerS, vis, args.held, speedOf(ents, args.player));
  if (changed) {
    rebuildCars(ctx);
    changed = false;
  }
  assignPhys(ctx, ents);
  const [env, otherEnv] = driveEnvs(ctx, dt, ents);
  for (const slot of ctx.list)
    if (!slot.parked) driveOne(ctx, slot, dirOf(slot) < 0 ? otherEnv : env);
  // one broken car never stops the game
  for (const slot of ctx.list)
    if (!slot.parked && !Number.isFinite(slot.car.x + slot.car.y + slot.car.vx + slot.car.vy)) {
      slot.parked = true;
      changed = true;
    }
  if (changed) rebuildCars(ctx);
}
