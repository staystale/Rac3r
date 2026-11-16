// ai/trafficTrips.ts - THE TRAFFIC'S TRIPS OFF AND ONTO THE ROAD (TODO 3a2 item 15, ?hwtrips=1).
// The owner's rates, as MEASURED (tools/scratch/_hwtrips.mjs): 2 in 12 of our way's cars passing a
// slip road leave by it; 5 in 40 passing a fuel station pull in; a cruising police car the same, a
// chasing one never; and cars join from the on-ramps. Each slip road and roadside station ahead is
// rolled for once a car (DECIDE_M ahead, in whatever lane it is in); a car going moves over to the
// nearside lane (ai/trafficLane.ts), then:
// - LEAVING: past the exit's signs it indicates left and follows the slip road's line (ai/
//   trafficPath.ts): a short or long slip to its gate (it stops short of it), a junction's
//   off-slip, round the roundabout and on along the bridge's road. Out of sight it is gone
//   (ai/trafficStep.ts puts it back as a new car). One that missed its slip (not in the nearside
//   lane in time) stays in that lane and leaves by the next one. The secret side road and a
//   services' road are not exits (they come back to the motorway): no car leaves by them.
// - FUEL: in reach of the station in the nearside lane, its pull-in (ai/trafficFuel.ts pullIn).
// - JOINING: now and then (JOIN_SHARE) a car put back ahead of you starts out of sight on an
//   on-ramp instead - a junction's on-slip, or the end of a side road / services' road - comes down
//   it, gives way to the nearside lane (it holds at the end if it must) and merges.
import { roadFrame, roadPose, roadSpan } from '../highway.ts';
import { reset } from '../vehicle.ts';
import { SLIP_WIDTH_M, curveBetween } from '../highway/junctions.ts';
import { RING_R, ringCentre } from '../highway/ringgeo.ts';
import { DECK_ROAD_HI, DECK_ROAD_LO } from '../world/crossinggeo.ts';
import { LANE_OFF_M } from './trafficBridge.ts';
import { GAP0, HEADWAY, geo } from './trafficCtx.ts';
import type { TrafficCtx, VisFn } from './trafficCtx.ts';
import { inPullInReach, pastPullIn, pullIn, stationsOf } from './trafficFuel.ts';
import type { Station } from './trafficFuel.ts';
import { findLead } from './trafficLane.ts';
import type { DriveEnv } from './trafficLane.ts';
import { drivePath, makePath } from './trafficPath.ts';
import type { TripPath } from './trafficPath.ts';
import { carryKinematic, drivePhysics } from './trafficPhys.ts';
import { setSpeed } from './trafficSpawn.ts';
import type { TrafficCar, TrafficEnt } from './types.ts';
import type { HwLevel } from '../highway/hwtypes.ts';
import type { Point, Prop } from '../world/types.ts';

/** A way off the road: where its slip starts (road s), its line, m it stops short of the end. */
interface Exit { s: number; pts: () => Point[]; stopShort: number }
/** A way onto the road: where it meets the road (road s), its line, the m/s a car starts at. */
interface Ramp { endS: number; pts: Point[]; startV: number }

/** A car's trip: leaving, for fuel or joining, and how far along it is. */
export interface TrafficTrip {
  kind: 'exit' | 'fuel' | 'join';
  // the road s it is for: the slip's start, the station's middle, the on-ramp's end
  at: number;
  exit?: Exit;
  station?: Station;
  // on its slip road / on-ramp: followed
  path?: TripPath | null;
  // joining: the nearside lane seen clear, it goes (no holding at the end)
  committed?: boolean;
  // joining, off the ramp: the road s it began to move across at and its offset then, m
  merge?: { s0: number; fromOff: number } | null;
}

// the rolls for the owner's rates: a car's chance to go for a slip road it nears, and for a
// roadside station - each above the rate itself, as a car put back out of sight before it gets
// there, or that misses a station, never counts (tools/scratch/_hwtrips.mjs measures the cars
// passing: leaving 2 in 12, pulling in 5 in 40); of our way's cars put back ahead of you with an
// on-ramp in reach, those that join from it (the owner's 2 in 12, so the road keeps its traffic)
const LEAVE_ROLL = 0.24, FUEL_ROLL = 0.36, JOIN_SHARE = 2 / 12;
// m ahead a slip / station is rolled for (from the outside lane of three: two lane changes of
// ~150 m each at 100 km/h); m ahead it must still be to be rolled for
const DECIDE_M = 500, ROLL_MIN_M = 40;
// m into the slip its line is met at, m before that the car starts across to it, and m past that
// start (still not in the nearside lane) it has missed the slip
const INTO_SLIP_M = 30, LEAD_M = 55, LATE_M = 15;
// m before the slip's start a car leaving indicates left (the exit's countdown boards)
const SIGNAL_M = 250;
// m before its slip / station a car not yet in the nearside lane eases off, and the share of its
// speed it holds then (a gap comes)
const EASE_M = 300, EASE_SHARE = 0.8;
// m short of its line's end a car leaving by a slip stops (its gate 3 m past the end)
const GATE_SHORT_M = 6;
// m along the bridge's road past a junction's roundabout a car leaving drives; radians a step
// round the roundabout
const RUN_M = 60, ARC_STEP = Math.PI / 16;
// m of a side road / services' road before its end a car joining starts on; points between its
// line's points (4 m apart)
const SIDE_JOIN_M = 220, SIDE_EVERY = 2;
// m/s a car joining starts at: off a roundabout, along a side road
const RING_START_MS = 8, SIDE_START_MS = 15;
// m of you an on-ramp's end must be ahead (inside where cars are kept), the least and the most;
// m ahead of you its start must be (one starting behind you is soon dropped behind); m clear of
// any car round its start for a car to be put there
const JOIN_AHEAD_M = [40, 480], START_AHEAD_M = 20, START_CLEAR_M = 14;
// joining: m short of the ramp's end it holds when the lane is not clear (the give-way); m before
// the end it looks; m along the road it moves across over
const GIVE_WAY_M = 12, COMMIT_M = 80, MERGE_M = 40;
// joining: clear means no car in the nearside lane, when it gets to the end, within AHEAD_CLEAR_M
// ahead / BEHIND_CLEAR_M behind, plus CLOSING_S of the speed between them
const AHEAD_CLEAR_M = 15, BEHIND_CLEAR_M = 15, CLOSING_S = 3;
// m from the nearside lane's line a car counts as in it
const IN_LANE_M = 2.4;

// the ways off and on found on the road loaded now (looked for again as the road changes: a prop
// or lane added or dropped, or every LOOK_AGAIN_M m it grows)
const LOOK_AGAIN_M = 200;
const FOUND = new WeakMap<object, { props: number; lanes: number; end: number; exits: Exit[];
  rings: Ramp[] }>();

/**
 * A roundabout's arc, turning left (the way the roads run) from one angle round to another.
 * @param centre its middle, world m
 * @param from the angle it comes in at, radians
 * @param toAngle the angle it leaves at, radians
 * @returns the arc's points after the first
 */
function ringArc(centre: Point, from: number, toAngle: number): Point[] {
  let end = toAngle;
  while (end <= from) end += 2 * Math.PI;
  const steps = Math.max(1, Math.ceil((end - from) / ARC_STEP)), pts: Point[] = [];
  for (let step = 1; step <= steps; step++) {
    const angle = from + (end - from) * (step / steps);
    pts.push([centre[0] + Math.cos(angle) * RING_R, centre[1] + Math.sin(angle) * RING_R]);
  }
  return pts;
}

/**
 * A junction exit's whole line: its off-slip, round the near roundabout to the bridge's road and
 * RUN_M along it, in the lane the bridge's own cars drive that way (ai/trafficBridge.ts).
 * @param slip the off-slip's line (ends where it meets the roundabout)
 * @param bridge the junction's bridge
 * @returns the points, world m
 */
function junctionExit(slip: Point[], bridge: Prop): Point[] {
  const centre = ringCentre(bridge, -1), entry = slip[slip.length - 1];
  const axisX = Math.cos(bridge.rot || 0), axisY = Math.sin(bridge.rot || 0);
  const from = Math.atan2(entry[1] - centre[1], entry[0] - centre[0]);
  const arc = ringArc(centre, from, Math.atan2(-axisY, -axisX));
  const out = Math.hypot(centre[0] - bridge.x, centre[1] - bridge.y) + RING_R + 3;
  const across = (DECK_ROAD_LO + DECK_ROAD_HI) / 2 - LANE_OFF_M;
  const spotAt = (along: number): Point => [bridge.x - axisX * along - axisY * across,
    bridge.y - axisY * along + axisX * across];
  return [...slip, ...arc, spotAt(out), spotAt(out + RUN_M)];
}

/**
 * The ways off and on along the road loaded now: the short and long slips' lines and the
 * junctions' off-slips (exits), the junctions' on-slips (ramps). (tools/scratch/_hwtrips.mjs
 * counts the cars passing them.)
 * @param level the highway level
 * @returns the exits and the ramps, each by road s
 */
export function waysOf(level: HwLevel): { exits: Exit[]; rings: Ramp[] } {
  const road = level._hw.pts, props = level.props.length, lanes = level.lanes.length;
  const end = Math.floor(road[road.length - 1].s / LOOK_AGAIN_M), known = FOUND.get(level);
  if (known && known.props === props && known.lanes === lanes && known.end === end) return known;
  const exits = slipExits(level), rings: Ramp[] = [];
  junctionWays(level, exits, rings);
  exits.sort((first, second) => first.s - second.s);
  const found = { props, lanes, end, exits, rings };
  FOUND.set(level, found);
  return found;
}

/**
 * The short and long slips' exits loaded now.
 * @param level the highway level
 * @returns the exits
 */
function slipExits(level: HwLevel): Exit[] {
  const exits: Exit[] = [];
  for (const prop of level.props) {
    if (prop.kind !== 'slip' || !prop.line || (prop.type !== 'short' && prop.type !== 'long'))
      continue;
    const line = prop.line, frame = roadFrame(level, line[0][0], line[0][1]);
    if (frame) exits.push({ s: frame.s, pts: () => line, stopShort: GATE_SHORT_M });
  }
  return exits;
}

/**
 * The junctions' slips loaded now (a lane of a junction slip's width): an off-slip (it starts on
 * the road) is an exit on round its roundabout, an on-slip (it ends on the road) a ramp.
 * @param level the highway level
 * @param exits the exits (added to)
 * @param rings the ramps (added to)
 */
function junctionWays(level: HwLevel, exits: Exit[], rings: Ramp[]) {
  const half = level._hw.geo.hw;
  const frameOf = (point: Point) => roadFrame(level, point[0], point[1]);
  const junctions = level.props.filter((prop) => prop.kind === 'bridge' && prop.rings);
  for (const lane of level.lanes) {
    if (lane.width !== SLIP_WIDTH_M || lane.pts.length < 2) continue;
    const first = frameOf(lane.pts[0]), last = frameOf(lane.pts[lane.pts.length - 1]);
    if (!first || !last) continue;
    if (Math.abs(first.off) <= half) {
      const end = lane.pts[lane.pts.length - 1], bridge = junctions.find((each) => {
        const centre = ringCentre(each, -1);
        return Math.hypot(centre[0] - end[0], centre[1] - end[1]) < RING_R + 1.5;
      });
      if (bridge) exits.push({ s: first.s, pts: () => junctionExit(lane.pts, bridge),
        stopShort: 0 });
    } else if (Math.abs(last.off) <= half) rings.push({ endS: last.s, pts: lane.pts,
      startV: RING_START_MS });
  }
}

/**
 * The side roads' and services' roads' ends loaded now (complete: the road on past them laid),
 * each as an on-ramp from SIDE_JOIN_M before its end.
 * @param level the highway level
 * @returns the ramps
 */
function sideRamps(level: HwLevel): Ramp[] {
  const road = level._hw.pts, ramps: Ramp[] = [];
  for (let i = 1; i < road.length - 1; i++) {
    if (road[i].sideOff == null || road[i + 1].sideOff != null) continue;
    const endS = road[i].s, pts: Point[] = [];
    let first = i;
    while (first > 0 && road[first - 1].sideOff != null && endS - road[first - 1].s <= SIDE_JOIN_M)
      first--;
    for (let j = first; j <= i; j += SIDE_EVERY) {
      const pose = roadPose(level, road[j].s, -road[j].sideOff!);
      pts.push([pose.x, pose.y]);
    }
    const end = roadPose(level, endS, -road[i].sideOff!);
    pts.push([end.x, end.y]);
    if (pts.length > 2) ramps.push({ endS, pts, startV: SIDE_START_MS });
  }
  return ramps;
}

/**
 * Every on-ramp loaded now: the junctions' on-slips and the side roads' / services' roads' ends.
 * @param level the highway level
 * @returns the ramps
 */
export const rampsOf = (level: HwLevel): Ramp[] => [...waysOf(level).rings, ...sideRamps(level)];

/**
 * Whether a car may take a trip: our way's, cruising - not broken down, wrecked, a speeder or a
 * police car in a chase (or an angry driver).
 * @param slot the car
 * @returns it may
 */
const mayTrip = (slot: TrafficCar) => !slot.broke && !slot.racer && !slot.wreck
  && (slot.dir ?? 1) > 0 && (!slot.police || (slot.police.mode === 'cruise'
    && !slot.police.angry));

/**
 * The first of a list (by road s) between ROLL_MIN_M and DECIDE_M ahead, not rolled for yet.
 * @param list the slips / stations, by road s
 * @param from the car's road s, m
 * @param rolled the one it rolled for last (its road s)
 * @returns it, or null
 */
function nextAhead<T extends { s: number }>(list: T[], from: number, rolled?: number): T | null {
  for (const each of list) {
    const ahead = each.s - from;
    if (each.s !== rolled && ahead > ROLL_MIN_M && ahead <= DECIDE_M) return each;
  }
  return null;
}

/**
 * The rolls for the next slip road or station ahead (the nearer first; one roll each).
 * @param ctx the traffic
 * @param slot the car
 */
function planTrip(ctx: TrafficCtx, slot: TrafficCar) {
  const exit = nextAhead(waysOf(ctx.level!).exits, slot.s, slot.slipAt);
  const station = nextAhead(stationsOf(ctx), slot.s, slot.stationAt);
  if (exit && (!station || exit.s <= station.s)) {
    slot.slipAt = exit.s;
    if (ctx.rnd() < LEAVE_ROLL) slot.trip = { kind: 'exit', at: exit.s, exit };
  } else if (station) {
    slot.stationAt = station.s;
    if (ctx.rnd() < FUEL_ROLL) slot.trip = { kind: 'fuel', at: station.s, station };
  }
}

/**
 * A car going for fuel: in reach of the station in the nearside lane, it pulls in (if the pumps
 * are free); past reach, it has missed it.
 * @param ctx the traffic
 * @param slot the car
 * @param env the step's road
 * @param station the station
 */
function goForFuel(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv, station: Station) {
  if (inPullInReach(slot, station) && slot.lane === 0 && slot.laneT === 0) {
    pullIn(ctx, slot, env, station);
    slot.trip = null;
  } else if (pastPullIn(slot, station)) slot.trip = null;
}

/**
 * A car that missed its slip goes for the next one ahead (none loaded yet: it looks again each
 * step), staying in the nearside lane till then.
 * @param ctx the traffic
 * @param slot the car
 * @param trip its trip
 */
function goForNextExit(ctx: TrafficCtx, slot: TrafficCar, trip: TrafficTrip) {
  const next = waysOf(ctx.level!).exits.find((each) => each.s - slot.s > ROLL_MIN_M);
  trip.exit = next;
  if (next) trip.at = next.s;
}

/**
 * A car leaving: in the nearside lane LEAD_M before the slip's line INTO_SLIP_M in, it takes the
 * slip - a curve from where it is onto that line, then the line. Too late, it has missed it and
 * goes for the next.
 * @param ctx the traffic
 * @param slot the car
 * @param trip its trip
 */
function goForExit(ctx: TrafficCtx, slot: TrafficCar, trip: TrafficTrip) {
  const exit = trip.exit;
  if (!exit) {
    goForNextExit(ctx, slot, trip);
    return;
  }
  const meetS = exit.s + INTO_SLIP_M;
  if (slot.s < meetS - LEAD_M) return;
  if (slot.s > meetS - LEAD_M + LATE_M) {
    goForNextExit(ctx, slot, trip);
    return;
  }
  if (slot.lane !== 0 || slot.laneT !== 0) return;
  const level = ctx.level!, pts = exit.pts();
  const meet = pts.findIndex((point) => (roadFrame(level, point[0], point[1], exit.s)?.s ?? 0)
    >= meetS);
  if (meet < 1 || meet > pts.length - 2) {
    slot.trip = null;
    return;
  }
  const car = slot.car, [meetX, meetY] = pts[meet], [nextX, nextY] = pts[meet + 1];
  const onward = Math.atan2(nextY - meetY, nextX - meetX);
  const curve = curveBetween([car.x, car.y], [Math.cos(car.heading), Math.sin(car.heading)],
    pts[meet], [Math.cos(onward), Math.sin(onward)]);
  slot.trip!.path = makePath([...curve, ...pts.slice(meet + 1)], exit.stopShort,
    Math.hypot(car.vx, car.vy));
}

/**
 * Whether the nearside lane will be clear where a joining car meets it, when it gets there.
 * @param slot the car
 * @param env the step's road
 * @param trip its trip (on its ramp)
 * @returns clear
 */
function laneClearAhead(slot: TrafficCar, env: DriveEnv, trip: TrafficTrip): boolean {
  const lane = env.centres[0], path = trip.path!, myV = Math.max(slot.vAl, RING_START_MS);
  const wait = Math.max(0, path.total - path.along) / myV;
  return !env.ents.some((ent) => {
    const moving = !!ent.t && ent.t.laneT === 0 && ent.t.lane !== 0;
    if (ent.car === slot.car || (Math.abs(ent.off - lane) > IN_LANE_M && !moving)) return false;
    const gap = ent.s + Math.max(0, ent.v) * wait - trip.at;
    return gap < AHEAD_CLEAR_M + Math.max(0, myV - ent.v) * CLOSING_S
      && gap > -(BEHIND_CLEAR_M + Math.max(0, ent.v - myV) * CLOSING_S);
  });
}

/**
 * A car on its slip road / on-ramp: followed; leaving, it indicates left onto it; joining, it
 * looks for the lane clear before the end (holding at the give-way if not), indicates right once
 * going, and off the ramp starts across.
 * @param ctx the traffic
 * @param slot the car
 * @param env the step's road
 * @param speed its speed, m/s
 * @param trip its trip
 */
function driveOnPath(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv, speed: number,
  trip: TrafficTrip) {
  const path = trip.path!;
  if (trip.kind === 'join' && !trip.committed && path.along >= path.total - COMMIT_M
    && laneClearAhead(slot, env, trip)) {
    trip.committed = true;
    path.stopShort = null;
  }
  const done = drivePath(ctx, slot, env, speed, path);
  slot.car.indicator = trip.kind === 'exit' ? (path.along < LEAD_M + INTO_SLIP_M ? -1 : 0)
    : trip.committed ? 1 : 0;
  if (trip.kind !== 'join' || !done || !trip.committed) return;
  trip.path = null;
  trip.merge = { s0: slot.s, fromOff: slot.off };
  Object.assign(slot, { lane: 0, laneT: 0, ind: 0, kOff: null });
}

/**
 * A joined car moving across into the nearside lane (eased over MERGE_M of road), at its cruise
 * behind any car ahead; once in, it is traffic again.
 * @param ctx the traffic
 * @param slot the car
 * @param env the step's road
 * @param speed its speed, m/s
 * @param merge where it began across
 */
function driveMerge(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv, speed: number,
  merge: { s0: number; fromOff: number }) {
  const lane = env.centres[0], share = Math.max(0, Math.min(1, (slot.s - merge.s0) / MERGE_M));
  const eased = share * share * (3 - 2 * share);
  const off = merge.fromOff + (lane - merge.fromOff) * eased;
  slot.laneOff = off;
  slot.bias = 0;
  const { lead, gap } = findLead(slot, env.ents);
  const vTarget = lead ? Math.min(slot.vWant, Math.max(0, (slot.dir ?? 1) * lead.v
    + (gap - GAP0 - HEADWAY * Math.max(0, slot.vAl)) * 0.4)) : slot.vWant;
  const across = { ...env, minOff: Math.min(env.minOff, off) };
  if (!slot.phys) {
    slot.kOff = off;
    carryKinematic(ctx, slot, across, vTarget, 0);
  } else drivePhysics(ctx, slot, across, speed, vTarget, 0);
  slot.car.indicator = share < 1 ? 1 : 0;
  if (share < 1) return;
  slot.trip = null;
  slot.laneOff = lane;
}

/**
 * A car's trip this step (?hwtrips=1): rolled for, moving over for it, taken.
 * @param ctx the traffic
 * @param slot the car
 * @param env the step's road
 * @param speed its speed, m/s
 * @returns true when the trip drove the car this step (on its slip / ramp, or moving across)
 */
export function driveTrip(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv,
  speed: number): boolean {
  const trip = slot.trip;
  if (!trip) {
    if (mayTrip(slot)) planTrip(ctx, slot);
    return false;
  }
  if (slot.broke || slot.wreck) {
    slot.trip = null;
    return false;
  }
  if (trip.merge) {
    driveMerge(ctx, slot, env, speed, trip.merge);
    return true;
  }
  if (!trip.path) {
    if (trip.kind === 'fuel') goForFuel(ctx, slot, env, trip.station!);
    else if (trip.kind === 'exit') goForExit(ctx, slot, trip);
    if (!slot.trip || !trip.path) return false;
  }
  driveOnPath(ctx, slot, env, speed, trip);
  return true;
}

/**
 * A car leaving, still on the road: its left indicator on from SIGNAL_M before the slip, once in
 * the nearside lane.
 * @param slot the car
 */
export function signalTrip(slot: TrafficCar) {
  const trip = slot.trip;
  if (trip && trip.kind === 'exit' && !trip.path && slot.lane === 0 && slot.laneT === 0
    && trip.at - slot.s < SIGNAL_M) slot.car.indicator = -1;
}

/**
 * The share of its speed a car going for a slip or a station holds: still not in the nearside lane
 * EASE_M before it, it eases off to let a gap come (MEASURED, tools/scratch/_hwtrips.mjs: without
 * it 17 of 61 cars going for a slip missed it, held in a middle lane beside a slower nearside lane
 * for 500 m).
 * @param slot the car
 * @returns 0..1
 */
export function tripSlowing(slot: TrafficCar): number {
  const trip = slot.trip;
  return trip && trip.kind !== 'join' && !trip.path && slot.lane > 0 && slot.laneT === slot.lane
    && trip.at - slot.s < EASE_M ? EASE_SHARE : 1;
}

/**
 * Whether a car has left the road by a slip (out of sight it is put back as a new car).
 * @param slot the car
 * @returns on its way off
 */
export const hasLeft = (slot: TrafficCar) => slot.trip?.kind === 'exit' && !!slot.trip.path;

/**
 * Whether a car is off its lane on purpose on a trip (on a slip road, an on-ramp, or moving
 * across from one): it is not stuck.
 * @param slot the car
 * @returns on a trip off the lanes
 */
export const isOffOnTrip = (slot: TrafficCar) => !!slot.trip
  && (!!slot.trip.path || !!slot.trip.merge);

/**
 * Now and then (JOIN_SHARE) a car just put back ahead of you starts on an on-ramp in reach ahead
 * instead, out of sight, with no car near its start.
 * @param ctx the traffic
 * @param slot the car
 * @param ents everyone on the road
 * @param vis the screen test
 * @returns put there
 */
export function mayJoin(ctx: TrafficCtx, slot: TrafficCar, ents: TrafficEnt[],
  vis: VisFn): boolean {
  const level = ctx.level!, playerS = level._hw.q!.s, span = roadSpan(level);
  const inReach = (ramp: Ramp) => ramp.endS - playerS > JOIN_AHEAD_M[0]
    && ramp.endS - playerS < JOIN_AHEAD_M[1] && ramp.endS < span.s1 - 60;
  const ramps = rampsOf(level).filter(inReach);
  const ramp = ramps.find((each) => {
    const [startX, startY] = each.pts[0], frame = roadFrame(level, startX, startY);
    return !!frame && frame.s - playerS > START_AHEAD_M && !vis(startX, startY, frame.s)
      && !ents.some((ent) => Math.hypot(ent.car.x - startX, ent.car.y - startY) < START_CLEAR_M);
  });
  if (!ramp || ctx.rnd() >= JOIN_SHARE) return false;
  const [startX, startY] = ramp.pts[0], [nextX, nextY] = ramp.pts[1];
  reset(slot.car, startX, startY, Math.atan2(nextY - startY, nextX - startX));
  setSpeed(slot, ramp.startV);
  const frame = roadFrame(level, startX, startY)!, lane = geo(ctx).own[0];
  Object.assign(slot, { s: frame.s, off: frame.off, lane: 0, laneT: 0, laneOff: lane,
    kOff: null, trip: { kind: 'join', at: ramp.endS, path: makePath(ramp.pts, GIVE_WAY_M,
      ramp.startV), committed: false } });
  return true;
}
