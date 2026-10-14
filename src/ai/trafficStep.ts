// ai/trafficStep.ts: one physics step of the highway traffic: everyone in road coordinates,
// recycling the cars that are out of view, the physics / kinematic choice, and driving each car.
import { roadFrame, roadSpan } from "../highway.js";
import { rolling } from "../roll.js";
import type { AiCar, TrafficCar, TrafficEnt } from "./types.ts";
import {
  HARD_BEHIND, PHYS_NEAR, RECYCLE_AHEAD, RECYCLE_BEHIND, geo,
} from "./trafficCtx.ts";
import type { TrafficCtx, VisFn } from "./trafficCtx.ts";
import { driveOne } from "./trafficDrive.ts";
import { cruise, fresh, rebuildCars, spot } from "./trafficSpawn.ts";

/** The inputs of a step: you, the AI cars and the renderer's screen test. */
export interface StepArgs {
  player: AiCar;
  others?: AiCar[];
  visible?: VisFn;
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
    slot.vAl = slot.car.vx * frame.dx + slot.car.vy * frame.dy;
    ents.push({ car: slot.car, s: slot.s, off: slot.off, v: slot.vAl, t: slot });
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

/** RECYCLE (out of view only) + place the parked slots; true if the live cars changed. */
function recycle(ctx: TrafficCtx, ents: TrafficEnt[], playerS: number, vis: VisFn) {
  const { s0: roadStart, s1: roadEnd } = roadSpan(ctx.level), laneCount = geo(ctx).centres.length;
  let changed = false;
  const drop = (slot: TrafficCar) => {
    const i = ents.findIndex((ent) => ent.t === slot);
    if (i >= 0) ents.splice(i, 1);
  };
  const join = (slot: TrafficCar, place: { s: number; lane: number }) => {
    fresh(ctx, slot, place.s, place.lane, cruise(ctx, place.lane, laneCount));
    ents.push({ car: slot.car, s: slot.s, off: slot.off, v: slot.vAl, t: slot });
    changed = true;
  };
  for (const slot of ctx.list) {
    if (slot.parked) {
      const place = spot(ctx, ents, playerS, 'ahead', vis);
      if (place) {
        join(slot, place);
        ctx.placed++;
      }
      continue;
    }
    const relS = slot.s - playerS, seen = vis(slot.car.x, slot.car.y, slot.s);
    const away = !seen && (relS < -RECYCLE_BEHIND || relS > RECYCLE_AHEAD || slot.deadT > 6);
    // about to fall off the road window: must go, seen or not
    const forced = relS < -HARD_BEHIND || slot.s < roadStart + 30 || slot.s > roadEnd - 30;
    if (!away && !forced) continue;
    if (forced && seen) ctx.visHits++;
    drop(slot);
    const place = spot(ctx, ents, playerS, relS > 0 ? 'behind' : 'ahead', vis);
    if (place) {
      join(slot, place);
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
  const reals = ents.filter((ent) => ent.you);
  for (const slot of ctx.list) {
    if (slot.parked) continue;
    slot.phys = slot.wreck || rolling(slot.car)
      || slot.car.dmg && slot.car.dmg.some((part) => part > 0.02)
      || reals.some((ent) => (
        Math.abs(ent.s - slot.s) < PHYS_NEAR && Math.abs(ent.off - slot.off) < 14
      ));
  }
}

/**
 * One physics step. player = your car; others = the AI cars; vis(x, y, s) = on screen right
 * now (main.js: the renderer's view).
 */
export function stepTraffic(ctx: TrafficCtx, dt: number, args: StepArgs) {
  const level = ctx.level;
  if (!ctx.list.length || !level || !level._hw || !level._hw.q) return;
  const playerS = level._hw.q.s, geom = geo(ctx), centres = geom.centres;
  const vis = args.visible || ((x, y, dist) => dist - playerS > -90 && dist - playerS < 270);
  const minOff = -geom.hw + level._cfg.shoulder + 1.0, maxOff = geom.hw - 1.0;
  const ents = collectEnts(ctx, args);
  let changed = recycle(ctx, ents, playerS, vis);
  if (changed) {
    rebuildCars(ctx);
    changed = false;
  }
  assignPhys(ctx, ents);
  const env = { dt, ents, centres, laneCount: centres.length, minOff, maxOff };
  for (const slot of ctx.list)
    if (!slot.parked) driveOne(ctx, slot, env);
  // one broken car never stops the game
  for (const slot of ctx.list)
    if (!slot.parked && !Number.isFinite(slot.car.x + slot.car.y + slot.car.vx + slot.car.vy)) {
      slot.parked = true;
      changed = true;
    }
  if (changed) rebuildCars(ctx);
}
