// ai/hwFlow.ts: the highway race's flow steps (highwayrace.ts createHwFlow): the CATCH THEM /
// PULLING AWAY countdown step by step, your position, and the final results table.
import type { HwCtx, HwEntry, HwFlow, HwRow } from "./hwFlowTypes.ts";

const GRACE = 2;

/** How far up the road an entry is (-Infinity before it has a road frame). */
export const sOf = (entry: HwEntry) => (entry.car._hwf ? entry.car._hwf.s : -Infinity);

/** Your position: 1 + the racers ahead of you. */
export function order(ctx: HwCtx) {
  const entries = ctx.entries, myEntry = entries.find((entry) => entry.player);
  return myEntry ? 1 + entries.filter((entry) =>
    entry !== myEntry && sOf(entry) > sOf(myEntry)).length : 1;
}

/** The race is over: the results table, sorted by how far up the road, and your place. */
export function endRace(ctx: HwCtx) {
  const flow = ctx.flow, sRef = ctx.sRef;
  flow.state = 'done';
  flow.endT = flow.t;
  flow.cdKind = null;
  const rows: HwRow[] = ctx.entries.map((entry) => ({ car: entry.car, player: entry.player,
    num: entry.car.num || 1, paint: entry.car.spec.paint, s: sOf(entry),
    dist: Math.max(0, sOf(entry) - sRef),
    bill: Math.round(entry.car.dmgBill || 0), time: flow.t, total: flow.t, penalty: 0, est: false,
      best: null, laps: 0 }));
  rows.sort((first, second) => second.s - first.s);
  rows.forEach((row, i) => {
    row.pos = i + 1;
    row.gapM = rows[0].s - row.s;
    row.gap = 0;
  });
  flow.results = rows;
  flow.myPlace = (rows.find((row) => row.player) || {}).pos;
  flow.flags.push(flow.t);
}

/**
 * Which countdown is due: 'ahead' (CATCH THEM), 'behind' (PULLING AWAY) or null.
 * CATCH THEM only when you are LAST and even the SLOWEST rival is off screen ahead (user,
 * "the catch them / loosing them warnings and timers should only show if the
 * slowest ai has passed you / is going off screen ahead, otherwise you should be free to
 * race"). While any rival is behind you or on screen there is no clock. (A story-mode time /
 * distance limit can come later.)
 */
export function dueKind(ctx: HwCtx, myS: number, rivals: HwEntry[], top: HwEntry) {
  const visible = ctx.visible;
  return rivals.every((entry) =>
    sOf(entry) > myS + 5) && !visible(top.car) ? 'ahead' : rivals.every((entry) =>
    sOf(entry) < myS - 5 && !visible(entry.car)) ? 'behind' : null;
}

/**
 * GRACE (user: "catch them timer never seems to time out it fails to count down";
 * MEASURED in tools/_flowtest: a rival dipping back on screen at the edge for a moment - a
 * bend, the zoom breathing - set the clock back to the full HW_CATCH every time). A running
 * clock now survives up to GRACE s of the condition dropping; only staying back in touch longer
 * cancels it.
 */
export function withGrace(flow: HwFlow, kind: string | null, dt: number) {
  if (kind) flow.lostT = 0;
  else if (flow.cdKind && (flow.lostT = (flow.lostT || 0) + dt) < GRACE) kind = flow.cdKind;
  return kind;
}
