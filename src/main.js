// main.js — boot, the FIXED-STEP ACCUMULATOR, and the one seam to the outside world.
//
// THE TWO CLOCKS (CLAUDE.md rule 5), kept explicitly separate:
//   fixed sim step (PHYSICS_STEP_SECONDS = 1/120 s) : vehicle dynamics, slip, rpm, gear,
//                                     skid-mark stamping
//   wall clock                    : camera lerp, shift-light flash, fps
// The vehicle NEVER receives a frame delta. If the accumulator falls behind it drops the remainder
// rather than catching up in one huge step — a background tab must not produce a 400-step lurch.
import { lcg } from "./core/random.ts";

import { makeCar, step, reset, assertFinite, PHYSICS_STEP_SECONDS } from './vehicle.ts';
const resetCar = reset;
import { CAR_IDS, applyLivery, applyTyre, ROSTER } from './cars.ts';
import { createInput } from './input.js';
import { createRenderer } from './render.ts';
import { readSettings } from './core/settings.ts';
import { createMarks } from './marks.js';
import { createHud } from './hud.js';
import { createMeter, takeMeterEvents } from './ui/meter.ts';   // ?meter=1 frame meter
import { createChurn } from './core/churn.ts';   // ?churn= memory churn test
import { createCones } from './cones.js';
import { createAudio } from './audio.js';
import { createGuide, rulesSeen } from './guide.js';
import { createMenu } from './menu.js';
import { genStage, installStage, addStageLevels } from './stagegen.js';
// the ENDLESS motorway (registers itself in LEVELS)
// PROCEDURAL STAGES (installs the default generated stage into LEVELS)
import { addHighwayLevel, stepHighway, resetHighway, highwayGuard, highwayRespawn, setHighwayPreset,
  roadFrame, speedCamera } from './highway.js';
import { createAutoDriver } from './ai/autodrive.ts';
import { createTraffic } from './traffic.ts';   // HIGHWAY TRAFFIC (endless levels)
// VS AI on the highway
import { createHwFlow, hwFrames, hwGrid, hwGridSpan, hwPutBack, HW_GREEN } from './highwayrace.ts';
import { createAIDriver } from './ai/circuit.ts';
import { aiTraits } from './ai/traits.ts';
import { lineRun } from './ai/line.ts';
import { carContacts, slipstream } from './contact.js';
import { createRaceFlow } from './raceflow.js';
import { hit, hitRoll, repair, resetBill, tooInjured } from './damage.js';
import { rolling, tripCheck, stepRoll } from './roll.js';
import { nudge, resetAll, setTuneAudio, snapshot } from './tune.js';
import { TUNE } from './vehicle.ts';
import { initWorld, setLevel } from "./world/load.ts";
import { SPAWN, LEVEL } from "./world/state.ts";
import { applyGround, fenceClamp, obstacleClamp, clearWear } from "./world/wear.ts";
import { barrierClamp, solidClamp } from "./world/barriers.ts";
import { LEVELS } from "./world/levels/index.ts";
import { findNearestSubtrackPoint, onTrack, querySubtrack } from "./world/tyrewall.ts";

// build the world, in this order: the hand-made levels (load.ts), then the levels added after them
initWorld();
addStageLevels();
addHighwayLevel();

const settings = readSettings(location.search);
const DEV = settings.dev;
// 5 -> 12 (2026-10-03, high-speed judder). MEASURED: frames over ~42 ms hit the 5-step cap and
// THREW AWAY sim time, so the car fell behind real time and hitched (drawn car vs a smooth path:
// worst 1.4 m at 200 km/h). wallDt is already capped at 0.1 s (12 steps), so this cannot become the
// "background tab lurch" the cap was guarding against.
const MAX_STEPS = 12;                // per frame; drop the rest

const canvas = document.getElementById('c');
const boot = document.getElementById('boot');
// the boot screen says "loading…" until the code runs (user, 2026-10-04: the old "THE LAB / tap to
// drive" flashed up first); only the no-menu mode (?menu=0, the test tools) still waits for a tap
// there
if (!(settings.menu === '1' || (settings.menu !== '0' && !navigator.webdriver))) {
  boot.querySelector('h1').textContent = 'THE LAB';
  boot.querySelector('p').textContent = 'tap to drive';
}

const game = {
  dev: DEV,
  settings,   // every page-link setting (core/settings.ts), for the code handed this object
  car: makeCar(settings.carId && CAR_IDS.includes(settings.carId) ? settings.carId : 'hatch-rwd'),
  cones: createCones(),
  marks: createMarks(),
  fps: 0, fpsLow: 0,
  // TEST MODE (user, 2026-10-06: the test list + the FPS corner "only in test for now"). Every
  // session is launched from TEST MODE until Story exists (menu.js main: Story is locked); ?menu=0
  // tool runs count too. When Story ships, launch() sets this from its opts.
  testMode: true,
  stepsLastFrame: 0,
  in: null,
  paused: false,
};

let trackProgress = 0;
// where the car was last ON the road (dist along the lap + signed offset from the centreline) —
// RESET puts you back there
let lastOnTrack = null;
const breadcrumbs = [];
let lastBreadcrumbTime = 0;

// RX RACE (user, 2026-10-04: "5-lap race, joker once; missing it adds +5 s; free practice stays as
// it is"). Only on a level with a joker, only when chosen in setup. Race time runs from the first
// move off the grid; it finishes when lap 5 is complete.
const race = { on: false, laps: 5, t: 0, started: false, joker: false, done: false, total: 0,
  penalty: 0 };
game.race = race;
function resetRace() {
  game.jokerPrev = null;
  game.jokerLap = null;
  game.jokerAt = 0;
  game.inJokerLane = false;
  game.jokerTaken = false;
  game.jokers = 0;
  game.inJokerGate = false;
  Object.assign(race,
    { t: 0, started: false, joker: false, done: false, total: 0, penalty: 0,
      laps: (LEVEL.joker && LEVEL.joker.laps) || 5 });
}
// the JOKER GATE counts in practice too (user: the arrows "vanish when the joker lap has been
// taken"); RESTART brings them back JOKER COUNT (user, 2026-10-04: "harsh, real-ish": exactly once;
// missed OR each extra = +30 s. FIA: a missed joker is a time penalty, extra jokers go to the
// stewards). Counted on ENTERING the gate, so one pass is one joker however long you sit in it.
// STAGE TIMING (point-to-point, user 2026-10-04): READY -> cross the START line (track distance
// wraps past 0) -> RUNNING -> pass the FINISH distance -> DONE (best kept). Drive the farm road
// back round and crossing the start line starts a new run; RESTART = READY.
const stage = { state: 'ready', t: 0, best: null, last: null, prevD: null, pen: 0 };
game.stage = stage;
function resetStage() {
  stage.state = 'ready';
  stage.t = 0;
  stage.prevD = null;
  stage.pen = 0;
}
function stepStage(dt) {
  const stageDef = LEVEL.stage, dist = game.trackD;
  if (!stageDef || dist == null) return;
  const prev = stage.prevD;
  stage.prevD = dist;
  if (prev == null) return;
  const total = LEVEL.subtrack.totalDist, crossedStart = prev > total - 60 && dist < 60;
  if (stage.state !== 'running') {
    if (crossedStart) {
      stage.state = 'running';
      stage.t = 0;
      stage.pen = 0;
    }
    return;
  }
  stage.t += dt;
  if (prev < stageDef.finish && dist >= stageDef.finish && dist - prev < 30) {
    stage.state = 'done';
    stage.last = stage.t + (stage.pen || 0);
    if (stage.best == null || stage.t < stage.best) stage.best = stage.t;
  }
}
// JOKER DETECTION = A LINE, not a circle (user, 2026-10-07: "Joker lane detection needs to be wider
// on knob hill - it's easy to come off the road shoot wide and cause a defection bug where it
// doesn't detect you've done it and then when you do it again it gives penalty for multiple
// jokers"). MEASURED: the gate was a 7 m-radius circle at the lane's middle; the lane is 12 m wide
// and Knobhill's loop is easy to run wide of, so a joker driven a few metres out was never counted.
// Now: a LINE across the lane at the gate, the lane's half width + JOKER_SPAN m out each side,
// counted when the car CROSSES it (either way), and at most ONCE PER LAP (a second crossing in the
// same lap - reversing back over it - never makes a second joker). Not on the main road: the line
// stops JOKER_ROAD m short of the circuit's edge.
const JOKER_SPAN = 8, JOKER_ROAD = 1;
function jokerLine(joker) {
  if (joker._line !== undefined) return joker._line;
  const lane = (LEVEL.lanes || []).find((cand) => cand.out == null
    && cand.pts.some(([x, y]) => (x - joker.gate.x) ** 2 + (y - joker.gate.y) ** 2
      < joker.gate.r * joker.gate.r * 4));
  if (!lane) return (joker._line = null);
  let nearest = 0, bestD2 = Infinity;
  lane.pts.forEach(([x, y], i) => {
    const distSq = (x - joker.gate.x) ** 2 + (y - joker.gate.y) ** 2;
    if (distSq < bestD2) {
      bestD2 = distSq;
      nearest = i;
    }
  });
  const before = lane.pts[Math.max(0, nearest - 2)],
    after = lane.pts[Math.min(lane.pts.length - 1, nearest + 2)],
      len = Math.hypot(after[0] - before[0], after[1] - before[1]) || 1;
  return (joker._line = { x: joker.gate.x, y: joker.gate.y, tx: (after[0] - before[0]) / len,
    ty: (after[1] - before[1]) / len, half: lane.width / 2 + JOKER_SPAN });
}
// did the car cross the joker line between (px, py) and (x, y)? Exposed for tools/_jokerline.mjs.
function crossedJoker(joker, prevX, prevY, x, y) {
  const line = jokerLine(joker);
  if (!line) return (x - joker.gate.x) ** 2 + (y - joker.gate.y) ** 2 < joker.gate.r * joker.gate.r
    && !((prevX - joker.gate.x) ** 2 + (prevY - joker.gate.y) ** 2 < joker.gate.r * joker.gate.r);
  const prevAlong = (prevX - line.x) * line.tx + (prevY - line.y) * line.ty,
    nowAlong = (x - line.x) * line.tx + (y - line.y) * line.ty;
  if ((prevAlong < 0) === (nowAlong < 0)) return false;
  const frac = prevAlong / (prevAlong - nowAlong || 1), crossX = prevX + (x - prevX) * frac,
    crossY = prevY + (y - prevY) * frac,
      side = (crossX - line.x) * -line.ty + (crossY - line.y) * line.tx;
  if (Math.abs(side) > line.half) return false;
  return querySubtrack(LEVEL.subtrack, crossX, crossY).dist > LEVEL.subtrack.width / 2 + JOKER_ROAD;
}
function stepJoker(car) {
  const joker = LEVEL.joker;
  if (!joker) return;
  const prev = game.jokerPrev;
  game.jokerPrev = { x: car.x, y: car.y };
  const inGate = !!prev && crossedJoker(joker, prev.x, prev.y, car.x, car.y);
  if (inGate && game.jokerLap !== lapState.lap) {
    game.jokerLap = lapState.lap;
    game.jokers = (game.jokers || 0) + 1;
    game.jokerTaken = true;
    game.jokerAt = performance.now();
  }
  // IN THE JOKER LANE (user, 2026-10-04: "the joker HUD warning should switch and show joker taken
  // when taken"): the gate sits mid-lane, so the HUD knows you are IN it from the moment you leave
  // the main road onto the lane (the lane through the gate; found once per level)
  if (joker._lane === undefined) joker._lane = (LEVEL.lanes || []).find((cand) => cand.out == null
    && cand.pts.some(([x, y]) => (x - joker.gate.x) ** 2 + (y - joker.gate.y) ** 2
      < joker.gate.r * joker.gate.r * 4)) || null;
  game.inJokerLane = false;
  if (joker._lane && querySubtrack(LEVEL.subtrack, car.x, car.y).dist > LEVEL.subtrack.width / 2) {
    const pts = joker._lane.pts, reach2 = (joker._lane.width / 2 + 1) ** 2;
    for (let i = 0; i + 1 < pts.length && !game.inJokerLane; i++) {
      const [startX, startY] = pts[i], [endX, endY] = pts[i + 1], vx = endX - startX,
        vy = endY - startY,
        frac = Math.max(0, Math.min(1,
          ((car.x - startX) * vx + (car.y - startY) * vy) / (vx * vx + vy * vy || 1)));
      if ((car.x - startX - frac * vx) ** 2 + (car.y - startY - frac * vy) ** 2 < reach2)
        game.inJokerLane = true;
    }
  }
  // the AI's joker tactics read it (covering a rival who has jokered)
  car._jokers = game.jokers || 0;
  game.inJokerGate = inGate;
}
function stepRace(car, dt) {
  if (!race.on || race.done || !LEVEL.joker) return;
  // timed from the GREEN when there are lights (the results time from it too — raceflow.js); else
  // from the first move
  if (!race.started
    && (game.start.on ? game.start.green : Math.hypot(car.vx, car.vy) > 0.8)) race.started = true;
  if (!race.started) return;
  race.t += dt;
  race.joker = !!game.jokerTaken;
  race.jokers = game.jokers || 0;
  if (lapState.lap > race.laps) {
    race.done = true;
    race.penalty = LEVEL.joker.penalty * (race.jokers === 0 ? 1 : race.jokers - 1);
    race.penalty += game.car._cutPen || 0;
    race.total = race.t + race.penalty;
  }
}
// AI CARS — stage 1 (2026-10-04, user: up to 5 opponents, FULL CONTACT, the SAME car as the player
// in different colours + numbers). Each is { car, drv }: a real car stepped by the same physics on
// the same fixed step, driven by the autodriver for now (stage 2 makes them race). ?ai=N (0-5) puts
// N on the grid behind the player on a circuit; they respawn on RESTART, level change and car
// change.
const AI_LIVERIES = [['#c8302c', '#7e1d1a'], ['#2b56b5', '#14306e'], ['#e2c13a', '#8a6d12'],
  ['#2f7d4f', '#174a2c'], ['#7a3fa0', '#43205a']];
let aiCount = settings.aiCount;
// DIFFICULTY (PLAN.md §4: 0 Mobile game .. 4 Real; aidriver.js DIFFICULTIES): the centre of the
// field's spread. ?diff=N, or setup's row.
let aiDiff = settings.aiDifficulty;
game.ai = [];
// RACE LENGTH (user, 2026-10-04: "choose in setup"): setup's LAPS row; 0 = the level's default (3
// on a circuit, the joker laps on RX)
let raceLaps = 0;
game.flow = null;
// GRID (user, 2026-10-04: "starting grid position should vary randomly but bias toward the front n
// back with difficulty"): the player's slot is drawn with weights exp(GRID_BIAS[diff] x slot / n) —
// Mobile leans to the FRONT, Real to the BACK, Realish is even.
const GRID_BIAS = [-2.2, -1.1, 0, 1.1, 2.2];
let gridSlot = 0;
function drawGridSlot(count) {
  if (mode === 'menu' || !count) return 0;
  const weights = [];
  for (let slot = 0; slot <= count; slot++)
    weights.push(Math.exp(GRID_BIAS[aiDiff] * slot / count));
  let pick = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let slot = 0; slot <= count; slot++) {
    pick -= weights[slot];
    if (pick <= 0) return slot;
  }
  return count;
}
// slot 0 = pole (the spawn, or the rolling-start pole), slot k = the staggered grid behind it RALLY
// STAGE (LEVEL.stage): single file back from the spawn along the road, STAGE_GAP_M apart; later
// starters queue here, STAGE_GAP_S apart in time REAL START INTERVALS (user, 2026-10-04: "it's like
// a normal race rather than starting IN BETWEEN other opponents on a rally stage TIME-WISE"): cars
// STAGE_GAP_S apart; you always start at the normal lights; those who started BEFORE you are
// already down the stage where their own pace would have taken them (lineRun); those AFTER you
// queue behind and go STAGE_GAP_S apart. (Was: everyone queued 6 s apart — a race in single file.)
const STAGE_GAP_S = 30, STAGE_GAP_M = 9;
function gridPos(slot) {
  // the highway: 2 wide in the right-hand lanes (highwayrace.js)
  if (LEVEL.endless) return hwGrid(LEVEL, slot);
  const sub = LEVEL.subtrack, spawn = LEVEL.spawn,
    offLap = querySubtrack(sub, spawn.x, spawn.y).dist > sub.width / 2;
  if (LEVEL.stage && slot > 0) {
    const spawnDist = querySubtrack(sub, spawn.x, spawn.y).trackDist,
      point = onTrack(sub,
        ((spawnDist - slot * STAGE_GAP_M) % sub.totalDist + sub.totalDist) % sub.totalDist, 0, {});
    return { x: point.x, y: point.y, h: point.rot };
  }
  // A REAL 2-WIDE STAGGERED GRID (user, 2026-10-05: "grid starts are wonky / place the player too
  // close to other cars / not in a grid formation"). MEASURED (tools/gridcheck, 5 AI): slots were
  // OUT OF ORDER (slot 2 at 4.5 m back, slot 1 at 9 m), pole sat on the CENTRELINE with its
  // neighbours 1.0-1.6 m away (box to box), and on the Test Track the player's pole was the spawn
  // while the rest counted back from totalDist - 15 -> the player overlapped AI 5 (-0.07 m). Now:
  // every slot, pole included, counts back from the SPAWN's own road distance, GRID_STEP m per
  // slot, alternating columns GRID_LAT m either side of the centre (narrower on a narrow road).
  const back = LEVEL.rollingStart ? ROLL_BACK : 0;
  const lat = Math.max(1.6, Math.min(GRID_LAT, sub.width / 2 - 1.8)), side = slot % 2 ? lat : -lat,
    backDist = back + slot * GRID_STEP;
  if (offLap) {
    // the spawn is OFF the lap (Slidden Hill's RX start straight): the grid runs straight back from
    // it along its heading
    if (slot === 0 && !back) return { x: spawn.x - Math.sin(spawn.heading) * side,
      y: spawn.y + Math.cos(spawn.heading) * side, h: spawn.heading };
    const cosH = Math.cos(spawn.heading), sinH = Math.sin(spawn.heading);
    return { x: spawn.x - cosH * backDist - sinH * side, y: spawn.y - sinH * backDist + cosH * side,
      h: spawn.heading };
  }
  const spawnDist = querySubtrack(sub, spawn.x, spawn.y).trackDist,
    dist = (((spawnDist - backDist) % sub.totalDist) + sub.totalDist) % sub.totalDist;
  const point = onTrack(sub, dist, side, {});
  return { x: point.x, y: point.y, h: point.rot };
}
// GRID_STEP: one slot back (so the same column is 2 x apart: 14 m nose to nose, ~9.5 m clear);
// GRID_LAT: column offset from the centre
const GRID_STEP = 7, GRID_LAT = 3.2;
// AI CARS (user, 2026-10-04: "AI should race within the class, not always the same vehicle — an
// option to force them to use your car"): 'class' = each AI draws a car of YOUR car's class (a
// shuffled deck, so the field mixes; a one-car class repeats it); 'same' = your car. The menu
// passes its setting (default CLASS); a launch without it (tools, the menu race) keeps 'same', so
// measurements stay like for like.
let aiCarMode = 'same';
function aiCarIds(count, seed) {
  const base = String(game.car.spec.id).split('#')[0],
    myCar = ROSTER.find((entry) => entry.id === base);
  if (aiCarMode !== 'class' || !myCar || !myCar.cls) return Array(count).fill(base);
  // parity first: your TYPE (subclass) when it has 2+ cars (a Hatch race = hatches + the Mini, not
  // the Lamborghini), else the whole class
  const sameSub = ROSTER.filter((entry) => entry.cls === myCar.cls && entry.sub === myCar.sub);
  const pool = (sameSub.length >= 2 ? sameSub
    : ROSTER.filter((entry) => entry.cls === myCar.cls)).map((entry) => entry.id);
  const rnd = lcg(seed >>> 0);
  const out = [];
  while (out.length < count) {
    const deck = pool.slice();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    out.push(...deck);
  }
  return out.slice(0, count);
}
function spawnAI(count = aiCount) {
  game.ai = [];
  game.poleCar = null;
  const sub = LEVEL.subtrack;
  if (!sub || !count) return;
  gridSlot = drawGridSlot(count);
  const seed = 1 + Math.floor(Math.random() * 1e6), ids = aiCarIds(count, seed);
  for (let i = 0; i < count; i++) {
    const car = makeCar(ids[i]), [paint, trim] = AI_LIVERIES[i % AI_LIVERIES.length];
    // own sprite (cached by id), same physics
    car.spec = { ...car.spec, id: car.spec.id + '#' + (i + 2), paint, trim };
    car.num = i + 2;
    const drv = createAIDriver(LEVEL, aiTraits(aiDiff, i, count, seed)), slot = i < gridSlot ? i
      : i + 1;
    car._jokers = 0;
    car._prog = undefined;
    car._stageStart = undefined;
    if (LEVEL.stage) {
      // slot relative to yours: < 0 started before you (already on the stage), > 0 queues behind
      // you
      const rel = slot - gridSlot;
      car._slot = rel;
      car._predT = lineRun(LEVEL, car.spec, drv.traits.pace, Infinity, LEVEL.stage.finish).t;
      if (rel < 0) {
        const run = lineRun(LEVEL, car.spec, drv.traits.pace, -rel * STAGE_GAP_S - 4 * START_STEP);
        reset(car, run.x, run.y, run.h);
        car.vx = Math.cos(run.h) * run.v;
        car.vy = Math.sin(run.h) * run.v;
        car._stageStart = rel * STAGE_GAP_S;
        car._prog = run.dist;
        car._lastQ = run.dist;
      } else {
        const pos = gridPos(rel);
        reset(car, pos.x, pos.y, pos.h);
      }
    } else {
      const pos = gridPos(slot);
      reset(car, pos.x, pos.y, pos.h);
      car._slot = slot;
      if (slot === 0) game.poleCar = car;
    }
    game.ai.push({ car, drv, stuckT: 0, inGate: false });
  }
}
// START LIGHTS (user, 2026-10-04: "all races started by lights that clearly go red to green, maybe
// a countdown"; "circuits with ROLLING starts: the game controls ALL cars, AI and player, until the
// start, then releases them"). Any race (VS AI or the RX race): three reds light one per second
// with 3-2-1, then GREEN + GO!. Every car is held until GREEN - START_EARLY ("free to go at green
// or a split second before", the same for player and AI). Rolling start (LEVEL.rollingStart, the
// ovals): the grid starts 120 m further back, the game drives every car at ROLL_PACE in grid order
// behind red lights, and it goes green as the front car crosses the line. Sim time (rule 5: what
// the cars do). Solo practice: no lights.
const START_STEP = 1.0, START_EARLY = 0.12, ROLL_PACE = 16, ROLL_BACK = 120;
game.start = { on: false, t: 0, tGreen: 0, rolling: false, green: false };
let autoDrv = null, autoStill = 0;   // ?autopilot=1: the player car's AI driver
function armStart() {
  autoDrv = settings.autopilot ? createAIDriver(LEVEL, aiTraits(4, 0, 1)) : null;   // 4 = top
  const active = mode !== 'menu' && (race.on || aiCount > 0), isRolling = active
    && (!!LEVEL.rollingStart || !!LEVEL.endless) && !!LEVEL.subtrack;
  game.start = { on: active, t: 0, tGreen: isRolling ? Infinity : 4 * START_STEP,
    tGreen0: isRolling ? undefined : 4 * START_STEP, rolling: isRolling, green: !active,
    drv: isRolling ? (LEVEL.endless ? createAIDriver(LEVEL, aiTraits(4, 0, 1))
      : createAutoDriver(LEVEL.subtrack)) : null };
  // the HIGHWAY's rolling start has no line to cross: green HW_GREEN s in, everyone already rolling
  // in formation (highwayrace.js)
  if (isRolling && LEVEL.endless) game.start.tGreen = game.start.tGreen0 = HW_GREEN;
}
const startHeld = () => game.start.on && !game.start.green
  && game.start.t < game.start.tGreen - START_EARLY;
// a car's own release: everyone at the green, except a RALLY STAGE: a later starter (slot k > 0
// behind you) goes k x STAGE_GAP_S after your green
const startAtOf = (car) => (game.start.tGreen0 ?? game.start.tGreen) + (LEVEL.stage
  ? (car._slot || 0) * STAGE_GAP_S : 0);
const carHeld = (car) => game.start.on && !game.start.rolling
  && game.start.t < startAtOf(car) - START_EARLY;
// cap a driver's output at the rolling-start pace
function atPace(out, car) {
  const speed = Math.hypot(car.vx, car.vy);
  return { ...out, throttle: speed > ROLL_PACE ? 0 : Math.min(out.throttle, 0.55),
    brake: speed > ROLL_PACE + 2 ? 0.25 : 0, handbrake: 0, reverse: 0 };
}
function stepStart(dt) {
  // the clock keeps running after green so the HUD can take the lights away 1.2 s later (user:
  // "race start lights don't vanish" — it stopped at green)
  const startState = game.start;
  if (!startState.on) return;
  startState.t += dt;
  if (startState.green) return;
  if (startState.rolling && !LEVEL.endless) {
    // green as the FRONT car (the player, pole) crosses the line; reds shown from 1 s
    const pole = game.poleCar || game.car, total = LEVEL.subtrack.totalDist,
      dist = pole === game.car ? game.trackD
        : querySubtrack(LEVEL.subtrack, pole.x, pole.y).trackDist;
    if (startState.prevD != null && dist != null && startState.prevD > total - 60 && dist < 60
      && startState.t > 2) startState.tGreen = startState.t;
    startState.prevD = dist;
  }
  if (startState.t >= startState.tGreen) startState.green = true;
}
// RACE ORDER (user, 2026-10-04: "the lap counter area should keep track of what place you are").
// Each car's distance round the lap, UNWRAPPED across the line (a car behind the line on the grid
// starts slightly negative), from the nearest centreline point; ranked.
function progressOf(car) {
  const sub = LEVEL.subtrack, total = sub.totalDist, near = querySubtrack(sub, car.x, car.y),
    along = near.trackDist;
  if (car._prog === undefined) {
    if (near.dist > sub.width / 2 + 2) return undefined;   // not on the lap yet
    car._prog = along > total / 2 ? along - total : along;
    car._lastQ = along;
    return car._prog;
  }
  // out of the track's range (querySubtrack: dist Infinity, trackDist 0 — that 0 dragged the
  // progress back to the line): hold it there
  if (!isFinite(near.dist)) {
    trackCut(car, near, 0);
    return car._prog;
  }
  let delta = along - car._lastQ;
  if (delta > total / 2) delta -= total;
  if (delta < -total / 2) delta += total;
  // (no jump guard: crossing an infield, the nearest centreline point JUMPS to the far side in one
  // step — that jump IS the cut)
  if (trackCut(car, near, delta) === 'reset') return car._prog;
  if (near.dist <= sub.width / 2 && near.seg != null) {
    const point = sub.pts[near.seg];
    car._lastOn = { dist: along, off: (car.x - point.x) * point.nx + (car.y - point.y) * point.ny };
  }
  car._prog += delta;
  car._lastQ = along;
  return car._prog;
}
// TRACK CUTS (user, 2026-10-04: "a time penalty for skipping track in rally / rallycross — and a
// forced reset when skipping too large of a section in normal races"). While a car is wholly OFF
// the road (centre > half width + CUT_OFF) it banks the track progress it gains BEYOND the distance
// it actually drives — the NET over the whole excursion, so going wide 50 m and cutting 50 m back
// gains nothing (a clamp at 0 lost a 300 m Thruston cut: the progress only jumps on rejoining,
// after the drive had been subtracted). Back on the road: gain >= CUT_MIN -> a cut. RX race / rally
// stage (timed): +1 s per CUT_PER_S m gained, at least 2 s, into the result. A circuit race: gain
// >= CUT_RESET -> the car is put back where it left the road, progress and all; smaller cuts pass.
// Free practice: nothing. CUT_MIN 8 -> 15 m: normal racing clipped one Castle Cum / Thruston inside
// at 8-10 m (~0.3 s), MEASURED (racecheck4) — not a cut
const CUT_OFF = 1.0, CUT_MIN = 15, CUT_RESET = 25, CUT_PER_S = 5;
function onLane(x, y) {
  for (const lane of LEVEL.lanes || []) {
    const pts = lane.pts, reach2 = (lane.width / 2 + 1) ** 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const [startX, startY] = pts[i], [endX, endY] = pts[i + 1], vx = endX - startX,
        vy = endY - startY, len2 = vx * vx + vy * vy || 1;
      const frac = Math.max(0, Math.min(1, ((x - startX) * vx + (y - startY) * vy) / len2)),
        missX = startX + vx * frac - x, missY = startY + vy * frac - y;
      if (missX * missX + missY * missY < reach2) return true;
    }
  }
  return false;
}
function trackCut(car, near, delta) {
  const live = game.flow ? game.flow.state !== 'done'
    && game.start.t >= (game.start.tGreen0 ?? game.start.tGreen) : LEVEL.stage && car === game.car
      && stage.state === 'running';
  if (!live) {
    car._cut = null;
    return;
  }
  // LANES ARE NOT CUTS (user, 2026-10-04: "the track cut triggers on joker laps — it shouldn't, a
  // specific exclusion; the only time penalty there is the event's, for missing or multiple
  // jokers"): on the joker lane, the RX start lane or a pit lane the car is on a legal road, and an
  // excursion that touched one is dropped whole.
  if (onLane(car.x, car.y)) {
    car._cut = null;
    return;
  }
  if (near.dist > LEVEL.subtrack.width / 2 + CUT_OFF) {
    // where it left the road
    if (!car._cut) car._cut = { gain: 0, prog: car._prog, q: car._lastQ };
    car._cut.gain += delta - Math.hypot(car.vx, car.vy) * PHYSICS_STEP_SECONDS;
    return;
  }
  const cut = car._cut;
  car._cut = null;
  // the step back onto the road (often the big jump)
  if (cut) cut.gain += delta - Math.hypot(car.vx, car.vy) * PHYSICS_STEP_SECONDS;
  if (!cut || cut.gain < CUT_MIN) return;
  car._cuts = (car._cuts || 0) + 1;
  // [m gained, where] for the tools
  (car._cutLog || (car._cutLog = [])).push([+cut.gain.toFixed(1), Math.round(cut.q)]);
  if (race.on || LEVEL.stage) {
    const pen = Math.max(2, Math.round(cut.gain / CUT_PER_S));
    car._cutPen = (car._cutPen || 0) + pen;
    if (car === game.car) {
      if (LEVEL.stage) stage.pen += pen;
      game.notice = { text: 'TRACK CUT +' + pen + ' s', at: performance.now() };
    }
  } else if (cut.gain >= CUT_RESET) {
    const point = onTrack(LEVEL.subtrack, cut.q, 0, {});
    resetCar(car, point.x, point.y, point.rot);
    car._prog = cut.prog;
    car._lastQ = cut.q;
    if (car === game.car) {
      lastOnTrack = { dist: cut.q, off: 0 };
      if (renderer && renderer.snap) renderer.snap(car);
      game.notice = { text: 'TRACK CUT — PUT BACK', at: performance.now() };
    }
    else {
      const entry = game.ai.find((x) => x.car === car);
      if (entry) entry.drv.relocate();
    }
    return 'reset';
  }
}
function stepOrder() {
  const all = [game.car, ...game.ai.map((entry) => entry.car)];
  for (const car of all) progressOf(car);
  // still on the start lane = behind everyone on the lap, ordered by how far down the lane they are
  const spawn = LEVEL.spawn,
    key = (car) => (car._prog === undefined
      ? -1e6 + (car.x - spawn.x) * Math.cos(spawn.heading)
        + (car.y - spawn.y) * Math.sin(spawn.heading)
      : car._prog);
  const mine = key(game.car);
  game.position = 1 + all.filter((car) => car !== game.car && key(car) > mine).length;
}
// AI RESET (user, 2026-10-04: "reset AI should reset like the player's, at the edge of the track"):
// RESET_BACK m behind the last point it was on the road, centred on the edge it left by (half on /
// half off), nose RESET_ANG deg back toward the road — as doReset does for you. No record (never on
// the road yet): the nearest centreline point, as before.
function aiReset(entry) {
  const car = entry.car, sub = LEVEL.subtrack, rec = car._lastOn;
  // the HIGHWAY: 15 m back from where it was, in the lane with the most room, facing up the road,
  // rolling (highwayrace.js hwPutBack)
  if (LEVEL.endless) {
    const all = [game.car, ...game.ai.map((other) => other.car),
      ...game.traffic.cars].filter((other) => other !== car),
        point = hwPutBack(LEVEL, (car._hwf ? car._hwf.s : 0) - 15, all);
    const speed = Math.max(12, 0.5 * Math.hypot(car.vx, car.vy));
    reset(car, point.x, point.y, point.h);
    car.vx = Math.cos(point.h) * speed;
    car.vy = Math.sin(point.h) * speed;
    car._hwf = null;
    entry.drv.relocate();
    repair(car);
    entry.hurtWait = null;
    return;
  }
  if (rec) {
    const side = Math.sign(rec.off) || (Math.random() < 0.5 ? -1 : 1),
      dist = (rec.dist - RESET_BACK + sub.totalDist) % sub.totalDist;
    const point = onTrack(sub, dist, side * sub.width / 2, {}),
      ang = (RESET_ANG[0] + Math.random() * (RESET_ANG[1] - RESET_ANG[0])) * Math.PI / 180;
    reset(car, point.x, point.y, point.rot - side * ang);
    car._lastOn = { dist: dist, off: side * (sub.width / 2 - 0.5) };
  } else {
    const nearest = findNearestSubtrackPoint(sub, car.x, car.y);
    reset(car, nearest.x, nearest.y, nearest.heading);
  }
  entry.drv.relocate();
  repair(car);
  entry.hurtWait = null;
}
function stepAI(dt) {
  // a RALLY STAGE: a car 3 s past the finish has gone through the stop control — off the road, so
  // it never drives back into the queue
  if (LEVEL.stage && game.flow) game.ai = game.ai.filter((entry) => {
    const flowRow = game.flow.entries.find((x) => x.car === entry.car);
    return !(flowRow && flowRow.finish != null && game.flow.t - flowRow.finish > 3);
  });
  for (const entry of game.ai) {
    const car = entry.car;
    car._p = { x: car.x, y: car.y, h: car.heading };
    // DRIVER AIDS follow yours (user, 2026-10-04: "in an event if you turn TCS on and off it should
    // also turn off for the AI"): the same switch, on the cars that have that aid
    car.absOn = !!game.car.absOn && !!(car.spec.aids && car.spec.aids.abs);
    car.tcsOn = !!game.car.tcsOn && !!(car.spec.aids && car.spec.aids.tcs);
    try {
      const v0x = car.vx, v0y = car.vy;
      fenceClamp(car);
      obstacleClamp(car);
      barrierClamp(car);
      solidClamp(car);
      hit(car, v0x, v0y);
      // TOO INJURED (user: "if an AI is too injured it should reset"): back on the
      // road, mended — the bill keeps the cost
      // TOO INJURED: a pause before the reset so the crash PLAYS OUT (user, 2026-10-04: "wait a
      // moment, the worse the damage the longer, max 2-3 s"): 1 s + 2 s x severity (mean corner
      // damage, + 0.4 for a lost wheel), coasting on light brakes meanwhile
      if (entry.hurtWait == null && tooInjured(car)) {
        const dmg = car.dmg,
          sev = Math.min(1,
            (dmg[0] + dmg[1] + dmg[2] + dmg[3]) / 4 + (car.wheelOff && car.wheelOff.some(Boolean)
              ? 0.4 : 0));
        entry.hurtWait = 1 + 2 * sev;
        entry.hurtT = 0;
      }
      if (entry.hurtWait != null && (entry.hurtT += dt) >= entry.hurtWait) {
        aiReset(entry);
        entry.hurtWait = null;
        car._dmgResets = (car._dmgResets || 0) + 1;
      }
      applyGround(car, dt);
      // what the AI knows: the other cars (to avoid / pass / cover), its lap (from the race order's
      // progress) and the race length (jokers)
      const total = LEVEL.subtrack.totalDist, lap = LEVEL.endless || car._prog === undefined ? 1
        : Math.max(1, Math.floor(car._prog / total) + 1);
      // loose objects (cones, tyres, bales) within 45 m, refreshed every 0.25 s — the AI steps
      // round them when it can (aidriver OBSTACLES)
      if (!(entry.obsT > 0)) {
        entry.obsT = 0.25;
        const near2 = 45 * 45;
        entry.obs = game.cones.list
          .filter((obj) => (obj.x - car.x) ** 2 + (obj.y - car.y) ** 2 < near2
            && !(obj.kind === 'banger' || obj.kind === 'caravan'))
          .map((obj) => ({ x: obj.x, y: obj.y, r: obj.r }));
      }
      entry.obsT -= dt;
      // (the highway racer also sees the TRAFFIC, and holds formation until the green)
      let want = entry.drv.drive(car, dt,
        { obstacles: entry.obs,
          cars: [game.car, ...game.ai.map((other) => other.car),
            ...(LEVEL.endless ? game.traffic.cars : [])].filter((other) => other !== car),
              hold: startHeld(), lap, laps: game.flow ? game.flow.laps : race.on ? race.laps
                : (LEVEL.joker && LEVEL.joker.laps) || 5 });
      // waiting out the crash
      if (entry.hurtWait != null) want = { steer: 0, throttle: 0, brake: 0.4, handbrake: 0 };
      const held = LEVEL.stage ? carHeld(car) : startHeld();
      if (rolling(car)) {
        stepRoll(car, dt, (kind, side, weight) => hitRoll(car, kind, side, weight));
        // an overturned AI, once it has stopped: back on its wheels on the road (as a marshal
        // would), mended
        if (car.roll && car.roll.phase !== 'rolling' && car.roll.still > 1.5) aiReset(entry);
      } else {
        step(car, held ? (game.start.rolling ? atPace(want, car)
          : { steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0 }) : want, dt);
        if (!held) tripCheck(car, dt);
      }   // start lights
      assertFinite(car);
      // the JOKER gate, counted for every AI exactly as for the player (stepJoker)
      const joker = LEVEL.joker;
      // (the same LINE as the player's, stepJoker; once per lap of this car's own progress)
      if (joker) {
        const lapA = car._prog === undefined ? 0 : Math.floor(car._prog / LEVEL.subtrack.totalDist);
        if (crossedJoker(joker, car._p.x, car._p.y, car.x, car.y) && entry.jLap !== lapA) {
          entry.jLap = lapA;
          car._jokers++;
        }
      }
      // STUCK (beached, nose in a wall, spun backwards): under 1 m/s for 3 s after the green ->
      // back on the road, as the player's RESET
      entry.stuckT = !held && Math.hypot(car.vx, car.vy) < 1 ? entry.stuckT + dt : 0;
      // the HIGHWAY: more than 8 m off the carriageway for 3 s (or 40 m out) also counts — there is
      // no lap to come back to
      if (LEVEL.endless && car._hwf) {
        const out = Math.abs(car._hwf.off) - LEVEL._hw.geo.hw;
        entry.offT = out > 8 ? (entry.offT || 0) + dt : 0;
        if (entry.offT > 3 || out > 40) {
          entry.offT = 0;
          entry.stuckT = 4;
        }
      }
      // (an AI first tries to DRIVE ITSELF OUT - aidriver.js DRIVE OUT - and gives up after three
      // tries: then this resets it)
      if (entry.stuckT > 3 || entry.drv.state.giveUp) {
        aiReset(entry);
        entry.stuckT = 0;
      }
    // an AI car that breaks is put back on the road, never allowed to stop the game
    } catch {
      if (LEVEL.endless) {
        car.x = car._p.x;
        car.y = car._p.y;
        car.vx = car.vy = 0;
        try {
          aiReset(entry);
        } catch { /* next step */ }
        continue;
      }
      const sub = LEVEL.subtrack, nearest = findNearestSubtrackPoint(sub, car._p.x, car._p.y);
      reset(car, nearest.x, nearest.y, nearest.heading);
      entry.drv.relocate();
    }
  }
}
const lapState = {
  lap: 0,
  lapTime: 0,
  bestTime: null,
  lastTime: null,
  started: false,
  halfway: false,
};
game.lap = lapState;

function updateRecoveryTracking(car, dt) {
  const speed = Math.hypot(car.vx, car.vy);

  // 1. If level has a subtrack, update track progress (the furthest point reached along the
  // circuit)
  if (LEVEL.subtrack) {
    const pts = LEVEL.subtrack.pts;
    const total = LEVEL.subtrack.totalDist;
    let closestPt = null, closestD2 = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const point = pts[i];
      const dist2 = (car.x - point.x) ** 2 + (car.y - point.y) ** 2;
      if (dist2 < closestD2) {
        closestD2 = dist2;
        closestPt = point;
      }
    }
    if (closestPt && closestD2 < (LEVEL.subtrack.width * 1.6) ** 2) {
      const curDist = closestPt.dist;
      game.trackD = curDist;
      const off = (car.x - closestPt.x) * closestPt.nx + (car.y - closestPt.y) * closestPt.ny;
      if (Math.abs(off) <= LEVEL.subtrack.width / 2) lastOnTrack = { dist: curDist, off };
      if (trackProgress === 0 && curDist < total * 0.20) {
        trackProgress = curDist;
      } else if (curDist > trackProgress && curDist - trackProgress < total * 0.30) {
        trackProgress = curDist;
      }

      // Start timing when vehicle moves off the grid
      if (!lapState.started && speed > 0.8 && !startHeld()) {
        lapState.started = true;
        lapState.lap = 1;
        lapState.lapTime = 0;
      }

      if (lapState.started) {
        if (trackProgress > total * 0.45) {
          lapState.halfway = true;
        }
        // Crossing start/finish line: car completed circuit (> 75%) and wraps back across line (<
        // 15%)
        if (lapState.halfway && trackProgress > total * 0.75 && curDist < total * 0.15) {
          lapState.lastTime = lapState.lapTime;
          if (lapState.bestTime === null || lapState.lapTime < lapState.bestTime) {
            lapState.bestTime = lapState.lapTime;
          }
          lapState.lap++;
          lapState.lapTime = 0;
          lapState.halfway = false;
          trackProgress = curDist;
        }
      }
    }

    if (lapState.started) {
      lapState.lapTime += dt;
    }
  }
}

const RESET_BACK = 4;          // m behind the exit point
const RESET_ANG = [5, 15];     // deg back toward the road, random in this range
function doReset() {
  // Safe track/free-roam recovery: places car back on nearest track edge or recent clear spot
  game.car.prevWheels = null;
  repair(game.car);   // DAMAGE: RESET mends the car (user); the repair bill keeps counting
  // RESET KEEPS TYRE HEAT (2026-10-03, step 2): vehicle.js reset() starts the tyres cold, which is
  // right for RESTART and a new car, but RESET is a recovery — you have not stopped driving. Put
  // the temperatures back afterwards.
  const keepT = game.car.tyreT ? game.car.tyreT.slice() : null;
  const resetKeepingTyres = (car, x, y, heading) => {
    resetCar(car, x, y, heading);
    if (keepT) car.tyreT = keepT.slice();
  };
  // CIRCUITS (user, 2026-10-04: "reset doesn't work nicely — always behind / in line with where the
  // player LEFT the track, half on half off as if corrected, a random close angle pointing back on,
  // NOT on the racing line"). Was: the nearest CENTRELINE point, dead straight — on the racing
  // line, and sometimes level with or past where you went off. Now: RESET_BACK m behind the last
  // point the car was on the road, centre on the EDGE it left by (half on / half off), nose turned
  // RESET_ANG deg back toward the road. tools/resetcheck.mjs.
  if (LEVEL.subtrack) {
    const sub = LEVEL.subtrack;
    let rec = lastOnTrack;
    if (!rec) {
      const point = findNearestSubtrackPoint(sub, game.car.x, game.car.y, trackProgress);
      if (point) rec = { dist: point.dist,
        off: (game.car.x - point.x) * point.nx + (game.car.y - point.y) * point.ny };
    }
    if (rec) {
      const side = Math.sign(rec.off) || (Math.random() < 0.5 ? -1 : 1);
      const dist = (rec.dist - RESET_BACK + sub.totalDist) % sub.totalDist;
      const point = onTrack(sub, dist, side * sub.width / 2, {});
      const ang = (RESET_ANG[0] + Math.random() * (RESET_ANG[1] - RESET_ANG[0])) * Math.PI / 180;
      // +heading turns the nose toward +normal, so a car on the +side turns by -ang to point back
      // across the road
      resetKeepingTyres(game.car, point.x, point.y, point.rot - side * ang);
      lastOnTrack = { dist: dist, off: side * (sub.width / 2 - 0.5) };
      if (renderer && renderer.snap) renderer.snap(game.car);
      return;
    }
  }
  if (breadcrumbs.length > 0) {
    const safe = breadcrumbs[Math.max(0, breadcrumbs.length - 5)];   // ~2 s back
    resetKeepingTyres(game.car, safe.x, safe.y, safe.heading);
    if (renderer && renderer.snap) renderer.snap(game.car);
    return;
  }
  resetKeepingTyres(game.car, SPAWN.x, SPAWN.y, SPAWN.heading);
  if (renderer && renderer.snap) renderer.snap(game.car);
}

// THE RACE (AI stage 4, src/raceflow.js): any VS AI or RX race on a lap circuit (not a stage).
// Laps: setup, else 3 / the RX laps.
function startFlow() {
  game.flow = null;
  game.flowShown = false;
  game.car.num = 1;
  game.car._jokers = 0;
  game.car._slot = game.ai.length && !LEVEL.stage ? gridSlot : 0;
  // your lights count to YOUR start
  if (LEVEL.stage && game.start.on) game.start.tGreen = startAtOf(game.car);
  for (const car of [game.car, ...game.ai.map((entry) => entry.car)]) {
    car._cut = null;
    car._cutPen = 0;
    car._cuts = 0;
  }
  if (mode !== 'session' || !LEVEL.subtrack || !(game.ai.length || race.on)) return;
  // the HIGHWAY: no laps — the race ends on the off-screen countdowns (highwayrace.js
  // createHwFlow); "on screen" = the renderer's real view
  if (LEVEL.endless) {
    game.flow = createHwFlow({ lv: LEVEL,
      cars: [{ car: game.car, player: true }, ...game.ai.map((entry) => ({ car: entry.car }))],
        visible: (car) => onScreen(car.x, car.y) });
    return;
  }
  if (LEVEL.stage) {
    game.flow = createRaceFlow({ cars: [{ car: game.car, player: true },
      ...game.ai.map((entry) => ({ car: entry.car }))], total: LEVEL.subtrack.totalDist, laps: 1,
        stage: { finish: LEVEL.stage.finish } });
    return;
  }
  const laps = raceLaps || (LEVEL.joker && race.on ? LEVEL.joker.laps || 5 : 3);
  race.laps = laps;
  game.flow = createRaceFlow({ cars: [{ car: game.car, player: true },
    ...game.ai.map((entry) => ({ car: entry.car }))], total: LEVEL.subtrack.totalDist, laps,
      joker: race.on ? LEVEL.joker : null });
}
try {
  game.hwBest = +(localStorage.getItem('rac3r.hwbest') || 0);
} catch {
  game.hwBest = 0;
}
let camRecord = {};
try {
  camRecord = JSON.parse(localStorage.getItem('rac3r.cams') || '{}') || {};
} catch {
  camRecord = {};
}
let savedHwBest = game.hwBest;   // what is in storage now
let camDirty = false;
// NO storage writes in the frame loop: a synchronous localStorage write can stall a phone frame
// (judder). The highway best and the speed camera record live in memory while driving and are
// saved here at safe moments: pause, restart, leaving a level, page hidden / closed.
function saveRecords() {
  try {
    if ((game.hwBest | 0) > (savedHwBest | 0)) {
      localStorage.setItem('rac3r.hwbest', String(game.hwBest | 0));
      savedHwBest = game.hwBest;
    }
    if (camDirty) {
      localStorage.setItem('rac3r.cams', JSON.stringify(camRecord));
      camDirty = false;
    }
  } catch { /* private mode: fine */ }
}
addEventListener('pagehide', saveRecords);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveRecords();
});
// TRAFFIC (user, 2026-10-05: "traffic in every mode, a slider in test mode for density"): 0..1.5 (1
// = PER_LANE cars a lane), setup's TRAFFIC slider or ?traffic=; LITTER (user: "a slider for
// frequency / density" of the roadside objects): 0..3 x, setup's LITTER slider
game.traffic = createTraffic();
let trafficDensity = settings.trafficDensity;
if (settings.litter !== null)
  for (const level of LEVELS) if (level.endless) level.litter = settings.litter;
// what the camera can see right now (+ a margin): traffic only appears / goes OUTSIDE it
function onScreen(x, y) {
  const margin = 14 * renderer.PPM, screenX = renderer.toScreenX(x),
    screenY = renderer.toScreenY(y);
  return screenX > -margin && screenX < renderer.W + margin && screenY > -margin
    && screenY < renderer.H + margin;
}
function doRestart() {
  saveRecords();
  if (LEVEL.endless) {
    resetHighway(LEVEL);
    game.hwDist = 0;
    game.camFines = 0;
    game.camCount = 0;
    game.camCaught = null;
  }   // the same motorway from the start again
  // the FPS corner's 10 s LOW starts again: the level-load hitch is not a driving dip (MEASURED:
  // LOW 26 from the load)
  game.fpsClear = true;
  // Full level restart: resets car to spawn, stands cones up, clears marks and wear
  game.car._prog = undefined;
  game.position = 1;
  repair(game.car);
  resetBill(game.car);   // DAMAGE: a fresh car and a clean bill
  setTimeout(() => {
    armStart();
    spawnAI();
    // any race grid puts YOU on your slot too — pole included (was gridSlot > 0: on pole you stayed
    // on the centreline spawn, out of formation)
    if (game.start.rolling || (game.ai.length && !LEVEL.stage)) {
      const slotPos = gridPos(game.ai.length ? gridSlot : 0);
      reset(game.car, slotPos.x, slotPos.y, slotPos.h);
      if (renderer && renderer.snap) renderer.snap(game.car);
    }
    game.traffic.reset(LEVEL.endless && mode !== 'menu' ? LEVEL : null, trafficDensity);
    if (LEVEL.endless && game.ai.length) {
      const [spanStart, spanEnd] = hwGridSpan(LEVEL, game.ai.length + 1);
      game.traffic.clearSpan(spanStart, spanEnd);
    }   // a clear road for the grid
    // the treadmill guard measures "dropped back" from the furthest point reached (the spawn): a
    // back-row grid slot is up to ~50 m behind it, which read as WRONG WAY 5 s into the race
    // (MEASURED, tools/_tfgame). Start the record where YOU start.
    if (LEVEL.endless && LEVEL._hw) {
      const frame = roadFrame(LEVEL, game.car.x, game.car.y, null);
      if (frame) LEVEL._hw.best = Math.min(LEVEL._hw.best, frame.s);
    }
    startFlow();
  }, 0);   // after this function has put the player on the spawn
  game.car.prevWheels = null;
  game.car.simTime = 0;
  lapState.lap = 0;
  lapState.lapTime = 0;
  lapState.bestTime = null;
  lapState.lastTime = null;
  lapState.started = false;
  lapState.halfway = false;
  reset(game.car, SPAWN.x, SPAWN.y, SPAWN.heading);
  if (renderer && renderer.snap) renderer.snap(game.car);
  game.cones.reset();
  game.marks.clear();
  clearWear();
  // open on the whole level, then ease in to the car
  if (renderer && renderer.flyIn) renderer.flyIn();
  trackProgress = 0;
  lastOnTrack = null;
  resetRace();
  resetStage();
  breadcrumbs.length = 0;
}

const hud = createHud();
// HOW TO PLAY (user, 2026-10-03). Opens by itself once per device, after the first fly-in. NOT
// under automation: Playwright sets navigator.webdriver, and every harness in tools/ taps the HUD
// as if no card were up. ?guide=1 forces it on (for photographing it), ?guide=0 forces it off.
const guide = createGuide();
// MENUS (user spec 2026-10-03: main menu -> Test Mode / Garage; a live DEMO LAP behind the menu).
// mode: 'menu' | 'session'. APPROVED (user, 2026-10-03: "sounds great") — the menu is the normal
// start. ?menu=0 drives straight in (the old start); automation (navigator.webdriver) also skips
// it, so every tool that taps the HUD still lands in a session; ?menu=1 forces it.
const MENU = settings.menu === '1' || (settings.menu !== '0' && !navigator.webdriver);
let mode = 'session', demo = null, demoStill = 0, paused = false;
// MENU RACE (user, 2026-10-04: "just use the updated AI / 5-car race event for the menu screen"):
// behind the menu a 5-car race runs — the camera car + DEMO_AI opponents, all on the racing AI
// (aidriver.js) at DEMO_DIFF, no lights. Was one autodrive car on the Test Track.
// ?menuai=N: A/B the frame cost
const DEMO_LEVEL = 'thruston', DEMO_CAR = 'hatch-rwd', DEMO_AI = settings.menuAi, DEMO_DIFF = 3;
let guidePending = false, rulesPending = null;
const renderer = createRenderer(canvas, settings);
const audio = createAudio();
game.audio = audio;
setTuneAudio(audio);
const input = createInput(canvas, {
  mode: settings.inputMode,
  // Asked BEFORE the steering stick or the pedals get a chance to claim the pointer, so a control
  // always wins over the world it is drawn on top of. Returns true if the HUD consumed the touch.
  hudDown: (tapX, tapY) => {
    if (!started || mode === 'menu') return false;
    // the guide, while open, owns every tap — before the HUD, the stick or the pedals
    if (guide.hit({ x: tapX, y: tapY })) return true;
    const action = hud.hit({ x: tapX, y: tapY }, renderer.W, renderer.H, game.car);
    if (!action) return false;
    if (action.car) selectCar(action.car);
    if (action.restart) doRestart();
    if (action.reset) doReset();
    if (action.clear) game.marks.clear();
    if (action.help) {
      hud.close();
      if (MENU) openPause(); else guide.open();
    }
    if (action.volumeCycle) {
      if (audio.muted) {
        audio.toggleMute();
        audio.setVolume(1.0);
      } else if (audio.volume > 0.65) {
        audio.setVolume(0.50);
      } else if (audio.volume > 0.30) {
        audio.setVolume(0.20);
      } else {
        audio.toggleMute();
      }
    }
    if (action.tune) nudge(game.car, action.tune, action.dir);
    if (action.tuneReset) resetAll(game.car);
    if (action.level) selectLevel(action.level);
    if (action.toggleAbs) game.car.absOn = !game.car.absOn;
    if (action.toggleTcs) game.car.tcsOn = !game.car.tcsOn;
    if (action.toggleLights) game.car.lightsOn = !game.car.lightsOn;
    if (action.indicate) {
      game.car.indicator = game.car.indicator === action.indicate ? 0 : action.indicate;
      game.car.indT = 0;
      game.car.indTurned = false;
    }
    return true;
  },
  onKey: (key) => {
    if (guide.active) {
      guide.key(key);
      return;
    }
    if (key === 'h' && started) {
      hud.close();
      guide.open();
      return;
    }
    if (MENU && mode === 'session' && (key === 'p' || key === 'escape') && !paused) {
      openPause();
      return;
    }
    if (key === 'r') doReset();
    if (key === 'R' || key === 'Backspace') doRestart();
    if (key === 'c') game.marks.clear();
    if (key === 'l') cycleLevel();
    if (key === 'm') audio.toggleMute();
    // driver aids, on cars that have them (user, 2026-10-03)
    if (key === 't' && game.car.spec.aids
      && game.car.spec.aids.tcs) game.car.tcsOn = !game.car.tcsOn;
    // headliGhts
    if (key === 'g') game.car.lightsOn = !game.car.lightsOn;
    if (key === 'q' || key === 'e') {
      const side = key === 'q' ? -1 : 1;
      game.car.indicator = game.car.indicator === side ? 0 : side;
      game.car.indT = 0;
      game.car.indTurned = false;
    }
    if (key === 'b' && game.car.spec.aids
      && game.car.spec.aids.abs) game.car.absOn = !game.car.absOn;
    const index = '12345'.indexOf(key);
    if (index >= 0) selectCar(CAR_IDS[index]);
    if (key === '[') cycleCar(-1);
    if (key === ']') cycleCar(1);
  },
});
game.input = input;

// LEVELS (user, 2026-09-28: "make it so you can switch levels between the lab and the surface
// sandbox"). A level owns its surfaces, its bumps and its cones, so switching means rebuilding the
// cone field and clearing the marks layer — a rut ploughed through the sandbox's mud has no
// business appearing on the lab floor at the same coordinates.
function selectLevel(levelId) {
  if (levelId === LEVEL.id) return;
  saveRecords();
  setLevel(levelId);
  // MEASURED BUG (user, 2026-10-04: "joker lap HUD warning showing on tracks it shouldn't"): the RX
  // race flag survived the in-game level switch, so after an RX race on Knobhill every track showed
  // LAP n/5 + JOKER TO DO. A level without a joker has no RX race.
  if (!LEVEL.joker) race.on = false;
  game.cones = createCones();     // cones are per-level, so the field is rebuilt from the new list
  game.marks.clear();
  clearWear();
  doRestart();
}
if (settings.levelId !== null) {
  selectLevel(settings.levelId);
}
function cycleLevel() {
  const i = LEVELS.findIndex((item) => item.id === LEVEL.id);
  selectLevel(LEVELS[(i + 1) % LEVELS.length].id);
}

// Switching car RESETS the car but KEEPS THE MARKS (PLAN.md): driving the same corner in two cars
// and comparing the two signatures side by side is the whole point of the selector. The roster is
// swapped, never rebuilt, so it is instant.
function selectCar(carId) {
  if (!carId || carId === game.car.spec.id) return;
  game.car = makeCar(carId);
  snapshot(game.car);     // so the tune panel can mark what has been changed from stock
  doReset();
  spawnAI();              // the AI drive the same car as the player (user)
  armStart();
}
function cycleCar(offset) {
  const i = CAR_IDS.indexOf(game.car.spec.id);
  selectCar(CAR_IDS[(i + offset + CAR_IDS.length) % CAR_IDS.length]);
}

// expose for harnesses (CLAUDE.md §5: a script must be able to drive the real game)
window.__game = game;
window.__game.selectCar = selectCar;
window.__game.reset = doReset;
window.__game.restart = doRestart;
window.__game.setAI = (count) => {
  aiCount = Math.max(0, Math.min(5, count | 0));
  spawnAI();
};   // tools
window.__game.launch = (levelId, car, opts) => launch(levelId, car, opts);
// tools/_jokerline.mjs   // tools: start a session (e.g. an RX race) without the menu
window.__game.crossedJoker = (prevX, prevY, x, y) => (LEVEL.joker
  ? crossedJoker(LEVEL.joker, prevX, prevY, x, y) : null);
window.__game.selectLevel = selectLevel;
Object.defineProperty(window.__game, 'level', { get: () => LEVEL });
window.__game.renderer = renderer;
window.__game.input = input;
Object.defineProperty(window.__game, 'hudExpanded', { get: () => hud.expanded });
Object.defineProperty(window.__game, 'tuneOpen', { get: () => hud.tuneOpen });
window.__game.setTyreHud = (enabled) => hud.setTyreHud(enabled);
window.__game.TUNE = TUNE;
window.__game.hudLayout = () => hud.layout(renderer.W, renderer.H);
window.__game.guide = guide;
snapshot(game.car);

addEventListener('resize', () => renderer.resize());
renderer.resize();

// tap to start — also the gesture an AudioContext will need later
let started = false;
function start() {
  if (started || MENU) return;
  started = true;
  boot.classList.add('gone');
  audio.init();
  doRestart();
  const guideSetting = settings.guide;
  guidePending = guideSetting === '1'
    || (guideSetting !== '0' && !guide.seen && !navigator.webdriver);
}
canvas.addEventListener('pointerdown', start, { once: false });
boot.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  start();
});
addEventListener('keydown', start);

// ---- MENU WIRING (only with ?menu=1 for now)
function enterMenu() {
  saveRecords();
  mode = 'menu';
  paused = false;
  started = true;
  aiCount = DEMO_AI;
  aiDiff = DEMO_DIFF;
  game.ai = [];
  game.start = { on: false, green: true, t: 0, tGreen: 0 };
  boot.classList.add('gone');
  hud.close();
  race.on = false;
  if (LEVEL.id !== DEMO_LEVEL) selectLevel(DEMO_LEVEL); else doRestart();
  if (game.car.spec.id !== DEMO_CAR) selectCar(DEMO_CAR);
  demo = createAIDriver(LEVEL,
    aiTraits(DEMO_DIFF, 2, DEMO_AI + 1, 1 + Math.floor(Math.random() * 1e6)));
}
function launch(levelId, carId, opts = {}) {
  mode = 'session';
  demo = null;
  paused = false;
  // ROAD TYPE (endless highway, Test Mode setup): set before the restart below builds the road
  {
    const level = LEVELS.find((item) => item.id === levelId);
    if (level && level.endless && opts.road) setHighwayPreset(level, opts.road);
  }
  aiCount = Math.max(0, Math.min(5, opts.ai | 0));
  aiDiff = settings.aiDifficulty;   // the menu race set its own
  if (opts.diff != null) aiDiff = Math.max(0, Math.min(4, opts.diff | 0));
  race.on = !!opts.rx;
  aiCarMode = opts.aiCars === 'class' ? 'class' : 'same';
  raceLaps = Math.max(0, Math.min(10, opts.laps | 0));
  if (opts.traffic != null) trafficDensity = Math.max(0, Math.min(1.5, +opts.traffic));
  {
    const level = LEVELS.find((item) => item.id === levelId);
    if (level && level.endless && opts.litter != null) level.litter = Math.max(0,
      Math.min(3, +opts.litter));
  }
  audio.init();
  if (LEVEL.id !== levelId) selectLevel(levelId);
  if (game.car.spec.id !== carId) selectCar(carId);
  applyLivery(game.car.spec, opts.livery);
  // TYRES from the garage (none = Pre-Spun, the stock car)
  // PAINT + NUMBER from the garage (none = the car's own colours, no number)
  applyTyre(game.car.spec, opts.tyre);
  doRestart();
  const guideSetting = settings.guide;
  guidePending = guideSetting === '1'
    || (guideSetting !== '0' && !guide.seen && !navigator.webdriver);
  // EVENT RULES the first time you do this kind of event (guide.js RULES); after HOW TO PLAY if
  // that is showing too. ?rules=1 forces them (photos), ?rules=0 / automation skips them, as the
  // guide.
  const rulesSetting = settings.rules, kind = eventKind();
  rulesPending = kind
    && (rulesSetting === '1' || (rulesSetting !== '0' && !rulesSeen(kind) && !navigator.webdriver))
      ? kind : null;
}
// which RULES walkthrough this session needs (guide.js RULES keys), or null
function eventKind() {
  if (LEVEL.endless) return game.ai.length || aiCount ? 'highway' : 'endless';
  if (LEVEL.stage && (aiCount || game.ai.length)) return 'stage';
  if (race.on) return 'rx';
  if (aiCount) return 'race';
  return null;
}
function openPause() {
  saveRecords();
  paused = true;
  const kind = eventKind();
  menu.pause({
    resume: () => {
      paused = false;
    },
    restart: () => {
      paused = false;
      doRestart();
    },
    guide: () => {
      paused = false;
      guide.open();
    },
    rules: kind ? () => {
      paused = false;
      guide.openRules(kind);
    } : null,
    tests: game.testMode,   // the TESTING list (src/testlist.js) in the pause menu, test mode only
    audio,                  // the SOUND slider + MUTE (menu.js pause)
    exit: () => {
      paused = false;
      enterMenu();
    },
  });
}
// thumbnails: paint every level's overview once, then put the demo level back
function paintThumbs() {
  const out = {}, keep = LEVEL.id;
  for (const level of LEVELS) {
    setLevel(level.id);
    out[level.id] = renderer.thumbnail(320);
  }
  setLevel(keep);
  game.cones = createCones();
  clearWear();
  return out;
}
const menu = MENU
  ? createMenu({ thumbs: paintThumbs, launch,
    genStage: (options) => installStage(genStage(options)),
      carSprite: (x, livery, wheels) => (typeof x === 'string'
        ? renderer.pixelCarWithWheels(applyLivery(makeCar(x).spec, livery)) : wheels
          ? renderer.pixelCarWithWheels(x) : renderer.pixelCar(x)) }) : null;
// RESULTS: 1.6 s after the race ends (the flag sweep), the podium then the table (menu.js results)
function stepResults() {
  const flow = game.flow;
  if (!flow || flow.state !== 'done' || game.flowShown || !menu || mode !== 'session') return;
  if (performance.now() - (game.flowDoneAt || 0) < 1600) return;
  game.flowShown = true;
  menu.results(flow,
    { name: LEVEL.name, restart: () => doRestart(), tracks: () => enterMenu(),
      menu: () => enterMenu() });
}
if (MENU) {
  hud.setHelpLabel('II');
  enterMenu();
  menu.show();
}
game.menuMode = MENU;
window.__game.menu = menu;
Object.defineProperty(window.__game, 'mode', { get: () => mode });
Object.defineProperty(window.__game, 'paused', { get: () => paused });

let acc = 0;
let last = performance.now();
const meter = settings.meter ? createMeter() : null;   // ?meter=1 only
const churn = settings.churn ? createChurn(settings.churn) : null;   // ?churn= only
let meterTiles = 0;
let meterTouches = 0;   // ?meter=1: pointer down / up / cancel events since the last frame
if (meter) for (const evName of ['pointerdown', 'pointerup', 'pointercancel']) {
  addEventListener(evName, () => {
    meterTouches++;
  }, { capture: true, passive: true });
}
let fpsAcc = 0, fpsN = 0;
const fpsHist = [];

// SAFETY NET (added 2026-10-03, Claude). The airborne-brake bug showed what happens without
// one: a single NaN in the car reached groundAt(), step() threw, and because nothing caught it
// requestAnimationFrame was never called again — the whole game froze on its last frame and
// every button looked dead. This is NOT a fix for physics bugs (those get fixed at source —
// see vehicle.js axle()). It makes sure the next one costs the player a reset instead of the
// game, and SHOUTS in the console so it is found:
//   * the car is checked for non-finite state EVERY step (8 numbers — free), not only under ?dev=1;
//   * on failure it is put back on the track near the last good position it had, via doReset();
//   * the frame is always rescheduled, even if something throws.
let lastGood = { x: 0, y: 0, heading: 0 };
let nanReports = 0;
function recoverCar(why) {
  if (nanReports++ < 5)
    console.error('[car sim] car state went bad — recovered with a reset. Cause:', why,
      { ...game.car.t });
  game.car.x = lastGood.x;
  game.car.y = lastGood.y;
  game.car.heading = lastGood.heading;
  doReset();
}

/**
 * The FPS meter: accumulates the clamped frame time and, every 0.4 s, publishes the average fps
 * and the worst recent window on `game`.
 * @param {number} wallDt the clamped wall-clock frame time, in seconds
 */
function updateFpsMeter(wallDt) {
  fpsAcc += wallDt;
  fpsN++;
  if (fpsAcc > 0.4) {
    game.fps = fpsN / fpsAcc;
    fpsAcc = 0;
    fpsN = 0;
    // the WORST 0.4 s window of the last ~10 s (user, 2026-10-06: an FPS counter "in the corner
    // always" to spot issues while testing; a dip lasts a moment, so the corner keeps it on screen
    // for 10 s). hud.js drawFps.
    if (game.fpsClear) {
      fpsHist.length = 0;
      game.fpsClear = false;
    } else fpsHist.push(game.fps);
    if (fpsHist.length > 25) fpsHist.shift();
    game.fpsLow = fpsHist.length ? Math.min(...fpsHist) : game.fps;
  }
}

/**
 * ?autopilot=1: the AI drives the player car; also caps the speed (?autopilot=<kmh>) and puts a
 * stuck car back on the track.
 * @param {number} wallDt the clamped wall-clock frame time, in seconds
 * @returns {object} the autopilot's input
 */
function autopilotInput(wallDt) {
  const others = [...game.ai.map((rival) => rival.car), ...game.traffic.cars];
  const inp = { ...autoDrv.drive(game.car, wallDt, { cars: others, lap: 1, laps: 99 }),
    reverse: 0, shiftUp: false, shiftDown: false };
  // ?autopilot=<kmh>: cap the speed (phone judder: highway vs speed)
  if (settings.autopilotKmh > 0) {
    const over = Math.hypot(game.car.vx, game.car.vy) - settings.autopilotKmh / 3.6;
    if (over > 0) inp.throttle = 0;
    if (over > 10 / 3.6) inp.brake = 0.3;
  }
  autoStill = Math.hypot(game.car.vx, game.car.vy) < 2 ? autoStill + wallDt : 0;
  if (autoStill > 3) {
    autoStill = 0;
    if (LEVEL.endless) doReset();
    else {
      const spot = findNearestSubtrackPoint(LEVEL.subtrack, game.car.x, game.car.y);
      reset(game.car, spot.x, spot.y, spot.heading);
    }
    autoDrv.relocate();
  }
  return inp;
}

/**
 * The menu demo: the demo car drives itself; if it stops or strays it is put back on the track.
 * @param {number} wallDt the clamped wall-clock frame time, in seconds
 * @returns {object} the demo driver's input
 */
function demoInput(wallDt) {
  const inp = { ...demo.drive(game.car, wallDt,
    { cars: game.ai.map((entry) => entry.car), lap: 1, laps: 99 }), reverse: 0, shiftUp: false,
      shiftDown: false };
  demoStill = Math.hypot(game.car.vx, game.car.vy) < 2 ? demoStill + wallDt : 0;
  if (demoStill > 3 || demo.state.lastDist > 30) {
    demoStill = 0;
    const spot = findNearestSubtrackPoint(LEVEL.subtrack, game.car.x, game.car.y);
    reset(game.car, spot.x, spot.y, spot.heading);
    demo.relocate();
  }
  return inp;
}

/**
 * Reads this frame's player input: the touch / keyboard sample, overridden by the start-grid
 * hold, the ?autopilot driver or the menu demo driver (each also unsticks its car).
 * @param {number} wallDt the clamped wall-clock frame time, in seconds
 * @returns {object} the input the sim steps with
 */
function readFrameInput(wallDt) {
  let inp = input.update(wallDt);
  // MENU: the demo car drives itself (src/ai/autodrive.ts — the same driver as the lap bench and
  // the AI seed). If it ever stops (stuck off the road), put it back on the track.
  if (mode !== 'menu' && startHeld()) {
    inp = game.start.rolling
      ? { ...atPace(game.start.drv.drive(game.car, PHYSICS_STEP_SECONDS,
        { cars: [...game.ai.map((entry) => entry.car), ...game.traffic.cars], hold: true }),
          game.car), shiftUp: false, shiftDown: false }
                             : { ...inp, throttle: 0, brake: 1, handbrake: 0, reverse: 0 };
  }
  // ?autopilot=1: the AI drives the player car; the phone judder test (drops) needs no fingers
  if (settings.autopilot && mode !== 'menu' && !startHeld() && autoDrv)
    inp = autopilotInput(wallDt);
  if (mode === 'menu' && demo) inp = demoInput(wallDt);
  return inp;
}

/**
 * Indicators, the field's lights and the rolled-over notice, once per frame.
 * @param {object} inp this frame's player input
 * @param {number} wallDt the clamped wall-clock frame time, in seconds
 */
function stepCarSignals(inp, wallDt) {
  // INDICATORS cancel like a real stalk: after the wheel has been turned that way and come back, or
  // after 8 s (wall clock)
  {
    const player = game.car;
    if (player.indicator) {
      player.indT = (player.indT || 0) + wallDt;
      const steer = inp.steer || 0;
      if (Math.sign(steer) === player.indicator
        && Math.abs(steer) > 0.35) player.indTurned = true; else if (player.indTurned
        && Math.abs(steer) < 0.08) player.indicator = 0;
      if (player.indT > 8) player.indicator = 0;
    }
  }
  // the field runs lights when you do
  for (const entry of game.ai) entry.car.lightsOn = !!game.car.lightsOn;
  if (game.car.roll && game.car.roll.phase !== 'rolling' && game.car.roll.phase !== 'none'
    && mode === 'session')
    game.notice = { text: game.car.roll.phase === 'roof' ? 'ON YOUR ROOF — RESET'
      : 'ON YOUR SIDE — RESET', at: performance.now() };
}

/**
 * The guide waits for the fly-in to land on the car, then opens and PAUSES the sim until it
 * closes; the rules card queues behind it.
 */
function openGuideOnLanding() {
  if (guidePending && !renderer.flying) {
    guidePending = false;
    guide.open();
  }
  else if (rulesPending && !guidePending && !guide.active && !renderer.flying) {
    const kind = rulesPending;
    rulesPending = null;
    guide.openRules(kind);
  }
}

/**
 * One fixed physics step of the player car: the clamps, damage, ground and rollover, then the
 * car model. A non-finite result puts the car back on the track instead of ending the game.
 * @param {object} inp this frame's player input
 * @returns {boolean} false if the car had to be recovered (the caller drops the step backlog)
 */
function stepCarPhysics(inp) {
  try {
    // DAMAGE (damage.js): the velocity change the clamps impose IS the impact
    const pv0x = game.car.vx, pv0y = game.car.vy;
    fenceClamp(game.car);
    obstacleClamp(game.car);
    barrierClamp(game.car);
    solidClamp(game.car);   // trees, planes, hangars ... (lab.js solidsFromProps)
    hit(game.car, pv0x, pv0y);
    applyGround(game.car, PHYSICS_STEP_SECONDS);
    // ROLLOVER (roll.js): a rolling / overturned car has no tyres to drive on — the body
    // tumbles or slides; RESET rights it
    if (rolling(game.car)) stepRoll(game.car, PHYSICS_STEP_SECONDS,
      (kind, side, weight) => hitRoll(game.car, kind, side, weight));
    else {
      step(game.car, inp, PHYSICS_STEP_SECONDS);
      tripCheck(game.car, PHYSICS_STEP_SECONDS);
    }
    assertFinite(game.car);
  } catch (err) {
    recoverCar(err.message);
    return false;
  }
  return true;
}

/**
 * The roadside litter and chevrons stream with the road: new ones in ahead, the ones behind out.
 */
function streamHighwayLitter() {
  // the roadside LITTER + CHEVRONS (loose objects) stream with the road: new ones ahead in,
  // the ones behind out (a tyre knocked off its stretch goes with it — it never belonged to
  // the road it rolled onto)
  const hwData = LEVEL._hw;
  if (hwData.looseNew.length) {
    game.cones.spawn(hwData.looseNew);
    hwData.looseNew.length = 0;
  }
  if (hwData.looseCut != null) {
    const cutAt = hwData.looseCut;
    game.cones.cull((cone) => cone._s == null || cone._s >= cutAt);
    hwData.looseCut = null;
  }
  if (hwData.goneFields && hwData.goneFields.size) {
    const gone = hwData.goneFields;
    game.cones.cull((cone) => cone.field == null || !gone.has(cone.field));
    gone.clear();
  }
}

/**
 * The highway speed camera: a catch is a HUD card plus a fine on the session; the fastest and
 * the count are kept.
 */
function caughtBySpeedCamera() {
  // SPEED CAMERA (highway.js speedCamera): caught = a HUD card (hud.js drawCamera) + the fine
  // on the session; fastest + count kept
  const cam = speedCamera(LEVEL, game.car);
  if (cam) {
    game.camCaught = { ...cam, at: performance.now() };
    game.camFines = (game.camFines || 0) + cam.fine;
    game.camCount = (game.camCount || 0) + 1;
    // in memory only: saveRecords() writes it at a safe moment
    camRecord.count = (camRecord.count || 0) + 1;
    camRecord.fines = (camRecord.fines || 0) + cam.fine;
    if (!(camRecord.fastest >= cam.kmh)) camRecord.fastest = cam.kmh;
    camDirty = true;
    game.camBest = camRecord.fastest;
  }
}

/**
 * THE ENDLESS HIGHWAY, one step: slide the road window, the treadmill guard, the litter stream,
 * the speed camera and the distance records.
 * @returns {boolean} false if the guard put the car back (the caller drops the step backlog)
 */
function stepEndlessHighway() {
  const shift = stepHighway(LEVEL, game.car);
  if (shift) {
    if (lastOnTrack) lastOnTrack.dist -= shift;
    if (game.trackD != null) game.trackD -= shift;
  }
  // THE TREADMILL GUARD (user, 2026-10-05: "go backwards should reset you"): wrong way /
  // dropped back / off the motorway -> put back in the left lane at the furthest point
  // reached, rolling at 60 % of the speed you had (or 15 m/s), with the reason shown
  const why = highwayGuard(LEVEL, game.car, PHYSICS_STEP_SECONDS);
  // the going-wide countdown
  if (LEVEL._hw.warn) game.notice = { text: LEVEL._hw.warn, at: performance.now() };
  streamHighwayLitter();
  if (why) {
    const speed = Math.max(15, 0.6 * Math.hypot(game.car.vx, game.car.vy)),
      spot = highwayRespawn(LEVEL);
    repair(game.car);
    resetCar(game.car, spot.x, spot.y, spot.h);
    game.car.vx = Math.cos(spot.h) * speed;
    game.car.vy = Math.sin(spot.h) * speed;
    // never put back into (or right behind) a traffic car
    game.traffic.clearAround(spot.x, spot.y, 30);
    lastOnTrack = null;
    breadcrumbs.length = 0;
    if (renderer && renderer.snap) renderer.snap(game.car);
    game.notice = { text: why, at: performance.now() };
    return false;
  }
  caughtBySpeedCamera();
  game.hwDist = LEVEL._hw.driven || 0;
  if (game.hwDist > (game.hwBest || 0)) {
    game.hwBest = game.hwDist;
  }
  return true;
}

/**
 * Engine and tyre sound, fenced off so a throw can never stop the frame.
 * @param {number} wallDt the clamped wall-clock frame time, in seconds
 */
function updateAudio(wallDt) {
  // AFTER the sim, and fenced off. MEASURED 2026-10-03: audio used to run first, and with a NaN car
  // its setTargetAtTime() throws — which aborted every frame BEFORE the sim could run the recovery
  // above, so the car stayed broken forever. Sound is cosmetic; it must never be able to stop the
  // game.
  try {
    audio.update(game.car, wallDt);
  } catch (err) {
    if (nanReports++ < 5) console.error('[car sim] audio.update threw:', err.message);
  }
}

/**
 * Keeps a breadcrumb of the car's position and travel direction every 0.5 s of sim time.
 */
function dropBreadcrumb() {
  // BREADCRUMBS for RESET on levels with no circuit. MEASURED BUG, 2026-10-03 (guide audit):
  // doReset() read this list but nothing ever wrote to it, so RESET on The Lab sent you to the
  // spawn. Every 0.5 s of sim time while moving and grounded, keep where you were and the way
  // you were TRAVELLING (not facing — mid-spin those differ); RESET uses the one ~2 s back, so
  // the spot you are put on is not the one you just crashed at.
  lastBreadcrumbTime += PHYSICS_STEP_SECONDS;
  if (lastBreadcrumbTime >= 0.5 && Math.hypot(game.car.vx, game.car.vy) > 3 && !game.car.air) {
    lastBreadcrumbTime = 0;
    breadcrumbs.push({ x: game.car.x, y: game.car.y,
      heading: Math.atan2(game.car.vy, game.car.vx) });
    if (breadcrumbs.length > 12) breadcrumbs.shift();
  }
}

/**
 * The running order for one sim step: the highway order, or the circuit order.
 */
function stepRunningOrder() {
  if (LEVEL.endless) {
    if (game.flow && game.flow.highway) game.position = game.flow.order();
  }
  else if ((game.ai.length || game.flow || LEVEL.stage) && LEVEL.subtrack) stepOrder();
}

/**
 * Race flow for one sim step: the running order, then the flow state machine (finish, and the
 * highway end countdowns on the notice line).
 */
function stepRaceFlow() {
  stepRunningOrder();
  if (game.flow && game.start.t >= (game.start.tGreen0 ?? game.start.tGreen)) {
    const was = game.flow.state;
    game.flow.step(PHYSICS_STEP_SECONDS);
    if (was !== 'done' && game.flow.state === 'done') game.flowDoneAt = performance.now();
    // the HIGHWAY's END COUNTDOWNS on the notice line (user: "an AI reaching the edge of the
    // screen ahead starts a countdown")
    const flow = game.flow;
    if (flow.highway
      && flow.cdKind) game.notice = { text: (flow.cdKind === 'ahead' ? (flow.cdHold
        ? 'CLOSING IN  ' : 'CATCH THEM  ') : 'PULLING AWAY  ') + Math.max(1,
          Math.ceil(flow.cd)), at: performance.now(), good: flow.cdKind === 'behind' };
  }
}

/**
 * TRAFFIC for one sim step, then the contact pass shared by you, the AI and the traffic.
 * @param {object[]} tcars the traffic cars
 */
function stepTrafficContacts(tcars) {
  // TRAFFIC: driven after the AI (it reads where everyone is), then in the SAME contact pass as
  // you and the AI — full contact, damage
  if (tcars.length || game.traffic.want) game.traffic.step(PHYSICS_STEP_SECONDS,
    { player: game.car, others: game.ai.map((entry) => entry.car), visible: onScreen });
  if (game.ai.length || tcars.length) {
    const racers = [game.car, ...game.ai.map((entry) => entry.car)], all = tcars.length
      ? [...racers, ...tcars] : racers, startVel = all.map((racer) => [racer.vx, racer.vy]);
    carContacts(all);
    all.forEach((racer, i) => hit(racer, startVel[i][0], startVel[i][1]));
    if (game.ai.length) slipstream(racers);
  }
}

/**
 * The loose cones and tyres for one sim step, and the loose tyres a torn-off wheel throws.
 * @param {object[]} tcars the traffic cars
 */
function stepLooseCones(tcars) {
  // cones are world state, so they advance on the SAME fixed step as the car (rule 5) (traffic
  // within 60 m of you knocks the litter too — a knocked tyre on the road is something they
  // then have to hit)
  {
    const near = tcars.length
      ? tcars.filter((racer) => Math.abs(racer.x - game.car.x) < 60
        && Math.abs(racer.y - game.car.y) < 60) : [];
    const field = game.ai.length || near.length
      ? [game.car, ...game.ai.map((entry) => entry.car), ...near] : [game.car],
        startVel = field.map((racer) => [racer.vx, racer.vy]);
    game.cones.step(field.length > 1 ? field : game.car, PHYSICS_STEP_SECONDS);
    field.forEach((racer, i) => hit(racer, startVel[i][0], startVel[i][1]));
    // DAMAGE: a torn-off wheel becomes a loose tyre, thrown from its corner with the car's
    // speed and outward
    for (const racer of field) while (racer.wheelSpawn && racer.wheelSpawn.length) {
      const corner = racer.wheelSpawn.shift(), cosH = Math.cos(racer.heading),
        sinH = Math.sin(racer.heading),
          alongOff = (corner < 2 ? racer.spec.lf : -racer.spec.lr),
            sideOff = (corner % 2 ? 1 : -1) * (racer.spec.trackWidth || 1.5) / 2;
      const out = (corner % 2 ? 1 : -1) * 4;
      game.cones.add({ x: racer.x + cosH * alongOff - sinH * sideOff,
        y: racer.y + sinH * alongOff + cosH * sideOff, vx: racer.vx * 0.85 - sinH * out,
          vy: racer.vy * 0.85 + cosH * out, ang: racer.heading,
            spin: (Math.random() - 0.5) * 8 });
    }
  }
}

/**
 * Tyre marks for one sim step: the AI, skidding traffic and the player stamp the road.
 * @param {object[]} tcars the traffic cars
 */
function stepTyreMarks(tcars) {
  for (const entry of game.ai)
    if (!rolling(entry.car)) game.marks.stamp(game.marks.wheelsOf(entry.car));
  // a skidding / crashing traffic car marks the road
  for (const racer of tcars) if (!rolling(racer) && racer.dmg
    && (Math.abs(racer.t.slipR) > 0.1 || racer.t.lockedF
      || racer.t.lockedR)) game.marks.stamp(game.marks.wheelsOf(racer));
  game.marks.follow(game.car.x, game.car.y);
  // marks are stamped on the SIM step: a mark is world bookkeeping, not an animation
  if (!rolling(game.car)) game.marks.stamp(game.marks.wheelsOf(game.car));
  game.marks.fade(PHYSICS_STEP_SECONDS);
}

/**
 * Moves the player car to its interpolated draw pose, between its last two physics poses.
 * @returns {object|null} the real pose to put back after drawing, or null if none was moved
 */
function interpolateCar() {
  const car = game.car, prevPose = car._p;
  let keepPose = null;
  if (started && prevPose && !guide.active
    && Math.hypot(car.x - prevPose.x, car.y - prevPose.y) < 5) {
    const alpha = Math.max(0, Math.min(1, acc / PHYSICS_STEP_SECONDS));
    keepPose = { x: car.x, y: car.y, h: car.heading };
    let dHeading = car.heading - prevPose.h;
    dHeading = Math.atan2(Math.sin(dHeading), Math.cos(dHeading));
    car.x = prevPose.x + (car.x - prevPose.x) * alpha;
    car.y = prevPose.y + (car.y - prevPose.y) * alpha;
    car.heading = prevPose.h + dHeading * alpha;
  }
  return keepPose;
}

/**
 * Moves the AI and traffic cars to their interpolated draw poses (same alpha as the player).
 * @returns {Array} [car, x, y, heading] entries to put back after drawing
 */
function interpolateAiCars() {
  const aiKeep = [];
  if (started
    && !guide.active) for (const aiCar of [...game.ai.map((entry) => entry.car),
      ...game.traffic.cars]) {
    const prev = aiCar._p;
    if (!prev || Math.hypot(aiCar.x - prev.x, aiCar.y - prev.y) > 5) continue;
    const alpha = Math.max(0, Math.min(1, acc / PHYSICS_STEP_SECONDS));
    aiKeep.push([aiCar, aiCar.x, aiCar.y, aiCar.heading]);
    let dHeading = aiCar.heading - prev.h;
    dHeading = Math.atan2(Math.sin(dHeading), Math.cos(dHeading));
    aiCar.x = prev.x + (aiCar.x - prev.x) * alpha;
    aiCar.y = prev.y + (aiCar.y - prev.y) * alpha;
    aiCar.heading = prev.h + dHeading * alpha;
  }
  return aiKeep;
}

/**
 * One fixed physics step of the whole world, in the original order.
 * @param {object} inp this frame's input
 * @returns {boolean} false when the step must end the frame's stepping (the car was recovered)
 */
function stepWorld(inp) {
  // The lab says what the ground under the car is doing; the car's own suspension answers.
  // Before step(), so the load is right for the forces computed this step rather than one step
  // stale. remember the pose BEFORE this step, for the render interpolation below
  game.car._p = { x: game.car.x, y: game.car.y, h: game.car.heading };
  if (!stepCarPhysics(inp)) return false;
  lastGood.x = game.car.x;
  lastGood.y = game.car.y;
  lastGood.heading = game.car.heading;
  updateRecoveryTracking(game.car, PHYSICS_STEP_SECONDS);
  stepJoker(game.car);
  stepStage(PHYSICS_STEP_SECONDS);
  // THE ENDLESS HIGHWAY: build ahead / drop behind; when the window moves, everything
  // remembered as a road distance moves with it
  if (LEVEL.endless && !stepEndlessHighway()) return false;
  stepRace(game.car, PHYSICS_STEP_SECONDS);
  dropBreadcrumb();
  stepStart(PHYSICS_STEP_SECONDS);
  // the HIGHWAY: every car's road frame (s, offset, speed along) once per step, for the racers,
  // the order and the countdowns
  if (LEVEL.endless && (game.ai.length || settings.autopilot)) hwFrames(LEVEL,
    [game.car, ...game.ai.map((entry) => entry.car), ...game.traffic.cars]);
  stepAI(PHYSICS_STEP_SECONDS);
  stepRaceFlow();
  const tcars = game.traffic.cars;
  stepTrafficContacts(tcars);
  stepLooseCones(tcars);
  stepTyreMarks(tcars);
  return true;
}

/**
 * The fixed-step sim loop: drains the accumulator in physics steps, up to MAX_STEPS.
 * @param {object} inp this frame's input
 * @param {number} wallDt the clamped wall-clock frame time in seconds
 * @returns {number} ms the sim took this frame, when the meter is on, else 0
 */
function runSimSteps(inp, wallDt) {
  let meterSim = 0;
  openGuideOnLanding();
  if (guide.active || paused) acc = 0;
  if (started && !guide.active && !paused) {
    acc += wallDt;
    let steps = 0;
    const simT0 = performance.now();   // tools: game.simMs / game.drawMs (smoothed ms per frame)
    while (acc >= PHYSICS_STEP_SECONDS && steps < MAX_STEPS) {
      if (!stepWorld(inp)) {
        acc = 0;
        break;
      }
      acc -= PHYSICS_STEP_SECONDS;
      steps++;
    }
    game.simMs = (game.simMs || 0) * 0.9 + (performance.now() - simT0) * 0.1;
    if (meter) meterSim = performance.now() - simT0;
    if (steps >= MAX_STEPS) acc = 0;      // fell behind: drop it, never catch up in a lurch
    game.stepsLastFrame = steps;
    game.car.brakeLight = inp.brake;
  }
  return meterSim;
}

/**
 * Draws the meter's per-frame sample and overlay.
 * @param {{frameMs: number, meterSim: number, drawT0: number}} frame this frame's timings
 */
function drawMeter(frame) {
  const tilesNow = renderer.groundRenders, draw = performance.now() - frame.drawT0;
  const steps = game.stepsLastFrame;
  const moving = Math.hypot(game.car.vx, game.car.vy) > 5.6;   // over 20 km/h
  const events = takeMeterEvents();   // highway slides / overview repaints this frame
  meter.add({ dt: frame.frameMs, sim: frame.meterSim, draw, steps, tiles: tilesNow - meterTiles,
    moving, touches: meterTouches, slide: events.slide, overview: events.overview,
    dist: LEVEL._hw ? game.hwDist : 0 });
  meterTouches = 0;
  meterTiles = tilesNow;
  meter.draw(renderer.ctx, renderer.W, renderer.H);
}

/**
 * Draws one frame (world, HUD, overlays) at the interpolated poses, then restores the real poses.
 * @param {{now: number, wallDt: number, frameMs: number, meterSim: number}} frame this frame
 * @returns {number} the performance.now() the draw started at, for the draw-time smoothing
 */
function renderFrame(frame) {
  // RENDER INTERPOLATION (user, 2026-10-03: "at high speeds the camera / car judder"). MEASURED in
  // a real browser at 200 km/h: the 120 Hz sim gave 2 steps on most frames but 3 or 5 on others, so
  // the car jumped up to 10 px on screen (sd 1.5 px per frame) and the camera chased the jumps.
  // Draw the car BETWEEN its last two physics poses, weighted by the leftover accumulator —
  // standard fixed-step practice. The sim itself is untouched. A teleport (RESET / RESTART / car
  // change) clears _p so nothing smears across the map.
  const car = game.car, keepPose = interpolateCar();
  // what this frame drew (tools: judder measurement)
  game.drawn = { x: car.x, y: car.y, t: frame.now };
  // the AI cars are drawn between their last two poses too (same alpha)
  const aiKeep = interpolateAiCars();
  const drawT0 = performance.now();
  try {
    renderer.frame(game, frame.wallDt, frame.now / 1000);
    if (mode !== 'menu' && !settings.skipLayers.has('hud')) {
      hud.draw(renderer.ctx, game, renderer.W, renderer.H, frame.wallDt);
    }
    if (churn) churn.step(frame.wallDt, renderer.ctx);   // ?churn= only
    if (meter && mode !== 'menu') drawMeter({ ...frame, drawT0 });
  } finally {
    if (keepPose) {
      car.x = keepPose.x;
      car.y = keepPose.y;
      car.heading = keepPose.h;
    }
    for (const [aiCar, x, y, heading] of aiKeep) {
      aiCar.x = x;
      aiCar.y = y;
      aiCar.heading = heading;
    }
  }
  return drawT0;
}

/**
 * One animation frame: input, the fixed-step sim, audio, then the draw.
 * @param {number} now the requestAnimationFrame timestamp in ms
 */
function loop(now) {
  // Rescheduled FIRST, so a throw anywhere below can never stop the game loop again.
  requestAnimationFrame(loop);
  const frameMs = now - last;   // the meter's dt, before the clamp below
  const wallDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  updateFpsMeter(wallDt);

  const inp = readFrameInput(wallDt);
  game.in = inp;
  stepResults();
  stepCarSignals(inp, wallDt);

  // HUD taps are handled in `hudDown` at the moment of the touch, BEFORE the stick or the pedals
  // can claim the pointer — see input.js. Nothing to do here; a tap that reaches this point hit the
  // world.
  input.consumeTap();

  // ---- fixed-step sim
  const meterSim = runSimSteps(inp, wallDt);
  updateAudio(wallDt);

  const drawT0 = renderFrame({ now, wallDt, frameMs, meterSim });
  game.drawMs = (game.drawMs || 0) * 0.9 + (performance.now() - drawT0) * 0.1;
  guide.draw(renderer.ctx, game, hud.layout(renderer.W, renderer.H), renderer.W, renderer.H, wallDt,
    renderer);
}
requestAnimationFrame(loop);
