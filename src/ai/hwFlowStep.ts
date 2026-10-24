// ai/hwFlowStep.ts: one step of the highway race flow after the green: the CATCH THEM clock
// (resume, gap tracking, refill / hold / count down) and the PULLING AWAY clock.
import { endRace, sOf, withGrace, dueKind, noteRoadPositions } from "./hwFlow.ts";
import type { HwCtx } from "./hwFlowTypes.ts";

const CLOSE_V = 1.0, REFILL = 0.5, NEAR = 40, NEAR_T = 10, JUMP = 8;

/**
 * RESUME, not restart: CATCH THEM cancelled (a rival spun / beached, you passed it, it came
 * back by) and then due again picks up where
 * it stopped, refilled only by the time you were back in touch (1 s per s). It used to restart
 * at the full HW_CATCH every time - with
 * racers spinning off, the number could go 15 -> 9, cancel, 15 -> 8, cancel ... and never reach
 * 0.
 */
function switchKind(ctx: HwCtx, kind: string | null) {
  const flow = ctx.flow, catchT = ctx.catchT;
  if (kind === flow.cdKind) return;
  if (flow.cdKind === 'ahead') {
    flow.cdLeft = flow.cd;
    flow.cdOffAt = flow.t;
  }
  flow.cdKind = kind;
  flow.cd = !kind ? null : kind === 'behind' ? ctx.count : flow.cdLeft != null ? Math.min(catchT,
    flow.cdLeft + (flow.t - flow.cdOffAt!)) : catchT;
  // the near-the-edge HOLD allowance (NEAR_T) and the edge itself carry over the same way: only
  // a FULL clock starts them afresh
  if (kind === 'ahead' && flow.cd! >= catchT) {
    flow.edge = null;
    flow.nearT = 0;
    flow.cdLeft = null;
  }
}

/**
 * The leader's gap and how fast it is changing (+ = it is pulling away), smoothed over ~1 s. A
 * JUMP (> JUMP m in one step: the car you have to catch changed, or a reset) is not closing:
 * re-seed the rate instead of reading it as a sprint that refills the clock.
 */
function trackGap(ctx: HwCtx, gap: number, dt: number) {
  if (ctx.gapPrev != null && Math.abs(gap - ctx.gapPrev) > JUMP) ctx.gapRate = 0;
  else if (ctx.gapPrev != null) ctx.gapRate +=
    ((gap - ctx.gapPrev) / dt - ctx.gapRate) * Math.min(1, dt / 1.0);
  ctx.gapPrev = gap;
}

/** Run the CATCH THEM clock: refill while closing, hold near the edge, else count down. */
function runAhead(ctx: HwCtx, gap: number, dt: number) {
  const flow = ctx.flow;
  // "nearly caught up" = within NEAR m of the edge of the screen (the visible distance is not
  // known here: the first gap at which it went off screen stands in for it)
  if (flow.edge == null) flow.edge = gap;
  if (ctx.gapRate < -CLOSE_V) {
    flow.cd = Math.min(ctx.catchT, flow.cd! + REFILL * dt);
    flow.cdHold = true;
  }
  else if (gap < flow.edge + NEAR && ctx.gapRate < CLOSE_V
    && (flow.nearT = (flow.nearT || 0) + dt) < NEAR_T) flow.cdHold = true;
  else flow.cd! -= dt;
  if (flow.cd! <= 0) endRace(ctx);
}

/** One step of the race flow, after the green. */
export function stepFlow(ctx: HwCtx, dt: number) {
  const flow = ctx.flow, entries = ctx.entries;
  if (flow.state === 'done') return;
  flow.t += dt;
  noteRoadPositions(entries);
  const myEntry = entries.find((entry) => entry.player),
    rivals = entries.filter((entry) => !entry.player);
  if (!myEntry || !rivals.length || flow.t < 3) return;
  // `top` = the rival you have to catch: the LAST one
  const myS = sOf(myEntry), top = rivals.reduce((slowest, entry) =>
    (sOf(entry) < sOf(slowest) ? entry : slowest), rivals[0]);
  const kind = withGrace(flow, dueKind(ctx, myS, rivals, top), dt);
  switchKind(ctx, kind);
  const gap = sOf(top) - myS;
  trackGap(ctx, gap, dt);
  flow.cdHold = false;
  if (kind === 'ahead') runAhead(ctx, gap, dt);
  else if (kind) {
    flow.cd! -= dt;
    if (flow.cd! <= 0) endRace(ctx);
  }
}
