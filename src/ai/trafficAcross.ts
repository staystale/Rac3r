// ai/trafficAcross.ts: a highway traffic car moving across lanes (indicate, drift over, abort)
// and leaning away from you inside its lane.
import { LAT_V } from "./trafficCtx.ts";
import type { TrafficCtx } from "./trafficCtx.ts";
import type { DriveEnv } from "./trafficLane.ts";
import { cruise } from "./trafficSpawn.ts";
import type { TrafficCar } from "./types.ts";

/**
 * ABORT while crossing: anything alongside (or closing fast from behind) on the side I am
 * moving to -> back to where I came from.
 */
function abortCross(slot: TrafficCar, env: DriveEnv) {
  const car = slot.car, centres = env.centres;
  for (const ent of env.ents) {
    if (ent.car === car) continue;
    const ahead = ent.s - slot.s, lat = ent.off - slot.laneOff;
    if (Math.sign(lat) !== Math.sign(centres[slot.laneT] - slot.laneOff)
      || Math.abs(lat) > 2.7) continue;
    if (ahead < car.spec.len + 3
      && ahead > -(car.spec.len + 3 + Math.max(0, ent.v - slot.vAl) * 1.5)) {
      const back = slot.lane;
      slot.lane = slot.laneT;
      slot.laneT = back;
      slot.ind = Math.sign(centres[back] - slot.laneOff);
      break;
    }
  }
}

/**
 * ACROSS: indicate, then drift over at LAT_V. car._trOff = the lane centre it is going
 * to (null = keeping its lane): read by the highway racers (highwayrace.js) so they plan
 * with where a car WILL be - an indicating car is a car about to be in that lane
 */
export function crossLanes(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv) {
  const car = slot.car, centres = env.centres, dt = env.dt;
  car._trOff = slot.laneT !== slot.lane ? centres[slot.laneT] : null;
  if (slot.laneT === slot.lane) return;
  if (slot.indT <= 0) abortCross(slot, env);
  if (slot.indT > 0) slot.indT -= dt;
  else {
    const goal = centres[slot.laneT], diff = goal - slot.laneOff, latStep = LAT_V * dt;
    slot.laneOff = Math.abs(diff) <= latStep ? goal : slot.laneOff + Math.sign(diff) * latStep;
    if (slot.laneOff === goal) {
      slot.lane = slot.laneT;
      slot.ind = 0;
      slot.keepLeftT = 0;
      slot.vWant = cruise(ctx, slot.lane, env.laneCount);
    }
  }
}

/** GENTLY AVOID you / the AI alongside: lean away inside the lane, up to 0.8 m. */
export function leanAway(slot: TrafficCar, env: DriveEnv) {
  let bias = 0;
  for (const ent of env.ents) {
    if (!ent.you) continue;
    const ahead = ent.s - slot.s, lat = ent.off - slot.off;
    if (Math.abs(ahead) < 7 && Math.abs(lat) < 3.0)
      bias -= Math.sign(lat || 1) * Math.min(0.8, (3.0 - Math.abs(lat)) * 0.5);
  }
  bias = Math.max(-0.8, Math.min(0.8, bias));
  slot.bias += Math.max(-1.2 * env.dt, Math.min(1.2 * env.dt, bias - slot.bias));
}
