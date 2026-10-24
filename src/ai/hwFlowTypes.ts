// ai/hwFlowTypes.ts: the types of the highway race flow (highwayrace.ts createHwFlow,
// hwFlow.ts): a racer, a results row, the arguments, the flow state and the steps' context.
import type { AiCar, HighwayLevel } from "./types.ts";

// One racer of the highway race.
export interface HwEntry {
  car: AiCar;
  player: boolean;
  lastS?: number;   // its last road position, kept while it has no road frame (hwFlow.ts)
}
// One row of the results table (raceflow.js-shaped, + dist / gapM).
export interface HwRow {
  car: AiCar; player: boolean; num: number; paint: string; s: number; dist: number;
  bill: number; time: number; total: number; penalty: number; est: boolean; best: null;
  laps: number; pos?: number; gapM?: number; gap?: number;
}
// What createHwFlow takes.
export interface HwFlowArgs {
  lv: HighwayLevel; cars: { car: AiCar; player?: boolean }[];
  visible: (car: AiCar) => boolean; count?: number; catchT?: number;
}
// What createHwFlow returns: the race state, and the countdowns' bookkeeping.
export interface HwFlow {
  highway: boolean; state: string; t: number; laps: number; entries: HwEntry[];
  flags: number[]; results: HwRow[] | null;
  cd: number | null; cdKind: string | null; cdHold: boolean; myPlace: number | null | undefined;
  // order / step / end: set right after the object is made
  order?: () => number; step?: (dt: number) => void; end?: () => void;
  endT?: number; lostT?: number; cdLeft?: number | null; cdOffAt?: number;
  edge?: number | null; nearT?: number;
}
/** The flow with what its steps share: the entries, the screen test and the gap tracking. */
export interface HwCtx {
  flow: HwFlow;
  entries: HwEntry[];
  visible: (car: AiCar) => boolean;
  count: number;
  catchT: number;
  sRef: number;
  gapPrev: number | null;
  gapRate: number;
}
