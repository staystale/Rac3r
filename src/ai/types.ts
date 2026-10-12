// The AI's shared shapes. Car and road-level shapes describe ONLY the fields src/ai/ and
// src/highwayrace.ts read, from JavaScript not converted yet (vehicle.js, highway.js).
import type { Lane, Spawn } from "../world/types.ts";

// One row of DIFFICULTIES: the centre of a difficulty's spread.
export interface Difficulty {
  id: string;
  name: string;
  pace: number;
  lineQ: number;
  wander: number;
  mistake: number;
  slip: number;
}

// What aiTraits returns: one AI's personality, dealt on top of its difficulty.
export interface Traits {
  diff: string;
  persona: string;
  skill: number;
  prec: number;
  pace: number;
  lineQ: number;
  wander: number;
  mistake: number;
  slip: number;
  aggression: number;
  defence: number;
  seed: number;
}

// What a driver returns each step (the scripted driver has no reverse).
export interface DriveInput {
  steer: number;
  throttle: number;
  brake: number;
  handbrake: number;
  reverse?: number;
}

// A car's ROAD FRAME on the highway, set once per step by hwFrames.
export interface RoadFrame {
  s: number;
  off: number;
  v: number;
}

// A car (vehicle.js), the fields the AI reads.
export interface AiCar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  yawRate: number;
  delta: number;
  num?: number;
  dmgBill?: number;
  spec: {
    id: string; lf: number; L: number; mu: number; steerMax?: number; paint: string;
    wid: number; len: number; aiK?: number;
  };
  surface: { mu: number };
  t: { slipR: number; spinR?: number; spinF?: number };
  _hwf?: RoadFrame | null;
  _trOff?: number | null;   // traffic.js: the lane offset a lane-changing car is heading for
  traffic?: boolean;   // traffic.js: a traffic car, not another racer
}

// One point of the highway's road centre line (highway.js): distance along it, curvature.
export interface RoadPoint {
  s: number;
  curv?: number;
}

// A highway level (highway.js), the fields highwayrace.ts and the weaver read.
export interface HighwayLevel {
  spawn: Spawn;
  _hw: { geo: { centres: number[]; hw: number }; pts: RoadPoint[] };
  _cfg: { walls?: string; shoulder: number };
}

// What a driver is told each step: hold = keep station (the rolling start), cars = everyone else.
export interface DriveCtx {
  hold?: boolean;
  cars?: AiCar[];
}

// The drive-out state both drivers share (driveOut in weaver.ts).
export interface DriveOutState {
  t: number;
  revUntil?: number;
  slowT?: number;
  nOut?: number;
  outN?: number;
  outAt?: number;
  giveUp?: boolean;
}

// What stands in a lateral line's way (the weaver's blockOn): the gap to it (0 = alongside),
// its speed.
export interface RoadBlock {
  gap: number;
  v: number;
  side?: boolean;   // a car right beside us on that side: we cannot swerve through it
  o: AiCar;
}

// The weaver's state (roadDriver).
export interface WeaverState extends DriveOutState {
  line: number | null;
  tgt: number | null;
  think: number;
  ph: number;
  base?: number | null;   // set with line on the first step
  tv?: number;
  free?: { off: number; score: number } | null;
  why?: { raw: number; off: number; why: string; chosen: number; chosenRaw: number };
  dbg?: Record<string, unknown>;   // read by the node tools only
}

// A point of a path: finishPath sets h, R, turn and mu.
export interface PathPoint {
  x: number;
  y: number;
  h: number;
  R: number;
  turn: number;
  mu: number;
}

// A point of the racing line: the centre-line point it lies beside and its offset from it.
export interface LinePoint extends PathPoint {
  nx: number;
  ny: number;
  dist: number;
  off: number;
}

// Target speed (m/s) at every point of a path, for one car model.
export type SpeedProfile = Float64Array;

// A path of points (the racing line or a branch) with its speed profiles cached by car model.
export interface Path<P extends PathPoint = PathPoint> {
  pts: P[];
  n: number;
  closed: boolean;
  total: number;
  sp: number;
  prof: Record<string, SpeedProfile>;
  switchI?: number;   // branch: the main-line index where it leaves
  rejoin?: number;   // branch: the main-line index where it merges back
}

// A run of the racing line tighter than CORNER_R.
export interface Corner {
  start: number;
  apex: number;
  turn: number;
}

// The racing line of a level (racingLine): a closed path plus the road it was cut from.
export interface RacingLine extends Path<LinePoint> {
  hw: number;
  lat: number[];   // lateral offsets sampled across the road
  mu: number[][];   // grip at every point x lateral offset, smoothed along the track
  best: number[];   // best grip across each cross-section
  cid: Int32Array;   // corner index of each point, -1 on a straight
  corners: Corner[];
}

// The branch paths of a level (branches): the joker lane, the start lane.
export interface Branches {
  joker?: Path;
  start?: Path;
  startLane?: Lane;
}

// The measured numbers of one car model (carstats.js) that carGrip reads.
export interface CarStat {
  gripG?: number;
  brake100?: number;
}
