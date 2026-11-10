// highwayrace.js — VS AI ON THE ENDLESS HIGHWAY (requirement: VS AI on the highway = a normal
// ROLLING-START race; "an AI reaching the EDGE OF THE SCREEN ahead (what is visible differs PC /
// phone) starts a COUNTDOWN (5-10 s); if it ends and you have not caught up -> race ends, POSITIONS
// shown. You get so far ahead the AI go off screen BEHIND -> countdown; when it ends YOU WIN";
// traffic in every mode). (was hwrace.js until the phase 5 rename)
//
// ONE AI (11-04): the circuit driver (ai/circuit.ts) races the highway too - the treadmill's road
// is rebuilt every ~300 m and never closes, so its line is made again for each stretch, down the
// lanes' middle (ai/roadLine.ts), and it gap-spots through the traffic (ai/gapPick.ts) - ignore
// lanes, go fast, dodge and weave through like the player would. (The highway weaver it
// replaced was deleted.)
// THE START: a 2-wide staggered grid in the two right-hand lanes behind the spawn; every car (you
// too) holds its slot in the formation behind red lights (ai/formation.ts), GREEN at HW_GREEN s.
// THE END (flow): EVERY AI ahead of you and the slowest of them OFF SCREEN -> "CATCH THEM n" for
// HW_CATCH s (back on screen = cancelled), at 0 the race ends. Every AI behind you AND off screen
// -> "PULLING AWAY n"; at 0 the race ends and you have won. Positions = how far up the road.
import { roadFrame, roadPose, roadSpan } from './highway.ts';
import { shoulderOff } from './highway/road.ts';
import { bayBehind } from './highway/laybys.ts';
import type { HwLevel } from './highway/hwtypes.ts';
import type { AiCar, HighwayLevel } from "./ai/types.ts";
import { endRace, order } from "./ai/hwFlow.ts";
import { stepFlow } from "./ai/hwFlowStep.ts";
import type { HwCtx, HwFlow, HwFlowArgs } from "./ai/hwFlowTypes.ts";
import type { Paint } from "./world/types.ts";

export const HW_GREEN = 6, HW_COUNT = 8;
// CATCH THEM is SOFT (requirement: catch them timer should be longer on highway, also it should be
// a bit soft if you've nearly caught up drop the timer... but let them getaway if the player isnt
// trying): HW_CATCH s; while you are CLOSING on the leader (gap shrinking faster than
// CLOSE_V, smoothed over ~1 s) it refills at REFILL x; NEAR m or less past the screen it holds;
// otherwise it runs. PULLING AWAY (you winning) stays HW_COUNT (requirement: winning is ok atm).
// (hovering just past the edge holds for NEAR_T s at most: sitting there for ever is not trying
// either)
export const HW_CATCH = 15;

// every car's ROAD FRAME once per step: c._hwf = { s, off, v (along the road) }
export function hwFrames(level: HighwayLevel, cars: AiCar[]) {
  for (const car of cars) {
    const frame = roadFrame(level, car.x, car.y, car._hwf ? car._hwf.s : null);
    car._hwf = frame ? { s: frame.s, off: frame.off,
      v: car.vx * frame.dx + car.vy * frame.dy } : null;
  }
}


// THE GRID: slot 0 = pole. Two columns in the two right-hand lanes (both lanes on a dual), rows
// GRID_ROW m apart, the right-hand column GRID_STAG m further back (staggered); GRID_BACK m behind
// the spawn. hwGridSpan = the road distances it covers (to clear traffic)
const GRID_ROW = 14, GRID_STAG = 7, GRID_BACK = 12;
export function hwGrid(level: HighwayLevel, slot: number) {
  const spawnS = roadFrame(level, level.spawn.x, level.spawn.y, null)!.s;
  const place = hwSlot(level, slot);
  const pose = roadPose(level, spawnS - GRID_BACK - place.backM, place.columnM);
  return { x: pose.x, y: pose.y, h: pose.h };
}
// a grid slot's lane (m off the road's base line) and m behind the pole's slot - the formation
// holds it until the green (ai/formation.ts roadFormationInput)
export function hwSlot(level: HighwayLevel, slot: number) {
  const centres = level._hw.geo.centres, laneCount = centres.length,
    cols = laneCount >= 3 ? [laneCount - 2, laneCount - 1] : [0, Math.min(1, laneCount - 1)];
  const row = Math.floor(slot / 2), col = slot % 2;
  return { columnM: centres[cols[col]], backM: row * GRID_ROW + col * GRID_STAG };
}
export function hwGridSpan(level: HighwayLevel, count: number) {
  const spawnS = roadFrame(level, level.spawn.x, level.spawn.y, null)!.s;
  return [spawnS - GRID_BACK - (Math.ceil(count / 2) + 1) * GRID_ROW - 25, spawnS + 60];
}
// where to put a car back (crashed / stuck / rolled; owner 11-09, passed: "Resetting should start
// up in the hard shoulder only"): at road distance s on the hard shoulder - from the other
// carriageway too - facing up the road, stepped back past any car there; how many 12 m steps back
// it looks for room
const PUT_BACK_TRIES = 4;

export function hwPutBack(level: HighwayLevel, dist: number, cars: AiCar[]) {
  const { s0, s1 } = roadSpan(level);
  dist = Math.max(s0 + 60, Math.min(s1 - 60, dist));
  const off = shoulderOff(level as unknown as HwLevel);
  const free = (spot: number, across: number) => !cars.some((other) => other._hwf
    && Math.abs(other._hwf.off - across) < 2.6 && Math.abs(other._hwf.s - spot) < 8);
  // (a road without a hard shoulder: the last lay-by behind, a spot in it clear of cars)
  const bay = bayBehind(level as unknown as HwLevel, dist, (spot) => free(spot, -(level._hw.geo.hw
    + 1.6)), s0 + 20);
  if (bay) return roadPose(level, bay.s, bay.off);
  for (let tries = 0; tries < PUT_BACK_TRIES && cars.some((other) => other._hwf
    && Math.abs(other._hwf.off - off) < 2.6 && Math.abs(other._hwf.s - dist) < 10); tries++)
    dist = Math.max(s0 + 60, dist - 12);
  return roadPose(level, dist, off);
}

// (the RACER itself is the one AI driver, createAIDriver (ai/circuit.ts), for circuits and the
// highway; (requirement: one engine is better and cheaper).
// This file keeps only the RACE: grid, put-back, the CATCH THEM flow.)

// THE RACE: entries [{ car, player }]; visible(car) = on screen right now. flow.step(dt) after the
// green; flow.order -> your position. Results rows are raceflow.ts-shaped (+ dist / gapM) so
// menu.ts can show them; flow.highway marks the distance table.
export function createHwFlow(
  { lv, cars, visible, count = HW_COUNT, catchT = HW_CATCH, finish = null }: HwFlowArgs) {
  const sRef = roadFrame(lv, lv.spawn.x, lv.spawn.y, null)!.s;   // ! : null before the road exists
  const entries = cars.map(({ car, player }) => ({ car, player: !!player }));
  const flow: HwFlow = { highway: true, state: 'racing', t: 0, laps: 0, entries: entries, flags: [],
    results: null, cd: null, cdKind: null, cdHold: false, myPlace: null,
    finish: finish ? { ...finish, ...(finish.m ? { s: sRef + finish.m } : {}) } : null };
  const ctx: HwCtx = { flow, entries, visible, count, catchT, sRef, gapPrev: null, gapRate: 0 };
  clearFinishLine(lv);
  flow.order = () => order(ctx);
  flow.step = (dt: number) => {
    if (flow.finish?.s != null && !finishLine) paintFinishLine(lv, flow.finish.s);
    stepFlow(ctx, dt);
  };
  flow.end = () => endRace(ctx);
  return flow;
}

// THE FINISH LINE (?hwfinish=1, a distance): a chequered line across our carriageway (a single
// carriageway: the whole road) at the finish, painted once the road has grown past it - far ahead,
// out of sight; the last one is taken off when a race starts again
let finishLine: Paint | null = null;

/**
 * Takes the last race's finish line off the road.
 * @param level the highway level
 */
export function clearFinishLine(level: HighwayLevel) {
  const paint = (level as unknown as { paint: Paint[] }).paint, spot = finishLine ? paint.indexOf(
    finishLine) : -1;
  if (spot >= 0) paint.splice(spot, 1);
  finishLine = null;
}

/**
 * Paints the finish line at road distance s, once the road reaches past it.
 * @param level the highway level
 * @param dist the finish's road distance, m
 */
function paintFinishLine(level: HighwayLevel, dist: number) {
  if (roadSpan(level).s1 < dist + 10) return;
  const geo = level._hw.geo as { hw: number; ownR: number }, left = -geo.hw, right = geo.ownR,
    pose = roadPose(level, dist, (left + right) / 2);
  finishLine = { kind: 'chequered', x: pose.x, y: pose.y, len: 1.6, wid: right - left,
    rot: pose.h, tone: 1 };
  (level as unknown as { paint: Paint[] }).paint.push(finishLine);
}
