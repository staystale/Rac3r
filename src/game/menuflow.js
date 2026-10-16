// menuflow.js — Menu, launch, pause and the results screen flow.
import { applyLivery, applyTyre } from '../cars.ts';
import { createCones } from '../cones.js';
import { rulesSeen } from '../guide.js';
import { setHighwayPreset } from '../highway.js';
import { createAIDriver } from '../ai/circuit.ts';
import { aiTraits } from '../ai/traits.ts';
import { setLevel } from "../world/load.ts";
import { LEVEL } from "../world/state.ts";
import { clearWear } from "../world/wear.ts";
import { LEVELS } from "../world/levels/index.ts";
import { saveRecords, doRestart } from './session.js';
import { selectLevel, selectCar } from './controls.js';
import { shared, game } from './state.js';
import { minimapSetting, setMinimapSetting } from '../hud/minimap.js';
import { showMenuVideo, hideMenuVideo } from './menuvideo.js';

/**
 * Works out whether the minimap shows (not with ?minimap=0; then the pause setting of the
 * current difficulty mode) into shared.minimapOn, which the HUD reads every frame.
 */
export function refreshMinimap() {
  shared.minimapOn = !!shared.settings.minimap && minimapSetting(shared.aiDiff).on;
}

export function start() {
  if (shared.started || shared.MENU) return;
  shared.started = true;
  shared.boot.classList.add('gone');
  shared.audio.init();
  doRestart();
  const guideSetting = shared.settings.guide;
  shared.guidePending = guideSetting === '1'
    || (guideSetting !== '0' && !shared.guide.seen && !navigator.webdriver);
}

// ---- MENU WIRING (only with ?menu=1 for now)
export function enterMenu() {
  saveRecords();
  shared.mode = 'menu';
  shared.paused = false;
  shared.started = true;
  shared.aiCount = shared.DEMO_AI;
  shared.aiDiff = shared.DEMO_DIFF;
  game.ai = [];
  game.start = { on: false, green: true, t: 0, tGreen: 0 };
  shared.boot.classList.add('gone');
  shared.hud.close();
  shared.race.on = false;
  // the recording behind the menu (menuvideo.js); ?menulive=1: the live race below
  shared.menuVideo = !shared.settings.menuLive && showMenuVideo();
  if (shared.menuVideo) {
    setTimeout(paintThumbsSoon, THUMB_START_MS);
    return;
  }
  if (LEVEL.id !== shared.DEMO_LEVEL) selectLevel(shared.DEMO_LEVEL); else doRestart();
  if (game.car.spec.id !== shared.DEMO_CAR) selectCar(shared.DEMO_CAR);
  shared.demo = createAIDriver(LEVEL,
    aiTraits(shared.DEMO_DIFF, 2, shared.DEMO_AI + 1, 1 + Math.floor(Math.random() * 1e6)));
}
/**
 * Applies the setup options of a launch (road, AI, race, traffic, litter) before the restart.
 * @param {string} levelId the level to launch
 * @param {object} opts the launch options
 */
export function applyLaunchOptions(levelId, opts) {
  // ROAD TYPE (endless highway, Test Mode setup): set before the restart below builds the road
  {
    const level = LEVELS.find((item) => item.id === levelId);
    if (level && level.endless && opts.road) setHighwayPreset(level, opts.road);
  }
  shared.aiCount = Math.max(0, Math.min(5, opts.ai | 0));
  shared.aiDiff = shared.settings.aiDifficulty;   // the menu race set its own
  if (opts.diff != null) shared.aiDiff = Math.max(0, Math.min(4, opts.diff | 0));
  refreshMinimap();   // the minimap's default follows the difficulty mode
  shared.race.on = !!opts.rx;
  shared.aiCarMode = opts.aiCars === 'class' ? 'class' : 'same';
  shared.raceLaps = Math.max(0, Math.min(10, opts.laps | 0));
  if (opts.traffic != null) shared.trafficDensity = Math.max(0, Math.min(1.5, +opts.traffic));
  {
    const level = LEVELS.find((item) => item.id === levelId);
    if (level && level.endless && opts.litter != null) level.litter = Math.max(0,
      Math.min(3, +opts.litter));
  }
}
/**
 * Starts a session: mode, options, level, car, livery and tyres, then the first walkthroughs.
 * @param {string} levelId the level to launch
 * @param {string} carId the car to drive
 * @param {object} opts the launch options (ai, diff, rx, laps, road, traffic, litter, ...)
 */
export function launch(levelId, carId, opts = {}) {
  hideMenuVideo();
  shared.menuVideo = false;
  shared.mode = 'session';
  shared.demo = null;
  shared.paused = false;
  applyLaunchOptions(levelId, opts);
  shared.audio.init();
  if (LEVEL.id !== levelId) selectLevel(levelId);
  if (game.car.spec.id !== carId) selectCar(carId);
  applyLivery(game.car.spec, opts.livery);
  // TYRES from the garage (none = Pre-Spun, the stock car)
  // PAINT + NUMBER from the garage (none = the car's own colours, no number)
  applyTyre(game.car.spec, opts.tyre);
  doRestart();
  const guideSetting = shared.settings.guide;
  shared.guidePending = guideSetting === '1'
    || (guideSetting !== '0' && !shared.guide.seen && !navigator.webdriver);
  // EVENT RULES the first time you do this kind of event (guide.js RULES); after HOW TO PLAY if
  // that is showing too. ?rules=1 forces them (photos), ?rules=0 / automation skips them, as the
  // guide.
  const rulesSetting = shared.settings.rules, kind = eventKind();
  shared.rulesPending = kind
    && (rulesSetting === '1' || (rulesSetting !== '0' && !rulesSeen(kind) && !navigator.webdriver))
      ? kind : null;
}
// which RULES walkthrough this session needs (guide.js RULES keys), or null
export function eventKind() {
  if (LEVEL.endless) return game.ai.length || shared.aiCount ? 'highway' : 'endless';
  if (LEVEL.stage && (shared.aiCount || game.ai.length)) return 'stage';
  if (shared.race.on) return 'rx';
  if (shared.aiCount) return 'race';
  return null;
}
export function openPause() {
  saveRecords();
  shared.paused = true;
  const kind = eventKind();
  shared.menu.pause({
    resume: () => {
      shared.paused = false;
    },
    restart: () => {
      shared.paused = false;
      doRestart();
    },
    guide: () => {
      shared.paused = false;
      shared.guide.open();
    },
    rules: kind ? () => {
      shared.paused = false;
      shared.guide.openRules(kind);
    } : null,
    tests: game.testMode,   // the TESTING list (src/testlist.js) in the pause menu, test mode only
    audio: shared.audio,                  // the SOUND slider + MUTE (menu.js pause)
    // the MINIMAP row (none with ?minimap=0): this difficulty mode's setting, locked in REAL
    minimap: shared.settings.minimap ? {
      setting: () => minimapSetting(shared.aiDiff),
      set: (shown) => {
        setMinimapSetting(shared.aiDiff, shown);
        refreshMinimap();
      },
    } : null,
    exit: () => {
      shared.paused = false;
      enterMenu();
    },
  });
}
// TRACK THUMBNAILS (the menu's track lists). MEASURED (TEST MODE tap, CPU x4): painting them all on
// the tap froze the menu 3.1 s, 2.0 s of it building ground detail a 320 px thumbnail cannot show
// (now a light build, load.ts prepareLevel). While the menu recording plays nothing else runs, so
// they are painted one level at a time in the background (paintThumbsSoon); the tap paints only
// what is still missing. Each is painted with its level current, then the level before is put back.
const THUMB_START_MS = 1200, THUMB_STEP_MS = 120;
const thumbs = {};
/**
 * Paints one level's thumbnail (its level becomes current: put the old one back after).
 * @param {object} level the level
 */
function paintThumb(level) {
  setLevel(level.id, { light: true });
  thumbs[level.id] = shared.renderer.thumbnail(320);
}
/**
 * Every level's thumbnail, painting the ones still missing now.
 * @returns {Record<string, HTMLCanvasElement>} level id -> thumbnail
 */
export function paintThumbs() {
  const keep = LEVEL.id, missing = LEVELS.filter((level) => !thumbs[level.id]);
  if (!missing.length) return thumbs;
  for (const level of missing) paintThumb(level);
  setLevel(keep);
  game.cones = createCones();
  clearWear();
  return thumbs;
}
/** Paints the next missing thumbnail, then the next a moment later, while the recording plays. */
function paintThumbsSoon() {
  const next = LEVELS.find((level) => !thumbs[level.id]);
  if (!next || shared.mode !== 'menu' || !shared.menuVideo) return;
  const keep = LEVEL.id;
  paintThumb(next);
  setLevel(keep);
  setTimeout(paintThumbsSoon, THUMB_STEP_MS);
}
// RESULTS: 1.6 s after the race ends (the flag sweep), the podium then the table (menu.js results)
export function stepResults() {
  const flow = game.flow;
  if (!flow || flow.state !== 'done' || game.flowShown || !shared.menu
    || shared.mode !== 'session') return;
  if (performance.now() - (game.flowDoneAt || 0) < 1600) return;
  game.flowShown = true;
  shared.menu.results(flow,
    { name: LEVEL.name, restart: () => doRestart(), tracks: () => enterMenu(),
      menu: () => enterMenu() });
}
