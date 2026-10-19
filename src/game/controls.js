// controls.js — HUD and key controls, and the level and car selectors.
import { makeCar } from '../vehicle.ts';
import { CAR_IDS } from '../cars.ts';
import { createCones } from '../cones.js';
import { nudge, resetAll, snapshot } from '../tune.js';
import { setLevel } from "../world/load.ts";
import { LEVEL } from "../world/state.ts";
import { clearWear } from "../world/wear.ts";
import { LEVELS } from "../world/levels/index.ts";
import { spawnAI } from './grid.js';
import { armStart } from './order.js';
import { doReset, saveRecords, doRestart, saveTyreWear, loadTyreWear } from './session.js';
import { openPause } from './menuflow.js';
import { shared, game } from './state.js';

/**
 * Steps the master volume round: 100% -> 50% -> 20% -> muted -> 100%.
 */
export function cycleVolume() {
  if (shared.audio.muted) {
    shared.audio.toggleMute();
    shared.audio.setVolume(1.0);
  } else if (shared.audio.volume > 0.65) {
    shared.audio.setVolume(0.50);
  } else if (shared.audio.volume > 0.30) {
    shared.audio.setVolume(0.20);
  } else {
    shared.audio.toggleMute();
  }
}

/**
 * Toggles the player's indicator on one side (-1 left, 1 right), or switches it off.
 * @param {number} side the side to indicate
 */
export function toggleIndicator(side) {
  game.car.indicator = game.car.indicator === side ? 0 : side;
  game.car.indT = 0;
  game.car.indTurned = false;
}

/**
 * Applies the toggles of a HUD action (aids, lights, indicator).
 * @param {object} action the HUD action
 */
export function hudToggles(action) {
  if (action.toggleAbs) game.car.absOn = !game.car.absOn;
  if (action.toggleTcs) game.car.tcsOn = !game.car.tcsOn;
  if (action.toggleLights) game.car.lightsOn = !game.car.lightsOn;
  if (action.indicate) toggleIndicator(action.indicate);
}

/**
 * Applies a HUD action to the game.
 * @param {object} action the action from hud.hit
 */
export function applyHudAction(action) {
  if (action.car) selectCar(action.car);
  if (action.restart) doRestart();
  if (action.reset) doReset();
  if (action.clear) game.marks.clear();
  if (action.help) {
    shared.hud.close();
    if (shared.MENU) openPause(); else shared.guide.open();
  }
  if (action.volumeCycle) cycleVolume();
  if (action.tune) nudge(game.car, action.tune, action.dir);
  if (action.tuneReset) resetAll(game.car);
  if (action.level) selectLevel(action.level);
  hudToggles(action);
}

/**
 * Handles a touch / click on the HUD (asked before the stick or the pedals claim the pointer).
 * @param {number} tapX the x of the tap
 * @param {number} tapY the y of the tap
 * @returns {boolean} true if the HUD consumed the touch
 */
export function hudDown(tapX, tapY) {
  if (!shared.started || shared.mode === 'menu') return false;
  // the guide, while open, owns every tap — before the HUD, the stick or the pedals
  if (shared.guide.hit({ x: tapX, y: tapY })) return true;
  const action = shared.hud.hit({ x: tapX, y: tapY }, shared.renderer.W, shared.renderer.H,
    game.car);
  if (!action) return false;
  applyHudAction(action);
  return true;
}

/**
 * Keys that toggle a car aid, light or indicator; one key at most is handled.
 * @param {string} key the key
 */
export function carToggleKey(key) {
  // driver aids, on cars that have them
  if (key === 't' && game.car.spec.aids
    && game.car.spec.aids.tcs) game.car.tcsOn = !game.car.tcsOn;
  // headliGhts
  if (key === 'g') game.car.lightsOn = !game.car.lightsOn;
  if (key === 'q' || key === 'e') toggleIndicator(key === 'q' ? -1 : 1);
  if (key === 'b' && game.car.spec.aids
    && game.car.spec.aids.abs) game.car.absOn = !game.car.absOn;
}

/**
 * Handles a key press that reaches the game (not the guide's, not the pause's).
 * @param {string} key the key
 */
export function gameKey(key) {
  if (key === 'r') doReset();
  if (key === 'R' || key === 'Backspace') doRestart();
  if (key === 'c') game.marks.clear();
  if (key === 'l') cycleLevel();
  if (key === 'm') shared.audio.toggleMute();
  carToggleKey(key);
  const index = '12345'.indexOf(key);
  if (index >= 0) selectCar(CAR_IDS[index]);
  if (key === '[') cycleCar(-1);
  if (key === ']') cycleCar(1);
}

/**
 * Handles a key press: the guide, help, pause, then the game keys.
 * @param {string} key the key
 */
export function onKey(key) {
  if (shared.guide.active) {
    shared.guide.key(key);
    return;
  }
  if (key === 'h' && shared.started) {
    shared.hud.close();
    shared.guide.open();
    return;
  }
  if (shared.MENU && shared.mode === 'session' && (key === 'p' || key === 'escape')
    && !shared.paused) {
    openPause();
    return;
  }
  gameKey(key);
}

// LEVELS (requirement: make it so you can switch levels between the lab and the surface sandbox). A
// level owns its surfaces, its bumps and its cones, so switching means rebuilding the cone field
// and clearing the marks layer — a rut ploughed through the sandbox's mud has no
// business appearing on the lab floor at the same coordinates.
export function selectLevel(levelId) {
  if (levelId === LEVEL.id) return;
  saveRecords();
  setLevel(levelId);
  // MEASURED BUG (requirement: joker lap HUD warning showing on tracks it shouldn't): the RX race
  // flag survived the in-game level switch, so after an RX race on Knobhill every track showed
  // LAP n/5 + JOKER TO DO. A level without a joker has no RX race.
  if (!LEVEL.joker) shared.race.on = false;
  game.cones = createCones();     // cones are per-level, so the field is rebuilt from the new list
  game.marks.clear();
  clearWear();
  doRestart();
}
export function cycleLevel() {
  const i = LEVELS.findIndex((item) => item.id === LEVEL.id);
  selectLevel(LEVELS[(i + 1) % LEVELS.length].id);
}

// Switching car RESETS the car but KEEPS THE MARKS (PLAN.md): driving the same corner in two cars
// and comparing the two signatures side by side is the whole point of the selector. The roster is
// swapped, never rebuilt, so it is instant.
export function selectCar(carId) {
  if (!carId || carId === game.car.spec.id) return;
  saveTyreWear();   // the old car's set is kept; the new car takes its own
  game.car = makeCar(carId);
  if (shared.mode === 'session') loadTyreWear(game.car);
  snapshot(game.car);     // so the tune panel can mark what has been changed from stock
  doReset();
  spawnAI();              // the AI drive the same car as the player (user)
  armStart();
}
export function cycleCar(offset) {
  const i = CAR_IDS.indexOf(game.car.spec.id);
  selectCar(CAR_IDS[(i + offset + CAR_IDS.length) % CAR_IDS.length]);
}
