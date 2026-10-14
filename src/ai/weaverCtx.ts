// ai/weaverCtx.ts: the highway driver's constants and the objects its step functions share: the
// context roadDriver (weaver.ts) makes once and the per-step view of the road and the traffic.
import { envValue } from "../core/debug.ts";
import type {
  AiCar, HighwayLevel, RoadBlock, RoadFrame, Traits, WeaverState,
} from "./types.ts";

// ---------------------------------------------------------------- THE HIGHWAY (endless level):
// the road read through highway.js AI ROUND 2 stage 1 (user, 2026-10-07: "same ai"; CLAUDE.md ONE
// SYSTEM NOT TWO THEN ONE): this was hwrace.js createHwDriver. It is now this file's road reader
// for levels with no closed lap (level.endless), behind the ONE entry point createAIDriver; moved
// UNCHANGED (MEASURED: weavecheck + pacesuite identical to before with __NOOUT) plus the shared
// drive-out. Later stages share more (mistakes, skill).
// m/s the lateral target moves (x1.8 in an emergency); traffic changes lane at 0.9
export const LAT_R = 3.0;
export const GRAVITY = 9.81;
export const IDLE = { steer: 0, throttle: 0, brake: 0.3, handbrake: 0, reverse: 0 };
// the RACER — v2, a WEAVER (user, 2026-10-05: "AI on highways should IGNORE LANES and go FAST,
// DODGING traffic and WEAVING through like the player would"). No lanes: across the whole
// carriageway (hard shoulder included) it tries N_LINES lateral lines a few times a second and
// scores each by how much free road it has: every car ahead within 220 m whose body (+ a margin)
// overlaps the line blocks it at its gap; the line with the most road wins, with a cost for a big
// swerve and a bonus for staying put (no dithering), and never a line on the far side of a car
// right alongside. It steers for that line (Stanley, as autodrive.js — the controller that holds
// this road), the lateral target moving at LAT_R so a swerve is a car's swerve. Speed: corner speed
// from the road's curvature, flat out otherwise; it brakes only while its line is still blocked
// (braking-distance following), and hard when a crash is close. traits = aidriver.js aiTraits
// (pace, prec, wander, aggression). ctx = { cars: everyone else (with _hwf), hold: keep station
// (the rolling start: follow, no swerving) }
export const N_LINES = 11, MARGIN = 0.55, LOOK_T = 3.2, EDGE_M = 1.8;
// A/B tuning from the node tools only (HWT='{"kC":0.5}'); the browser has no process -> {}
// (the ! : envValue("HWT") was just seen to be set; JSON.parse returns any, which fits the Record)
export const HWT: Record<string, number> = envValue("HWT")
  ? JSON.parse(envValue("HWT")!) : {};

/** What roadDriver makes once: the level, traits, random stream, state and tuned numbers. */
export interface Wvr {
  level: HighwayLevel;
  traits: Traits;
  rnd: () => number;
  state: WeaverState;
  thrMax: number;
  cornerK: number;
  brakeK: number;
  agg: number;
  margin: number;
}

/** The road around the car this step: its frame, the lines it may use and the other cars. */
export interface Road {
  car: AiCar;
  dt: number;
  frame: RoadFrame;
  pts: HighwayLevel["_hw"]["pts"];
  geo: HighwayLevel["_hw"]["geo"];
  speed: number;
  vAl: number;
  hold: boolean;
  minOff: number;
  maxOff: number;
  cars: AiCar[];
  myW: number;
  grip: number;
  idx0: number;
}

/** One step's view: the road plus the verge limits, what blocks a line and the mirror. */
export interface Step extends Road {
  vLo: number;
  vHi: number;
  mirT: number;
  blockOn: (off: number) => RoadBlock | null;
  mirror: (off: number) => boolean;
  reach: number;
}

/** The speed plan of one step: the target and the numbers it came from. */
export interface Plan {
  vTarget: number;
  vCorner: number;
  vFollow: number;
  brakeX: number;
  fol: RoadBlock | null;
}
