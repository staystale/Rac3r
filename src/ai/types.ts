// The AI's shared shapes. Car and road-level shapes describe ONLY the fields src/ai/ and
// src/highwayrace.ts read, from JavaScript not converted yet (vehicle.js, highway.js).
import type { Spawn } from "../world/types.ts";

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
  spec: { lf: number; L: number; mu: number; steerMax?: number; paint: string };
  surface: { mu: number };
  t: { slipR: number; spinR?: number; spinF?: number };
  _hwf?: RoadFrame | null;
}

// A highway level (highway.js), the fields highwayrace.ts reads.
export interface HighwayLevel {
  spawn: Spawn;
  _hw: { geo: { centres: number[] } };
}
