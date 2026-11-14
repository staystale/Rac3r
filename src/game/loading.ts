// game/loading.ts - THE LOADING SCREEN (?loadscreen=1, FIX.loadscreen): a START (menuflow.ts
// launch) or a RESTART (session.ts doRestart) in a session puts the screen up at once (the track's
// name, a bar: menu/loadscreen.ts), lets a frame paint it, then does the work behind it in stages
// - the level build, the field lined up, the cones stood up, the ground round the grid painted, the
// fly-in's whole-level picture made and sent to the GPU - a stage a task, the bar moving between
// them (and easing on through a long one on the compositor). Then the screen fades, the fly-in
// plays in full, and only when it is over does the sim step: the countdown starts with the player
// in. Race time, the AI and the sim are held while the screen or the fly-in is up (loop.ts). The
// race behind the menu never shows it. Switch off: nothing here runs.
import { FIX } from '../core/fixes.ts';
import { createLoadScreen } from '../menu/loadscreen.ts';
import { PRESS_BLINK_MS } from '../menu/pixelstyle.ts';
import { shared, game } from './state.ts';
import type { LoadScreen } from '../menu/loadscreen.ts';

/** One piece of the work behind the screen. */
export interface LoadStage {
  key: string;   // what kind of work (its time is kept to pace the bar the next time)
  weight: number;   // its share of the bar
  work: () => void;
  more?: () => boolean;   // true: run it again (a slice at a time) before the next stage
}

// ms the screen stays up at the least: a level that loads in a frame or two flashed it up and away
// like a fault; this long it reads as a loading screen
const MIN_SCREEN_MS = 300;
// ms the bar takes to fill its last share when the work is done (then it flashes blue)
const FILL_LAST_MS = 120;
// ms a stage is thought to take before it has been timed (the bar's ease through it)
const FIRST_GUESS_MS = 1500;
// the share of its stage the bar eases to while the stage runs (the rest when it ends)
const CREEP_SHARE = 0.9;
// ground tiles painted a task (each ~2 ms on the laptop, ~7 ms at CPU x4). MEASURED on Spa at x4
// (tools/scratch/_startload.mjs): 6 a task, the field to the screen's end 2.45 s for 0.9 s of
// tiles; 12 a task, 2.07 s - a frame between tasks costs as much as the painting
const TILES_A_SLICE = 12;

type Phase = 'screen' | 'fly' | null;
// (groundLeft: tiles round the grid still to paint)
const state = { phase: null as Phase, generation: 0, shownAt: 0, fieldsQueued: 0,
  groundLeft: false };
// ms each kind of stage took the last time (a session's restarts pace the bar by the first)
const stageMs = new Map<string, number>();
let screen: LoadScreen | null = null;

/**
 * Whether a start or restart goes behind the loading screen: the switch on, in a session.
 * @returns true to load behind the screen
 */
export function loadScreenOn(): boolean {
  return FIX.loadscreen && shared.started && shared.mode === 'session';
}

/**
 * Whether the work behind the screen is under way (the fly-in waits for it).
 * @returns true while the screen is up
 */
export function loadingNow(): boolean {
  return state.phase === 'screen';
}

/**
 * Whether the race is held: the screen or the fly-in after it is up. Ends the hold once the
 * fly-in is over (or the session left for the menu). Called once a frame, before the sim steps.
 * @returns true while the sim, race time and AI must not run
 */
export function holdRace(): boolean {
  if (state.phase === 'fly' && (!shared.renderer.flying || shared.mode !== 'session'))
    state.phase = null;
  return state.phase !== null;
}

/** A field line-up queued (session.ts startField runs in a task of its own). */
export function noteFieldQueued(): void {
  state.fieldsQueued++;
}

/** A queued field line-up done. */
export function noteFieldDone(): void {
  state.fieldsQueued = Math.max(0, state.fieldsQueued - 1);
}

/**
 * The stages every load ends with: the ground round the grid painted (once the field is lined
 * up, so the car is on its slot), then the fly-in started - its whole-level picture painted and
 * uploaded behind the screen.
 * @returns the stages
 */
export function readyStages(): LoadStage[] {
  return [
    { key: 'ground', weight: 0.2, work: () => {
      if (state.fieldsQueued === 0)
        state.groundLeft = shared.renderer.paintStartGround(game.car, TILES_A_SLICE);
    }, more: () => state.fieldsQueued > 0 || state.groundLeft },
    { key: 'picture', weight: 0.08, work: () => shared.renderer.readyFlyIn() },
  ];
}

/**
 * Puts the screen up and runs the stages behind it, one task each after a painted frame, then
 * hands over to the fly-in. A new load replaces one under way.
 * @param name the track's name
 * @param stages the work, in order
 */
export function runLoading(name: string, stages: LoadStage[]): void {
  const generation = ++state.generation;
  state.phase = 'screen';
  state.shownAt = performance.now();
  state.groundLeft = true;
  screen ??= createLoadScreen();
  screen.show(name);
  // a pedal or the stick held into the screen is let go
  shared.input.releaseAll();
  const total = stages.reduce((sum, stage) => sum + stage.weight, 0) || 1;
  let index = 0, done = 0, stageStart = 0;
  const current = () => generation === state.generation;
  const step = () => {
    if (!current()) return;
    const stage = stages[index];
    stage.work();
    if (stage.more && stage.more()) {
      nextFrame();
      return;
    }
    stageMs.set(stage.key, performance.now() - stageStart);
    done += stage.weight;
    index++;
    stageStart = 0;
    if (index < stages.length) nextFrame();
    else finishLoading(generation);
  };
  // the bar's next mark set before the frame paints; the work after it has
  const nextFrame = () => requestAnimationFrame(() => {
    if (!current()) return;
    const stage = stages[index];
    if (!stageStart) {
      stageStart = performance.now();
      screen!.progress((done + stage.weight * CREEP_SHARE) / total,
        stageMs.get(stage.key) ?? FIRST_GUESS_MS * stage.weight);
    }
    setTimeout(step, 0);
  });
  nextFrame();
}

/**
 * The work done: the bar full, the screen held to its least time, the bar flashed blue (as a
 * pressed button: two blinks), then the screen faded over the fly-in's start; the race stays held
 * until the fly-in is over (holdRace).
 * @param generation the load this is
 */
function finishLoading(generation: number): void {
  if (generation !== state.generation) return;
  screen!.progress(1, FILL_LAST_MS);
  const wait = Math.max(FILL_LAST_MS, MIN_SCREEN_MS - (performance.now() - state.shownAt));
  setTimeout(() => flashThenFly(generation), wait);
}

/**
 * The full bar flashes blue, then the screen fades and the fly-in starts.
 * @param generation the load this is
 */
function flashThenFly(generation: number): void {
  if (generation !== state.generation) return;
  screen!.flash();
  setTimeout(() => {
    if (generation !== state.generation) return;
    state.phase = 'fly';
    screen!.hide();
  }, PRESS_BLINK_MS);
}
