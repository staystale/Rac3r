// grid.ts — AI cars: liveries, the starting grid and spawning.
import { hwLevel } from './state.ts';
import { lcg } from "../core/random.ts";
import { makeCar, reset } from '../vehicle.ts';
import { ROSTER, PALETTE } from '../cars.ts';
import { rimColour } from '../carpaint.ts';
import { SPOKES } from '../render/wheelface.ts';
import { hwGrid } from '../highwayrace.ts';
import { createAIDriver } from '../ai/circuit.ts';
import { aiTraits } from '../ai/traits.ts';
import { tuneOf } from '../ai/tune.ts';
import { lineRun } from '../ai/line.ts';
import { LEVEL } from "../world/state.ts";
import { onTrack, querySubtrack } from "../world/tyrewall.ts";
import { START_STEP, ROLL_BACK } from './order.ts';
import { shared, game } from './state.ts';
import type { GameCar } from './state.ts';

// AI CARS — stage 1 (user: up to 5 opponents, FULL CONTACT, the SAME car as the player
// in different colours + numbers). Each is { car, drv }: a real car stepped by the same physics on
// the same fixed step, driven by the autodriver for now (stage 2 makes them race). ?ai=N (0-5) puts
// N on the grid behind the player on a circuit; they respawn on RESTART, level change and car
// change.
export const AI_LIVERIES = [['#c8302c', '#7e1d1a'], ['#2b56b5', '#14306e'], ['#e2c13a', '#8a6d12'],
  ['#2f7d4f', '#174a2c'], ['#7a3fa0', '#43205a'],
  // five more, so ten cars all differ (cars.ts PALETTE)
  ['#e86fa8', '#8a2f5e'], ['#3fb6c9', '#1d6a76'], ['#f0f0ea', '#5a5f69'], ['#e0603a', '#8a3414'],
  ['#9bc53d', '#4a6a14'],
  // ten more for a 20-car field (owner 11-03: 20 liveries), two-tone from the paint palette
  ['#a9aeb6', '#5a5f69'], ['#16181d', '#e2c13a'], ['#7a1d22', '#3d0e11'], ['#f2a900', '#16181d'],
  ['#1f4d2e', '#9bc53d'], ['#1d3f9a', '#f0f0ea'], ['#f0f0ea', '#c8342a'], ['#3fb6c9', '#16181d'],
  ['#8a4fc0', '#f2a900'], ['#c8302c', '#f0f0ea']];
// GRID (requirement: starting grid position should vary randomly but bias toward the front n back
// with difficulty): the player's slot is drawn with weights exp(GRID_BIAS[diff] x slot / n) —
// Mobile leans to the FRONT, Real to the BACK, Realish is even.
export const GRID_BIAS = [-2.2, -1.1, 0, 1.1, 2.2];
// an AI's third part and rims, by its slot - the field all differ (the rims: stock,
// chrome, gold, black, white in turn; the third a palette colour well away from the body's)
const AI_RIMS = ['', 'chrome', 'gold', '#16181d', '#f0f0ea'];
const aiPaintParts = (slot: number) => ({
  third: PALETTE[(slot * 7 + 4) % PALETTE.length], spokes: SPOKES[slot % SPOKES.length],
  ...(AI_RIMS[slot % AI_RIMS.length] ? { rim: rimColour(AI_RIMS[slot % AI_RIMS.length]) } : {}),
});

export function drawGridSlot(count: number) {
  if (!count) return 0;
  // (the menu race: any slot, even odds)
  if (shared.mode === 'menu') return Math.floor(Math.random() * (count + 1));
  const weights = [];
  for (let slot = 0; slot <= count; slot++)
    weights.push(Math.exp(GRID_BIAS[shared.aiDiff] * slot / count));
  let pick = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let slot = 0; slot <= count; slot++) {
    pick -= weights[slot];
    if (pick <= 0) return slot;
  }
  return count;
}
// slot 0 = pole (the spawn, or the rolling-start pole), slot k = the staggered grid behind it RALLY
// STAGE (LEVEL.stage): single file back from the spawn along the road, STAGE_GAP_M apart; later
// starters queue here, STAGE_GAP_S apart in time REAL START INTERVALS (requirement: it's like a
// normal race rather than starting IN BETWEEN other opponents on a rally stage TIME-WISE): cars
// STAGE_GAP_S apart; you always start at the normal lights; those who started BEFORE you are
// already down the stage where their own pace would have taken them (lineRun); those AFTER you
// queue behind and go STAGE_GAP_S apart. (Was: everyone queued 6 s apart — a race in single file.)
export const STAGE_GAP_S = 30, STAGE_GAP_M = 9;
export function gridPos(slot: number) {
  // the highway: 2 wide in the right-hand lanes (highwayrace.js)
  if (LEVEL.endless) return hwGrid(hwLevel(), slot);
  const sub = LEVEL.subtrack!, spawn = LEVEL.spawn,
    offLap = querySubtrack(sub, spawn.x, spawn.y).dist > sub.width / 2;
  if (LEVEL.stage && slot > 0) {
    const spawnDist = querySubtrack(sub, spawn.x, spawn.y).trackDist,
      point = onTrack(sub,
        ((spawnDist - slot * STAGE_GAP_M) % sub.totalDist + sub.totalDist) % sub.totalDist, 0, {});
    return { x: point.x, y: point.y, h: point.rot };
  }
  // A REAL 2-WIDE STAGGERED GRID (requirement: grid starts are wonky / place the player too close
  // to other cars / not in a grid formation). MEASURED (tools/gridcheck, 5 AI): slots were
  // OUT OF ORDER (slot 2 at 4.5 m back, slot 1 at 9 m), pole sat on the CENTRELINE with its
  // neighbours 1.0-1.6 m away (box to box), and on the Test Track the player's pole was the spawn
  // while the rest counted back from totalDist - 15 -> the player overlapped AI 5 (-0.07 m). Now:
  // every slot, pole included, counts back from the SPAWN's own road distance, GRID_STEP m per
  // slot, alternating columns GRID_LAT m either side of the centre (narrower on a narrow road).
  const back = LEVEL.rollingStart ? ROLL_BACK : 0;
  const side = gridColumn(slot), backDist = back + slot * GRID_STEP;
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
export const GRID_STEP = 7, GRID_LAT = 3.2;
/**
 * A grid slot's column: its offset across the road from the centreline (narrower on a narrow
 * road), alternating sides slot by slot.
 * @param slot the slot, 0 = pole
 * @returns the offset, m (along the road's normal)
 */
export function gridColumn(slot: number) {
  const lat = Math.max(1.6, Math.min(GRID_LAT, LEVEL.subtrack!.width / 2 - 1.8));
  return slot % 2 ? lat : -lat;
}
export function aiCarIds(count: number, seed: number) {
  const base = String(game.car.spec.id).split('#')[0],
    myCar = ROSTER.find((entry) => entry.id === base);
  if (shared.aiCarMode !== 'class' || !myCar || !myCar.cls) return Array(count).fill(base);
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
/**
 * RACE NUMBERS (owner 11-01): each AI a different number 2-99, never the one on
 * your car, dealt at random each event (TEST MODE; Story will keep a driver's number), painted on
 * the car and shown on the scoreboard.
 * @param count how many AI
 * @param seed the spawn's seed
 * @returns the numbers, by AI
 */
function aiNumbers(count: number, seed: number) {
  const mine = (game.car.spec.num || 0) | 0, rnd = lcg((seed * 7 + 3) >>> 0);
  const deck = [];
  for (let num = 2; num <= 99; num++) if (num !== mine) deck.push(num);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, count);
}
export function spawnAI(count: number = shared.aiCount) {
  game.ai = [];
  game.poleCar = null;
  const sub = LEVEL.subtrack!;
  if (!sub || !count) return;
  shared.gridSlot = drawGridSlot(count);
  const seed = 1 + Math.floor(Math.random() * 1e6), ids = aiCarIds(count, seed),
    nums = aiNumbers(count, seed);
  for (let i = 0; i < count; i++) {
    const car = makeCar(ids[i]) as GameCar, [paint, trim] = AI_LIVERIES[i % AI_LIVERIES.length];
    // own sprite (cached by id), same physics
    car.spec = { ...car.spec, id: car.spec.id + '#' + (i + 2), paint, trim, ...aiPaintParts(i) };
    car.num = nums[i];
    car.spec.num = nums[i];
    // the field from the AI DRIVERS dials (the difficulty's preset unless moved)
    const tune = shared.aiTune || tuneOf(shared.aiDiff);
    const drv = createAIDriver(LEVEL, aiTraits(shared.aiDiff, i, count, seed, tune)),
      slot = i < shared.gridSlot ? i : i + 1;
    car.mods.power *= drv.traits.power ?? 1;
    car._jokers = 0;
    car._prog = undefined;
    car._stageStart = undefined;
    if (LEVEL.stage) {
      // slot relative to yours: < 0 started before you (already on the stage), > 0 queues behind
      // you
      const rel = slot - shared.gridSlot;
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
