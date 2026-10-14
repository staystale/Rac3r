// highwayrace.js — VS AI ON THE ENDLESS HIGHWAY (user, 2026-10-05: "VS AI on the highway = a normal
// ROLLING-START race"; "an AI reaching the EDGE OF THE SCREEN ahead (what is visible differs PC /
// phone) starts a COUNTDOWN (5-10 s); if it ends and you have not caught up -> race ends, POSITIONS
// shown. You get so far ahead the AI go off screen BEHIND -> countdown; when it ends YOU WIN";
// traffic in every mode). (was hwrace.js until the phase 5 rename)
//
// The circuit AI (aidriver.js) races a precomputed line round a CLOSED lap; the treadmill's road is
// rebuilt every ~300 m and never closes, so its driver reads the road through highway.js's road
// frame: the WEAVER (aidriver.js roadDriver; v1 raced in lanes — the user: "ignore lanes, go fast,
// dodge and weave through like the player would").
// THE START: a 2-wide staggered grid in the two right-hand lanes behind the spawn; every car (you
// too) is driven at the rolling pace behind red lights (main.js atPace), GREEN at HW_GREEN s. THE
// END (flow): EVERY AI ahead of you and the slowest of them OFF SCREEN -> "CATCH THEM n" for
// HW_CATCH s (back on screen = cancelled), at 0 the race ends. Every AI behind you AND off screen
// -> "PULLING AWAY n"; at 0 the race ends and you have won. Positions = how far up the road.
import { roadFrame, roadPose, roadSpan } from './highway.js';
import type { AiCar, HighwayLevel } from "./ai/types.ts";
import { endRace, order } from "./ai/hwFlow.ts";
import { stepFlow } from "./ai/hwFlowStep.ts";
import type { HwCtx, HwFlow, HwFlowArgs } from "./ai/hwFlowTypes.ts";

export const HW_GREEN = 6, HW_COUNT = 8;
// CATCH THEM is SOFT (user, 2026-10-06: "catch them timer should be longer on highway, also it
// should be a bit soft if you've nearly caught up drop the timer... but let them getaway if the
// player isnt trying"): HW_CATCH s; while you are CLOSING on the leader (gap shrinking faster than
// CLOSE_V, smoothed over ~1 s) it refills at REFILL x; NEAR m or less past the screen it holds;
// otherwise it runs. PULLING AWAY (you winning) stays HW_COUNT (user: "winning is ok atm").
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
  const centres = level._hw.geo.centres, laneCount = centres.length,
    cols = laneCount >= 3 ? [laneCount - 2, laneCount - 1] : [0, Math.min(1, laneCount - 1)];
  const spawnS = roadFrame(level, level.spawn.x, level.spawn.y, null)!.s,
    row = Math.floor(slot / 2), col = slot % 2;
  const pose = roadPose(level, spawnS - GRID_BACK - row * GRID_ROW - col * GRID_STAG,
    centres[cols[col]]);
  return { x: pose.x, y: pose.y, h: pose.h };
}
export function hwGridSpan(level: HighwayLevel, count: number) {
  const spawnS = roadFrame(level, level.spawn.x, level.spawn.y, null)!.s;
  return [spawnS - GRID_BACK - (Math.ceil(count / 2) + 1) * GRID_ROW - 25, spawnS + 60];
}
// where to put a car back (crashed / stuck / rolled): at road distance s, in the lane with the most
// room, facing up the road
export function hwPutBack(level: HighwayLevel, dist: number, cars: AiCar[]) {
  const { s0, s1 } = roadSpan(level), centres = level._hw.geo.centres;
  dist = Math.max(s0 + 60, Math.min(s1 - 60, dist));
  let best = 0, room = -1;
  for (let lane = 0; lane < centres.length; lane++) {
    let nearest = 99;
    for (const other of cars) {
      const frame = other._hwf;
      if (frame && Math.abs(frame.off - centres[lane]) < 2.6) nearest = Math.min(nearest,
        Math.abs(frame.s - dist));
    }
    if (nearest > room) {
      room = nearest;
      best = lane;
    }
  }
  return roadPose(level, dist, centres[best]);
}

// (the RACER itself - the WEAVER - lives in aidriver.js since AI ROUND 2 stage 1: ONE driver,
// createAIDriver, for circuits and the highway; user 2026-10-07: "one engine is better and
// cheaper". This file keeps only the RACE: grid, put-back, the CATCH THEM flow.)

// THE RACE: entries [{ car, player }]; visible(car) = on screen right now. flow.step(dt) after the
// green; flow.order() -> your position. Results rows are raceflow.js-shaped (+ dist / gapM) so
// menu.js can show them; flow.highway marks the distance table.
export function createHwFlow(
  { lv, cars, visible, count = HW_COUNT, catchT = HW_CATCH }: HwFlowArgs) {
  const sRef = roadFrame(lv, lv.spawn.x, lv.spawn.y, null)!.s;   // ! : null before the road exists
  const entries = cars.map(({ car, player }) => ({ car, player: !!player }));
  const flow: HwFlow = { highway: true, state: 'racing', t: 0, laps: 0, entries: entries, flags: [],
    results: null, cd: null, cdKind: null, cdHold: false, myPlace: null };
  const ctx: HwCtx = { flow, entries, visible, count, catchT, sRef, gapPrev: null, gapRate: 0 };
  flow.order = () => order(ctx);
  flow.step = (dt: number) => stepFlow(ctx, dt);
  flow.end = () => endRace(ctx);
  return flow;
}