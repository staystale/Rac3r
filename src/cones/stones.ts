// cones/stones.ts - MOVABLE STONES (?spikerocks; owner 11-22): small rocks on a road's edges and
// the insides of its corners, loose objects like the cones (cones.ts: pushed by their mass - the
// heavier barely move - and asleep when untouched), placed by the level (world/levels/spikes.ts,
// SPIKES PEAK first; the rally stages after). Each DISTINCT hit (STONE_HIT_GAP_S apart: one pass
// through a stone pushes it for a moment) has the same small chance of puncturing the tyre that hit
// it, STONE_PUNCTURE, and makes the next car likelier to drive straight over it (its overChance
// rises by STONE_OVER_STEP of what is left: as body panels come off with repeated hits) - the
// drive-over roll itself is the loose objects' own (cones/coneCar.ts rollsOver: per meeting, by
// the car's ground clearance). The first numbers (the owner's 2 % a hit; the rest Worker C's) are
// here to change.
import type { ConeCar, ConesCtx, Loose } from './coneTypes.ts';

// the chance one hit punctures a tyre (the same every hit)
export const STONE_PUNCTURE = 0.02;
// how much of the chance left of being driven over each hit adds
export const STONE_OVER_STEP = 0.25;
// m/s: a hit slower than this punctures nothing (the debris' own: physics/tyrewear.ts)
const STONE_HIT_V = 3;
// s: contacts closer than this are the same hit
const STONE_HIT_GAP_S = 0.6;
// the stones by size: kg, m across / 2, the chance a car drives over it before any hit
// and how fast it grinds to a stop sliding, 1/s (a rock on the ground: a banger's 6.5, a cone's
// ~2). MEASURED (tools/scratch/_stonehit.mjs, a car into each at 10 m/s): with a loose object's own
// push (the car's speed, whatever its mass: cones/coneCar.ts transferMomentum) and drag every size
// flew 8-14 m, a 500 kg boulder too - "heavier ones barely move" needs its share of the car's
// momentum (stonePush) and a rock's grip on the ground
export const STONE_KINDS: Record<string, { mass: number; r: number; over0: number; drag: number }>
  = {
    stone: { mass: 10, r: 0.2, over0: 0.6, drag: 3 },
    stonemid: { mass: 60, r: 0.3, over0: 0.25, drag: 5 },
    stonebig: { mass: 500, r: 0.45, over0: 0, drag: 8 },
  };

/**
 * A stone's share of a car's push: its velocity from the hit x the car's mass over both (a pebble
 * all of it, a boulder much less).
 * @param obj the stone (its velocity is scaled in place)
 * @param carMass the car's mass, kg
 */
export function stonePush(obj: Loose, carMass: number) {
  if (!STONE_KINDS[obj.kind]) return;
  const share = carMass / (carMass + obj.mass);
  obj.vx *= share;
  obj.vy *= share;
}

/**
 * A stone's chance of being driven over before any hit.
 * @param kind its kind
 * @returns 0..1, or undefined (not a stone)
 */
export const stoneOverChance = (kind: string): number | undefined => STONE_KINDS[kind]?.over0;

/**
 * A car's hit on a stone (one sim step of contact): a new distinct hit raises its drive-over
 * chance and rolls the puncture.
 * @param ctx the cones context (its clock)
 * @param obj the stone
 * @param car the car
 * @param rel the closing speed, m/s
 * @param tyre the front tyre on the side it was hit (0 / 1)
 */
export function hitStone(ctx: ConesCtx, obj: Loose, car: ConeCar, rel: number, tyre: number) {
  if (!STONE_KINDS[obj.kind]) return;
  const isNew = ctx.clock - (obj._stoneT ?? -Infinity) > STONE_HIT_GAP_S;
  obj._stoneT = ctx.clock;
  if (!isNew) return;
  obj.overChance = 1 - (1 - (obj.overChance ?? 0)) * (1 - STONE_OVER_STEP);
  if (rel > STONE_HIT_V && Math.random() < STONE_PUNCTURE) {
    car.burstTyre = tyre;
    car.burstSlow = true;
  }
}
