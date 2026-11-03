// hud/hudtypes.ts: the shapes the HUD shares - its state, the actions a tap returns, and the game
// as the HUD reads it (a narrow view of main.js's game object).
import type { Car } from '../vehicle.ts';
import type { TuneRow } from '../tune.ts';
import type { DamageCar } from '../damage.ts';
import type { RoadFrame } from '../ai/types.ts';

/** The HUD's own state (hud.ts newHudState). */
export interface HudState {
  hidden: Set<string>;   // pieces the player turned off (the pause menu's HUD list)
  expanded: boolean;   // the car / level list is open
  tuneOpen: boolean;   // the debug / tuning panel is open (only one of the two)
  shiftFlash: number; gearFlash: number; lastGear: number;
  aidFlash: { abs: number; tcs: number };
  helpLabel: string;   // '?' (replay the guide) or 'II' (pause) with the menus on
  tyreHud: boolean;   // the player's TYRE / DAMAGE choice
  carDiagram: boolean;   // the diagram is drawn this frame
  mph: boolean; tempF: boolean;   // the units
  flagSeen: number; flagAt: number; flagTxt: string;   // the race flag banner
  drawLightsLater: (() => void) | null;   // the start lights / notices, drawn last
}

/** What a tap on the HUD asks for (null: it missed every control). */
export interface HudAction {
  consumed?: boolean;   // swallowed, nothing else to do
  toggleAbs?: boolean; toggleTcs?: boolean; toggleLights?: boolean;
  indicate?: number;   // -1 left, 1 right
  tune?: TuneRow; dir?: number; tuneReset?: boolean;
  car?: string; level?: string;   // a pick from the dropdown
  restart?: boolean; reset?: boolean; clear?: boolean; volumeCycle?: boolean; help?: boolean;
}

/** The car as the HUD reads it: the car, its damage / tyre / engine systems, its lamps. */
export type HudCar = Car & DamageCar & {
  _hwf?: RoadFrame | null;   // where it is on the highway's road (traffic.ts)
  indicator?: number;   // -1 left, 0 off, 1 right
  lightsOn?: boolean;
};

/** A point on the screen, css px. */
export interface ScreenPoint { x: number; y: number }

/** One entry of a race's running order (raceflow.ts). */
export interface HudFlowEntry {
  id: string; player?: boolean; car?: HudCar;
  lapDone: number; finish?: number | null;   // laps done; the finish time once home
}
/** A race with AI, as the HUD reads it (raceflow.ts). */
export interface HudFlow {
  entries: HudFlowEntry[]; flags: unknown[];   // the order; one flag per finisher so far
  highway?: boolean; stage?: boolean;   // the kind of event
  laps: number; myPlace?: number; t: number;
}
/** The rallycross race state: laps, time, the joker and its penalty (raceflow.ts). */
export interface HudRace {
  on: boolean; started: boolean; done: boolean; t: number; total: number; laps: number;
  joker: boolean; jokers: number; penalty: number;
}
/** A stage's timer (game/rules.js). */
export interface HudStage { state: string; t: number; last: number; best: number | null }
/** The start lights (game/order.js armStart). */
export interface HudStart {
  on: boolean; t: number; tGreen: number; green: boolean; rolling?: boolean;
}
/** A banner (game/session.js note). */
export interface HudNotice { text: string; good: boolean; at: number }
/** The input as the HUD draws it (input.ts). */
export interface HudInput {
  stick: { active: boolean; ox: number; oy: number; x: number; y: number };
  stickReach?: number;   // px of thumb for full lock (core/steerfeel.ts)
  pedals: Record<string, boolean>;
  // the pedals' circles for a screen size (input.ts findPedalHits)
  pedalHits: (width: number, height: number) => { name: string; x: number; y: number; r: number }[];
  isTouch: () => boolean;
}
/** The game object as the HUD reads it (main.js). */
export interface HudGame {
  car: HudCar;
  ai?: { car: HudCar }[];
  fps: number; fpsLow?: number; stepsLastFrame?: number; dev?: boolean; testMode?: boolean;
  position?: number;   // your place in a race
  flow?: HudFlow | null; race?: HudRace | null; stage?: HudStage | null; start?: HudStart;
  lap: { lap: number; lapTime: number; bestTime: number | null };
  notice?: HudNotice | null;
  camCount?: number; camFines?: number;   // highway speed cameras: caught, fined
  camCaught?: { at: number; kmh: number; mph: number; fine: number } | null;   // the last flash
  trackD?: number | null;   // the player's distance round the track
  jokerAt?: number; inJokerLane?: boolean;
  hwDist?: number; hwBest?: number;   // the endless highway's distance, and its best
  marks: { stamps: number };
  input: HudInput;
  in?: { throttle: number; steer: number; handbrake: number; brake: number };
  cones: { total: number; knocked: number };
  audio?: { muted: boolean; volume: number };
}
