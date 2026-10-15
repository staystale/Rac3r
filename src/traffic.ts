// traffic.js — HIGHWAY TRAFFIC (requirement: dumb, slightly SLOW TRAFFIC, RECYCLED when overtaken
// and off screen (vehicle randomised and moved to the front, or replaced — whichever is most
// efficient)); "CRASHABLE cars WITH DAMAGE; NOT racing, just driving;
// GENTLY AVOIDING; LANE CHANGING"; "traffic in EVERY MODE and a SLIDER in test mode for DENSITY").
//
// Every traffic car is a REAL car (vehicle.ts step, the same clamps, damage, rollover and contacts
// as you and the AI), driven by a dumb LANE DRIVER: pure pursuit on its lane line (+ a small
// sideways lean away from you when you are alongside), a cruise speed of 90-110 km/h (the left lane
// slowest), FOLLOWING whatever is ahead in its path (traffic, you, the AI) at ~1 s, and braking
// hard when the time to a collision gets short. LANE CHANGES: indicate first, then drift across —
// to overtake a slower car (right, else rarely left), back to the left when it is clear (keep
// left), and now and then for no reason. A car TOO DAMAGED stops with its hazards on.
// RECYCLING: a car OUT OF VIEW (main.js passes the renderer's real screen test) and well behind you
// is REPLACED by a fresh random car (model + colour) ahead, off the top; one far ahead (you
// stopped) comes back from behind. A new car is always placed OFF SCREEN and never near another car
// in that lane. Positions are absolute road distances, so the window moving needs nothing.
// Measured: tools/trafficcheck.mjs.
import { PER_LANE } from "./ai/trafficCtx.ts";
import type { TrafficCtx } from "./ai/trafficCtx.ts";
import { clearAround, clearSpan, resetTraffic } from "./ai/trafficReset.ts";
import { stepTraffic } from "./ai/trafficStep.ts";
import type { StepArgs } from "./ai/trafficStep.ts";
import type { HighwayLevel } from "./ai/types.ts";

export { PER_LANE };

/** The highway traffic: the factory makes one context and returns the traffic object. */
export function createTraffic({ rnd = Math.random } = {}) {
  const ctx: TrafficCtx = {
    rnd, list: [], level: null, want: 0, placed: 0, recycled: 0, visHits: 0, cars: [],
  };
  return {
    cars: ctx.cars,
    reset: (nextLevel: HighwayLevel | null, density: number) => (
      resetTraffic(ctx, nextLevel, density)
    ),
    step: (dt: number, args: StepArgs) => stepTraffic(ctx, dt, args),
    clearAround: (x: number, y: number, radius: number) => clearAround(ctx, x, y, radius),
    clearSpan: (fromS: number, toS: number) => clearSpan(ctx, fromS, toS),
    get list() { return ctx.list; }, get want() { return ctx.want; },
    stats: () => ({
      live: ctx.cars.length, want: ctx.want, placed: ctx.placed, recycled: ctx.recycled,
      visHits: ctx.visHits,
    }),
  };
}
export type Traffic = ReturnType<typeof createTraffic>;
