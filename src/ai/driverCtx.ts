// ai/driverCtx.ts: the one context object a circuit driver (circuit.ts createAIDriver) shares
// with its step functions (driverJoker.ts, driverLane.ts, driverTraffic.ts, driverPedals.ts).
import type { parkMiller } from "../core/random.ts";
import type { Level } from "../world/types.ts";
import type { createAttackSteps, createRaceMoves } from "./racecraft.ts";
import type { createHandbrakeStep, createSlideStep } from "./driverSteps.ts";
import type { Branches, CircuitState, RacingLine, Traits } from "./types.ts";

/** A path the driver follows: the racing line or one of its branches. */
export type AiPath = CircuitState["path"];

/** One circuit driver's level, traits, random stream, racing line, state and racecraft steps. */
export interface Drv {
  level: Level;
  traits: Traits;
  rnd: ReturnType<typeof parkMiller>;
  line: RacingLine;
  main: RacingLine;
  branches: Branches;
  count: number;
  state: CircuitState;
  attack: ReturnType<typeof createAttackSteps>;
  moves: ReturnType<typeof createRaceMoves>;
  handbrakeStep: ReturnType<typeof createHandbrakeStep>;
  slideStep: ReturnType<typeof createSlideStep>;
  wanderPhaseA: number;
  wanderPhaseB: number;
  jLaps: number;
}
