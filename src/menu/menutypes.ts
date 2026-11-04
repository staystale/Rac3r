// menu/menutypes.ts: the shapes the menu screens share - what the session hands the pause and
// results screens, a race's results, and the setup screen's choices.
import type { Car } from '../vehicle.ts';
import type { AiTune } from '../ai/tune.ts';

/** One row of the pause menu's HUD list (game/menuflow.ts hudActions). */
export interface HudItem { id: string; label: string; on: boolean; locked: boolean; value?: string }

/** What the pause menu's SOUND row reads and sets (audio.ts). */
export interface MenuAudio {
  volume: number; muted: boolean;
  setVolume: (value: number) => void; toggleMute: () => void;
}

/** The session's actions for the pause menu (game/menuflow.ts openPause). */
export interface PauseActions {
  resume: () => void; restart: () => void; guide: () => void; exit: () => void;
  rules: (() => void) | null;   // this event's walkthrough, when it has one
  tests?: boolean;   // the TESTING list (test mode only)
  audio?: MenuAudio | null;
  hud?: { items: () => HudItem[]; set: (pieceId: string, shown: boolean) => void };
}

/** The session's actions for the results screens (game/menuflow.ts stepResults). */
export interface ResultsActions {
  name: string;   // the level's name
  restart: () => void; tracks: () => void; menu: () => void;
}

/** One finisher's row (raceflow.ts endRace; the highway's its own fields). */
export interface ResultRow {
  car: Car & { spec: Car['spec'] & { name?: string } };
  player: boolean; num: number; paint?: string;
  pos: number;
  time?: number; penalty: number; total: number;   // s; the penalty added; with it
  est: boolean; dnf: boolean;   // an estimate (not home); did not finish
  best: number | null; laps?: number; jokers?: number;
  bill: number;   // the damage bill, £
  gap?: number;   // s behind the winner
  dist?: number; gapM?: number;   // the highway: m driven; m behind the leader
}

/** A finished race, as the results read it (raceflow.ts). */
export interface ResultsFlow {
  results: ResultRow[];
  t: number; endT: number | null;   // the race clock; when it ended
  laps: number;
  highway?: boolean; stage?: unknown;   // the kind of event
}

/** The setup screen's widgets that paintSetupOpponents repaints. */
export interface SetupUi {
  bSolo?: HTMLButtonElement; bAI?: HTMLButtonElement;
  nRow?: HTMLElement; nLbl?: HTMLElement;   // the AI count ticker
  dRow?: HTMLElement; dBtns?: HTMLButtonElement[]; dName?: HTMLElement;
  aRow?: HTMLElement; bCls?: HTMLButtonElement; bSame?: HTMLButtonElement;
  tRow?: HTMLElement; tLine?: HTMLElement;   // ?aisliders: AI DRIVERS > and its line
}

/** The setup screen's choices (menu/setup.ts showSetup). */
export interface SetupState {
  road: string | null;   // the endless highway's road type
  traffic: number; litter: number;   // endless: traffic and roadside litter density
  opponents: number;   // VS AI opponents (0 = solo)
  aiN: number;   // how many opponents VS AI picks
  diff: number;   // AI difficulty (an index into DIFF)
  aiCars: string;   // AI cars: 'class' or 'same'
  rxRace: boolean;   // the RX race (joker level) rather than practice
  laps: number;
  ui: SetupUi;
  paint: () => void;   // repaints the setup rows
  weather?: { mode: string; season: number };
  time?: number | null;   // the hour the event starts at (null: live; the clock on)
  aiTune?: AiTune | null;   // ?aisliders: the AI DRIVERS dials (null: the difficulty's preset)
}
