// state.ts — the ONE home of the state shared by the game modules.
//   game: the world object every module reads (filled in by main.ts)
//   shared: the module-level variables of main.ts that more than one module reads or writes
//     (settings, renderer, hud, mode, started, acc ...), assigned in main.ts in boot order
import type { AiTune } from '../ai/tune.ts';
import type { Car, CarInput } from '../vehicle.ts';
import type { DamageCar, DamageState } from '../damage.ts';
import type { LooseObstacle } from '../ai/types.ts';
import type { RoadFrame } from '../ai/types.ts';
import type { createCones } from '../cones.ts';
import type { createMarks } from '../marks.ts';
import type { createTraffic } from '../traffic.ts';
import type { RaceFlow } from '../raceflow.ts';
import type { HwFlow } from '../ai/hwFlowTypes.ts';
import type { Settings } from '../core/settings.ts';
import type { createRenderer } from '../render.ts';
import type { createHud } from '../hud.ts';
import type { createGuide } from '../guide.ts';
import type { createAudio } from '../audio.ts';
import type { InputState } from '../input.ts';
import type { createMenu } from '../menu.ts';
import type { createAIDriver } from '../ai/circuit.ts';
import type { createAutoDriver } from '../ai/autodrive.ts';
import type { createMeter } from '../ui/meter.ts';
import type { createReporter } from '../ui/report.ts';
import type { createFramePacer } from './pacing.ts';
import type { createChurn } from '../core/churn.ts';
import type { HwLevel } from '../highway/hwtypes.ts';
import type { WeatherMode, WeatherPlan } from '../world/weather.ts';
import { LEVEL } from '../world/state.ts';

/** A car in the session: the car, its damage / tyre / engine systems, and what the game tags. */
export type GameCar = Car & DamageCar & DamageState & {
  _hwf?: RoadFrame | null;   // where it is on the highway's road
  _hwS?: number;   // its road distance last step (the hint for the next frame)
  _jokers?: number; _cutPen?: number; _prog?: number; _predT?: number;
  _stageStart?: number | null;
  indicator?: number; lightsOn?: boolean;
  indT?: number; indTurned?: boolean;   // the indicator's blink clock; cancelled by the turn
  brakeLight?: number; handbrakeOn?: number; rainLight?: boolean;   // the lamps
  num?: number;
  _slot?: number;   // its grid slot (a stage: relative to yours)
  _lastQ?: number;   // its distance round the track last step
  _lastOn?: { dist: number; off: number };   // where it was last on the road
  _cut?: CutRun | null;   // a track cut in progress
  _cuts?: number; _cutLog?: number[][];   // track cuts taken; their log (tools)
  _dmgResets?: number;   // resets for damage
  simTime?: number;
};

/** A track cut in progress (game/order.ts): the progress gained; where it left the road. */
export interface CutRun { gain: number; prog?: number; q?: number }

/** Keeps a car's scripted formation driver (the start, or an AI entry: order.ts formationWant). */
export interface FormKeeper { formDrv?: ReturnType<typeof createAutoDriver> }

/** Puts a car down at a spot, facing a heading (a reset). */
export type PlaceCar = (car: GameCar, x: number, y: number, heading: number) => void;

/** A launch's options (menu/setup.ts LAUNCH; window.__game.launch for the tools). */
export interface LaunchOpts {
  ai?: number; diff?: number; aiCars?: string;   // opponents, their difficulty, their cars
  rx?: boolean; laps?: number;   // the RX race; laps (0 = practice)
  road?: string | null; traffic?: number; litter?: number;   // the endless highway
  scenery?: string | null;   // its scenery (?hwpick=1: highway/presets.ts HW_SCENERY)
  weather?: { mode: WeatherMode; season: number }; time?: number | null;   // the conditions
  livery?: { paint?: string; trim?: string; num?: number } | null; tyre?: string;   // garage
  aiTune?: AiTune | null;   // the AI DRIVERS dials (ai/tune.ts)
}

/** A circuit / stage AI driver (ai/circuit.ts). */
export type AiDriver = ReturnType<typeof createAIDriver>;

/** One AI racer: its car, its driver, and the game's bookkeeping. */
export interface AiEntry extends FormKeeper {
  car: GameCar; drv: AiDriver;
  stuckT: number; inGate: boolean;
  stuckFrom?: number;   // m/s when it went slow (gaining since = trying, not stuck)
  offT?: number;   // seconds off the road
  obs?: LooseObstacle[]; obsT?: number;   // loose objects near it (the driver steers round them)
  hurtWait?: number | null; hurtT?: number;   // a hurt car waiting to be repaired
  jLap?: number | null;   // the lap it took its joker
  id?: string; cls?: string; sub?: string;
  // a held car (game/crashbench.ts): drives with these, no driver, never put back on a road
  held?: CarInput;
}

/** What a hurt car's pause-then-reset reads (an AI entry, or the menu demo car). */
export type HurtEntry = Pick<AiEntry, 'car' | 'drv' | 'hurtWait' | 'hurtT'>;

/** The race start: lights on, the clock, green, a rolling (formation) start. */
export interface GameStart extends FormKeeper {
  on: boolean; t: number; tGreen: number; green: boolean; rolling?: boolean;
  tGreen0?: number;   // the green as first set (a stage's later starters count from it)
  prevD?: number | null;   // the pole car's distance last step (the rolling start's line)
}

/** The rallycross race (joker rule): laps, time, the joker and its penalty. */
export interface RxRace {
  on: boolean; laps: number; t: number; started: boolean; joker: boolean; done: boolean;
  total: number; penalty: number; jokers?: number;
}

/** A stage's timer: ready / running / done, the time, the best and the last run. */
export interface StageTimer {
  state: string; t: number; best: number | null; last: number | null; prevD: number | null;
  pen: number;
}

/** The player's laps. */
export interface LapState {
  lap: number; lapTime: number; bestTime: number | null; lastTime: number | null;
  started: boolean; halfway: boolean;
}

/** The game object (filled in by main.ts). */
export interface Game {
  dev: boolean; settings: Settings;
  car: GameCar;
  cones: ReturnType<typeof createCones>;
  marks: ReturnType<typeof createMarks>;
  traffic: ReturnType<typeof createTraffic>;
  ai: AiEntry[];
  poleCar?: GameCar | null;
  flow: RaceFlow | HwFlow | null; flowShown?: boolean; flowDoneAt?: number;
  start: GameStart;
  race: RxRace; stage: StageTimer; lap: LapState;
  audio: ReturnType<typeof createAudio>;
  input: InputState;
  in: CarInput | null;   // the input the sim stepped with this frame
  fps: number; fpsLow: number; fpsClear?: boolean;
  stepsLastFrame: number; simMs?: number; drawMs?: number;
  drawn?: { x: number; y: number; t: number };   // where the car was drawn last frame
  testMode: boolean; paused: boolean; menuMode?: boolean;
  notice?: { text: string; good?: boolean; at: number } | null;
  position?: number;   // your place in a race
  trackD?: number | null;   // your distance round the track
  hwBest: number; hwDist?: number;   // the endless highway: your best, this run
  camCount?: number; camFines?: number; camBest?: number;
  camCaught?: { at: number; kmh: number; mph: number; fine: number } | null;
  // the joker (game/rules.ts)
  jokerPrev?: { x: number; y: number } | null; jokerLap?: number | null; jokerAt?: number;
  inJokerLane?: boolean; inJokerGate?: boolean; jokerTaken?: boolean; jokers?: number;
  lastOnJoker?: { along: number; off: number } | null;
}

/** The shared variables of the game modules (main.ts assigns them in boot order). */
export interface Shared {
  settings: Settings; DEV: boolean; MENU: boolean;
  canvas: HTMLCanvasElement; boot: HTMLElement;
  renderer: ReturnType<typeof createRenderer>;
  hud: ReturnType<typeof createHud>;
  guide: ReturnType<typeof createGuide>;
  audio: ReturnType<typeof createAudio>;
  input: InputState;
  menu: ReturnType<typeof createMenu> | null;
  meter: ReturnType<typeof createMeter> | null;
  reporter: ReturnType<typeof createReporter> | null;
  pacer: ReturnType<typeof createFramePacer>;
  churn: ReturnType<typeof createChurn> | null;
  mode: string;   // 'menu' | 'session'
  started: boolean; paused: boolean;
  acc: number; last: number;   // the fixed-step accumulator; the last frame's time
  race: RxRace; stage: StageTimer; lapState: LapState;
  aiCount: number; aiDiff: number; aiCarMode: string; raceLaps: number; gridSlot: number;
  aiTune?: AiTune | null;   // the dials of this session's field
  trafficDensity: number;
  demo: AiDriver | null; demoStill: number;
  demoHurt?: HurtEntry;   // the menu demo car, hurt (game/ai.ts stepAIInjury)
  autoDrv: AiDriver | null; autoStill: number;
  DEMO_LEVEL: string; DEMO_CAR: string; DEMO_AI: number; DEMO_DIFF: number;
  guidePending: boolean; rulesPending: string | null;
  trackProgress: number;
  lastOnTrack: { dist: number; off: number } | null;
  lastGood: { x: number; y: number; heading: number };
  breadcrumbs: { x: number; y: number; heading: number; t?: number }[];
  lastBreadcrumbTime: number;
  camRecord: Record<string, number>; camDirty: boolean; savedHwBest: number;
  fpsHist: number[]; fpsAcc: number; fpsN: number;
  minimapOn: boolean; progressOn: boolean; trackTempOn: boolean;
  weatherPlan: WeatherPlan | null;
  meterTiles: number; meterTouches: number; meterUploads: number; meterMipmaps: number;
  warmMs: number; loadMs?: number; nanReports: number;
}

declare global {
  // the harness handle (CLAUDE.md §5: a script must be able to drive the real game)
  interface Window { __game: Record<string, unknown> }
}

/** The game object (filled in by main.ts). */
export const game = {} as Game;
/** The shared variables of the game modules. */
export const shared = {} as Shared;

/**
 * The current level as the highway's own (only called while an endless level is current).
 * @returns the highway level
 */
/** The race flow when it is the highway's (highwayrace.ts), else null. */
export function hwFlow(): HwFlow | null {
  const flow = game.flow;
  return flow && 'highway' in flow && flow.highway ? flow : null;
}

export function hwLevel(): HwLevel {
  return LEVEL as unknown as HwLevel;
}
