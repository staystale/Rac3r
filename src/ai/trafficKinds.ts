// ai/trafficKinds.ts - THE DRIVER each of your way's cars is as it joins the road (owner 11-10:
// "can cars on my side come up behind me still", "I want them too like a real road", "can we make
// a small % of the traffic speed and get in the way"): most cruise (ai/trafficSpawn.ts cruise,
// 90-110 km/h), FAST_SHARE are quicker drivers at FAST_KMH and SPEEDER_SHARE speeders (ai/
// trafficSpeeder.ts). Where one is put back is where a real road's would come into sight: one
// faster than you from behind (it comes past), one slower ahead (you catch it up) - MEASURED,
// tools/scratch/_trafficsides.mjs, you at ~100 km/h for 120 s: dealt only as a car you passed was
// put back, and kept behind only while catching you up, no one came past at the traffic's own
// speed (you passed no one, so no one was put back).
import type { TrafficCtx } from './trafficCtx.ts';
import { setSpeed } from './trafficSpawn.ts';
import { SPEEDER_KMH, SPEEDER_SHARE, makeSpeeder } from './trafficSpeeder.ts';
import { makePolice, policeShare } from './trafficPolice.ts';
import { FIX } from '../core/fixes.ts';
import type { TrafficCar } from './types.ts';

// the share of your way's cars that are quicker drivers, and their cruise, km/h
const FAST_SHARE = 0.2, FAST_KMH = [125, 150];
// km/h a cruising car does on the whole (ai/trafficSpawn.ts cruise: 90-110)
const CRUISE_KMH = 100;

/** A driver: cruising, a quicker one, a speeder, the police (?police=1). */
export type Kind = 'cruise' | 'fast' | 'speeder' | 'police';

/**
 * The driver a car joining the road is: now and then (?police=1) the police, either way
 * (ai/trafficPolice.ts policeShare); the other way's every other one cruise.
 * @param ctx the traffic
 * @param dir its way (+1 yours)
 * @returns its kind
 */
export function dealKind(ctx: TrafficCtx, dir: number): Kind {
  if (FIX.police && ctx.rnd() < policeShare(ctx)) return 'police';
  if (dir < 0) return 'cruise';
  if (ctx.rnd() < SPEEDER_SHARE) return 'speeder';
  if (ctx.rnd() < FAST_SHARE) return 'fast';
  return 'cruise';
}

/**
 * A kind's speed on the whole, m/s.
 * @param kind the driver
 * @returns m/s
 */
export function kindSpeed(kind: Kind): number {
  const [low, high] = kind === 'speeder' ? SPEEDER_KMH : kind === 'fast' ? FAST_KMH
    : [CRUISE_KMH, CRUISE_KMH];
  return (low + high) / 2 / 3.6;
}

/**
 * A car just placed made its kind: a quicker driver's cruise raised to FAST_KMH and put moving at
 * it; a speeder's racing driver; a police car (cruising); a cruising car as it is.
 * @param ctx the traffic
 * @param slot the car
 * @param kind the driver
 */
export function applyKind(ctx: TrafficCtx, slot: TrafficCar, kind: Kind) {
  if (kind === 'speeder') makeSpeeder(ctx, slot);
  else if (kind === 'police') makePolice(ctx, slot);
  else if (kind === 'fast') {
    slot.vWant = Math.max(slot.vWant, (FAST_KMH[0] + ctx.rnd() * (FAST_KMH[1] - FAST_KMH[0]))
      / 3.6);
    slot.quick = true;
    setSpeed(slot, slot.vWant);
  }
}
