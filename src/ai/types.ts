// The AI's shared shapes. Car shapes describe ONLY the fields src/ai/ and src/highwayrace.ts read
// (types from vehicle.ts / cars.ts); road-level shapes come from JavaScript not converted yet
// (highway.js).
import type { Lane, Spawn } from "../world/types.ts";
import type { Spec, Surface } from "../cars.ts";
import type { Car, CarTelemetry } from "../vehicle.ts";

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

// A car model's numbers (cars.ts Spec), the fields the AI reads; the optional ones are
// optional here because the AI is also driven by tools with plain objects.
export type AiSpec = Pick<Spec, 'id' | 'lf' | 'L' | 'mu' | 'paint' | 'wid' | 'len'>
  & Partial<Pick<Spec, 'steerMax' | 'aiK' | 'drive'>>;   // drive: circuit.ts drifts only below 0.5

// A car (vehicle.ts Car), the narrow view of the fields the AI reads.
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
  spec: AiSpec;
  surface: Pick<Surface, 'mu'>;
  t: Pick<CarTelemetry, 'slipR'> & Partial<Pick<CarTelemetry, 'slipF' | 'spinR' | 'spinF'>>;
  _hwf?: RoadFrame | null;
  _trOff?: number | null;   // traffic.ts: the lane offset a lane-changing car is heading for
  traffic?: boolean;   // traffic.ts: a traffic car, not another racer
  _hwS?: number;   // traffic.ts: this racer's road distance last step
   // (the hint for its next road frame)
  _jokers?: number;   // main.js: jokers taken (the joker tactics read it)
  dragMul?: number;   // contact.js: the slipstream (1 = no tow)
}

// One point of the highway's road centre line (highway.js): distance along it, curvature.
export interface RoadPoint {
  s: number;
  curv?: number;
}

// The player's place on the highway road (highway.js locate): distance, offset, road direction.
export interface RoadQ {
  s: number;
  off: number;
  dx: number;
  dy: number;
}

// A highway level (highway.js), the fields highwayrace.ts, the weaver and traffic.ts read.
export interface HighwayLevel {
  spawn: Spawn;
  endless?: boolean;
  _hw: {
    geo: { centres: number[]; hw: number }; pts: RoadPoint[];
    q?: RoadQ | null;   // highway.js stepHighway: where the player is on the road
  };
  _cfg: { walls?: string; shoulder: number };
}

// What a driver is told each step: hold = keep station (the rolling start), cars = everyone else.
export interface DriveCtx {
  hold?: boolean;
  cars?: AiCar[];
  lap?: number;   // main.js, circuit driver: the current lap, 1-based
  laps?: number;   // main.js, circuit driver: the race length
  obstacles?: LooseObstacle[];   // main.js, circuit driver: loose objects near the car
}

// A loose object on the road (a cone, a tyre) the circuit driver steers round.
export interface LooseObstacle {
  x: number;
  y: number;
  r: number;
}

// What decideJoker is told: the driver's ctx plus its own car.
export interface JokerCtx extends DriveCtx {
  self: AiCar;
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
  wetEpoch?: number;   // the weather's wetness step the grip (pts mu) was read at (profileOf)
  switchI?: number;   // branch: the main-line index where it leaves
  rejoin?: number;   // branch: the main-line index where it merges back
}

// A run of the racing line tighter than CORNER_R.
export interface Corner {
  start: number;
  apex: number;
  turn: number;
  angle?: number;   // circuit.ts: the corner's total turn (rad), summed once when first needed
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

// A mistake in progress: drawn per corner, ends once through the corner.
export interface Mistake {
  kind: string;
  sev: number;
  corner: number;
  inside: boolean;
  t: number;
  fired?: boolean;   // the "throttle" kind: the slide has been started
}

// An overtake in progress: the car attacked, the side taken, the corner (-1 = a tow pass).
export interface Attack {
  car: AiCar;
  side: number;
  corner: number;
  t0: number;
}

// A cover move in progress: the side taken, the corner it is for.
export interface CoverMove {
  side: number;
  corner: number;
  t0: number;
}

// A point of the path the circuit driver follows: the racing line has off,
// a branch (joker, start lane) does not.
export interface DrivePoint extends PathPoint {
  off?: number;
}

// What stands ahead in the way / close behind (circuit.ts): the car, its gap along us and its
// place across.
export interface Lead {
  c: AiCar;
  f: number;
  oc: number;
  vAlong: number;
}
export interface Threat {
  c: AiCar;
  f: number;
  oc: number;
}

// What the circuit driver learns from the cars around it (carsStep) and what it reads from drive.
export interface CarsAcc {
  dodgeT: number; followCap: number; conflict: boolean; lead: Lead | null;
  threat: Threat | null; side: number; alg: number[];
}
export interface CarsEnv {
  car: AiCar; path: Path<DrivePoint>; nearIdx: number; idx: (pos: number) => number;
  speed: number; prec: number; prof: SpeedProfile; lineOff: number;
  latT: number; startK: number; latLim: number; myLat: number; clear: number; gapF: number;
}

// The circuit driver's state (createAIDriver). Fields without a ? are set when it is made.
export interface CircuitState extends DriveOutState {
  path: Path<DrivePoint>;
  i: number | null;   // null until the first step (and after a relocate) finds its place
  vT: number;
  lap: number;
  jokers: number;
  jPlan: number;
  jWant: boolean;
  jDecLap: number;
  jForget: boolean;
  mist: Mistake | null;
  mistCorner: number;
  dodge: number;
  follow: boolean;
  cap: number;
  lastDist: number;
  pushing: boolean;
  thrUntil: number;
  atk: Attack | null;
  atkCorner: number;
  hbCorner: number;
  hbUntil: number;
  cover: CoverMove | null;
  covCorner: number;
  leadCar: AiCar | null;
  behindT: number;
  goT?: number;   // drive: the time the car first moved off
  gridLat?: number;   // drive: set with goT, its offset from the line when it set off
  wide?: number;   // drive: the width allowed while going round a car outside the usual edge
  wideUntil?: number;   // drive: set with wide
  obst?: number;   // drive: seconds spent dodging loose objects
  nearT?: number;   // drive: seconds with a car ahead
  nAtk?: number;   // drive: attacks made
  towT?: number;   // drive: the time of the last tow-pass check
  cc?: number;   // drive: the corner it is in or heading for
  driftT?: number;   // drive: seconds drifting
  lastDrift?: number;   // drive: the time it last drifted
  driftOn?: boolean;   // drive: set per corner
  driftBan?: number;   // drive: no drifting until this time
  driftCorner?: number;   // drive: the corner driftOn was decided for
  hbN?: number;   // drive: handbrake pulls made
}

// A traffic car is a real car (vehicle.ts makeCar) plus what traffic.ts puts on it.
export type TrafficVehicle = Car & Pick<AiCar, 'traffic' | '_trOff' | '_hwS' | '_hwf'> & {
  dmg?: number[];   // damage.ts damageInit: the damage of the four corners
  indicator?: number;   // traffic.ts: -1 / 0 / 1
  hazard?: boolean;   // traffic.ts: a wreck's hazard lights
  brakeLight?: number;   // traffic.ts
};

// One traffic slot: a live car, or (parked) a slot waiting for a free off-screen spot.
export interface TrafficCar {
  car: TrafficVehicle;
  lane: number;
  laneT: number;
  laneOff: number;
  bias: number;
  vWant: number;
  s: number;
  off: number;
  vAl: number;
  ind: number;
  indT: number;
  think: number;
  keepLeftT: number;
  wreck: boolean;
  deadT: number;
  parked: boolean;
  kOff: number | null;
  kin: boolean;
  phys: boolean;
}

// Everyone on the road in road coordinates (stepTraffic): along, sideways, speed along.
export interface TrafficEnt {
  car: AiCar;
  s: number;
  off: number;
  v: number;
  t?: TrafficCar;   // a traffic car
  you?: boolean;   // you or an AI: a real car
}
