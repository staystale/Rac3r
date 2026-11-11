// ai/trafficSpeeder.ts - SPEEDERS (owner 11-10: "can we make a small % of the traffic
// speed and get in the way ect", "They can jsut adopt the racing ai I guess"): now and then one of
// your way's cars put back is a speeder - the one AI driver (ai/circuit.ts, as it races the
// highway) at its wheel, held at SPEEDER_KMH, weaving through the traffic and cutting in as a
// racer does; from behind (it comes past you when you are slower) or ahead (ai/trafficKinds.ts).
// Out of sight and away from every real car it is carried along its lane like any traffic car, at
// that speed.
import { createAIDriver } from './circuit.ts';
import { aiTraits } from './traits.ts';
import { tooInjured } from '../damage.ts';
import { geo } from './trafficCtx.ts';
import type { TrafficCtx } from './trafficCtx.ts';
import type { DriveEnv } from './trafficLane.ts';
import { drivePhysics } from './trafficPhys.ts';
import { setSpeed } from './trafficSpawn.ts';
import type { TrafficCar } from './types.ts';
import type { Level } from '../world/types.ts';

// the share of your way's cars that are speeders (ai/trafficKinds.ts), and the km/h one holds
export const SPEEDER_SHARE = 1 / 15, SPEEDER_KMH = [150, 180];
// a speeder's difficulty (Game: a road driver, not a pro - it makes mistakes) and aggression (it
// gets in the way)
const SPEEDER_DIFF = 1, SPEEDER_AGG = 0.9;

/**
 * A car just put back made a speeder: the racing driver at its wheel, its speed SPEEDER_KMH, put
 * moving at it.
 * @param ctx the traffic
 * @param slot the car
 */
export function makeSpeeder(ctx: TrafficCtx, slot: TrafficCar) {
  const seed = 1 + ((ctx.rnd() * 1e6) | 0);
  const traits = { ...aiTraits(SPEEDER_DIFF, 0, 1, seed), aggression: SPEEDER_AGG };
  // (the traffic's level is the game's endless level)
  slot.racer = createAIDriver(ctx.level as unknown as Level, traits);
  slot.quick = true;
  slot.vWant = (SPEEDER_KMH[0] + ctx.rnd() * (SPEEDER_KMH[1] - SPEEDER_KMH[0])) / 3.6;
  setSpeed(slot, slot.vWant);
}

/**
 * A speeder near a real car: the racing driver's controls (it sees every car on its side of a
 * central reservation), then the same physics as every traffic car; a wreck brakes as one.
 * @param ctx the traffic
 * @param slot the speeder
 * @param env the step's road
 * @param speed its speed, m/s
 */
export function driveSpeeder(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv, speed: number) {
  const car = slot.car, racer = slot.racer!, median = geo(ctx).median;
  // (woken from being carried: it finds its place on the line again; no lane change of the
  // carried car's left signalling)
  if (slot.kin) racer.relocate();
  slot.laneT = slot.lane;
  slot.ind = 0;
  const side = (off: number) => median == null || Math.sign(off - median)
    === Math.sign(slot.off - median);
  const input = slot.wreck || tooInjured(car) ? undefined : racer.drive(car, env.dt, () => ({
    cars: env.ents.filter((ent) => ent.car !== car && side(ent.off)).map((ent) => ent.car),
    vMax: slot.vWant, hold: false }));
  drivePhysics(ctx, slot, env, speed, slot.vWant, 0, input);
}
