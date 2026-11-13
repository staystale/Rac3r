// cones/coneSleep.ts: THE AWAKE LIST (FIX.perfpass): the loose objects a step walks, in list order
// (by _n, the fixed creation index the list is in). An object AT REST (stillAtRest: the one gate
// the step skips on) sleeps at the end of a step and leaves it; a step's walks then skip only what
// the walk of the whole list would have skipped. Within a step only a car meeting a resting
// object (coneStep.ts hitRestingObjects) or a mover striking one (coneGrid.ts pairWithResting) can
// change it: either wakes it first if it stirred it. New objects join awake; a restart wakes all.
// A tumbleweed with a breeze never sleeps (its breeze is looked at before the gate).
import type { ConesCtx, Loose } from './coneTypes.ts';

/**
 * AT REST since its last step - still, not spinning or settling, the same spot and the
 * same filed cell - so this step would change nothing and test no car (MEASURED, 20 AI on
 * Thruston: ~1100 objects stepped for nothing were 0.2 ms of a 4.6 ms physics step).
 * @param obj the object
 * @returns true when its step can be skipped
 */
export function stillAtRest(obj: Loose) {
  return obj._restX === obj.x && obj._restY === obj.y && obj._restCk === obj._ck
    && !obj.vx && !obj.vy && !obj.spin && !(obj.down > 0 && obj.down < 1);
}

/**
 * Wakes an object a car or a mover has just stirred (no longer at rest), in list order.
 * @param ctx the cones context
 * @param obj the object
 */
export function wakeIfStirred(ctx: ConesCtx, obj: Loose): void {
  if (obj._awake || stillAtRest(obj)) return;
  obj._awake = true;
  const awake = ctx.awake, order = obj._n!;
  let low = 0, high = awake.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (awake[mid]._n! < order) low = mid + 1; else high = mid;
  }
  awake.splice(low, 0, obj);
}

/**
 * A new object (the newest in the list) joins the awake list at its end.
 * @param ctx the cones context
 * @param obj the object
 */
export function joinAwake(ctx: ConesCtx, obj: Loose): void {
  obj._awake = true;
  ctx.awake.push(obj);
}

/**
 * Every object of the list awake (a restart, a new list, a harness's own additions).
 * @param ctx the cones context
 */
export function wakeAll(ctx: ConesCtx): void {
  ctx.awake = ctx.list.slice();
  for (const obj of ctx.awake) obj._awake = true;
}

/**
 * The end of a step: every object at rest (and with no breeze) goes to sleep.
 * @param ctx the cones context
 */
export function sleepRested(ctx: ConesCtx): void {
  const awake = ctx.awake;
  let kept = 0;
  for (let i = 0; i < awake.length; i++) {
    const obj = awake[i];
    if (!obj.wind && stillAtRest(obj)) obj._awake = false;
    else awake[kept++] = obj;
  }
  awake.length = kept;
}
