// menuflow.ts — Menu, launch, pause and the results screen flow.
import { applyLivery, applyTyre } from '../cars.ts';
import { createCones } from '../cones.ts';
import { rulesSeen } from '../guide.ts';
import { setHighwayPreset, HW_NAMES } from '../highway.ts';
import { catOf } from '../world/levels/category.ts';
import { FIX } from '../core/fixes.ts';
import { createAIDriver } from '../ai/circuit.ts';
import { aiTraits } from '../ai/traits.ts';
import { setLevel } from "../world/load.ts";
import { CLOCK, calendarAt, startEventClock } from "../world/clock.ts";
import { LEVEL } from "../world/state.ts";
import { clearWear } from "../world/wear.ts";
import { LEVELS } from "../world/levels/index.ts";
import { saveRecords, doRestart, loadTyreWear, saveTyreWear } from './session.ts';
import { selectLevel, selectCar } from './controls.ts';
import { shared, game } from './state.ts';
import {
  minimapSetting, setMinimapSetting, progressSetting, setProgressSetting,
} from '../hud/minimap.ts';
import { setTrackTempSetting, trackTempSetting } from '../hud/tracktemp.ts';
import { BUILD_ID, hasSavedThumbs, readThumbs, saveThumbs } from '../menu/thumbcache.ts';
import { loadProfile } from '../menu/profile.ts';
import type { Level } from '../world/types.ts';
import type { HwLevel } from '../highway/hwtypes.ts';
import type { ResultsFlow } from '../menu/menutypes.ts';
import type { LaunchOpts } from './state.ts';
import { MAX_AI } from '../core/settings.ts';

/**
 * Works out whether the minimap, the progress bar and the track gauge show (the pause settings
 * of the current difficulty mode) into shared.minimapOn, progressOn and trackTempOn, which the
 * HUD reads every frame.
 */
export function refreshMinimap() {
  shared.minimapOn = minimapSetting(shared.aiDiff).on;
  shared.progressOn = progressSetting(shared.aiDiff);
  shared.trackTempOn = trackTempSetting(shared.aiDiff).on;
}

/**
 * The pause menu's HUD list: each piece's label, whether it shows and whether
 * this difficulty mode locks it; set() remembers a choice and applies it at once.
 * @returns { items, set }
 */
function hudActions() {
  const hud = shared.hud, mode = shared.aiDiff;
  // the minimap and its bar; the track temperature gauge (the minimap's rule per mode) and the
  // units
  const mapItems = () => [
    { id: 'minimap', label: 'MINIMAP', ...minimapSetting(mode) },
    { id: 'progress', label: 'PROGRESS BAR', on: progressSetting(mode), locked: false },
  ];
  const unitItems = () => [
    { id: 'trackTemp', label: 'TRACK TEMP', ...trackTempSetting(mode) },
    { id: 'speedUnits', label: 'SPEED', on: true, locked: false, value: hud.mph ? 'MPH' : 'KM/H' },
    { id: 'tempUnits', label: 'TEMPERATURE', on: true, locked: false,
      value: hud.tempF ? '°F' : '°C' },
  ];
  return {
    items: () => [
      ...mapItems(),
      { id: 'lapTimer', label: 'LAP TIMER', on: hud.pieceShown('lapTimer'), locked: false },
      { id: 'speedo', label: 'SPEEDO', on: hud.pieceShown('speedo'), locked: false },
      { id: 'tyres', label: 'TYRE / DAMAGE', on: hud.tyreHud, locked: false },
      ...unitItems(),
    ],
    set: (pieceId: string, shown: boolean) => {
      if (pieceId === 'minimap') setMinimapSetting(mode, shown);
      else if (pieceId === 'progress') setProgressSetting(mode, shown);
      else if (pieceId === 'tyres') hud.setTyreHud(shown);
      else if (pieceId === 'trackTemp') setTrackTempSetting(mode, shown);
      else if (pieceId === 'speedUnits') hud.setMph(!hud.mph);
      else if (pieceId === 'tempUnits') hud.setTempF(!hud.tempF);
      else hud.setPieceShown(pieceId, shown);
      refreshMinimap();
    },
  };
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

// ?menurand: the kinds of track the menu race picks from (lapped racing - not the rally stages
// or the test grounds), and the chance it is the highway
const MENU_CATS = new Set(['circuits', 'ovals', 'rx']), HW_CHANCE = 0.2;
// ?menurand: the field behind the menu, cars with the camera car, fewest .. most (owner 11-07:
// "vary the ai amount 5-20 randomly")
const FIELD_MIN = 5, FIELD_MAX = 20;

/**
 * The menu race's track: ?menurand - a random circuit, oval or rallycross track, never the one
 * just raced; the highway (a random road type) one time in HW_CHANCE. Else Thruston.
 * @returns the level id
 */
function menuLevel(): string {
  if (!FIX.menurand) return shared.DEMO_LEVEL;
  const highway = LEVELS.find((level) => level.endless);
  if (highway && Math.random() < HW_CHANCE) {
    const roads = Object.keys(HW_NAMES);
    setHighwayPreset(highway as unknown as HwLevel,
      roads[Math.floor(Math.random() * roads.length)]);
    return highway.id;
  }
  const pool = LEVELS.filter((level) => MENU_CATS.has(catOf(level)) && level.id !== LEVEL.id);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)].id : shared.DEMO_LEVEL;
}

// ---- MENU WIRING (only with ?menu=1 for now)
export function enterMenu() {
  saveRecords();
  saveTyreWear();   // the event is over: the set as worn as it is now
  shared.mode = 'menu';
  shared.paused = false;
  shared.started = true;
  // (?menurand: a random field, FIELD_MIN .. FIELD_MAX cars; ?menuai=N still sets it)
  const menuAi = FIX.menurand && !new URLSearchParams(location.search).has('menuai')
    ? FIELD_MIN - 1 + Math.floor(Math.random() * (FIELD_MAX - FIELD_MIN + 1)) : shared.DEMO_AI;
  shared.aiCount = menuAi;
  shared.aiDiff = shared.DEMO_DIFF;
  game.ai = [];
  game.start = { on: false, green: true, t: 0, tGreen: 0 };
  shared.boot.classList.add('gone');
  shared.hud.close();
  shared.race.on = false;
  // the race behind the menu is dry it shows the global time
  // and its season's weather (owner)
  shared.weatherPlan = CLOCK.isOn ? { mode: 'season', season: calendarAt(CLOCK.globalS).season,
    seed: Math.floor(Math.random() * 2147483646) + 1 } : null;
  startEventClock(null);
  const menuId = menuLevel();
  if (LEVEL.id !== menuId) selectLevel(menuId); else doRestart();
  // the camera car: YOUR car from the garage, in its paint and number (owner 11-01)
  const profile = loadProfile(), demoCar = profile ? profile.active : shared.DEMO_CAR;
  if (game.car.spec.id !== demoCar) selectCar(demoCar);
  if (profile) applyLivery(game.car.spec, (profile.livery || {})[demoCar]);
  shared.demo = createAIDriver(LEVEL,
    aiTraits(shared.DEMO_DIFF, 2, menuAi + 1, 1 + Math.floor(Math.random() * 1e6)));
}
/**
 * Applies the setup options of a launch (road, AI, race, traffic, litter) before the restart.
 * @param levelId the level to launch
 * @param opts the launch options
 */
export function applyLaunchOptions(levelId: string, opts: LaunchOpts) {
  // ROAD TYPE (endless highway, Test Mode setup): set before the restart below builds the road
  {
    const level = LEVELS.find((item) => item.id === levelId);
    if (level && level.endless && opts.road)
      setHighwayPreset(level as unknown as HwLevel, opts.road);
  }
  shared.aiCount = Math.max(0, Math.min(MAX_AI, (opts.ai ?? 0) | 0));
  shared.aiDiff = shared.settings.aiDifficulty;   // the menu race set its own
  if (opts.diff != null) shared.aiDiff = Math.max(0, Math.min(4, opts.diff | 0));
  refreshMinimap();   // the minimap's default follows the difficulty mode
  shared.race.on = !!opts.rx;
  shared.aiCarMode = opts.aiCars === 'class' ? 'class' : 'same';
  shared.aiTune = opts.aiTune || null;
  shared.raceLaps = Math.max(0, Math.min(10, (opts.laps ?? 0) | 0));
  // WEATHER (setup): the plan and the seed its random stream starts from, so a restart
  // replays the same weather; none = the dry 18 C game
  // the game clock: the global time, or (TEST MODE) the hour the setup picked
  startEventClock(opts.time ?? null);
  shared.weatherPlan = opts.weather ? { mode: opts.weather.mode, season: opts.weather.season,
    seed: Math.floor(Math.random() * 2147483646) + 1 } : null;
  if (opts.traffic != null) shared.trafficDensity = Math.max(0, Math.min(1.5, +opts.traffic));
  {
    const level = LEVELS.find((item) => item.id === levelId);
    if (level && level.endless && opts.litter != null) level.litter = Math.max(0,
      Math.min(3, +opts.litter));
  }
}
/**
 * Starts a session: mode, options, level, car, livery and tyres, then the first walkthroughs.
 * @param levelId the level to launch
 * @param carId the car to drive
 * @param opts the launch options (ai, diff, rx, laps, road, traffic, litter, ...)
 */
export function launch(levelId: string, carId: string, opts: LaunchOpts = {}) {
  shared.mode = 'session';
  shared.demo = null;
  shared.paused = false;
  applyLaunchOptions(levelId, opts);
  shared.audio.init();
  if (LEVEL.id !== levelId) selectLevel(levelId);
  if (game.car.spec.id !== carId) selectCar(carId);
  applyLivery(game.car.spec, opts.livery ?? null);
  // TYRES from the garage (none = Pre-Spun, the stock car)
  // PAINT + NUMBER from the garage (none = the car's own colours, no number)
  applyTyre(game.car.spec, opts.tyre ?? '');   // (none: the stock set)
  loadTyreWear(game.car);   // this car's set, as worn as it was
  doRestart();
  const guideSetting = shared.settings.guide;
  shared.guidePending = guideSetting === '1'
    || (guideSetting !== '0' && !shared.guide.seen && !navigator.webdriver);
  // EVENT RULES the first time you do this kind of event (guide.ts RULES); after HOW TO PLAY if
  // that is showing too. ?rules=1 forces them (photos), ?rules=0 / automation skips them, as the
  // guide.
  const rulesSetting = shared.settings.rules, kind = eventKind();
  shared.rulesPending = kind
    && (rulesSetting === '1' || (rulesSetting !== '0' && !rulesSeen(kind) && !navigator.webdriver))
      ? kind : null;
}
// which RULES walkthrough this session needs (guide.ts RULES keys), or null
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
  shared.menu!.pause({   // (the pause button is the menu's)
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
    tests: game.testMode,   // the TESTING list (src/testlist.ts) in the pause menu, test mode only
    audio: shared.audio,                  // the SOUND slider + MUTE (menu.ts pause)
    hud: hudActions(),   // the HUD list (each piece on / off for this difficulty mode)
    exit: () => {
      shared.paused = false;
      enterMenu();
    },
  });
}
// TRACK THUMBNAILS (the menu's track lists). MEASURED (TEST MODE tap, CPU x4): painting them all on
// the tap froze the menu 3.1 s, 2.0 s of it building ground detail a 320 px thumbnail cannot show
// (now a light build, load.ts prepareLevel). Each is painted with its level current, then the
// level before is put back.
// ms after the menu shows before the painted thumbnails are saved (thumbcache.js), clear of its
// start
const THUMB_SAVE_MS = 4000;
const thumbs: Record<string, HTMLCanvasElement> = {};
/**
 * Paints one level's thumbnail (its level becomes current: put the old one back after).
 * @param level the level
 */
function paintThumb(level: Level) {
  setLevel(level.id, { light: true });
  thumbs[level.id] = shared.renderer.thumbnail(320);
}
/**
 * Every level's thumbnail, painting the ones still missing now.
 * @returns level id -> thumbnail
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
/**
 * The thumbnails at load (main.ts, while the loading screen is up): with this version's saved on
 * the device, read back (a tap before they arrive paints what is missing); else painted now, and
 * saved a moment after the menu is up.
 */
export function prepareThumbs() {
  const build = BUILD_ID;
  if (hasSavedThumbs(build)) {
    readThumbs().then((saved) => {
      for (const [levelId, canvas] of Object.entries(saved)) thumbs[levelId] ??= canvas;
    }).catch(() => {});
    return;
  }
  paintThumbs();
  setTimeout(() => saveThumbs(build, thumbs).catch(() => {}), THUMB_SAVE_MS);
}
// RESULTS: 1.6 s after the race ends (the flag sweep), the podium then the table (menu.ts results)
export function stepResults() {
  const flow = game.flow;
  if (!flow || flow.state !== 'done' || game.flowShown || !shared.menu
    || shared.mode !== 'session') return;
  if (performance.now() - (game.flowDoneAt || 0) < 1600) return;
  game.flowShown = true;
  // the race is over: its tyre wear is kept, and a restart from here starts on that set
  saveTyreWear();
  if (game.car.tyreWear) game.car.tyreWearStart = [...game.car.tyreWear];
  shared.menu.results(flow as unknown as ResultsFlow,   // (done: its results are in)
    { name: LEVEL.name, restart: () => doRestart(), tracks: () => enterMenu(),
      menu: () => enterMenu() });
}
