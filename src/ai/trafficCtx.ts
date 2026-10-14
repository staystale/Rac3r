// ai/trafficCtx.ts: the constants and the one context object the highway traffic (traffic.ts
// createTraffic) shares with its step functions (trafficSpawn.ts, trafficStep.ts,
// trafficDrive.ts, trafficKin.ts).
import type { HighwayLevel, TrafficCar, TrafficVehicle } from "./types.ts";

// what is on the road (weights) — road cars only; vans / lorries come with the traffic
// vehicles (TODO 4)
export const VEH: [string, number][] = [
  ['hatch-fwd', 3], ['saloon-rwd', 3], ['estate-4x4', 2.5], ['mini-fwd', 1.5],
  ['hatch-rwd', 1], ['muscle-rwd', 0.4], ['lambo-awd', 0.12],
];
// real-road colours: mostly silver / white / black / grey (each its own sprite, cached by
// id + paint)
export const PAINTS: [string, string, number][] = [
  ['#b9bdc4', '#6f747c', 4], ['#e6e8ea', '#9aa0a8', 3], ['#22252b', '#0e1013', 3],
  ['#5b626d', '#353a42', 3], ['#1f3a6e', '#10223f', 1.5],
  ['#9c2a2a', '#5a1515', 1.5], ['#2f5d3a', '#1a3622', 0.8], ['#7a6340', '#453720', 0.6],
  ['#3c6fa8', '#22426a', 1], ['#c7b98f', '#7d7255', 0.6],
];
export const PER_LANE = 6;          // cars per lane at 100 % density (motorway: 18)
export const MAX_CARS = 24;
export const LAT_V = 0.9;           // m/s sideways while changing lane (3.65 m in ~4 s)
export const IND_T = 1.3;           // s of indicating before moving across
export const CROSS_T = 6;           // s a lane change takes, indicating included, + a margin
// m along the road from you / an AI inside which traffic is a real physics car
// (LOD; 0.75 s at a 220 km/h closing speed)
export const PHYS_NEAR = 45;
export const HEADWAY = 1.1, GAP0 = 5;   // following: GAP0 + HEADWAY x v metres, bumper to bumper
// m along the road from you (+ out of view)
export const RECYCLE_BEHIND = 70, RECYCLE_AHEAD = 520, HARD_BEHIND = 320;
export const SPAWN_AHEAD = [300, 470], SPAWN_BEHIND = [150, 240];

/** The traffic's state: its slots, the live cars, the counters and the random source. */
export interface TrafficCtx {
  rnd: () => number;
  list: TrafficCar[];
  level: HighwayLevel | null;
  want: number;
  placed: number;
  recycled: number;
  visHits: number;
  // the LIVE cars (drawn + collided); a parked slot (waiting for a free off-screen spot)
  // is not in it
  cars: TrafficVehicle[];
}

/** Is (x, y) at road distance dist on screen right now? */
export type VisFn = (x: number, y: number, dist: number) => boolean;

/** The road geometry (! : only called once resetTraffic has set the level). */
export const geo = (ctx: TrafficCtx) => ctx.level!._hw.geo;
