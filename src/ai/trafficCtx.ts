// ai/trafficCtx.ts: the constants and the one context object the highway traffic (traffic.ts
// createTraffic) shares with its step functions (trafficSpawn.ts, trafficStep.ts,
// trafficDrive.ts, trafficKin.ts).
import type { HighwayLevel, TrafficCar, TrafficVehicle } from "./types.ts";
import type { PoliceOrders } from "./trafficPolice.ts";
import { FIX } from '../core/fixes.ts';
import { CLOCK, calendarAt } from '../world/clock.ts';

// what is on the road (weights) — road cars only; vans / lorries come with the traffic
// vehicles (TODO 4). A car not in the roster is left out (trafficSpawn.ts): a new car behind its
// switch (newcars.ts). The Transfit stands for all vans: 2.4 is 17 % of the picks, the
// vans' share of Great Britain's road traffic (DfT road traffic estimates 2023; cars 76 %).
// The Defunder stands for the Land Rovers: 0.4 is ~3.4 % of the cars (1.1 M of Great Britain's
// ~34 M licensed cars; DfT / DVLA licensing statistics), ~2.8 % of the picks. The Focust stands
// for the Focus: 0.37 is ~3 % of the cars (1.05 M of ~35 M; SMMT Motorparc 2023).
// The vans' 2.4 split between the three Transfits by these parts of 100 (EST: no registration
// split found; the MWB the commonest of the big Transits): the L2 MWB 40, the L3 LWB 30, the Mk7
// SWB 30.
// The Routemonster stands for the buses: 0.07 is ~0.5 % of the picks, the buses' and coaches'
// share of Great Britain's road traffic (DfT road traffic estimates).
// The Land Rovers' 0.4 split between the Defunder and the Strange Rover: 0.15 / 0.25 (owner; EST,
// Range Rovers outnumber Defenders).
const DEFUNDERS = 0.15, STRANGE_ROVERS = 0.25;
// The rare ones at their real share of the cars (DVLA licensing data via howrareismycar.co.uk,
// against ~34 M cars and the cars' ~12.3 of the weights): every Saxo, 2,306 licensed (2025) -
// 0.0068 %, 0.00083 - about 1 car in 15,000; the Clio Renaultsport Cup, 210 (2025) - 0.00062 %,
// 0.000076 - about 1 car in 160,000.
const RARE: [string, number][] = [['saxo-vtr', 0.00083], ['cleo-rs200', 0.000076]];
// The Model 3 at its share the same way: ~133,000 licensed (2025 Q4, DVLA via
// howmanyleft.co.uk) - 0.39 %, 0.048 - about 1 car in 260.
const TESLAS = 0.048;
// The Ibiza the same way (every Ibiza): ~204,700 licensed (2025 Q4, DVLA via
// stillontheroad.co.uk) - 0.60 %, 0.074 - about 1 car in 170.
const IBIZAS = 0.074;
// The A4 the same way (every A4): ~226,700 licensed (2025 Q4, DVLA via stillontheroad.co.uk) -
// 0.67 %, 0.082 - about 1 car in 150.
const AUDI_A4S = 0.082;
// The school bus: rare (an American bus on British roads - owner: "rare"), 0.02 (EST: ~1 in 700
// of the traffic), and only on the school runs (SCHOOL_RUNS, the game's clock: world/clock.ts).
const SCHOOL_BUSES = 0.02;
// hours of the school runs, morning and afternoon (EST, UK school hours); the days of the clock's
// 7-day week that are the weekend (no school run: its last two)
const SCHOOL_RUNS: [number, number][] = [[7.5, 9], [14.75, 16.5]], WEEKEND_DAYS = [5, 6];
// vehicles that keep their own paint in the traffic (a school bus is yellow)
export const OWN_PAINT = new Set(['skool-bus']);

/**
 * Whether a vehicle may be picked for the traffic now: the school bus only on the school runs of
 * a weekday by the game's clock (never without the clock); every other always.
 * @param vehId the vehicle
 * @returns in service
 */
export function inService(vehId: string): boolean {
  if (vehId !== 'skool-bus') return true;
  if (!CLOCK.isOn) return false;
  const { hour, dayInSeason } = calendarAt(CLOCK.eventS);
  if (WEEKEND_DAYS.includes(dayInSeason)) return false;
  return SCHOOL_RUNS.some(([from, until]) => hour >= from && hour < until);
}
const VANS = 2.4;
// The vans' parts of 100: the L2 MWB 40, the L3 LWB 30, the Mk7 SWB 30; with the Transfit Custom
// (?transitcustom) four ways - the Custom 40 (SMMT: the UK's best-selling van, 2013-23), the MWB
// 25, the SWB 20, the LWB 15 (EST: no registration split by wheelbase found).
const VAN_PART = FIX.transitcustom ? { custom: 40, mwb: 25, lwb: 15, swb: 20 }
  : { custom: 0, mwb: 40, lwb: 30, swb: 30 };
/** One Transit's weight: its part (of 100) of the vans' VANS. */
const vanWeight = (part: number) => VANS * part / 100;
export const VEH: [string, number][] = [
  ['hatch-fwd', 3], ['saloon-rwd', 3], ['estate-4x4', 2.5], ['mini-fwd', 1.5],
  ['hatch-rwd', 1], ['muscle-rwd', 0.4], ['lambo-awd', 0.12],
  ['transfit-van', vanWeight(VAN_PART.mwb)],
  ['defunder-110', DEFUNDERS], ['focust-st', 0.37], ['routemonster', 0.07],
  ['transfit-lwb', vanWeight(VAN_PART.lwb)], ['transfit-swb', vanWeight(VAN_PART.swb)],
  ...(VAN_PART.custom ? [['transfit-custom', vanWeight(VAN_PART.custom)] as [string, number]]
    : []),
  ['strange-l322', STRANGE_ROVERS],
  ...RARE, ['tesla-m3', TESLAS], ['seat-ibiza', IBIZAS], ['ordi-a4', AUDI_A4S],
  ['skool-bus', SCHOOL_BUSES],
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
// a speeder out of sight (carried, the traffic's own lane logic): its lane changes
// SPEEDER_LAT x as quick, signalled SPEEDER_IND s; it follows at SPEEDER_HEADWAY s (tailgates) and
// looks SPEEDER_LOOK_M ahead for a slower car to go round, either side (MEASURED, a probe: carried
// with the traffic's own, a speeder sat at 100-104 km/h behind a cruising car for 20 s and more)
export const SPEEDER_LAT = 2.5, SPEEDER_IND = 0.3, SPEEDER_HEADWAY = 0.5, SPEEDER_LOOK_M = 90;

/**
 * How fast a car moves across, m/s: a speeder's SPEEDER_LAT x quicker.
 * @param slot the car
 * @param slot.racer a speeder's driver
 * @returns m/s
 */
export const latOf = (slot: { racer?: unknown }) => (slot.racer ? LAT_V * SPEEDER_LAT : LAT_V);
// m along the road from you (+ out of view)
export const RECYCLE_BEHIND = 70, RECYCLE_AHEAD = 520, HARD_BEHIND = 320;
export const SPAWN_AHEAD = [300, 470], SPAWN_BEHIND = [150, 240];
// m behind you a chaser is sent from (ai/trafficPolice.ts): out of sight on screen, inside its
// sight of you (ai/policeHeat.ts SIGHT_M)
export const CHASE_BEHIND = [110, 170];

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
  // those of them the racers read: not the far side of a central reservation's barrier
  // (MEASURED, hwracecheck: reading the other way's cars 7.6 m across on the dual
  // carriageway, the racers ran 9-12 km/h slower)
  ourSide: TrafficVehicle[];
  // what the heat tells the police (ai/trafficPolice.ts ordersOf)
  police?: PoliceOrders;
}

/** Is (x, y) at road distance dist on screen right now? */
export type VisFn = (x: number, y: number, dist: number) => boolean;

/** The road geometry (! : only called once resetTraffic has set the level). */
export const geo = (ctx: TrafficCtx) => ctx.level!._hw.geo;
