// ai/trafficFuel.ts - TRAFFIC AT THE PETROL STATIONS (owner 11-11: "Can traffic
// use petrol stations"): now and then (STOP_SHARE of the passes) a car of our way in the nearside
// lane coming up to a roadside station (highway/stations.ts: a lay-by's, Deaf Valley's LAST GASP;
// not a services' - it is off its side road) indicates left, slows and pulls onto the forecourt,
// stops beside the pumps (PUMP_S), then pulls out - indicating right, once the nearside lane is
// clear behind it - and drives on; now and then a car put back ahead is one already at the pumps.
// It is a car with an issue that is not broken (ai/trafficBreak.ts: its TrafficBroke, its
// roadside road, PARKED, roadsideFree): its stop is a place, not wherever it slows to a halt.
import { roadFrame, roadPose, roadSpan } from '../highway.ts';
import { reset } from '../vehicle.ts';
import { geo } from './trafficCtx.ts';
import type { TrafficCtx } from './trafficCtx.ts';
import type { DriveEnv } from './trafficLane.ts';
import { carryKinematic, drivePhysics } from './trafficPhys.ts';
import { cruise, setSpeed } from './trafficSpawn.ts';
import { PARKED, roadsideFree } from './trafficBreak.ts';
import type { TrafficCar, TrafficEnt } from './types.ts';

// the share of a nearside car's passes of a station it stops at (MEASURED, _police.mjs PART=
// traffic4: ~5 rolls a km - at 5 % none stopped in 16); of the cars put back ahead by one, the
// share already at its pumps
const STOP_SHARE = 0.15, AT_PUMP_SHARE = 0.25;
// s at the pumps, the least and the most
const PUMP_S = [10, 20];
// m ahead of a car a station is chosen, the nearest and the furthest (time to slow)
const CHOOSE_M = [70, 170];
// m toward the road from the station's middle it stops: level with the pumps along the canopy's
// road-side edge, clear of its posts on the way in and out and half seen (under the canopy a car
// is hidden - PHOTOGRAPHED: at 2.6 m in, beside the island, it was out of sight; world/
// desertjunk.ts GAS_CANOPY 8 m deep round 1 m in, GAS_POSTS 4 m in); m past its edge a roadside
// station's middle can be (a lay-by's at 10 m, Deaf Valley's apron 10 m; a services' is further)
const PUMP_IN_M = 5.2, ROADSIDE_M = 14;
// m before the station's middle the forecourt begins (its lay-by's flat half + taper: highway/
// laybys.ts STATION_FLAT_M / 2 + STATION_TAPER_M), and before it the car is all the way across
const TAPER_M = 37, ACROSS_M = 10;
// m/s it comes onto the forecourt at; m/s^2 it slows at on the road and brakes at to the pump;
// m/s^2 it pulls away at
const IN_MS = 8, SLOW_MS2 = 2.5, STOP_MS2 = 3, AWAY_MS2 = 2;
// m of the nearside lane behind it (and ahead) that must be clear for it to pull out
const CLEAR_BEHIND_M = 70, CLEAR_AHEAD_M = 20, CLEAR_ACROSS_M = 2.4;

/** The roadside stations on our side: each one's middle's road s and its offset, m. */
interface Station { s: number; off: number }
// the stations by road (the props seen last), and the road's end then (a new stretch: looked again)
const STATIONS = new WeakMap<object, { end: number; list: Station[] }>();

/**
 * The roadside stations on our side of the road loaded now (looked for again as the road grows).
 * @param ctx the traffic
 * @returns their middles (s, off), m
 */
function stationsOf(ctx: TrafficCtx): Station[] {
  const level = ctx.level!, end = roadSpan(level).s1;
  let known = STATIONS.get(level);
  if (known && known.end === end) return known.list;
  const half = geo(ctx).hw, list: Station[] = [];
  for (const prop of level.props) {
    if (prop.kind !== 'gasstation' || prop._s == null) continue;
    const frame = roadFrame(level, prop.x, prop.y, prop._s);
    if (frame && frame.off < 0 && -frame.off < half + ROADSIDE_M)
      list.push({ s: frame.s, off: frame.off });
  }
  STATIONS.set(level, known = { end, list });
  return known.list;
}

/**
 * Whether a car may pull in for fuel: our way's, cruising in the nearside lane, not a speeder, a
 * police car, broken down or wrecked.
 * @param slot the car
 * @returns it may
 */
const mayRefuel = (slot: TrafficCar) => !slot.broke && !slot.racer && !slot.police && !slot.wreck
  && (slot.dir ?? 1) > 0 && slot.lane === 0 && slot.laneT === 0;

/**
 * Now and then a nearside car coming up to a roadside station pulls in for fuel (one roll a
 * station, its pumps free).
 * @param ctx the traffic
 * @param slot the car
 * @param env the step's road
 */
export function mayStopForFuel(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv) {
  if (!mayRefuel(slot)) return;
  const station = stationsOf(ctx).find((each) => each.s - slot.s > CHOOSE_M[0]
    && each.s - slot.s < CHOOSE_M[1]);
  if (!station || station.s === slot.stationAt) return;
  slot.stationAt = station.s;
  const stopOff = station.off + PUMP_IN_M;
  if (ctx.rnd() >= STOP_SHARE || !roadsideFree(env.ents, station.s, stopOff)) return;
  slot.broke = { stopOff, v: slot.vAl, off: slot.off, stopped: false, at: station.s,
    wait: PUMP_S[0] + ctx.rnd() * (PUMP_S[1] - PUMP_S[0]), out: false };
}

/**
 * A car just put back ahead by a roadside station, now and then (AT_PUMP_SHARE) put at its pumps,
 * stopped.
 * @param ctx the traffic
 * @param slot the car
 * @param ents everyone on the road
 * @returns put there
 */
export function mayPlaceAtPump(ctx: TrafficCtx, slot: TrafficCar, ents: TrafficEnt[]): boolean {
  const station = stationsOf(ctx).find((each) => Math.abs(each.s - slot.s) < CHOOSE_M[1]);
  if (!station || ctx.rnd() >= AT_PUMP_SHARE) return false;
  const stopOff = station.off + PUMP_IN_M;
  if (!roadsideFree(ents, station.s, stopOff)) return false;
  const pose = roadPose(ctx.level!, station.s, stopOff);
  reset(slot.car, pose.x, pose.y, pose.h);
  setSpeed(slot, 0);
  Object.assign(slot, { lane: 0, laneT: 0, laneOff: stopOff, s: station.s, off: stopOff,
    kOff: stopOff, stationAt: station.s, broke: { stopOff, v: 0, off: stopOff, stopped: true,
      at: station.s, wait: PUMP_S[0] + ctx.rnd() * (PUMP_S[1] - PUMP_S[0]), out: false } });
  return true;
}

/**
 * Whether the nearside lane is clear for a car pulling out: no one in it from CLEAR_BEHIND_M
 * behind to CLEAR_AHEAD_M ahead.
 * @param slot the car
 * @param env the step's road
 * @returns clear
 */
const laneFree = (slot: TrafficCar, env: DriveEnv) => !env.ents.some((ent) => ent.car !== slot.car
  && Math.abs(ent.off - env.centres[0]) < CLEAR_ACROSS_M && ent.s - slot.s > -CLEAR_BEHIND_M
  && ent.s - slot.s < CLEAR_AHEAD_M);

/**
 * A share 0..1 eased (smoothstep).
 * @param share the share
 * @returns eased
 */
const eased = (share: number) => {
  const clamped = Math.max(0, Math.min(1, share));
  return clamped * clamped * (3 - 2 * clamped);
};

/**
 * A fuel stop's offset and speed for the step: in - slowing to IN_MS by the forecourt, eased across
 * it, braking to the pump; at the pump - waiting, then out once the lane is clear; out - pulling
 * away, eased back across into the nearside lane, done there.
 * @param slot the car (its broke: the stop)
 * @param env the step's road
 * @returns true when it is back in the lane (the stop over)
 */
function stepStop(slot: TrafficCar, env: DriveEnv): boolean {
  const stop = slot.broke!, toGo = stop.at! - slot.s, lane = env.centres[0];
  if (stop.out) {
    const share = eased((-toGo - ACROSS_M) / (TAPER_M - ACROSS_M));
    stop.off = stop.stopOff + (lane - stop.stopOff) * share;
    stop.v = Math.min(slot.vWant, stop.v + AWAY_MS2 * env.dt);
    return share >= 1;
  }
  if (stop.stopped) {
    stop.v = 0;
    stop.wait = (stop.wait ?? 0) - env.dt;
    if (stop.wait <= 0 && laneFree(slot, env)) {
      stop.out = true;
      stop.stopped = false;
    }
    return false;
  }
  stop.off = lane + (stop.stopOff - lane) * eased((TAPER_M - toGo) / (TAPER_M - ACROSS_M));
  const cap = toGo > TAPER_M ? Math.sqrt(IN_MS * IN_MS + 2 * SLOW_MS2 * (toGo - TAPER_M))
    : Math.min(IN_MS, Math.sqrt(2 * STOP_MS2 * Math.max(0, toGo)));
  stop.v = Math.min(stop.v, cap);
  stop.stopped = toGo < 1.5 && slot.vAl < 0.5;
  return false;
}

/**
 * A car stopping for fuel, this step: its stop's offset and speed (stepStop), driven or carried
 * along them on its road reaching the forecourt; its left indicator on going in, its right going
 * out, none at the pump (parked, no brake lights, no hazards: it is not broken). Back in the lane,
 * it is traffic again.
 * @param ctx the traffic
 * @param slot the car
 * @param env the step's road
 * @param speed its speed, m/s
 */
export function driveFuelStop(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv, speed: number) {
  const stop = slot.broke!, done = stepStop(slot, env);
  slot.laneOff = stop.off;
  slot.laneT = slot.lane;
  slot.bias = 0;
  const forecourt = { ...env, minOff: Math.min(env.minOff, stop.stopOff) };
  if (!slot.phys) {
    // (carried: on the stop's own eased line - the carried drift is a lane change's, too slow)
    slot.kOff = stop.off;
    carryKinematic(ctx, slot, forecourt, stop.v, 0);
  } else drivePhysics(ctx, slot, forecourt, speed, stop.v, 0, stop.stopped ? PARKED : undefined);
  const car = slot.car;
  car.indicator = stop.stopped ? 0 : stop.out ? 1 : -1;
  car.hazard = slot.wreck;
  if (stop.stopped) car.brakeLight = 0;
  if (!done) return;
  slot.broke = null;
  slot.laneOff = env.centres[0];
  slot.vWant = slot.quick ? slot.vWant : cruise(ctx, 0, env.laneCount);
  car.indicator = 0;
}
