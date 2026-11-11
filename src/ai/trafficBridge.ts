// ai/trafficBridge.ts - TRAFFIC OVER THE BRIDGES (?bridgecars=1; owner 11-11: "Real traffic
// cars" over the road bridges): each drivable road bridge over the endless road
// (highway/bridgeways.ts) has BRIDGE_CARS real traffic cars driving its road - a loop up its left
// lane, over the deck, round a turning place out in the country and back (round a junction's
// roundabouts), steered by the autopilot driver (ai/autodrive.ts) along the loop and stepped by
// the traffic's own physics (ai/trafficPhys.ts drivePhysics: the clamps, the damage, a bridge's
// crossing, the tumble). Near you they drive; past SLEEP_M they sleep where they are (no work);
// they go with their bridge.
import { createAutoDriver } from './autodrive.ts';
import { drivePhysics } from './trafficPhys.ts';
import { gearFor, newTrafficVehicle, rebuildCars } from './trafficSpawn.ts';
import { reset } from '../vehicle.ts';
import { createSubtrack } from '../world/subtrack.ts';
import { DECK_ROAD_HI, DECK_ROAD_LO } from '../world/crossinggeo.ts';
import { RING_R, ringCentre } from '../highway/ringgeo.ts';
import type { TrafficCtx } from './trafficCtx.ts';
import type { DriveEnv } from './trafficLane.ts';
import type { TrafficCar, TrafficVehicle } from './types.ts';
import type { Point, Prop, Subtrack } from '../world/types.ts';

// cars a bridge carries; m/s they drive at (a country road over a motorway: ~45 km/h); m from you
// past which one sleeps; m each loop point is from the next
const BRIDGE_CARS = 2, BRIDGE_SPEED_MS = 12.5, SLEEP_M = 300, PATH_STEP_M = 4;
// m off the road's middle line each lane runs (a 7 m road: driving on the left), the turning
// place's radius (wide enough to come round at a crawl) and how far short of the road's end it is
const LANE_OFF_M = 1.75, TURN_R_M = 7, TURN_SHORT_M = 10;
// a turning place's points round its half circle; the lane's points over which it eases out to it
const TURN_POINTS = 8, EASE_POINTS = 4;
// m/s over BRIDGE_SPEED_MS at which it brakes; its brake then
const OVER_MS = 2, BRAKE = 0.3;

/** A car of a bridge's road: the traffic car, its loop and its driver. */
interface BridgeCar {
  slot: TrafficCar;
  bridge: Prop;
  drive: ReturnType<typeof createAutoDriver>['drive'];
}

/** The bridges' cars, kept on the traffic's context. */
type BridgeCtx = TrafficCtx & { bridgeCars?: BridgeCar[] };

/**
 * A bridge road's loop: up its left lane from the turning place at its -x end to the one at its +x
 * end, round, and back along the other lane; round a junction's roundabouts (their lane's line).
 * @param bridge the bridge (x, y, rot along its road, wid its span, appL its approaches)
 * @returns the loop's points, world m
 */
function loopOf(bridge: Prop): Point[] {
  const axisX = Math.cos(bridge.rot || 0), axisY = Math.sin(bridge.rot || 0);
  const mid = (DECK_ROAD_LO + DECK_ROAD_HI) / 2, half = (bridge.wid || 30) / 2;
  const [negEnd, posEnd] = (bridge.appL || [60, 60]).map((len) => half + 3 + len - TURN_SHORT_M);
  const rings = bridge.rings ? [ringCentre(bridge, -1), ringCentre(bridge, 1)] : [];
  const spotAt = (along: number, across: number): Point => {
    let spot: Point = [bridge.x + axisX * along - axisY * across,
      bridge.y + axisY * along + axisX * across];
    // (round a roundabout: on its lane's line, the way it lies)
    for (const [ringX, ringY] of rings) {
      const dx = spot[0] - ringX, dy = spot[1] - ringY, dist = Math.hypot(dx, dy);
      if (dist < RING_R) {
        const away = dist > 0.1 ? [dx / dist, dy / dist] : [-axisY * Math.sign(across || 1),
          axisX * Math.sign(across || 1)];
        spot = [ringX + away[0] * RING_R, ringY + away[1] * RING_R];
      }
    }
    return spot;
  };
  const pts: Point[] = [];
  const out = mid + LANE_OFF_M, back = mid - LANE_OFF_M;
  // a turning place round the end at `end` (+1 the +x end): the lane eased out to the circle's
  // edge over its last EASE_POINTS, a half circle of TURN_R_M, eased back into the other lane
  const turn = (end: number, endAlong: number, isOutFirst: boolean) => {
    for (let step = 1; step <= TURN_POINTS; step++) {
      const angle = (step / TURN_POINTS) * Math.PI;
      pts.push(spotAt(endAlong + end * Math.sin(angle) * TURN_R_M, mid + (isOutFirst ? 1 : -1)
        * Math.cos(angle) * TURN_R_M));
    }
  };
  const lane = (fromAlong: number, toAlong: number, across: number, wide: number) => {
    const count = Math.round(Math.abs(toAlong - fromAlong) / PATH_STEP_M);
    for (let step = 0; step <= count; step++) {
      const along = fromAlong + (toAlong - fromAlong) * (step / count);
      // (eased out toward the turning places at its ends)
      const ease = Math.max(0, 1 - Math.min(step, count - step) / EASE_POINTS);
      pts.push(spotAt(along, across + (wide - across) * ease * ease));
    }
  };
  lane(-negEnd, posEnd, out, mid + TURN_R_M);
  turn(1, posEnd, true);
  lane(posEnd, -negEnd, back, mid - TURN_R_M);
  turn(-1, -negEnd, false);
  return pts;
}

/**
 * A bridge's cars, spread round its loop, each a real traffic car with the autopilot at its wheel.
 * @param ctx the traffic
 * @param bridge the bridge
 * @returns its cars
 */
function carsOf(ctx: TrafficCtx, bridge: Prop): BridgeCar[] {
  const loop = loopOf(bridge), sub: Subtrack = createSubtrack(loop, 7, [], [], true);
  const cars: BridgeCar[] = [];
  for (let index = 0; index < BRIDGE_CARS; index++) {
    const car: TrafficVehicle = newTrafficVehicle(ctx);
    const start = Math.floor((index + 0.25) / BRIDGE_CARS * loop.length) % loop.length;
    const [x, y] = loop[start], [nextX, nextY] = loop[(start + 1) % loop.length];
    const heading = Math.atan2(nextY - y, nextX - x);
    reset(car, x, y, heading);
    car.vx = Math.cos(heading) * BRIDGE_SPEED_MS;
    car.vy = Math.sin(heading) * BRIDGE_SPEED_MS;
    gearFor(car, BRIDGE_SPEED_MS);
    const slot = { car, lane: 0, laneT: 0, laneOff: 0, bias: 0, vWant: BRIDGE_SPEED_MS, s: 0,
      off: 0, vAl: BRIDGE_SPEED_MS, ind: 0, indT: 0, think: 0, keepLeftT: 0, wreck: false,
      deadT: 0, parked: false, kOff: null, kin: false, phys: true, dir: 1, quick: false,
      racer: null, broke: null } as TrafficCar;
    cars.push({ slot, bridge, drive: createAutoDriver(sub).drive });
  }
  return cars;
}

/**
 * Brings the bridges' cars in line with the bridges loaded: new ones for a new bridge, gone with a
 * dropped one; the traffic's live list rebuilt when they change.
 * @param ctx the traffic
 * @returns the cars
 */
function syncBridgeCars(ctx: BridgeCtx): BridgeCar[] {
  const level = ctx.level!, list = (ctx.bridgeCars ||= []);
  const bridges = level.props.filter((prop: Prop) => prop.kind === 'bridge'
    && prop.look === 'venue');
  const loaded = new Set(bridges);
  let changed = false;
  for (let i = list.length - 1; i >= 0; i--)
    if (!loaded.has(list[i].bridge)) {
      list.splice(i, 1);
      changed = true;
    }
  const served = new Set(list.map((entry) => entry.bridge));
  for (const bridge of bridges)
    if (!served.has(bridge)) {
      list.push(...carsOf(ctx, bridge));
      changed = true;
    }
  if (changed) rebuildCars(ctx);
  return list;
}

/**
 * One step of the bridges' cars (?bridgecars=1): each near you driven round its loop by the
 * autopilot at BRIDGE_SPEED_MS through the traffic's physics; the rest asleep.
 * @param ctx the traffic
 * @param dt the step, s
 * @param player your car (x, y)
 */
export function stepBridgeCars(ctx: TrafficCtx, dt: number, player: { x: number; y: number }) {
  if (!ctx.level) return;
  const env = { dt } as DriveEnv;
  for (const entry of syncBridgeCars(ctx)) {
    const { slot } = entry, car = slot.car;
    if (Math.hypot(car.x - player.x, car.y - player.y) > SLEEP_M) continue;
    const speed = Math.hypot(car.vx, car.vy);
    const input = entry.drive(car, dt);
    if (speed > BRIDGE_SPEED_MS) input.throttle = 0;
    if (speed > BRIDGE_SPEED_MS + OVER_MS) input.brake = Math.max(input.brake, BRAKE);
    drivePhysics(ctx, slot, env, speed, BRIDGE_SPEED_MS, 0, input);
  }
}

/**
 * The bridges' cars' bodies, for the traffic's live list (drawn, collided).
 * @param ctx the traffic
 * @returns the cars
 */
export const bridgeCarBodies = (ctx: TrafficCtx): TrafficVehicle[] =>
  ((ctx as BridgeCtx).bridgeCars || []).map((entry) => entry.slot.car);

/**
 * Forgets the bridges' cars (a new road).
 * @param ctx the traffic
 */
export function resetBridgeCars(ctx: TrafficCtx) {
  (ctx as BridgeCtx).bridgeCars = [];
}
