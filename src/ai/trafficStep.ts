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
import { cruise, dirOf, fresh, lanesOf, rebuildCars, spot } from "./trafficSpawn.ts";
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
  span: { s0: number; s1: number }) {
  return {
    away: !seen && (relS < -RECYCLE_BEHIND || relS > RECYCLE_AHEAD || slot.deadT > 6),
    forced: relS < -HARD_BEHIND || slot.s < span.s0 + 30 || slot.s > span.s1 - 30,
  };
}

/** RECYCLE (out of view only) + place the parked slots; true if the live cars changed. */
function recycle(ctx: TrafficCtx, ents: TrafficEnt[], playerS: number, vis: VisFn,
  held = false) {
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
        ctx.placed++;
      }
      continue;
    }
    const relS = slot.s - playerS, seen = vis(slot.car.x, slot.car.y, slot.s);
    const { away, forced } = leaving(slot, relS, seen, span);
    if (!away && !forced) continue;
    if (forced && seen) ctx.visHits++;
    drop(slot);
    // (the other way's traffic always comes from ahead)
    const from = relS > 0 && dir > 0 ? 'behind' : 'ahead';
    const place = spot(ctx, ents, playerS, from, vis, dir);
    if (place) {
      join(slot, place, dir);
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
 * One physics step. player = your car; others = the AI cars; vis(x, y, s) = on screen right
 * now (main.ts: the renderer's view).
 */
export function stepTraffic(ctx: TrafficCtx, dt: number, args: StepArgs) {
  const level = ctx.level;
  if (!ctx.list.length || !level || !level._hw || !level._hw.q) return;
  const playerS = level._hw.q.s;
  const vis = args.visible || ((x, y, dist) => dist - playerS > -90 && dist - playerS < 270);
  const ents = collectEnts(ctx, args);
  let changed = recycle(ctx, ents, playerS, vis, args.held);
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
