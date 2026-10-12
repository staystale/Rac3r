// main.js — boot, the FIXED-STEP ACCUMULATOR, and the one seam to the outside world.
//
// THE TWO CLOCKS (CLAUDE.md rule 5), kept explicitly separate:
//   fixed sim step (DT = 1/120 s) : vehicle dynamics, slip, rpm, gear, skid-mark stamping
//   wall clock                    : camera lerp, shift-light flash, fps
// The vehicle NEVER receives a frame delta. If the accumulator falls behind it drops the remainder
// rather than catching up in one huge step — a background tab must not produce a 400-step lurch.
import { lcg } from "./core/random.ts";

import { makeCar, step, reset, assertFinite, DT } from './vehicle.js';
const resetCar = reset;
import { CAR_IDS, applyLivery, applyTyre, ROSTER } from './cars.js';
import { createInput } from './input.js';
import { createRenderer } from './render.ts';
import { readSettings } from './core/settings.ts';
import { createMarks } from './marks.js';
import { createHud } from './hud.js';
import { createCones } from './cones.js';
import { createAudio } from './audio.js';
import { createGuide, rulesSeen } from './guide.js';
import { createMenu } from './menu.js';
import { genStage, installStage } from './stagegen.js';
import { stepHighway, resetHighway, highwayGuard, highwayRespawn, setHighwayPreset, roadFrame, speedCamera } from './highway.js';   // the ENDLESS motorway (registers itself in LEVELS)   // PROCEDURAL STAGES (installs the default generated stage into LEVELS)
import { createAutoDriver } from './autodrive.js';
import { createTraffic } from './traffic.js';   // HIGHWAY TRAFFIC (endless levels)
import { createHwFlow, hwFrames, hwGrid, hwGridSpan, hwPutBack, HW_GREEN } from './hwrace.js';   // VS AI on the highway
import { createAIDriver, aiTraits, lineRun } from './aidriver.js';
import { carContacts, slipstream } from './contact.js';
import { createRaceFlow } from './raceflow.js';
import { hit, hitRoll, repair, resetBill, tooInjured } from './damage.js';
import { rolling, tripCheck, stepRoll } from './roll.js';
import { nudge, resetAll, snapshot } from './tune.js';
import { TUNE } from './vehicle.js';
import { setLevel } from "./world/load.ts";   // the world is set up before this file runs (as importing lab.js did)
import { SPAWN, LEVEL } from "./world/state.ts";
import { applyGround, fenceClamp, obstacleClamp, clearWear } from "./world/wear.ts";
import { barrierClamp, solidClamp } from "./world/barriers.ts";
import { LEVELS } from "./world/levels/index.ts";
import { FENCE } from "./world/bounds.ts";
import { findNearestSubtrackPoint, onTrack, querySubtrack } from "./world/tyrewall.ts";

const settings = readSettings(location.search);
const DEV = settings.dev;
// 5 -> 12 (2026-10-03, high-speed judder). MEASURED: frames over ~42 ms hit the 5-step cap and THREW AWAY sim time, so the
// car fell behind real time and hitched (drawn car vs a smooth path: worst 1.4 m at 200 km/h). wallDt is already capped
// at 0.1 s (12 steps), so this cannot become the "background tab lurch" the cap was guarding against.
const MAX_STEPS = 12;                // per frame; drop the rest

const canvas = document.getElementById('c');
const boot = document.getElementById('boot');
// the boot screen says "loading…" until the code runs (user, 2026-10-04: the old "THE LAB / tap to drive" flashed up first); only the no-menu
// mode (?menu=0, the test tools) still waits for a tap there
if (!(settings.menu === '1' || (settings.menu !== '0' && !navigator.webdriver))) { boot.querySelector('h1').textContent = 'THE LAB'; boot.querySelector('p').textContent = 'tap to drive'; }

const game = {
  dev: DEV,
  car: makeCar(settings.carId && CAR_IDS.includes(settings.carId) ? settings.carId : 'hatch-rwd'),
  cones: createCones(),
  marks: createMarks(),
  fps: 0, fpsLow: 0,
  // TEST MODE (user, 2026-10-06: the test list + the FPS corner "only in test for now"). Every session is launched from TEST MODE until
  // Story exists (menu.js main: Story is locked); ?menu=0 tool runs count too. When Story ships, launch() sets this from its opts.
  testMode: true,
  stepsLastFrame: 0,
  in: null,
  paused: false,
};

let trackProgress = 0;
// where the car was last ON the road (dist along the lap + signed offset from the centreline) — RESET puts you back there
let lastOnTrack = null;
const breadcrumbs = [];
let lastBreadcrumbTime = 0;

// RX RACE (user, 2026-10-04: "5-lap race, joker once; missing it adds +5 s; free practice stays as it is"). Only on a level with a
// joker, only when chosen in setup. Race time runs from the first move off the grid; it finishes when lap 5 is complete.
const race = { on: false, laps: 5, t: 0, started: false, joker: false, done: false, total: 0, penalty: 0 };
game.race = race;
function resetRace() { game.jokerPrev = null; game.jokerLap = null; game.jokerAt = 0; game.inJokerLane = false; game.jokerTaken = false; game.jokers = 0; game.inJokerGate = false; Object.assign(race, { t: 0, started: false, joker: false, done: false, total: 0, penalty: 0, laps: (LEVEL.joker && LEVEL.joker.laps) || 5 }); }
// the JOKER GATE counts in practice too (user: the arrows "vanish when the joker lap has been taken"); RESTART brings them back
// JOKER COUNT (user, 2026-10-04: "harsh, real-ish": exactly once; missed OR each extra = +30 s. FIA: a missed joker is a time penalty,
// extra jokers go to the stewards). Counted on ENTERING the gate, so one pass is one joker however long you sit in it.
// STAGE TIMING (point-to-point, user 2026-10-04): READY -> cross the START line (track distance wraps past 0) -> RUNNING -> pass the
// FINISH distance -> DONE (best kept). Drive the farm road back round and crossing the start line starts a new run; RESTART = READY.
const stage = { state: 'ready', t: 0, best: null, last: null, prevD: null, pen: 0 };
game.stage = stage;
function resetStage() { stage.state = 'ready'; stage.t = 0; stage.prevD = null; stage.pen = 0; }
function stepStage(dt) {
  const S = LEVEL.stage, d = game.trackD; if (!S || d == null) return;
  const prev = stage.prevD; stage.prevD = d; if (prev == null) return;
  const total = LEVEL.subtrack.totalDist, crossedStart = prev > total - 60 && d < 60;
  if (stage.state !== 'running') { if (crossedStart) { stage.state = 'running'; stage.t = 0; stage.pen = 0; } return; }
  stage.t += dt;
  if (prev < S.finish && d >= S.finish && d - prev < 30) { stage.state = 'done'; stage.last = stage.t + (stage.pen || 0); if (stage.best == null || stage.t < stage.best) stage.best = stage.t; }
}
// JOKER DETECTION = A LINE, not a circle (user, 2026-10-07: "Joker lane detection needs to be wider on knob hill - it's easy to come off the
// road shoot wide and cause a defection bug where it doesn't detect you've done it and then when you do it again it gives penalty for
// multiple jokers"). MEASURED: the gate was a 7 m-radius circle at the lane's middle; the lane is 12 m wide and Knobhill's loop is easy to
// run wide of, so a joker driven a few metres out was never counted. Now: a LINE across the lane at the gate, the lane's half width +
// JOKER_SPAN m out each side, counted when the car CROSSES it (either way), and at most ONCE PER LAP (a second crossing in the same lap -
// reversing back over it - never makes a second joker). Not on the main road: the line stops JOKER_ROAD m short of the circuit's edge.
const JOKER_SPAN = 8, JOKER_ROAD = 1;
function jokerLine(J) {
  if (J._line !== undefined) return J._line;
  const lane = (LEVEL.lanes || []).find((n) => n.out == null && n.pts.some(([x, y]) => (x - J.gate.x) ** 2 + (y - J.gate.y) ** 2 < J.gate.r * J.gate.r * 4));
  if (!lane) return (J._line = null);
  let k = 0, bd = Infinity; lane.pts.forEach(([x, y], i) => { const d = (x - J.gate.x) ** 2 + (y - J.gate.y) ** 2; if (d < bd) { bd = d; k = i; } });
  const a = lane.pts[Math.max(0, k - 2)], b = lane.pts[Math.min(lane.pts.length - 1, k + 2)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return (J._line = { x: J.gate.x, y: J.gate.y, tx: (b[0] - a[0]) / l, ty: (b[1] - a[1]) / l, half: lane.width / 2 + JOKER_SPAN });
}
// did the car cross the joker line between (px, py) and (x, y)? Exposed for tools/_jokerline.mjs.
function crossedJoker(J, px, py, x, y) {
  const G = jokerLine(J);
  if (!G) return (x - J.gate.x) ** 2 + (y - J.gate.y) ** 2 < J.gate.r * J.gate.r && !((px - J.gate.x) ** 2 + (py - J.gate.y) ** 2 < J.gate.r * J.gate.r);
  const a0 = (px - G.x) * G.tx + (py - G.y) * G.ty, a1 = (x - G.x) * G.tx + (y - G.y) * G.ty;
  if ((a0 < 0) === (a1 < 0)) return false;
  const u = a0 / (a0 - a1 || 1), cx = px + (x - px) * u, cy = py + (y - py) * u, side = (cx - G.x) * -G.ty + (cy - G.y) * G.tx;
  if (Math.abs(side) > G.half) return false;
  return querySubtrack(LEVEL.subtrack, cx, cy).dist > LEVEL.subtrack.width / 2 + JOKER_ROAD;
}
function stepJoker(car) {
  const J = LEVEL.joker; if (!J) return;
  const lp = game.jokerPrev; game.jokerPrev = { x: car.x, y: car.y };
  const inGate = !!lp && crossedJoker(J, lp.x, lp.y, car.x, car.y);
  if (inGate && game.jokerLap !== lapState.lap) { game.jokerLap = lapState.lap; game.jokers = (game.jokers || 0) + 1; game.jokerTaken = true; game.jokerAt = performance.now(); }
  // IN THE JOKER LANE (user, 2026-10-04: "the joker HUD warning should switch and show joker taken when taken"): the gate sits mid-lane, so
  // the HUD knows you are IN it from the moment you leave the main road onto the lane (the lane through the gate; found once per level)
  if (J._lane === undefined) J._lane = (LEVEL.lanes || []).find((n) => n.out == null && n.pts.some(([x, y]) => (x - J.gate.x) ** 2 + (y - J.gate.y) ** 2 < J.gate.r * J.gate.r * 4)) || null;
  game.inJokerLane = false;
  if (J._lane && querySubtrack(LEVEL.subtrack, car.x, car.y).dist > LEVEL.subtrack.width / 2) {
    const P = J._lane.pts, rr = (J._lane.width / 2 + 1) ** 2;
    for (let k = 0; k + 1 < P.length && !game.inJokerLane; k++) {
      const [ax, ay] = P[k], [bx, by] = P[k + 1], vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((car.x - ax) * vx + (car.y - ay) * vy) / (vx * vx + vy * vy || 1)));
      if ((car.x - ax - t * vx) ** 2 + (car.y - ay - t * vy) ** 2 < rr) game.inJokerLane = true;
    }
  }
  car._jokers = game.jokers || 0;   // the AI's joker tactics read it (covering a rival who has jokered)
  game.inJokerGate = inGate;
}
function stepRace(car, dt) {
  if (!race.on || race.done || !LEVEL.joker) return;
  // timed from the GREEN when there are lights (the results time from it too — raceflow.js); else from the first move
  if (!race.started && (game.start.on ? game.start.green : Math.hypot(car.vx, car.vy) > 0.8)) race.started = true;
  if (!race.started) return;
  race.t += dt;
  race.joker = !!game.jokerTaken; race.jokers = game.jokers || 0;
  if (lapState.lap > race.laps) { race.done = true; race.penalty = LEVEL.joker.penalty * (race.jokers === 0 ? 1 : race.jokers - 1); race.penalty += game.car._cutPen || 0; race.total = race.t + race.penalty; }
}
// AI CARS — stage 1 (2026-10-04, user: up to 5 opponents, FULL CONTACT, the SAME car as the player in different colours + numbers).
// Each is { car, drv }: a real car stepped by the same physics on the same fixed step, driven by the autodriver for now (stage 2 makes
// them race). ?ai=N (0-5) puts N on the grid behind the player on a circuit; they respawn on RESTART, level change and car change.
const AI_LIVERIES = [['#c8302c', '#7e1d1a'], ['#2b56b5', '#14306e'], ['#e2c13a', '#8a6d12'], ['#2f7d4f', '#174a2c'], ['#7a3fa0', '#43205a']];
let aiCount = settings.aiCount;
// DIFFICULTY (PLAN.md §4: 0 Mobile game .. 4 Real; aidriver.js DIFFICULTIES): the centre of the field's spread. ?diff=N, or setup's row.
let aiDiff = settings.aiDifficulty;
game.ai = [];
// RACE LENGTH (user, 2026-10-04: "choose in setup"): setup's LAPS row; 0 = the level's default (3 on a circuit, the joker laps on RX)
let raceLaps = 0;
game.flow = null;
// GRID (user, 2026-10-04: "starting grid position should vary randomly but bias toward the front n back with difficulty"): the player's
// slot is drawn with weights exp(GRID_BIAS[diff] x slot / n) — Mobile leans to the FRONT, Real to the BACK, Realish is even.
const GRID_BIAS = [-2.2, -1.1, 0, 1.1, 2.2];
let gridSlot = 0;
function drawGridSlot(n) {
  if (mode === 'menu' || !n) return 0;
  const w = []; for (let k = 0; k <= n; k++) w.push(Math.exp(GRID_BIAS[aiDiff] * k / n));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let k = 0; k <= n; k++) { r -= w[k]; if (r <= 0) return k; }
  return n;
}
// slot 0 = pole (the spawn, or the rolling-start pole), slot k = the staggered grid behind it
// RALLY STAGE (LEVEL.stage): single file back from the spawn along the road, STAGE_GAP_M apart; later starters queue here, STAGE_GAP_S apart in time
// REAL START INTERVALS (user, 2026-10-04: "it's like a normal race rather than starting IN BETWEEN other opponents on a rally stage
// TIME-WISE"): cars STAGE_GAP_S apart; you always start at the normal lights; those who started BEFORE you are already down the stage
// where their own pace would have taken them (lineRun); those AFTER you queue behind and go STAGE_GAP_S apart. (Was: everyone queued
// 6 s apart — a race in single file.)
const STAGE_GAP_S = 30, STAGE_GAP_M = 9;
function gridPos(k) {
  if (LEVEL.endless) return hwGrid(LEVEL, k);   // the highway: 2 wide in the right-hand lanes (hwrace.js)
  const sub = LEVEL.subtrack, sp = LEVEL.spawn, offLap = querySubtrack(sub, sp.x, sp.y).dist > sub.width / 2;
  if (LEVEL.stage && k > 0) { const d0 = querySubtrack(sub, sp.x, sp.y).trackDist, p = onTrack(sub, ((d0 - k * STAGE_GAP_M) % sub.totalDist + sub.totalDist) % sub.totalDist, 0, {}); return { x: p.x, y: p.y, h: p.rot }; }
  // A REAL 2-WIDE STAGGERED GRID (user, 2026-10-05: "grid starts are wonky / place the player too close to other cars / not in a grid
  // formation"). MEASURED (tools/gridcheck, 5 AI): slots were OUT OF ORDER (slot 2 at 4.5 m back, slot 1 at 9 m), pole sat on the
  // CENTRELINE with its neighbours 1.0-1.6 m away (box to box), and on the Test Track the player's pole was the spawn while the rest
  // counted back from totalDist - 15 -> the player overlapped AI 5 (-0.07 m). Now: every slot, pole included, counts back from the
  // SPAWN's own road distance, GRID_STEP m per slot, alternating columns GRID_LAT m either side of the centre (narrower on a narrow road).
  const back = LEVEL.rollingStart ? ROLL_BACK : 0;
  const lat = Math.max(1.6, Math.min(GRID_LAT, sub.width / 2 - 1.8)), side = k % 2 ? lat : -lat, bk = back + k * GRID_STEP;
  if (offLap) {
    // the spawn is OFF the lap (Slidden Hill's RX start straight): the grid runs straight back from it along its heading
    if (k === 0 && !back) return { x: sp.x - Math.sin(sp.heading) * side, y: sp.y + Math.cos(sp.heading) * side, h: sp.heading };
    const ch = Math.cos(sp.heading), sh = Math.sin(sp.heading);
    return { x: sp.x - ch * bk - sh * side, y: sp.y - sh * bk + ch * side, h: sp.heading };
  }
  const d0 = querySubtrack(sub, sp.x, sp.y).trackDist, d = (((d0 - bk) % sub.totalDist) + sub.totalDist) % sub.totalDist;
  const p = onTrack(sub, d, side, {}); return { x: p.x, y: p.y, h: p.rot };
}
// GRID_STEP: one slot back (so the same column is 2 x apart: 14 m nose to nose, ~9.5 m clear); GRID_LAT: column offset from the centre
const GRID_STEP = 7, GRID_LAT = 3.2;
// AI CARS (user, 2026-10-04: "AI should race within the class, not always the same vehicle — an option to force them to use your car"):
// 'class' = each AI draws a car of YOUR car's class (a shuffled deck, so the field mixes; a one-car class repeats it); 'same' = your car.
// The menu passes its setting (default CLASS); a launch without it (tools, the menu race) keeps 'same', so measurements stay like for like.
let aiCarMode = 'same';
function aiCarIds(n, seed) {
  const base = String(game.car.spec.id).split('#')[0], me = ROSTER.find((r) => r.id === base);
  if (aiCarMode !== 'class' || !me || !me.cls) return Array(n).fill(base);
  // parity first: your TYPE (subclass) when it has 2+ cars (a Hatch race = hatches + the Mini, not the Lamborghini), else the whole class
  const sameSub = ROSTER.filter((r) => r.cls === me.cls && r.sub === me.sub);
  const pool = (sameSub.length >= 2 ? sameSub : ROSTER.filter((r) => r.cls === me.cls)).map((r) => r.id);
  const rnd = lcg(seed >>> 0);
  const out = [];
  while (out.length < n) { const deck = pool.slice(); for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } out.push(...deck); }
  return out.slice(0, n);
}
function spawnAI(n = aiCount) {
  game.ai = []; game.poleCar = null;
  const sub = LEVEL.subtrack; if (!sub || !n) return;
  gridSlot = drawGridSlot(n);
  const seed = 1 + Math.floor(Math.random() * 1e6), ids = aiCarIds(n, seed);
  for (let i = 0; i < n; i++) {
    const car = makeCar(ids[i]), [paint, trim] = AI_LIVERIES[i % AI_LIVERIES.length];
    car.spec = { ...car.spec, id: car.spec.id + '#' + (i + 2), paint, trim };   // own sprite (cached by id), same physics
    car.num = i + 2;
    const drv = createAIDriver(LEVEL, aiTraits(aiDiff, i, n, seed)), slot = i < gridSlot ? i : i + 1;
    car._jokers = 0; car._prog = undefined; car._stageStart = undefined;
    if (LEVEL.stage) {
      // slot relative to yours: < 0 started before you (already on the stage), > 0 queues behind you
      const rel = slot - gridSlot; car._slot = rel;
      car._predT = lineRun(LEVEL, car.spec, drv.traits.pace, Infinity, LEVEL.stage.finish).t;
      if (rel < 0) {
        const run = lineRun(LEVEL, car.spec, drv.traits.pace, -rel * STAGE_GAP_S - 4 * START_STEP);
        reset(car, run.x, run.y, run.h); car.vx = Math.cos(run.h) * run.v; car.vy = Math.sin(run.h) * run.v;
        car._stageStart = rel * STAGE_GAP_S; car._prog = run.dist; car._lastQ = run.dist;
      } else { const g = gridPos(rel); reset(car, g.x, g.y, g.h); }
    } else {
      const g = gridPos(slot); reset(car, g.x, g.y, g.h); car._slot = slot;
      if (slot === 0) game.poleCar = car;
    }
    game.ai.push({ car, drv, stuckT: 0, inGate: false });
  }
}
// START LIGHTS (user, 2026-10-04: "all races started by lights that clearly go red to green, maybe a countdown"; "circuits with ROLLING
// starts: the game controls ALL cars, AI and player, until the start, then releases them"). Any race (VS AI or the RX race): three
// reds light one per second with 3-2-1, then GREEN + GO!. Every car is held until GREEN - START_EARLY ("free to go at green or a split
// second before", the same for player and AI). Rolling start (LEVEL.rollingStart, the ovals): the grid starts 120 m further back, the
// game drives every car at ROLL_PACE in grid order behind red lights, and it goes green as the front car crosses the line.
// Sim time (rule 5: what the cars do). Solo practice: no lights.
const START_STEP = 1.0, START_EARLY = 0.12, ROLL_PACE = 16, ROLL_BACK = 120;
game.start = { on: false, t: 0, tGreen: 0, rolling: false, green: false };
function armStart() {
  const on = mode !== 'menu' && (race.on || aiCount > 0), rolling = on && (!!LEVEL.rollingStart || !!LEVEL.endless) && !!LEVEL.subtrack;
  game.start = { on, t: 0, tGreen: rolling ? Infinity : 4 * START_STEP, tGreen0: rolling ? undefined : 4 * START_STEP, rolling, green: !on,
    drv: rolling ? (LEVEL.endless ? createAIDriver(LEVEL, aiTraits(4, 0, 1)) : createAutoDriver(LEVEL.subtrack)) : null };
  // the HIGHWAY's rolling start has no line to cross: green HW_GREEN s in, everyone already rolling in formation (hwrace.js)
  if (rolling && LEVEL.endless) game.start.tGreen = game.start.tGreen0 = HW_GREEN;
}
const startHeld = () => game.start.on && !game.start.green && game.start.t < game.start.tGreen - START_EARLY;
// a car's own release: everyone at the green, except a RALLY STAGE: a later starter (slot k > 0 behind you) goes k x STAGE_GAP_S after your green
const startAtOf = (c) => (game.start.tGreen0 ?? game.start.tGreen) + (LEVEL.stage ? (c._slot || 0) * STAGE_GAP_S : 0);
const carHeld = (c) => game.start.on && !game.start.rolling && game.start.t < startAtOf(c) - START_EARLY;
// cap a driver's output at the rolling-start pace
function atPace(out, car) {
  const v = Math.hypot(car.vx, car.vy);
  return { ...out, throttle: v > ROLL_PACE ? 0 : Math.min(out.throttle, 0.55), brake: v > ROLL_PACE + 2 ? 0.25 : 0, handbrake: 0, reverse: 0 };
}
function stepStart(dt) {
  // the clock keeps running after green so the HUD can take the lights away 1.2 s later (user: "race start lights don't vanish" — it stopped at green)
  const s = game.start; if (!s.on) return;
  s.t += dt;
  if (s.green) return;
  if (s.rolling && !LEVEL.endless) {
    // green as the FRONT car (the player, pole) crosses the line; reds shown from 1 s
    const pc = game.poleCar || game.car, total = LEVEL.subtrack.totalDist, d = pc === game.car ? game.trackD : querySubtrack(LEVEL.subtrack, pc.x, pc.y).trackDist;
    if (s.prevD != null && d != null && s.prevD > total - 60 && d < 60 && s.t > 2) s.tGreen = s.t;
    s.prevD = d;
  }
  if (s.t >= s.tGreen) s.green = true;
}
// RACE ORDER (user, 2026-10-04: "the lap counter area should keep track of what place you are"). Each car's distance round the lap,
// UNWRAPPED across the line (a car behind the line on the grid starts slightly negative), from the nearest centreline point; ranked.
function progressOf(c) {
  const sub = LEVEL.subtrack, total = sub.totalDist, Q = querySubtrack(sub, c.x, c.y), q = Q.trackDist;
  if (c._prog === undefined) {
    if (Q.dist > sub.width / 2 + 2) return undefined;   // not on the lap yet
    c._prog = q > total / 2 ? q - total : q; c._lastQ = q; return c._prog;
  }
  // out of the track's range (querySubtrack: dist Infinity, trackDist 0 — that 0 dragged the progress back to the line): hold it there
  if (!isFinite(Q.dist)) { trackCut(c, Q, 0); return c._prog; }
  let dq = q - c._lastQ; if (dq > total / 2) dq -= total; if (dq < -total / 2) dq += total;
  // (no jump guard: crossing an infield, the nearest centreline point JUMPS to the far side in one step — that jump IS the cut)
  if (trackCut(c, Q, dq) === 'reset') return c._prog;
  if (Q.dist <= sub.width / 2 && Q.seg != null) { const p = sub.pts[Q.seg]; c._lastOn = { dist: q, off: (c.x - p.x) * p.nx + (c.y - p.y) * p.ny }; }
  c._prog += dq; c._lastQ = q; return c._prog;
}
// TRACK CUTS (user, 2026-10-04: "a time penalty for skipping track in rally / rallycross — and a forced reset when skipping too large of
// a section in normal races"). While a car is wholly OFF the road (centre > half width + CUT_OFF) it banks the track progress it gains
// BEYOND the distance it actually drives — the NET over the whole excursion, so going wide 50 m and cutting 50 m back gains nothing (a
// clamp at 0 lost a 300 m Thruston cut: the progress only jumps on rejoining, after the drive had been subtracted).
// Back on the road: gain >= CUT_MIN -> a cut. RX race / rally stage (timed): +1 s per CUT_PER_S m gained, at least 2 s, into the result.
// A circuit race: gain >= CUT_RESET -> the car is put back where it left the road, progress and all; smaller cuts pass. Free practice:
// nothing.
// CUT_MIN 8 -> 15 m: normal racing clipped one Castle Cum / Thruston inside at 8-10 m (~0.3 s), MEASURED (racecheck4) — not a cut
const CUT_OFF = 1.0, CUT_MIN = 15, CUT_RESET = 25, CUT_PER_S = 5;
function onLane(x, y) {
  for (const l of LEVEL.lanes || []) {
    const P = l.pts, r2 = (l.width / 2 + 1) ** 2;
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, ay] = P[i], [bx, by] = P[i + 1], vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L2)), ex = ax + vx * t - x, ey = ay + vy * t - y;
      if (ex * ex + ey * ey < r2) return true;
    }
  }
  return false;
}
function trackCut(c, Q, dq) {
  const live = game.flow ? game.flow.state !== 'done' && game.start.t >= (game.start.tGreen0 ?? game.start.tGreen) : LEVEL.stage && c === game.car && stage.state === 'running';
  if (!live) { c._cut = null; return; }
  // LANES ARE NOT CUTS (user, 2026-10-04: "the track cut triggers on joker laps — it shouldn't, a specific exclusion; the only time penalty
  // there is the event's, for missing or multiple jokers"): on the joker lane, the RX start lane or a pit lane the car is on a legal road,
  // and an excursion that touched one is dropped whole.
  if (onLane(c.x, c.y)) { c._cut = null; return; }
  if (Q.dist > LEVEL.subtrack.width / 2 + CUT_OFF) {
    if (!c._cut) c._cut = { gain: 0, prog: c._prog, q: c._lastQ };   // where it left the road
    c._cut.gain += dq - Math.hypot(c.vx, c.vy) * DT;
    return;
  }
  const cut = c._cut; c._cut = null;
  if (cut) cut.gain += dq - Math.hypot(c.vx, c.vy) * DT;   // the step back onto the road (often the big jump)
  if (!cut || cut.gain < CUT_MIN) return;
  c._cuts = (c._cuts || 0) + 1; (c._cutLog || (c._cutLog = [])).push([+cut.gain.toFixed(1), Math.round(cut.q)]);   // [m gained, where] for the tools
  if (race.on || LEVEL.stage) {
    const pen = Math.max(2, Math.round(cut.gain / CUT_PER_S));
    c._cutPen = (c._cutPen || 0) + pen;
    if (c === game.car) { if (LEVEL.stage) stage.pen += pen; game.notice = { text: 'TRACK CUT +' + pen + ' s', at: performance.now() }; }
  } else if (cut.gain >= CUT_RESET) {
    const p = onTrack(LEVEL.subtrack, cut.q, 0, {});
    resetCar(c, p.x, p.y, p.rot); c._prog = cut.prog; c._lastQ = cut.q;
    if (c === game.car) { lastOnTrack = { dist: cut.q, off: 0 }; if (renderer && renderer.snap) renderer.snap(c); game.notice = { text: 'TRACK CUT — PUT BACK', at: performance.now() }; }
    else { const a = game.ai.find((x) => x.car === c); if (a) a.drv.relocate(); }
    return 'reset';
  }
}
function stepOrder() {
  const all = [game.car, ...game.ai.map((a) => a.car)];
  for (const c of all) progressOf(c);
  // still on the start lane = behind everyone on the lap, ordered by how far down the lane they are
  const sp = LEVEL.spawn, key = (c) => (c._prog === undefined ? -1e6 + (c.x - sp.x) * Math.cos(sp.heading) + (c.y - sp.y) * Math.sin(sp.heading) : c._prog);
  const mine = key(game.car);
  game.position = 1 + all.filter((c) => c !== game.car && key(c) > mine).length;
}
// AI RESET (user, 2026-10-04: "reset AI should reset like the player's, at the edge of the track"): RESET_BACK m behind the last point it
// was on the road, centred on the edge it left by (half on / half off), nose RESET_ANG deg back toward the road — as doReset does for you.
// No record (never on the road yet): the nearest centreline point, as before.
function aiReset(a) {
  const c = a.car, sub = LEVEL.subtrack, rec = c._lastOn;
  // the HIGHWAY: 15 m back from where it was, in the lane with the most room, facing up the road, rolling (hwrace.js hwPutBack)
  if (LEVEL.endless) { const all = [game.car, ...game.ai.map((o) => o.car), ...game.traffic.cars].filter((o) => o !== c), p = hwPutBack(LEVEL, (c._hwf ? c._hwf.s : 0) - 15, all);
    const v = Math.max(12, 0.5 * Math.hypot(c.vx, c.vy)); reset(c, p.x, p.y, p.h); c.vx = Math.cos(p.h) * v; c.vy = Math.sin(p.h) * v; c._hwf = null; a.drv.relocate(); repair(c); a.hurtWait = null; return; }
  if (rec) {
    const side = Math.sign(rec.off) || (Math.random() < 0.5 ? -1 : 1), d = (rec.dist - RESET_BACK + sub.totalDist) % sub.totalDist;
    const p = onTrack(sub, d, side * sub.width / 2, {}), ang = (RESET_ANG[0] + Math.random() * (RESET_ANG[1] - RESET_ANG[0])) * Math.PI / 180;
    reset(c, p.x, p.y, p.rot - side * ang); c._lastOn = { dist: d, off: side * (sub.width / 2 - 0.5) };
  } else { const q = findNearestSubtrackPoint(sub, c.x, c.y); reset(c, q.x, q.y, q.heading); }
  a.drv.relocate(); repair(c); a.hurtWait = null;
}
function stepAI(dt) {
  // a RALLY STAGE: a car 3 s past the finish has gone through the stop control — off the road, so it never drives back into the queue
  if (LEVEL.stage && game.flow) game.ai = game.ai.filter((a) => { const e = game.flow.entries.find((x) => x.car === a.car); return !(e && e.finish != null && game.flow.t - e.finish > 3); });
  for (const a of game.ai) {
    const c = a.car; c._p = { x: c.x, y: c.y, h: c.heading };
    // DRIVER AIDS follow yours (user, 2026-10-04: "in an event if you turn TCS on and off it should also turn off for the AI"): the same switch,
    // on the cars that have that aid
    c.absOn = !!game.car.absOn && !!(c.spec.aids && c.spec.aids.abs); c.tcsOn = !!game.car.tcsOn && !!(c.spec.aids && c.spec.aids.tcs);
    try {
      const v0x = c.vx, v0y = c.vy;
      fenceClamp(c); obstacleClamp(c); barrierClamp(c); solidClamp(c);
      hit(c, v0x, v0y);
      // TOO INJURED (user: "if an AI is too injured it should reset"): back on the road, mended — the bill keeps the cost
      // TOO INJURED: a pause before the reset so the crash PLAYS OUT (user, 2026-10-04: "wait a moment, the worse the damage the longer, max
      // 2-3 s"): 1 s + 2 s x severity (mean corner damage, + 0.4 for a lost wheel), coasting on light brakes meanwhile
      if (a.hurtWait == null && tooInjured(c)) { const d = c.dmg, sev = Math.min(1, (d[0] + d[1] + d[2] + d[3]) / 4 + (c.wheelOff && c.wheelOff.some(Boolean) ? 0.4 : 0)); a.hurtWait = 1 + 2 * sev; a.hurtT = 0; }
      if (a.hurtWait != null && (a.hurtT += dt) >= a.hurtWait) { aiReset(a); a.hurtWait = null; c._dmgResets = (c._dmgResets || 0) + 1; }
      applyGround(c, dt);
      // what the AI knows: the other cars (to avoid / pass / cover), its lap (from the race order's progress) and the race length (jokers)
      const total = LEVEL.subtrack.totalDist, lap = LEVEL.endless || c._prog === undefined ? 1 : Math.max(1, Math.floor(c._prog / total) + 1);
      // loose objects (cones, tyres, bales) within 45 m, refreshed every 0.25 s — the AI steps round them when it can (aidriver OBSTACLES)
      if (!(a.obsT > 0)) { a.obsT = 0.25; const L2 = 45 * 45; a.obs = game.cones.list.filter((o) => (o.x - c.x) ** 2 + (o.y - c.y) ** 2 < L2 && !(o.kind === 'banger' || o.kind === 'caravan')).map((o) => ({ x: o.x, y: o.y, r: o.r })); }
      a.obsT -= dt;
      // (the highway racer also sees the TRAFFIC, and holds formation until the green)
      let want = a.drv.drive(c, dt, { obstacles: a.obs, cars: [game.car, ...game.ai.map((o) => o.car), ...(LEVEL.endless ? game.traffic.cars : [])].filter((o) => o !== c), hold: startHeld(), lap, laps: game.flow ? game.flow.laps : race.on ? race.laps : (LEVEL.joker && LEVEL.joker.laps) || 5 });
      if (a.hurtWait != null) want = { steer: 0, throttle: 0, brake: 0.4, handbrake: 0 };   // waiting out the crash
      const held = LEVEL.stage ? carHeld(c) : startHeld();
      if (rolling(c)) {
        stepRoll(c, dt, (k, sd, w) => hitRoll(c, k, sd, w));
        // an overturned AI, once it has stopped: back on its wheels on the road (as a marshal would), mended
        if (c.roll && c.roll.phase !== 'rolling' && c.roll.still > 1.5) aiReset(a);
      } else { step(c, held ? (game.start.rolling ? atPace(want, c) : { steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0 }) : want, dt); if (!held) tripCheck(c, dt); }   // start lights
      assertFinite(c);
      // the JOKER gate, counted for every AI exactly as for the player (stepJoker)
      const J = LEVEL.joker;
      // (the same LINE as the player's, stepJoker; once per lap of this car's own progress)
      if (J) { const lapA = c._prog === undefined ? 0 : Math.floor(c._prog / LEVEL.subtrack.totalDist); if (crossedJoker(J, c._p.x, c._p.y, c.x, c.y) && a.jLap !== lapA) { a.jLap = lapA; c._jokers++; } }
      // STUCK (beached, nose in a wall, spun backwards): under 1 m/s for 3 s after the green -> back on the road, as the player's RESET
      a.stuckT = !held && Math.hypot(c.vx, c.vy) < 1 ? a.stuckT + dt : 0;
      // the HIGHWAY: more than 8 m off the carriageway for 3 s (or 40 m out) also counts — there is no lap to come back to
      if (LEVEL.endless && c._hwf) { const out = Math.abs(c._hwf.off) - LEVEL._hw.geo.hw; a.offT = out > 8 ? (a.offT || 0) + dt : 0; if (a.offT > 3 || out > 40) { a.offT = 0; a.stuckT = 4; } }
      // (an AI first tries to DRIVE ITSELF OUT - aidriver.js DRIVE OUT - and gives up after three tries: then this resets it)
      if (a.stuckT > 3 || a.drv.state.giveUp) { aiReset(a); a.stuckT = 0; }
    } catch (e) {   // an AI car that breaks is put back on the road, never allowed to stop the game
      if (LEVEL.endless) { c.x = c._p.x; c.y = c._p.y; c.vx = c.vy = 0; try { aiReset(a); } catch { /* next step */ } continue; }
      const sub = LEVEL.subtrack, q = findNearestSubtrackPoint(sub, c._p.x, c._p.y);
      reset(c, q.x, q.y, q.heading); a.drv.relocate();
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
  const sp = Math.hypot(car.vx, car.vy);
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // 1. If level has a subtrack, update track progress (the furthest point reached along the circuit)
  if (LEVEL.subtrack) {
    const pts = LEVEL.subtrack.pts;
    const total = LEVEL.subtrack.totalDist;
    let closestPt = null, closestD2 = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const d2 = (car.x - p.x) ** 2 + (car.y - p.y) ** 2;
      if (d2 < closestD2) {
        closestD2 = d2;
        closestPt = p;
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
      if (!lapState.started && sp > 0.8 && !startHeld()) {
        lapState.started = true;
        lapState.lap = 1;
        lapState.lapTime = 0;
      }

      if (lapState.started) {
        if (trackProgress > total * 0.45) {
          lapState.halfway = true;
        }
        // Crossing start/finish line: car completed circuit (> 75%) and wraps back across line (< 15%)
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
  // RESET KEEPS TYRE HEAT (2026-10-03, step 2): vehicle.js reset() starts the tyres cold, which is right for RESTART
  // and a new car, but RESET is a recovery — you have not stopped driving. Put the temperatures back afterwards.
  const keepT = game.car.tyreT ? game.car.tyreT.slice() : null;
  const reset = (c, x, y, h) => { resetCar(c, x, y, h); if (keepT) c.tyreT = keepT.slice(); };
  // CIRCUITS (user, 2026-10-04: "reset doesn't work nicely — always behind / in line with where the player LEFT the track,
  // half on half off as if corrected, a random close angle pointing back on, NOT on the racing line"). Was: the nearest
  // CENTRELINE point, dead straight — on the racing line, and sometimes level with or past where you went off.
  // Now: RESET_BACK m behind the last point the car was on the road, centre on the EDGE it left by (half on / half off),
  // nose turned RESET_ANG deg back toward the road. tools/resetcheck.mjs.
  if (LEVEL.subtrack) {
    const sub = LEVEL.subtrack;
    let rec = lastOnTrack;
    if (!rec) {
      const pt = findNearestSubtrackPoint(sub, game.car.x, game.car.y, trackProgress);
      if (pt) rec = { dist: pt.dist, off: (game.car.x - pt.x) * pt.nx + (game.car.y - pt.y) * pt.ny };
    }
    if (rec) {
      const side = Math.sign(rec.off) || (Math.random() < 0.5 ? -1 : 1);
      const d = (rec.dist - RESET_BACK + sub.totalDist) % sub.totalDist;
      const p = onTrack(sub, d, side * sub.width / 2, {});
      const ang = (RESET_ANG[0] + Math.random() * (RESET_ANG[1] - RESET_ANG[0])) * Math.PI / 180;
      // +heading turns the nose toward +normal, so a car on the +side turns by -ang to point back across the road
      reset(game.car, p.x, p.y, p.rot - side * ang);
      lastOnTrack = { dist: d, off: side * (sub.width / 2 - 0.5) };
      if (renderer && renderer.snap) renderer.snap(game.car);
      return;
    }
  }
  if (breadcrumbs.length > 0) {
    const safe = breadcrumbs[Math.max(0, breadcrumbs.length - 5)];   // ~2 s back
    reset(game.car, safe.x, safe.y, safe.heading);
    if (renderer && renderer.snap) renderer.snap(game.car);
    return;
  }
  reset(game.car, SPAWN.x, SPAWN.y, SPAWN.heading);
  if (renderer && renderer.snap) renderer.snap(game.car);
}

// THE RACE (AI stage 4, src/raceflow.js): any VS AI or RX race on a lap circuit (not a stage). Laps: setup, else 3 / the RX laps.
function startFlow() {
  game.flow = null; game.flowShown = false; game.car.num = 1; game.car._jokers = 0; game.car._slot = game.ai.length && !LEVEL.stage ? gridSlot : 0;
  if (LEVEL.stage && game.start.on) game.start.tGreen = startAtOf(game.car);   // your lights count to YOUR start
  for (const c of [game.car, ...game.ai.map((a) => a.car)]) { c._cut = null; c._cutPen = 0; c._cuts = 0; }
  if (mode !== 'session' || !LEVEL.subtrack || !(game.ai.length || race.on)) return;
  // the HIGHWAY: no laps — the race ends on the off-screen countdowns (hwrace.js createHwFlow); "on screen" = the renderer's real view
  if (LEVEL.endless) { game.flow = createHwFlow({ lv: LEVEL, cars: [{ car: game.car, player: true }, ...game.ai.map((a) => ({ car: a.car }))], visible: (c) => onScreen(c.x, c.y) }); return; }
  if (LEVEL.stage) { game.flow = createRaceFlow({ cars: [{ car: game.car, player: true }, ...game.ai.map((a) => ({ car: a.car }))], total: LEVEL.subtrack.totalDist, laps: 1, stage: { finish: LEVEL.stage.finish } }); return; }
  const laps = raceLaps || (LEVEL.joker && race.on ? LEVEL.joker.laps || 5 : 3);
  race.laps = laps;
  game.flow = createRaceFlow({ cars: [{ car: game.car, player: true }, ...game.ai.map((a) => ({ car: a.car }))], total: LEVEL.subtrack.totalDist, laps, joker: race.on ? LEVEL.joker : null });
}
try { game.hwBest = +(localStorage.getItem('rac3r.hwbest') || 0); } catch { game.hwBest = 0; }
// TRAFFIC (user, 2026-10-05: "traffic in every mode, a slider in test mode for density"): 0..1.5 (1 = PER_LANE cars a lane), setup's
// TRAFFIC slider or ?traffic=; LITTER (user: "a slider for frequency / density" of the roadside objects): 0..3 x, setup's LITTER slider
game.traffic = createTraffic();
let trafficDensity = settings.trafficDensity;
if (settings.litter !== null) for (const l of LEVELS) if (l.endless) l.litter = settings.litter;
// what the camera can see right now (+ a margin): traffic only appears / goes OUTSIDE it
function onScreen(x, y) { const m = 14 * renderer.PPM, X = renderer.sx(x), Y = renderer.sy(y); return X > -m && X < renderer.W + m && Y > -m && Y < renderer.H + m; }
function doRestart() {
  if (LEVEL.endless) { resetHighway(LEVEL); game.hwDist = 0; game.camFines = 0; game.camCount = 0; game.camCaught = null; }   // the same motorway from the start again
  game.fpsClear = true;   // the FPS corner's 10 s LOW starts again: the level-load hitch is not a driving dip (MEASURED: LOW 26 from the load)
  // Full level restart: resets car to spawn, stands cones up, clears marks and wear
  game.car._prog = undefined; game.position = 1;
  repair(game.car); resetBill(game.car);   // DAMAGE: a fresh car and a clean bill
  setTimeout(() => { armStart(); spawnAI();
    // any race grid puts YOU on your slot too — pole included (was gridSlot > 0: on pole you stayed on the centreline spawn, out of formation)
    if (game.start.rolling || (game.ai.length && !LEVEL.stage)) { const g = gridPos(game.ai.length ? gridSlot : 0); reset(game.car, g.x, g.y, g.h); if (renderer && renderer.snap) renderer.snap(game.car); }
    game.traffic.reset(LEVEL.endless && mode !== 'menu' ? LEVEL : null, trafficDensity);
    if (LEVEL.endless && game.ai.length) { const [a, b] = hwGridSpan(LEVEL, game.ai.length + 1); game.traffic.clearSpan(a, b); }   // a clear road for the grid
    // the treadmill guard measures "dropped back" from the furthest point reached (the spawn): a back-row grid slot is up to ~50 m behind
    // it, which read as WRONG WAY 5 s into the race (MEASURED, tools/_tfgame). Start the record where YOU start.
    if (LEVEL.endless && LEVEL._hw) { const f = roadFrame(LEVEL, game.car.x, game.car.y, null); if (f) LEVEL._hw.best = Math.min(LEVEL._hw.best, f.s); }
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
  if (renderer && renderer.flyIn) renderer.flyIn();   // open on the whole level, then ease in to the car
  trackProgress = 0;
  lastOnTrack = null;
  resetRace();
  resetStage();
  breadcrumbs.length = 0;
}

const hud = createHud();
// HOW TO PLAY (user, 2026-10-03). Opens by itself once per device, after the first fly-in. NOT under automation:
// Playwright sets navigator.webdriver, and every harness in tools/ taps the HUD as if no card were up.
// ?guide=1 forces it on (for photographing it), ?guide=0 forces it off.
const guide = createGuide();
// MENUS (user spec 2026-10-03: main menu -> Test Mode / Garage; a live DEMO LAP behind the menu). mode: 'menu' | 'session'.
// APPROVED (user, 2026-10-03: "sounds great") — the menu is the normal start. ?menu=0 drives straight in (the old start);
// automation (navigator.webdriver) also skips it, so every tool that taps the HUD still lands in a session; ?menu=1 forces it.
const MENU = settings.menu === '1' || (settings.menu !== '0' && !navigator.webdriver);
let mode = 'session', demo = null, demoStill = 0, paused = false;
// MENU RACE (user, 2026-10-04: "just use the updated AI / 5-car race event for the menu screen"): behind the menu a 5-car race runs —
// the camera car + DEMO_AI opponents, all on the racing AI (aidriver.js) at DEMO_DIFF, no lights. Was one autodrive car on the Test Track.
const DEMO_LEVEL = 'thruston', DEMO_CAR = 'hatch-rwd', DEMO_AI = settings.menuAi, DEMO_DIFF = 3;   // ?menuai=N: A/B the frame cost
let guidePending = false, rulesPending = null;
const renderer = createRenderer(canvas, settings);
const audio = createAudio();
game.audio = audio;
const input = createInput(canvas, {
  mode: settings.inputMode,
  // Asked BEFORE the steering stick or the pedals get a chance to claim the pointer, so a control
  // always wins over the world it is drawn on top of. Returns true if the HUD consumed the touch.
  hudDown: (px, py) => {
    if (!started || mode === 'menu') return false;
    // the guide, while open, owns every tap — before the HUD, the stick or the pedals
    if (guide.hit({ x: px, y: py })) return true;
    const action = hud.hit({ x: px, y: py }, renderer.W, renderer.H, game.car);
    if (!action) return false;
    if (action.car) selectCar(action.car);
    if (action.restart) doRestart();
    if (action.reset) doReset();
    if (action.clear) game.marks.clear();
    if (action.help) { hud.close(); if (MENU) openPause(); else guide.open(); }
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
    if (action.indicate) { game.car.indicator = game.car.indicator === action.indicate ? 0 : action.indicate; game.car.indT = 0; game.car.indTurned = false; }
    return true;
  },
  onKey: (k) => {
    if (guide.active) { guide.key(k); return; }
    if (k === 'h' && started) { hud.close(); guide.open(); return; }
    if (MENU && mode === 'session' && (k === 'p' || k === 'escape') && !paused) { openPause(); return; }
    if (k === 'r') doReset();
    if (k === 'R' || k === 'Backspace') doRestart();
    if (k === 'c') game.marks.clear();
    if (k === 'l') cycleLevel();
    if (k === 'm') audio.toggleMute();
    // driver aids, on cars that have them (user, 2026-10-03)
    if (k === 't' && game.car.spec.aids && game.car.spec.aids.tcs) game.car.tcsOn = !game.car.tcsOn;
    if (k === 'g') game.car.lightsOn = !game.car.lightsOn;                                                    // headliGhts
    if (k === 'q' || k === 'e') { const s = k === 'q' ? -1 : 1; game.car.indicator = game.car.indicator === s ? 0 : s; game.car.indT = 0; game.car.indTurned = false; }
    if (k === 'b' && game.car.spec.aids && game.car.spec.aids.abs) game.car.absOn = !game.car.absOn;
    const n = '12345'.indexOf(k);
    if (n >= 0) selectCar(CAR_IDS[n]);
    if (k === '[') cycleCar(-1);
    if (k === ']') cycleCar(1);
  },
});
game.input = input;

// LEVELS (user, 2026-09-28: "make it so you can switch levels between the lab and the surface sandbox").
// A level owns its surfaces, its bumps and its cones, so switching means rebuilding the cone field and
// clearing the marks layer — a rut ploughed through the sandbox's mud has no business appearing on the
// lab floor at the same coordinates.
function selectLevel(id) {
  if (id === LEVEL.id) return;
  setLevel(id);
  // MEASURED BUG (user, 2026-10-04: "joker lap HUD warning showing on tracks it shouldn't"): the RX race flag survived the in-game level
  // switch, so after an RX race on Knobhill every track showed LAP n/5 + JOKER TO DO. A level without a joker has no RX race.
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
  const i = LEVELS.findIndex((l) => l.id === LEVEL.id);
  selectLevel(LEVELS[(i + 1) % LEVELS.length].id);
}

// Switching car RESETS the car but KEEPS THE MARKS (PLAN.md): driving the same corner in two cars and
// comparing the two signatures side by side is the whole point of the selector. The roster is swapped,
// never rebuilt, so it is instant.
function selectCar(id) {
  if (!id || id === game.car.spec.id) return;
  game.car = makeCar(id);
  snapshot(game.car);     // so the tune panel can mark what has been changed from stock
  doReset();
  spawnAI();              // the AI drive the same car as the player (user)
  armStart();
}
function cycleCar(d) {
  const i = CAR_IDS.indexOf(game.car.spec.id);
  selectCar(CAR_IDS[(i + d + CAR_IDS.length) % CAR_IDS.length]);
}

// expose for harnesses (CLAUDE.md §5: a script must be able to drive the real game)
window.__game = game;
window.__game.selectCar = selectCar;
window.__game.reset = doReset;
window.__game.restart = doRestart;
window.__game.setAI = (n) => { aiCount = Math.max(0, Math.min(5, n | 0)); spawnAI(); };   // tools
window.__game.launch = (lv, car, opts) => launch(lv, car, opts);
window.__game.crossedJoker = (px, py, x, y) => (LEVEL.joker ? crossedJoker(LEVEL.joker, px, py, x, y) : null);   // tools/_jokerline.mjs   // tools: start a session (e.g. an RX race) without the menu
window.__game.selectLevel = selectLevel;
Object.defineProperty(window.__game, 'level', { get: () => LEVEL });
window.__game.renderer = renderer;
window.__game.input = input;
Object.defineProperty(window.__game, 'hudExpanded', { get: () => hud.expanded });
Object.defineProperty(window.__game, 'tuneOpen', { get: () => hud.tuneOpen });
window.__game.setTyreHud = (on) => hud.setTyreHud(on);
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
  const g = settings.guide;
  guidePending = g === '1' || (g !== '0' && !guide.seen && !navigator.webdriver);
}
canvas.addEventListener('pointerdown', start, { once: false });
boot.addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
addEventListener('keydown', start);

// ---- MENU WIRING (only with ?menu=1 for now)
function enterMenu() {
  mode = 'menu'; paused = false; started = true;
  aiCount = DEMO_AI; aiDiff = DEMO_DIFF; game.ai = []; game.start = { on: false, green: true, t: 0, tGreen: 0 };
  boot.classList.add('gone');
  hud.close();
  race.on = false;
  if (LEVEL.id !== DEMO_LEVEL) selectLevel(DEMO_LEVEL); else doRestart();
  if (game.car.spec.id !== DEMO_CAR) selectCar(DEMO_CAR);
  demo = createAIDriver(LEVEL, aiTraits(DEMO_DIFF, 2, DEMO_AI + 1, 1 + Math.floor(Math.random() * 1e6)));
}
function launch(levelId, carId, opts = {}) {
  mode = 'session'; demo = null; paused = false;
  // ROAD TYPE (endless highway, Test Mode setup): set before the restart below builds the road
  { const lv = LEVELS.find((l) => l.id === levelId); if (lv && lv.endless && opts.road) setHighwayPreset(lv, opts.road); }
  aiCount = Math.max(0, Math.min(5, opts.ai | 0));
  aiDiff = settings.aiDifficulty;   // the menu race set its own
  if (opts.diff != null) aiDiff = Math.max(0, Math.min(4, opts.diff | 0));
  race.on = !!opts.rx;
  aiCarMode = opts.aiCars === 'class' ? 'class' : 'same';
  raceLaps = Math.max(0, Math.min(10, opts.laps | 0));
  if (opts.traffic != null) trafficDensity = Math.max(0, Math.min(1.5, +opts.traffic));
  { const lv = LEVELS.find((l) => l.id === levelId); if (lv && lv.endless && opts.litter != null) lv.litter = Math.max(0, Math.min(3, +opts.litter)); }
  audio.init();
  if (LEVEL.id !== levelId) selectLevel(levelId);
  if (game.car.spec.id !== carId) selectCar(carId);
  applyLivery(game.car.spec, opts.livery);
  applyTyre(game.car.spec, opts.tyre);       // TYRES from the garage (none = Pre-Spun, the stock car)   // PAINT + NUMBER from the garage (none = the car's own colours, no number)
  doRestart();
  const g = settings.guide;
  guidePending = g === '1' || (g !== '0' && !guide.seen && !navigator.webdriver);
  // EVENT RULES the first time you do this kind of event (guide.js RULES); after HOW TO PLAY if that is showing too. ?rules=1 forces
  // them (photos), ?rules=0 / automation skips them, as the guide.
  const rq = settings.rules, kind = eventKind();
  rulesPending = kind && (rq === '1' || (rq !== '0' && !rulesSeen(kind) && !navigator.webdriver)) ? kind : null;
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
  paused = true;
  const kind = eventKind();
  menu.pause({
    resume: () => { paused = false; },
    restart: () => { paused = false; doRestart(); },
    guide: () => { paused = false; guide.open(); },
    rules: kind ? () => { paused = false; guide.openRules(kind); } : null,
    tests: game.testMode,   // the TESTING list (src/testlist.js) in the pause menu, test mode only
    audio,                  // the SOUND slider + MUTE (menu.js pause)
    exit: () => { paused = false; enterMenu(); },
  });
}
// thumbnails: paint every level's overview once, then put the demo level back
function paintThumbs() {
  const out = {}, keep = LEVEL.id;
  for (const lv of LEVELS) { setLevel(lv.id); out[lv.id] = renderer.thumbnail(320); }
  setLevel(keep); game.cones = createCones(); clearWear();
  return out;
}
const menu = MENU ? createMenu({ thumbs: paintThumbs, launch, genStage: (o) => installStage(genStage(o)), carSprite: (x, lv, wheels) => (typeof x === 'string' ? renderer.pixelCarWithWheels(applyLivery(makeCar(x).spec, lv)) : wheels ? renderer.pixelCarWithWheels(x) : renderer.pixelCar(x)) }) : null;
// RESULTS: 1.6 s after the race ends (the flag sweep), the podium then the table (menu.js results)
function stepResults() {
  const f = game.flow; if (!f || f.state !== 'done' || game.flowShown || !menu || mode !== 'session') return;
  if (performance.now() - (game.flowDoneAt || 0) < 1600) return;
  game.flowShown = true;
  menu.results(f, { name: LEVEL.name, restart: () => doRestart(), tracks: () => enterMenu(), menu: () => enterMenu() });
}
if (MENU) { hud.setHelpLabel('II'); enterMenu(); menu.show(); }
game.menuMode = MENU;
window.__game.menu = menu;
Object.defineProperty(window.__game, 'mode', { get: () => mode });
Object.defineProperty(window.__game, 'paused', { get: () => paused });

let acc = 0;
let last = performance.now();
let fpsAcc = 0, fpsN = 0; const fpsHist = [];

// SAFETY NET (added 2026-10-03, Claude). The airborne-brake bug showed what happens without one: a single
// NaN in the car reached groundAt(), step() threw, and because nothing caught it requestAnimationFrame was
// never called again — the whole game froze on its last frame and every button looked dead.
// This is NOT a fix for physics bugs (those get fixed at source — see vehicle.js axle()). It makes sure
// the next one costs the player a reset instead of the game, and SHOUTS in the console so it is found:
//   * the car is checked for non-finite state EVERY step (8 numbers — free), not only under ?dev=1;
//   * on failure it is put back on the track near the last good position it had, via doReset();
//   * the frame is always rescheduled, even if something throws.
let lastGood = { x: 0, y: 0, heading: 0 };
let nanReports = 0;
function recoverCar(why) {
  if (nanReports++ < 5) console.error('[car sim] car state went bad — recovered with a reset. Cause:', why, { ...game.car.t });
  game.car.x = lastGood.x; game.car.y = lastGood.y; game.car.heading = lastGood.heading;
  doReset();
}

function loop(now) {
  // Rescheduled FIRST, so a throw anywhere below can never stop the game loop again.
  requestAnimationFrame(loop);
  const wallDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fpsAcc += wallDt; fpsN++;
  if (fpsAcc > 0.4) { game.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    // the WORST 0.4 s window of the last ~10 s (user, 2026-10-06: an FPS counter "in the corner always" to spot issues while testing;
    // a dip lasts a moment, so the corner keeps it on screen for 10 s). hud.js drawFps.
    if (game.fpsClear) { fpsHist.length = 0; game.fpsClear = false; } else fpsHist.push(game.fps); if (fpsHist.length > 25) fpsHist.shift(); game.fpsLow = fpsHist.length ? Math.min(...fpsHist) : game.fps; }

  let inp = input.update(wallDt);
  // MENU: the demo car drives itself (src/autodrive.js — the same driver as the lap bench and the AI seed). If it ever
  // stops (stuck off the road), put it back on the track.
  if (mode !== 'menu' && startHeld()) {
    inp = game.start.rolling ? { ...atPace(game.start.drv.drive(game.car, DT, { cars: [...game.ai.map((a) => a.car), ...game.traffic.cars], hold: true }), game.car), shiftUp: false, shiftDown: false }
                             : { ...inp, throttle: 0, brake: 1, handbrake: 0, reverse: 0 };
  }
  if (mode === 'menu' && demo) {
    inp = { ...demo.drive(game.car, wallDt, { cars: game.ai.map((a) => a.car), lap: 1, laps: 99 }), reverse: 0, shiftUp: false, shiftDown: false };
    demoStill = Math.hypot(game.car.vx, game.car.vy) < 2 ? demoStill + wallDt : 0;
    if (demoStill > 3 || demo.state.lastDist > 30) { demoStill = 0; const q = findNearestSubtrackPoint(LEVEL.subtrack, game.car.x, game.car.y); reset(game.car, q.x, q.y, q.heading); demo.relocate(); }
  }
  game.in = inp;
  stepResults();
  // INDICATORS cancel like a real stalk: after the wheel has been turned that way and come back, or after 8 s (wall clock)
  { const c = game.car; if (c.indicator) { c.indT = (c.indT || 0) + wallDt; const st = inp.steer || 0;
    if (Math.sign(st) === c.indicator && Math.abs(st) > 0.35) c.indTurned = true; else if (c.indTurned && Math.abs(st) < 0.08) c.indicator = 0;
    if (c.indT > 8) c.indicator = 0; } }
  for (const a of game.ai) a.car.lightsOn = !!game.car.lightsOn;   // the field runs lights when you do
  if (game.car.roll && game.car.roll.phase !== 'rolling' && game.car.roll.phase !== 'none' && mode === 'session')
    game.notice = { text: game.car.roll.phase === 'roof' ? 'ON YOUR ROOF — RESET' : 'ON YOUR SIDE — RESET', at: performance.now() };

  // HUD taps are handled in `hudDown` at the moment of the touch, BEFORE the stick or the pedals can
  // claim the pointer — see input.js. Nothing to do here; a tap that reaches this point hit the world.
  input.consumeTap();

  // ---- fixed-step sim
  // the guide waits for the fly-in to land on the car, then opens and PAUSES the sim until it closes
  if (guidePending && !renderer.flying) { guidePending = false; guide.open(); }
  else if (rulesPending && !guidePending && !guide.active && !renderer.flying) { const k = rulesPending; rulesPending = null; guide.openRules(k); }
  if (guide.active || paused) acc = 0;
  if (started && !guide.active && !paused) {
    acc += wallDt;
    let n = 0; const simT0 = performance.now();   // tools: game.simMs / game.drawMs (smoothed ms per frame)
    while (acc >= DT && n < MAX_STEPS) {
      // The lab says what the ground under the car is doing; the car's own suspension answers. Before
      // step(), so the load is right for the forces computed this step rather than one step stale.
      // remember the pose BEFORE this step, for the render interpolation below
      game.car._p = { x: game.car.x, y: game.car.y, h: game.car.heading };
      try {
        // DAMAGE (damage.js): the velocity change the clamps impose IS the impact
        const pv0x = game.car.vx, pv0y = game.car.vy;
        fenceClamp(game.car);
        obstacleClamp(game.car);
        barrierClamp(game.car);
        solidClamp(game.car);   // trees, planes, hangars ... (lab.js solidsFromProps)
        hit(game.car, pv0x, pv0y);
        applyGround(game.car, DT);
        // ROLLOVER (roll.js): a rolling / overturned car has no tyres to drive on — the body tumbles or slides; RESET rights it
        if (rolling(game.car)) stepRoll(game.car, DT, (k, sd, w) => hitRoll(game.car, k, sd, w));
        else { step(game.car, inp, DT); tripCheck(game.car, DT); }
        assertFinite(game.car);
      } catch (e) {
        recoverCar(e.message);
        acc = 0;
        break;
      }
      lastGood.x = game.car.x; lastGood.y = game.car.y; lastGood.heading = game.car.heading;
      updateRecoveryTracking(game.car, DT);
      stepJoker(game.car);
      stepStage(DT);
      // THE ENDLESS HIGHWAY: build ahead / drop behind; when the window moves, everything remembered as a road distance moves with it
      if (LEVEL.endless) { const ds = stepHighway(LEVEL, game.car); if (ds) { if (lastOnTrack) lastOnTrack.dist -= ds; if (game.trackD != null) game.trackD -= ds; }
        // THE TREADMILL GUARD (user, 2026-10-05: "go backwards should reset you"): wrong way / dropped back / off the motorway -> put
        // back in the left lane at the furthest point reached, rolling at 60 % of the speed you had (or 15 m/s), with the reason shown
        const why = highwayGuard(LEVEL, game.car, DT);
        if (LEVEL._hw.warn) game.notice = { text: LEVEL._hw.warn, at: performance.now() };   // the going-wide countdown
        // the roadside LITTER + CHEVRONS (loose objects) stream with the road: new ones ahead in, the ones behind out (a tyre knocked
        // off its stretch goes with it — it never belonged to the road it rolled onto)
        { const hw = LEVEL._hw; if (hw.looseNew.length) { game.cones.spawn(hw.looseNew); hw.looseNew.length = 0; }
          if (hw.looseCut != null) { const s0 = hw.looseCut; game.cones.cull((k) => k._s == null || k._s >= s0); hw.looseCut = null; }
          if (hw.goneFields && hw.goneFields.size) { const g = hw.goneFields; game.cones.cull((k) => k.field == null || !g.has(k.field)); g.clear(); } }
        if (why) { const sp = Math.max(15, 0.6 * Math.hypot(game.car.vx, game.car.vy)), r = highwayRespawn(LEVEL);
          repair(game.car); resetCar(game.car, r.x, r.y, r.h); game.car.vx = Math.cos(r.h) * sp; game.car.vy = Math.sin(r.h) * sp;
          game.traffic.clearAround(r.x, r.y, 30);   // never put back into (or right behind) a traffic car
          lastOnTrack = null; breadcrumbs.length = 0; if (renderer && renderer.snap) renderer.snap(game.car);
          game.notice = { text: why, at: performance.now() }; acc = 0; break; }
        // SPEED CAMERA (highway.js speedCamera): caught = a HUD card (hud.js drawCamera) + the fine on the session; fastest + count kept
        { const cam = speedCamera(LEVEL, game.car); if (cam) { game.camCaught = { ...cam, at: performance.now() }; game.camFines = (game.camFines || 0) + cam.fine; game.camCount = (game.camCount || 0) + 1;
          try { const S = JSON.parse(localStorage.getItem('rac3r.cams') || '{}'); S.count = (S.count || 0) + 1; S.fines = (S.fines || 0) + cam.fine; if (!(S.fastest >= cam.kmh)) S.fastest = cam.kmh; localStorage.setItem('rac3r.cams', JSON.stringify(S)); game.camBest = S.fastest; } catch { /* fine */ } } }
        game.hwDist = LEVEL._hw.driven || 0; if (game.hwDist > (game.hwBest || 0)) { game.hwBest = game.hwDist; if ((game.hwDist | 0) % 50 === 0) try { localStorage.setItem('rac3r.hwbest', String(game.hwBest | 0)); } catch { /* fine */ } } }
      stepRace(game.car, DT);
      // BREADCRUMBS for RESET on levels with no circuit. MEASURED BUG, 2026-10-03 (guide audit): doReset() read
      // this list but nothing ever wrote to it, so RESET on The Lab sent you to the spawn. Every 0.5 s of sim time
      // while moving and grounded, keep where you were and the way you were TRAVELLING (not facing — mid-spin those
      // differ); RESET uses the one ~2 s back, so the spot you are put on is not the one you just crashed at.
      lastBreadcrumbTime += DT;
      if (lastBreadcrumbTime >= 0.5 && Math.hypot(game.car.vx, game.car.vy) > 3 && !game.car.air) {
        lastBreadcrumbTime = 0;
        breadcrumbs.push({ x: game.car.x, y: game.car.y, heading: Math.atan2(game.car.vy, game.car.vx) });
        if (breadcrumbs.length > 12) breadcrumbs.shift();
      }
      stepStart(DT);
      // the HIGHWAY: every car's road frame (s, offset, speed along) once per step, for the racers, the order and the countdowns
      if (LEVEL.endless && game.ai.length) hwFrames(LEVEL, [game.car, ...game.ai.map((a) => a.car), ...game.traffic.cars]);
      stepAI(DT);
      if (LEVEL.endless) { if (game.flow && game.flow.highway) game.position = game.flow.order(); }
      else if ((game.ai.length || game.flow || LEVEL.stage) && LEVEL.subtrack) stepOrder();
      if (game.flow && game.start.t >= (game.start.tGreen0 ?? game.start.tGreen)) { const was = game.flow.state; game.flow.step(DT); if (was !== 'done' && game.flow.state === 'done') game.flowDoneAt = performance.now();
        // the HIGHWAY's END COUNTDOWNS on the notice line (user: "an AI reaching the edge of the screen ahead starts a countdown")
        const f = game.flow; if (f.highway && f.cdKind) game.notice = { text: (f.cdKind === 'ahead' ? (f.cdHold ? 'CLOSING IN  ' : 'CATCH THEM  ') : 'PULLING AWAY  ') + Math.max(1, Math.ceil(f.cd)), at: performance.now(), good: f.cdKind === 'behind' }; }
      // TRAFFIC: driven after the AI (it reads where everyone is), then in the SAME contact pass as you and the AI — full contact, damage
      const tcars = game.traffic.cars;
      if (tcars.length || game.traffic.want) game.traffic.step(DT, { player: game.car, others: game.ai.map((a) => a.car), visible: onScreen });
      if (game.ai.length || tcars.length) { const racers = [game.car, ...game.ai.map((a) => a.car)], all = tcars.length ? [...racers, ...tcars] : racers, v0 = all.map((c) => [c.vx, c.vy]);
        carContacts(all); all.forEach((c, i) => hit(c, v0[i][0], v0[i][1])); if (game.ai.length) slipstream(racers); }
      // cones are world state, so they advance on the SAME fixed step as the car (rule 5)
      // (traffic within 60 m of you knocks the litter too — a knocked tyre on the road is something they then have to hit)
      { const near = tcars.length ? tcars.filter((c) => Math.abs(c.x - game.car.x) < 60 && Math.abs(c.y - game.car.y) < 60) : [];
        const cs = game.ai.length || near.length ? [game.car, ...game.ai.map((a) => a.car), ...near] : [game.car], v0 = cs.map((c) => [c.vx, c.vy]);
        game.cones.step(cs.length > 1 ? cs : game.car, DT); cs.forEach((c, i) => hit(c, v0[i][0], v0[i][1]));
        // DAMAGE: a torn-off wheel becomes a loose tyre, thrown from its corner with the car's speed and outward
        for (const c of cs) while (c.wheelSpawn && c.wheelSpawn.length) {
          const k = c.wheelSpawn.shift(), ch = Math.cos(c.heading), sh = Math.sin(c.heading), fx = (k < 2 ? c.spec.lf : -c.spec.lr), fy = (k % 2 ? 1 : -1) * (c.spec.trackWidth || 1.5) / 2;
          const out = (k % 2 ? 1 : -1) * 4;
          game.cones.add({ x: c.x + ch * fx - sh * fy, y: c.y + sh * fx + ch * fy, vx: c.vx * 0.85 - sh * out, vy: c.vy * 0.85 + ch * out, ang: c.heading, spin: (Math.random() - 0.5) * 8 });
        } }
      for (const a of game.ai) if (!rolling(a.car)) game.marks.stamp(game.marks.wheelsOf(a.car));
      for (const c of tcars) if (!rolling(c) && c.dmg && (Math.abs(c.t.slipR) > 0.1 || c.t.lockedF || c.t.lockedR)) game.marks.stamp(game.marks.wheelsOf(c));   // a skidding / crashing traffic car marks the road
      game.marks.follow(game.car.x, game.car.y);
      // marks are stamped on the SIM step: a mark is world bookkeeping, not an animation
      if (!rolling(game.car)) game.marks.stamp(game.marks.wheelsOf(game.car));
      game.marks.fade(DT);
      acc -= DT;
      n++;
    }
    game.simMs = (game.simMs || 0) * 0.9 + (performance.now() - simT0) * 0.1;
    if (n >= MAX_STEPS) acc = 0;      // fell behind: drop it, never catch up in a lurch
    game.stepsLastFrame = n;
    game.car.brakeLight = inp.brake;
  }

  // AFTER the sim, and fenced off. MEASURED 2026-10-03: audio used to run first, and with a NaN car its
  // setTargetAtTime() throws — which aborted every frame BEFORE the sim could run the recovery above, so
  // the car stayed broken forever. Sound is cosmetic; it must never be able to stop the game.
  try { audio.update(game.car, wallDt); } catch (e) { if (nanReports++ < 5) console.error('[car sim] audio.update threw:', e.message); }

  // RENDER INTERPOLATION (user, 2026-10-03: "at high speeds the camera / car judder"). MEASURED in a real browser at
  // 200 km/h: the 120 Hz sim gave 2 steps on most frames but 3 or 5 on others, so the car jumped up to 10 px on screen
  // (sd 1.5 px per frame) and the camera chased the jumps. Draw the car BETWEEN its last two physics poses, weighted
  // by the leftover accumulator — standard fixed-step practice. The sim itself is untouched. A teleport (RESET /
  // RESTART / car change) clears _p so nothing smears across the map.
  const car = game.car, p0 = car._p;
  let keepPose = null;
  if (started && p0 && !guide.active && Math.hypot(car.x - p0.x, car.y - p0.y) < 5) {
    const a = Math.max(0, Math.min(1, acc / DT));
    keepPose = { x: car.x, y: car.y, h: car.heading };
    let dh = car.heading - p0.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    car.x = p0.x + (car.x - p0.x) * a; car.y = p0.y + (car.y - p0.y) * a; car.heading = p0.h + dh * a;
  }
  game.drawn = { x: car.x, y: car.y, t: now };      // what this frame drew (tools: judder measurement)
  // the AI cars are drawn between their last two poses too (same alpha)
  const aiKeep = [];
  if (started && !guide.active) for (const c of [...game.ai.map((a) => a.car), ...game.traffic.cars]) { const q = c._p; if (!q || Math.hypot(c.x - q.x, c.y - q.y) > 5) continue;
    const al = Math.max(0, Math.min(1, acc / DT)); aiKeep.push([c, c.x, c.y, c.heading]); let dh = c.heading - q.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    c.x = q.x + (c.x - q.x) * al; c.y = q.y + (c.y - q.y) * al; c.heading = q.h + dh * al; }
  const drawT0 = performance.now();
  try {
    renderer.frame(game, wallDt, now / 1000);
    if (mode !== 'menu') hud.draw(renderer.ctx, game, renderer.W, renderer.H, wallDt);
  } finally {
    if (keepPose) { car.x = keepPose.x; car.y = keepPose.y; car.heading = keepPose.h; }
    for (const [c, x, y, h] of aiKeep) { c.x = x; c.y = y; c.heading = h; }
  }
  game.drawMs = (game.drawMs || 0) * 0.9 + (performance.now() - drawT0) * 0.1;
  guide.draw(renderer.ctx, game, hud.layout(renderer.W, renderer.H), renderer.W, renderer.H, wallDt, renderer);
}
requestAnimationFrame(loop);
