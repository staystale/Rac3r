// main.js — boot, the FIXED-STEP ACCUMULATOR, and the one seam to the outside world.
//
// THE TWO CLOCKS (CLAUDE.md rule 5), kept explicitly separate:
//   fixed sim step (PHYSICS_STEP_SECONDS = 1/120 s) : vehicle dynamics, slip, rpm, gear,
//                                     skid-mark stamping
//   wall clock                    : camera lerp, shift-light flash, fps
// The vehicle NEVER receives a frame delta. If the accumulator falls behind it drops the remainder
// rather than catching up in one huge step — a background tab must not produce a 400-step lurch.

import { makeCar } from './vehicle.ts';
import { CAR_IDS, applyLivery } from './cars.ts';
import { createInput } from './input.js';
import { createRenderer } from './render.ts';
import { readSettings } from './core/settings.ts';
import { createMarks } from './marks.js';
import { createHud } from './hud.js';
import { setMinimapSource, setMinimapView } from './hud/minimap.js';
import { createMeter } from './ui/meter.ts';
import { createReporter } from './ui/report.ts';
import { createFramePacer } from './game/pacing.ts';
import { createChurn } from './core/churn.ts';
import { createCones } from './cones.js';
import { createAudio } from './audio.js';
import { createGuide } from './guide.js';
import { createMenu } from './menu.js';
import { genStage, installStage, addStageLevels } from './stagegen.js';
import { addHighwayLevel } from './highway.js';

import { createTraffic } from './traffic.ts';

import { setTuneAudio, snapshot } from './tune.js';
import { TUNE } from './vehicle.ts';
import { initWorld } from "./world/load.ts";
import { applyGrassGrip } from "./world/surfaces.ts";
import { LEVEL } from "./world/state.ts";

import { LEVELS } from "./world/levels/index.ts";
import { crossedJoker }
  from './game/rules.js';

import { game, shared } from './game/state.js';
import { spawnAI } from './game/grid.js';
import { doReset, saveRecords, doRestart } from './game/session.js';
import { hudDown, onKey, selectLevel, selectCar } from './game/controls.js';
import { start, enterMenu, launch, paintThumbs, refreshMinimap } from './game/menuflow.js';
import { loop } from './game/loop.js';
// build the world, in this order: the hand-made levels (load.ts), then the levels added after them
initWorld();
addStageLevels();
addHighwayLevel();

shared.settings = readSettings(location.search);
if (shared.settings.grassGrip) applyGrassGrip();   // ?grassgrip=1, under test (surfaces.ts)
shared.DEV = shared.settings.dev;

shared.canvas = document.getElementById('c');
shared.boot = document.getElementById('boot');
// the boot screen says "loading…" until the code runs (user: the old "THE LAB / tap to
// drive" flashed up first); only the no-menu mode (?menu=0, the test tools) still waits for a tap
// there
if (!(shared.settings.menu === '1' || (shared.settings.menu !== '0' && !navigator.webdriver))) {
  shared.boot.querySelector('h1').textContent = 'THE LAB';
  shared.boot.querySelector('p').textContent = 'tap to drive';
}

Object.assign(game, {
  dev: shared.DEV,
  // every page-link setting (core/settings.ts), for the code handed this object
  settings: shared.settings,
  car: makeCar(shared.settings.carId && CAR_IDS.includes(shared.settings.carId)
    ? shared.settings.carId : 'hatch-rwd'),
  cones: createCones(),
  marks: createMarks(),
  fps: 0, fpsLow: 0,
  // TEST MODE (user: the test list + the FPS corner "only in test for now"). Every
  // session is launched from TEST MODE until Story exists (menu.js main: Story is locked); ?menu=0
  // tool runs count too. When Story ships, launch sets this from its opts.
  testMode: true,
  stepsLastFrame: 0,
  in: null,
  paused: false,
});

shared.trackProgress = 0;
// where the car was last ON the road (dist along the lap + signed offset from the centreline) —
// RESET puts you back there
shared.lastOnTrack = null;
shared.breadcrumbs = [];
shared.lastBreadcrumbTime = 0;

// RX RACE (requirement: 5-lap race, joker once; missing it adds +5 s; free practice stays as it
// is). Only on a level with a joker, only when chosen in setup. Race time runs from the first move
// off the grid; it finishes when lap 5 is complete.
shared.race = { on: false, laps: 5, t: 0, started: false, joker: false, done: false, total: 0,
  penalty: 0 };
game.race = shared.race;
// the JOKER GATE counts in practice too (the arrows vanish when the joker lap has been taken);
// RESTART brings them back. JOKER COUNT (requirement: harsh, real-ish): exactly once; missed OR
// each extra = +30 s (FIA: a missed joker is a time penalty, extra jokers go to the stewards).
// Counted on ENTERING the gate, so one pass is one joker however long you sit in it.
// STAGE TIMING (point-to-point, user): READY -> cross the START line (track distance
// wraps past 0) -> RUNNING -> pass the FINISH distance -> DONE (best kept). Drive the farm road
// back round and crossing the start line starts a new run; RESTART = READY.
shared.stage = { state: 'ready', t: 0, best: null, last: null, prevD: null, pen: 0 };
game.stage = shared.stage;
shared.aiCount = shared.settings.aiCount;
// DIFFICULTY (PLAN.md §4: 0 Mobile game .. 4 Real; aidriver.js DIFFICULTIES): the centre of the
// field's spread. ?diff=N, or setup's row.
shared.aiDiff = shared.settings.aiDifficulty;
game.ai = [];
// RACE LENGTH (requirement: choose in setup): setup's LAPS row; 0 = the level's default (3 on a
// circuit, the joker laps on RX)
shared.raceLaps = 0;
game.flow = null;
shared.gridSlot = 0;
// AI CARS (requirement: AI should race within the class, not always the same vehicle — an option to
// force them to use your car): 'class' = each AI draws a car of YOUR car's class (a shuffled deck,
// so the field mixes; a one-car class repeats it); 'same' = your car. The menu
// passes its setting (default CLASS); a launch without it (tools, the menu race) keeps 'same', so
// measurements stay like for like.
shared.aiCarMode = 'same';
game.start = { on: false, t: 0, tGreen: 0, rolling: false, green: false };
shared.autoDrv = null;
shared.autoStill = 0;   // ?autopilot=1: the player car's AI driver
shared.lapState = {
  lap: 0,
  lapTime: 0,
  bestTime: null,
  lastTime: null,
  started: false,
  halfway: false,
};
game.lap = shared.lapState;
try {
  game.hwBest = +(localStorage.getItem('rac3r.hwbest') || 0);
} catch {
  game.hwBest = 0;
}
shared.camRecord = {};
try {
  shared.camRecord = JSON.parse(localStorage.getItem('rac3r.cams') || '{}') || {};
} catch {
  shared.camRecord = {};
}
shared.savedHwBest = game.hwBest;   // what is in storage now
shared.camDirty = false;
addEventListener('pagehide', saveRecords);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveRecords();
});
// TRAFFIC (requirement: traffic in every mode, a slider in test mode for density): 0..1.5 (1
// = PER_LANE cars a lane), setup's TRAFFIC slider or ?traffic=; LITTER (requirement: a slider for
// the frequency / density of the roadside objects): 0..3 x, setup's LITTER slider
game.traffic = createTraffic();
shared.trafficDensity = shared.settings.trafficDensity;
if (shared.settings.litter !== null)
  for (const level of LEVELS) if (level.endless) level.litter = shared.settings.litter;

shared.hud = createHud();
refreshMinimap();
setMinimapSource(() => !!shared.minimapOn && shared.mode !== 'menu');
setMinimapView(() => shared.renderer.PPM);
// HOW TO PLAY. Opens by itself once per device, after the first fly-in. NOT
// under automation: Playwright sets navigator.webdriver, and every harness in tools/ taps the HUD
// as if no card were up. ?guide=1 forces it on (for photographing it), ?guide=0 forces it off.
shared.guide = createGuide();
// MENUS (user spec: main menu -> Test Mode / Garage; a live DEMO LAP behind the menu).
// mode: 'menu' | 'session'. APPROVED (requirement: sounds great) — the menu is the normal start.
// ?menu=0 drives straight in (the old start); automation (navigator.webdriver) also skips
// it, so every tool that taps the HUD still lands in a session; ?menu=1 forces it.
shared.MENU = shared.settings.menu === '1'
  || (shared.settings.menu !== '0' && !navigator.webdriver);
shared.mode = 'session';
shared.demo = null;
shared.demoStill = 0;
shared.paused = false;
// MENU RACE (requirement: just use the updated AI / 5-car race event for the menu screen): behind
// the menu a 5-car race runs — the camera car + DEMO_AI opponents, all on the racing AI
// (aidriver.js) at DEMO_DIFF, no lights. Was one autodrive car on the Test Track.
// ?menuai=N: A/B the frame cost
shared.DEMO_LEVEL = 'thruston';
shared.DEMO_CAR = 'hatch-rwd';
shared.DEMO_AI = shared.settings.menuAi;
shared.DEMO_DIFF = 3;
shared.guidePending = false;
shared.rulesPending = null;
shared.renderer = createRenderer(shared.canvas, shared.settings);
shared.audio = createAudio(shared.settings.audio);   // ?noaudio=1: no Web Audio (judder test)
game.audio = shared.audio;
setTuneAudio(shared.audio);
shared.input = createInput(shared.canvas, {
  mode: shared.settings.inputMode,
  // Asked BEFORE the steering stick or the pedals get a chance to claim the pointer, so a control
  // always wins over the world it is drawn on top of. Returns true if the HUD consumed the touch.
  hudDown,
  onKey,
});
game.input = shared.input;
if (shared.settings.levelId !== null) {
  selectLevel(shared.settings.levelId);
}

// expose for harnesses (CLAUDE.md §5: a script must be able to drive the real game)
window.__game = game;
window.__game.selectCar = selectCar;
window.__game.reset = doReset;
window.__game.restart = doRestart;
window.__game.setAI = (count) => {
  shared.aiCount = Math.max(0, Math.min(5, count | 0));
  spawnAI();
};   // tools
window.__game.launch = (levelId, car, opts) => launch(levelId, car, opts);
// tools/_jokerline.mjs   // tools: start a session (e.g. an RX race) without the menu
window.__game.crossedJoker = (prevX, prevY, x, y) => (LEVEL.joker
  ? crossedJoker(LEVEL.joker, prevX, prevY, x, y) : null);
window.__game.selectLevel = selectLevel;
Object.defineProperty(window.__game, 'level', { get: () => LEVEL });
window.__game.renderer = shared.renderer;
window.__game.input = shared.input;
Object.defineProperty(window.__game, 'hudExpanded', { get: () => shared.hud.expanded });
Object.defineProperty(window.__game, 'tuneOpen', { get: () => shared.hud.tuneOpen });
window.__game.setTyreHud = (enabled) => shared.hud.setTyreHud(enabled);
window.__game.TUNE = TUNE;
window.__game.hudLayout = () => shared.hud.layout(shared.renderer.W, shared.renderer.H);
window.__game.guide = shared.guide;
snapshot(game.car);

addEventListener('resize', () => shared.renderer.resize());
shared.renderer.resize();

// tap to start — also the gesture an AudioContext will need later
shared.started = false;
shared.canvas.addEventListener('pointerdown', start, { once: false });
shared.boot.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  start();
});
addEventListener('keydown', start);
shared.menu = shared.MENU
  ? createMenu({ thumbs: paintThumbs, launch,
    genStage: (options) => installStage(genStage(options)),
      carSprite: (x, livery, wheels) => (typeof x === 'string'
        ? shared.renderer.pixelCarWithWheels(applyLivery(makeCar(x).spec, livery)) : wheels
          ? shared.renderer.pixelCarWithWheels(x) : shared.renderer.pixelCar(x)) }) : null;
if (shared.MENU) {
  shared.hud.setHelpLabel('II');
  enterMenu();
  shared.menu.show();
}
game.menuMode = shared.MENU;
window.__game.menu = shared.menu;
Object.defineProperty(window.__game, 'mode', { get: () => shared.mode });
Object.defineProperty(window.__game, 'paused', { get: () => shared.paused });

shared.acc = 0;
shared.last = performance.now();
shared.meter = shared.settings.meter ? createMeter() : null;   // ?meter=1 only
// paint the surface textures while the game is idle, one per WARM_SLICE_MS, so a level's
// fly-in does not paint them all in its first frame (render/ground/art.ts warmNextTexture)
const WARM_SLICE_MS = 60;
(function warmTextures() {
  if (shared.renderer.warmNextTexture()) setTimeout(warmTextures, WARM_SLICE_MS);
})();
shared.pacer = shared.settings.vsync ? createFramePacer() : null;   // ?vsync=0: off (pacing.ts)
// ?report=1: the meter's frames also go to the test server (ui/report.ts)
shared.reporter = shared.settings.report
  ? createReporter(location.search, () => (LEVEL ? LEVEL.id : '')) : null;
shared.churn = shared.settings.churn ? createChurn(shared.settings.churn) : null;   // ?churn= only
shared.meterTiles = 0;
shared.meterTouches = 0;   // ?meter=1: pointer down / up / cancel events since the last frame
if (shared.meter) for (const evName of ['pointerdown', 'pointerup', 'pointercancel']) {
  addEventListener(evName, () => {
    shared.meterTouches++;
  }, { capture: true, passive: true });
}
shared.fpsAcc = 0;
shared.fpsN = 0;
shared.fpsHist = [];

// SAFETY NET (added, Claude). The airborne-brake bug showed what happens without
// one: a single NaN in the car reached groundAt, step threw, and because nothing caught it
// requestAnimationFrame was never called again — the whole game froze on its last frame and
// every button looked dead. This is NOT a fix for physics bugs (those get fixed at source —
// see vehicle.js axle). It makes sure the next one costs the player a reset instead of the
// game, and SHOUTS in the console so it is found:
//   * the car is checked for non-finite state EVERY step (8 numbers — free), not only under ?dev=1;
//   * on failure it is put back on the track near the last good position it had, via doReset;
//   * the frame is always rescheduled, even if something throws.
shared.lastGood = { x: 0, y: 0, heading: 0 };
shared.nanReports = 0;
requestAnimationFrame(loop);
