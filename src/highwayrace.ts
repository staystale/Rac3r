// highwayrace.js — VS AI ON THE ENDLESS HIGHWAY (user, 2026-10-05: "VS AI on the highway = a normal ROLLING-START race"; "an AI reaching the
// EDGE OF THE SCREEN ahead (what is visible differs PC / phone) starts a COUNTDOWN (5-10 s); if it ends and you have not caught up -> race
// ends, POSITIONS shown. You get so far ahead the AI go off screen BEHIND -> countdown; when it ends YOU WIN"; traffic in every mode).
// (was hwrace.js until the phase 5 rename)
//
// The circuit AI (aidriver.js) races a precomputed line round a CLOSED lap; the treadmill's road is rebuilt every ~300 m and never
// closes, so its driver reads the road through highway.js's road frame: the WEAVER (aidriver.js roadDriver; v1 raced in lanes — the user: "ignore lanes, go fast,
// dodge and weave through like the player would").
// THE START: a 2-wide staggered grid in the two right-hand lanes behind the spawn; every car (you too) is driven at the rolling pace
// behind red lights (main.js atPace), GREEN at HW_GREEN s.
// THE END (flow): EVERY AI ahead of you and the slowest of them OFF SCREEN -> "CATCH THEM n" for HW_CATCH s (back on screen =
// cancelled), at 0 the race ends. Every AI behind you AND off screen -> "PULLING AWAY n"; at 0 the race ends and you have won. Positions = how far up the road.
import { roadFrame, roadPose, roadSpan } from './highway.js';
import type { AiCar, HighwayLevel } from "./ai/types.ts";

// One racer of the highway race.
interface HwEntry { car: AiCar; player: boolean }
// One row of the results table (raceflow.js-shaped, + dist / gapM).
interface HwRow {
  car: AiCar; player: boolean; num: number; paint: string; s: number; dist: number;
  bill: number; time: number; total: number; penalty: number; est: boolean; best: null;
  laps: number; pos?: number; gapM?: number; gap?: number;
}
// What createHwFlow takes.
interface HwFlowArgs {
  lv: HighwayLevel; cars: { car: AiCar; player?: boolean }[];
  visible: (car: AiCar) => boolean; count?: number; catchT?: number;
}
// What createHwFlow returns: the race state, and the countdowns' bookkeeping.
interface HwFlow {
  highway: boolean; state: string; t: number; laps: number; entries: HwEntry[];
  flags: number[]; results: HwRow[] | null;
  cd: number | null; cdKind: string | null; cdHold: boolean; myPlace: number | null | undefined;
  // order / step / end: set right after the object is made
  order?: () => number; step?: (dt: number) => void; end?: () => void;
  endT?: number; lostT?: number; cdLeft?: number | null; cdOffAt?: number;
  edge?: number | null; nearT?: number;
}


export const HW_GREEN = 6, HW_COUNT = 8;
// CATCH THEM is SOFT (user, 2026-10-06: "catch them timer should be longer on highway, also it should be a bit soft if you've nearly
// caught up drop the timer... but let them getaway if the player isnt trying"): HW_CATCH s; while you are CLOSING on the leader (gap
// shrinking faster than CLOSE_V, smoothed over ~1 s) it refills at REFILL x; NEAR m or less past the screen it holds; otherwise it runs.
// PULLING AWAY (you winning) stays HW_COUNT (user: "winning is ok atm").
// (hovering just past the edge holds for NEAR_T s at most: sitting there for ever is not trying either)
export const HW_CATCH = 15; const CLOSE_V = 1.0, REFILL = 0.5, NEAR = 40, NEAR_T = 10, GRACE = 2, JUMP = 8;

// every car's ROAD FRAME once per step: c._hwf = { s, off, v (along the road) }
export function hwFrames(lv: HighwayLevel, cars: AiCar[]) {
  for (const c of cars) { const f = roadFrame(lv, c.x, c.y, c._hwf ? c._hwf.s : null); c._hwf = f ? { s: f.s, off: f.off, v: c.vx * f.dx + c.vy * f.dy } : null; }
}


// THE GRID: slot 0 = pole. Two columns in the two right-hand lanes (both lanes on a dual), rows GRID_ROW m apart, the right-hand column
// GRID_STAG m further back (staggered); GRID_BACK m behind the spawn. hwGridSpan = the road distances it covers (to clear traffic)
const GRID_ROW = 14, GRID_STAG = 7, GRID_BACK = 12;
export function hwGrid(lv: HighwayLevel, k: number) {
  const C = lv._hw.geo.centres, nL = C.length, cols = nL >= 3 ? [nL - 2, nL - 1] : [0, Math.min(1, nL - 1)];
  const s0 = roadFrame(lv, lv.spawn.x, lv.spawn.y, null)!.s, row = Math.floor(k / 2), col = k % 2;
  const p = roadPose(lv, s0 - GRID_BACK - row * GRID_ROW - col * GRID_STAG, C[cols[col]]);
  return { x: p.x, y: p.y, h: p.h };
}
export function hwGridSpan(lv: HighwayLevel, n: number) { const s0 = roadFrame(lv, lv.spawn.x, lv.spawn.y, null)!.s; return [s0 - GRID_BACK - (Math.ceil(n / 2) + 1) * GRID_ROW - 25, s0 + 60]; }
// where to put a car back (crashed / stuck / rolled): at road distance s, in the lane with the most room, facing up the road
export function hwPutBack(lv: HighwayLevel, s: number, cars: AiCar[]) {
  const { s0, s1 } = roadSpan(lv), C = lv._hw.geo.centres; s = Math.max(s0 + 60, Math.min(s1 - 60, s));
  let best = 0, room = -1;
  for (let L = 0; L < C.length; L++) { let r = 99; for (const o of cars) { const f = o._hwf; if (f && Math.abs(f.off - C[L]) < 2.6) r = Math.min(r, Math.abs(f.s - s)); } if (r > room) { room = r; best = L; } }
  return roadPose(lv, s, C[best]);
}

// (the RACER itself - the WEAVER - lives in aidriver.js since AI ROUND 2 stage 1: ONE driver, createAIDriver, for circuits and the
// highway; user 2026-10-07: "one engine is better and cheaper". This file keeps only the RACE: grid, put-back, the CATCH THEM flow.)

// THE RACE: entries [{ car, player }]; visible(car) = on screen right now. flow.step(dt) after the green; flow.order() -> your position.
// Results rows are raceflow.js-shaped (+ dist / gapM) so menu.js can show them; flow.highway marks the distance table.
export function createHwFlow(
  { lv, cars, visible, count = HW_COUNT, catchT = HW_CATCH }: HwFlowArgs) {
  const sRef = roadFrame(lv, lv.spawn.x, lv.spawn.y, null)!.s;   // ! : null before the road exists
  const E = cars.map(({ car, player }) => ({ car, player: !!player }));
  const flow: HwFlow = { highway: true, state: 'racing', t: 0, laps: 0, entries: E, flags: [], results: null, cd: null, cdKind: null, cdHold: false, myPlace: null };
  let gapPrev: number | null = null, gapRate = 0;
  const sOf = (e: HwEntry) => (e.car._hwf ? e.car._hwf.s : -Infinity);
  flow.order = () => { const me = E.find((e) => e.player); return me ? 1 + E.filter((e) => e !== me && sOf(e) > sOf(me)).length : 1; };
  flow.step = (dt: number) => {
    if (flow.state === 'done') return;
    flow.t += dt;
    const me = E.find((e) => e.player), ai = E.filter((e) => !e.player); if (!me || !ai.length || flow.t < 3) return;
    // CATCH THEM only when you are LAST and even the SLOWEST rival is off screen ahead (user, 2026-10-06: "the catch them / loosing them
    // warnings and timers should only show if the slowest ai has passed you / is going off screen ahead, otherwise you should be free to
    // race"). While any rival is behind you or on screen there is no clock. (A story-mode time / distance limit can come later.)
    const ms = sOf(me), top = ai.reduce((a, e) => (sOf(e) < sOf(a) ? e : a), ai[0]);   // `top` = the rival you have to catch: the LAST one
    let kind = ai.every((e) => sOf(e) > ms + 5) && !visible(top.car) ? 'ahead' : ai.every((e) => sOf(e) < ms - 5 && !visible(e.car)) ? 'behind' : null;
    // GRACE (user, 2026-10-06: "catch them timer never seems to time out it fails to count down"; MEASURED in tools/_flowtest: a rival
    // dipping back on screen at the edge for a moment - a bend, the zoom breathing - set the clock back to the full HW_CATCH every time).
    // A running clock now survives up to GRACE s of the condition dropping; only staying back in touch longer cancels it.
    if (kind) flow.lostT = 0;
    else if (flow.cdKind && (flow.lostT = (flow.lostT || 0) + dt) < GRACE) kind = flow.cdKind;
    // RESUME, not restart: CATCH THEM cancelled (a rival spun / beached, you passed it, it came back by) and then due again picks up where
    // it stopped, refilled only by the time you were back in touch (1 s per s). It used to restart at the full HW_CATCH every time - with
    // racers spinning off, the number could go 15 -> 9, cancel, 15 -> 8, cancel ... and never reach 0.
    if (kind !== flow.cdKind) {
      if (flow.cdKind === 'ahead') { flow.cdLeft = flow.cd; flow.cdOffAt = flow.t; }
      flow.cdKind = kind;
      flow.cd = !kind ? null : kind === 'behind' ? count : flow.cdLeft != null ? Math.min(catchT, flow.cdLeft + (flow.t - flow.cdOffAt!)) : catchT;
      // the near-the-edge HOLD allowance (NEAR_T) and the edge itself carry over the same way: only a FULL clock starts them afresh
      if (kind === 'ahead' && flow.cd! >= catchT) { flow.edge = null; flow.nearT = 0; flow.cdLeft = null; }
    }
    // the leader's gap and how fast it is changing (+ = it is pulling away), smoothed over ~1 s. A JUMP (> JUMP m in one step: the car
    // you have to catch changed, or a reset) is not closing: re-seed the rate instead of reading it as a sprint that refills the clock.
    const gap = sOf(top) - ms;
    if (gapPrev != null && Math.abs(gap - gapPrev) > JUMP) gapRate = 0; else if (gapPrev != null) gapRate += ((gap - gapPrev) / dt - gapRate) * Math.min(1, dt / 1.0);
    gapPrev = gap;
    flow.cdHold = false;
    if (kind === 'ahead') {
      // "nearly caught up" = within NEAR m of the edge of the screen (the visible distance is not known here: the first gap at which
      // it went off screen stands in for it)
      if (flow.edge == null) flow.edge = gap;
      if (gapRate < -CLOSE_V) { flow.cd = Math.min(catchT, flow.cd! + REFILL * dt); flow.cdHold = true; }
      else if (gap < flow.edge + NEAR && gapRate < CLOSE_V && (flow.nearT = (flow.nearT || 0) + dt) < NEAR_T) flow.cdHold = true;
      else flow.cd! -= dt;
      if (flow.cd! <= 0) end();
    } else if (kind) { flow.cd! -= dt; if (flow.cd! <= 0) end(); }
  };
  function end() {
    flow.state = 'done'; flow.endT = flow.t; flow.cdKind = null;
    const rows: HwRow[] = E.map((e) => ({ car: e.car, player: e.player, num: e.car.num || 1, paint: e.car.spec.paint, s: sOf(e), dist: Math.max(0, sOf(e) - sRef),
      bill: Math.round(e.car.dmgBill || 0), time: flow.t, total: flow.t, penalty: 0, est: false, best: null, laps: 0 }));
    rows.sort((a, b) => b.s - a.s);
    rows.forEach((r, i) => { r.pos = i + 1; r.gapM = rows[0].s - r.s; r.gap = 0; });
    flow.results = rows; flow.myPlace = (rows.find((r) => r.player) || {}).pos; flow.flags.push(flow.t);
  }
  flow.end = end;
  return flow;
}