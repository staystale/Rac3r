// main.ts — boot, the FIXED-STEP ACCUMULATOR, and the one seam to the outside world.
//
// THE TWO CLOCKS (CLAUDE.md rule 5), kept explicitly separate:
//   fixed sim step (PHYSICS_STEP_SECONDS = 1/120 s) : vehicle dynamics, slip, rpm, gear,
//                                     skid-mark stamping
//   wall clock                    : camera lerp, shift-light flash, fps
// The vehicle NEVER receives a frame delta. If the accumulator falls behind it drops the remainder
// rather than catching up in one huge step — a background tab must not produce a 400-step lurch.

import { makeCar } from './vehicle.ts';
import { CAR_IDS, applyLivery } from './cars.ts';
import { createInput } from './input.ts';
import { createRenderer } from './render.ts';
import { readSettings } from './core/settings.ts';
import { createMarks } from './marks.ts';
import { setTrackTempSource } from './hud/tracktemp.ts';
import { createHud } from './hud.ts';
import {
  setMinimapSource, setMinimapView, setProgressSource,
} from './hud/minimap.ts';
import { createMeter } from './ui/meter.ts';
import { createReporter } from './ui/report.ts';
import { createFramePacer } from './game/pacing.ts';
import { createChurn } from './core/churn.ts';
import { createCones } from './cones.ts';
import { createAudio } from './audio.ts';
import { createGuide } from './guide.ts';
import { createMenu } from './menu.ts';
import { genStage, installStage, addStageLevels } from './stagegen.ts';
import { addHighwayLevel } from './highway.ts';

import { createTraffic } from './traffic.ts';

import { TUNE } from './vehicle.ts';
import { initWorld } from "./world/load.ts";
import {
  setWetness, setRain,
} from "./world/weather.ts";
import { setDarkness } from "./world/daylight.ts";
import { CLOCK, startClock } from "./world/clock.ts";
import { LEVEL } from "./world/state.ts";

import { LEVELS } from "./world/levels/index.ts";
import { crossedJoker }
  from './game/rules.ts';

import { game, shared } from './game/state.ts';
import type { LaunchOpts } from './game/state.ts';
import { spawnAI } from './game/grid.ts';
import { doReset, saveRecords, doRestart } from './game/session.ts';
import { hudDown, onKey, selectLevel, selectCar } from './game/controls.ts';
import {
  start, enterMenu, launch, paintThumbs, paintThumbsNow, prepareThumbs, refreshMinimap,
} from './game/menuflow.ts';
import { loop } from './game/loop.ts';
import { MAX_AI } from './core/settings.ts';
// build the world, in this order: the hand-made levels (load.ts), then the levels added after them
initWorld();
addStageLevels();
addHighwayLevel();

shared.settings = readSettings(location.search);
// ?rain=0.6: a wet track, raining (weather test, before any level or racing line is built)
if (shared.settings.rain !== null) {
  setWetness(shared.settings.rain);
  setRain(shared.settings.rain);
}
// ?night=0.8: this dark (lighting test: the night layer, the field's headlights)
if (shared.settings.night !== null) setDarkness(shared.settings.night);
// the game clock drives the sky (?night= overrides it with a fixed dark); a new player starts
// in today's season
startClock(shared.settings.night === null,
  Math.floor(((new Date().getMonth() + 1) % 12) / 3));
shared.DEV = shared.settings.dev;

shared.canvas = document.getElementById('c') as HTMLCanvasElement;   // index.html
shared.boot = document.getElementById('boot')!;
// the boot screen says "loading…" until the code runs (user: the old "THE LAB / tap to
// drive" flashed up first); only the no-menu mode (?menu=0, the test tools) still waits for a tap
// there
if (!(shared.settings.menu === '1' || (shared.settings.menu !== '0' && !navigator.webdriver))) {
  shared.boot.querySelector('h1')!.textContent = 'THE LAB';
  shared.boot.querySelector('p')!.textContent = 'tap to drive';
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
  // session is launched from TEST MODE until Story exists (menu.ts main: Story is locked); ?menu=0
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
setTrackTempSource(() => !!shared.trackTempOn && shared.mode !== 'menu');
refreshMinimap();
setMinimapSource(() => !!shared.minimapOn && shared.mode !== 'menu');
// the progress bar is its own choice in the HUD list
setProgressSource(() => !!shared.progressOn && shared.mode !== 'menu');
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
window.__game = game as unknown as Record<string, unknown>;   // (the tools add to it)
window.__game.selectCar = selectCar;
window.__game.reset = doReset;
window.__game.restart = doRestart;
window.__game.setAI = (count: number) => {
  shared.aiCount = Math.max(0, Math.min(MAX_AI, count | 0));
  spawnAI();
};   // tools
window.__game.launch = (levelId: string, car: string, opts?: LaunchOpts) =>
  launch(levelId, car, opts);
// tools/_jokerline.mjs   // tools: start a session (e.g. an RX race) without the menu
window.__game.crossedJoker = (prevX: number, prevY: number, x: number, y: number) => (LEVEL.joker
  ? crossedJoker(LEVEL.joker, prevX, prevY, x, y) : null);
window.__game.selectLevel = selectLevel;
// (tools/scratch/_bridgeshot.mjs: the autopilot to a spot, then the car's own physics)
window.__game.setAutopilot = (isOn: boolean) => {
  shared.settings.autopilot = isOn;
};
window.__game.paintThumbsNow = paintThumbsNow;   // (tools/thumbs.mjs)
Object.defineProperty(window.__game, 'level', { get: () => LEVEL });
window.__game.renderer = shared.renderer;
window.__game.input = shared.input;
window.__game.setTyreHud = (enabled: boolean) => shared.hud.setTyreHud(enabled);
window.__game.TUNE = TUNE;
window.__game.hudLayout = () => shared.hud.layout(shared.renderer.W, shared.renderer.H);
window.__game.guide = shared.guide;

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
    daytime: CLOCK.isOn, dev: shared.DEV,
    genStage: (options) => installStage(genStage(options)),
      carSprite: (x, livery, wheels) => (typeof x === 'string'
        ? shared.renderer.pixelCarWithWheels(applyLivery(makeCar(x).spec, livery ?? null)) : wheels
          ? shared.renderer.pixelCarWithWheels(x) : shared.renderer.pixelCar(x))! }) : null;
// the long-grass textures (~115 ms on the phone) now, while loading, not in a frame of the menu -
// or of the level a link opens straight into (?menu=0: the idle warm-up painted one in a frame
// 0.6 s in, MEASURED 143 ms on the owner's phone)
shared.renderer.warmBladeTextures();
if (shared.MENU) {
  shared.hud.setHelpLabel('II');
  // the track thumbnails, read in the background (shipped: menu/thumbfiles.ts)
  prepareThumbs();
  enterMenu();
  shared.menu!.show();
  // the phone report's load time: ms from the page opening to the menu shown (ui/report.ts)
  shared.loadMs = Math.round(performance.now());
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
shared.warmMs = 0;   // ms of texture warm-up since the last frame, for the phone report (loop.ts)
(function warmTextures() {
  const began = performance.now(), more = shared.renderer.warmNextTexture();
  shared.warmMs += performance.now() - began;
  if (more) setTimeout(warmTextures, WARM_SLICE_MS);
})();
shared.pacer = createFramePacer();   // whole display refreshes (pacing.ts)
// ?report=1: the meter's frames also go to the test server (ui/report.ts)
shared.reporter = shared.settings.report
  ? createReporter(location.search, () => (LEVEL ? LEVEL.id : ''), () => shared.loadMs ?? null)
  : null;
// the last part-batch goes too when the page is left (a short run used to send nothing)
const reporter = shared.reporter;
if (reporter) {
  addEventListener('pagehide', () => reporter.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) reporter.flush();
  });
}
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
