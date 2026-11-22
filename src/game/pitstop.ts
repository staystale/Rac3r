// game/pitstop.ts - PIT STOPS, your car (?pitstops step 1; owner 11-15 / 11-22, TODO 16). On the
// pit lane (world/pitlane.ts) the LIMITER holds you to 60 km/h (a light, no penalty). You stop
// in YOUR box yourself (your grid slot's) - with 30 %+ of the car in it and the car still, the PIT
// STOP menu opens (menu/pitmenu.ts) while the race runs on: tyres, repair (refuelling comes with
// fuel).
// CONFIRM & GO holds the car for the work - the jobs overlap, the longest counts; worse damage
// takes longer - + 0.5 s, then the race start's GO lets you go; CANCEL leaves with nothing done.
// The COMPULSORY STOP (owner 11-22: "one stop for fresh tyres"; F1 races, dry): not made, +30 s
// at the finish (raceflow.ts addPenalty: car._pitPen).
import { FIX } from '../core/fixes.ts';
import { LEVEL } from '../world/state.ts';
import { WEATHER } from '../world/weather.ts';
import { PIT_LIMIT_V, boxArrow, onPitLane, pitWorkTime } from '../world/pitlane.ts';
import type { PitBox, PitLevel } from '../world/pitlane.ts';
import { applyTyre, ROSTER, TYRES, tyreFits } from '../cars.ts';
import { repair } from '../damage.ts';
import { PHYSICS_STEP_SECONDS } from '../vehicle.ts';
import { game, shared } from './state.ts';
import type { GameCar } from './state.ts';
import type { CarInput } from '../vehicle.ts';

// m/s over the pit lane's limit (world/pitlane.ts PIT_LIMIT_V) the limiter brakes from
const LIMIT_BRAKE_V = 2;
// the share of the car's footprint in the box that opens the menu, and the speed it must be under
const IN_BOX_SHARE = 0.3, STILL_V = 0.5;
// s the GO is shown
const GO_S = 1.2;
// s added at the finish when a compulsory stop was not made
const MISSED_STOP_S = 30;

/** What the menu chose: a tyre to fit (its id) or none, and a repair or not. */
export interface PitChoice { tyre: string | null; repair: boolean }

// your stop: where it is at (out, menu open, held for the work, GO shown), the sim s the work ends,
// the GO's clock, whether you left the box since the last stop, whether fresh tyres went on
const pit = { phase: 'out' as 'out' | 'menu' | 'work' | 'go', until: 0, clock: 0,
  left: true, tyresDone: false };
// when fresh tyres went on, wall clock (performance.now): the lap panel's PIT TAKEN flash, as the
// joker's (a wall-clock flash, CLAUDE.md §3)
let tyresAt = 0;

/**
 * Whether pit stops run in this session: the switch, the setup's PIT STOPS, a pit lane.
 * @returns on
 */
export const pitsOn = () => FIX.pitstops && !!shared.pitsOn && !!(LEVEL as PitLevel).pits
  && !LEVEL.endless;

/**
 * Whether this race has the compulsory stop: an F1 race (a single-seater, with laps), dry at the
 * start.
 * @returns compulsory
 */
export const pitRule = () => pitsOn() && rowOf(game.car)?.cls === 'single'
  && (shared.raceLaps || 0) > 0 && !(WEATHER.rain > 0);

/**
 * A car's roster row.
 * @param car the car
 * @returns the row
 */
const rowOf = (car: GameCar) => ROSTER.find((one) => one.id === String(car.spec.id).split('#')[0]);

/** A session (re)starts: no stop made, out of the pit lane. */
export function resetPitStop(): void {
  pit.phase = 'out';
  pit.left = true;
  pit.tyresDone = false;
  pit.clock = 0;
  game.pitGo = null;
  game.pitLimiter = false;
  game.pitCue = null;
  game.pitArrows = null;
  game.pitBox = null;
  tyresAt = 0;
  (game.car as GameCar & { _pitPen?: number })._pitPen = 0;
}

/**
 * Shows where to stop, as a joker lap is shown: your box marked (always, pit stops on); while the
 * compulsory stop is to do, the joker's arrows into the pit lane and to your box, and the lap
 * panel's joker line as PIT (hud/laps.ts).
 * @param inLane you are on the pit lane
 */
function showPitCues(inLane: boolean): void {
  const pits = (LEVEL as PitLevel).pits!, box = myBox();
  game.pitBox = box;
  if (!pitRule()) {
    game.pitCue = null;
    game.pitArrows = null;
    return;
  }
  const cue = game.pitCue || { done: false, inLane: false, at: 0, turnD: pits.entryD };
  cue.done = pit.tyresDone;
  cue.inLane = inLane;
  cue.at = tyresAt;
  game.pitCue = cue;
  game.pitArrows = pit.tyresDone ? null : game.pitArrows || (box ? [...pits.arrows,
    boxArrow(box, pits.width)] : pits.arrows);
}

/**
 * The share of the car's footprint inside a box (sampled 5 x 3).
 * @param car the car
 * @param box the box
 * @returns 0..1
 */
function shareInBox(car: GameCar, box: PitBox): number {
  const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  const boxCos = Math.cos(box.heading), boxSin = Math.sin(box.heading);
  let inside = 0;
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
    const along = (i / 4 - 0.5) * car.spec.len, across = (j / 2 - 0.5) * car.spec.wid;
    const dx = car.x + cos * along - sin * across - box.x;
    const dy = car.y + sin * along + cos * across - box.y;
    if (Math.abs(dx * boxCos + dy * boxSin) <= box.len / 2
      && Math.abs(-dx * boxSin + dy * boxCos) <= box.wid / 2) inside++;
  }
  return inside / 15;
}

/**
 * Your box: your grid slot's (the last box past the field's size).
 * @returns the box
 */
export function myBox(): PitBox | null {
  const boxes = (LEVEL as PitLevel).pits?.boxes || [];
  return boxes[Math.min(boxes.length - 1, Math.max(0, shared.gridSlot | 0))] || null;
}

/**
 * The menu's numbers and choices for your car: tyre wear and damage (0..1), the tyres it may fit.
 * @returns the menu's view
 */
export function pitView() {
  const car = game.car, row = rowOf(car);
  const wear = (car.tyreWear || [0, 0, 0, 0]).reduce((all, one) => all + one, 0) / 4;
  const damage = (car.dmg || [0, 0, 0, 0]).reduce((all, one) => all + one, 0) / 4;
  const fits = row ? TYRES.filter((tyre) => tyreFits(tyre, row)) : [];
  const current = (car.spec.tyre as { id?: string } | null)?.id || 'pre-spun';
  return { wear, damage, current, tyres: fits.map((tyre) => ({ id: tyre.id, name: tyre.name })) };
}

/**
 * The stop's work in s: the jobs overlap (the longest counts), a repair longer the worse the
 * damage; + STOP_S.
 * @param choice the menu's choice
 * @param damage the car's damage, 0..1
 * @returns s
 */
export const workTime = (choice: PitChoice, damage: number): number =>
  pitWorkTime(!!choice.tyre, choice.repair, damage);

/**
 * CONFIRM & GO: the choice done on the car, held for the work, then GO. CANCEL (null): away now.
 * @param choice the choice, or null
 */
export function pitChosen(choice: PitChoice | null): void {
  if (pit.phase !== 'menu') return;
  if (!choice || (!choice.tyre && !choice.repair)) {
    pit.phase = 'out';
    return;
  }
  const car = game.car, work = workTime(choice, pitView().damage);
  if (choice.tyre) {
    applyTyre(car.spec, choice.tyre);
    car.tyreWear = [0, 0, 0, 0];
    pit.tyresDone = true;
    tyresAt = performance.now();
  }
  if (choice.repair) repair(car);
  pit.phase = 'work';
  pit.until = pit.clock + work;
}

/** The menu opens (game/menuflow.ts: the menu's own screen), the race running on. */
function openMenu(): void {
  pit.phase = 'menu';
  pit.left = false;
  if (shared.menu) shared.menu.pitStop(pitView(), (choice) => pitChosen(choice));
  else pitChosen(null);
}

/** The stop's clock: the missed stop's penalty kept, the work's end the GO, the GO's time. */
function stepPitClock(): void {
  pit.clock += PHYSICS_STEP_SECONDS;
  const car = game.car as GameCar & { _pitPen?: number };
  car._pitPen = pitRule() && !pit.tyresDone ? MISSED_STOP_S : 0;
  if (pit.phase === 'work' && pit.clock >= pit.until) {
    pit.phase = 'go';
    game.pitGo = { on: true, t: 0, tGreen: 0, green: true };
  }
  if (game.pitGo) {
    game.pitGo.t += PHYSICS_STEP_SECONDS;
    if (game.pitGo.t > GO_S) game.pitGo = null;
  }
}

/**
 * One sim step of your stop: the limiter on the pit lane, the menu as you stop in your box, the
 * hold for the work, the GO; the controls as the stop lets them be.
 * @param inp this step's controls
 * @returns the controls
 */
export function pitInput(inp: CarInput): CarInput {
  if (!pitsOn()) return inp;
  stepPitClock();
  const car = game.car as GameCar & { _pitPen?: number };
  if (pit.phase === 'menu' || pit.phase === 'work') {
    showPitCues(true);
    return { ...inp, throttle: 0, brake: 1, handbrake: 1 };
  }
  if (pit.phase === 'go') pit.phase = 'out';
  const inLane = onPitLane(LEVEL as PitLevel, car.x, car.y);
  const speed = Math.hypot(car.vx, car.vy);
  game.pitLimiter = inLane;
  showPitCues(inLane);
  if (!inLane) {
    pit.left = true;
    return inp;
  }
  const box = myBox();
  if (box && pit.left && speed < STILL_V && shareInBox(car, box) >= IN_BOX_SHARE) {
    openMenu();
    return { ...inp, throttle: 0, brake: 1 };
  }
  if (speed <= PIT_LIMIT_V) return inp;
  const over = speed > PIT_LIMIT_V + LIMIT_BRAKE_V;
  return { ...inp, throttle: 0, brake: over ? Math.max(inp.brake, 0.5) : inp.brake };
}

/**
 * A reset on the pit lane: back on the track at the pit lane's entrance (owner 11-22), as a track
 * spot (track m, m across: on the pit lane's side).
 * @param back m the reset goes back from a spot (RESET_BACK)
 * @returns the spot, or null when not on the pit lane
 */
export function pitResetSpot(back: number): { dist: number; off: number } | null {
  const level = LEVEL as PitLevel;
  if (!pitsOn() || !onPitLane(level, game.car.x, game.car.y)) return null;
  const sub = level.subtrack!, total = sub.totalDist, pits = level.pits!;
  return { dist: (pits.entryD + back) % total, off: 1 };
}
