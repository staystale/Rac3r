// cones/coneCushion.ts - A CRASH-CUSHION BARREL HIT (highway/cushions.ts lays them;
// TODO 3a2 item 13, the owner's answers 11-15: "each LEAKS or POPS depending on how hard (with a
// chance), spraying water over 2-6 squares (a wet patch that dries); they soften the crash"). A
// barrel is a heavy loose object (DEBRIS.cushion: ~400 kg, a dead bounce), so a car ploughing
// through a cluster gives it its momentum barrel by barrel and meets what stands behind slower.
// Each DISTINCT hit rolls: the harder, the likelier it pops (split open, its water out at once, a
// flat shell driven over), else a firmer one may leak (a few cells of its water out, the barrel
// lighter). The water lands as the one water there is - the tyres' water in the wear cells
// (physics/engineheat.ts wetCellAt: the field's look and grip, tyres clear it, it dries), sprayed
// the way the barrel was knocked.
import { wetCellAt } from '../physics/engineheat.ts';
import { WEAR_CELL } from '../world/wear.ts';
import type { ConesCtx, Loose } from './coneTypes.ts';

// the bounce of a water-filled barrel (the water soaks the hit up; a tyre stack's is 0.25)
export const CUSHION_REST = 0.1;
// m/s of closing speed: a hit below LEAK_FROM_V only shoves it; from it a leak is likelier the
// harder, sure (unless it pops) from LEAK_SURE_V
const LEAK_FROM_V = 2, LEAK_SURE_V = 8;
// m/s: the pop's chance rises from 0 at POP_FROM_V (22 km/h) to sure at POP_SURE_V (72 km/h)
const POP_FROM_V = 6, POP_SURE_V = 20;
// wear cells (1.5 m squares) a full barrel's water covers (the owner: 2-6), and a leak's
const CELLS_FULL = 6, LEAK_LEAST = 2, LEAK_MOST = 3;
// kg: a barrel's full weight (DEBRIS.cushion), its empty drum's, its split shell's (as the other
// broken patches)
const FULL_KG = 400, EMPTY_KG = 25, SHELL_KG = 40;
// m the spray reaches from the barrel; rad either side of the way it was knocked
const SPRAY_REACH_M = 3, SPRAY_SPREAD = 0.8;
// s between DISTINCT hits (one pass shoves it for ~0.4 s, as cones/coneCar.ts breakDebris)
const DISTINCT_S = 0.6;
// tries a spray makes for each cell it means to wet (two may land in one cell)
const TRIES_PER_CELL = 4;

const clampShare = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Sprays a barrel's water over `cells` distinct wear cells round it, the way it was knocked, and
 * throws a splash.
 * @param ctx the cones context (its hits: the splash)
 * @param obj the barrel
 * @param cells how many cells
 */
function sprayWater(ctx: ConesCtx, obj: Loose, cells: number) {
  if (cells <= 0) return;
  const way = Math.atan2(obj.vy, obj.vx), wet = new Set<string>();
  for (let tries = 0; tries < cells * TRIES_PER_CELL && wet.size < cells; tries++) {
    const angle = way + (Math.random() * 2 - 1) * SPRAY_SPREAD;
    const reach = Math.random() * SPRAY_REACH_M;
    const x = obj.x + Math.cos(angle) * reach, y = obj.y + Math.sin(angle) * reach;
    const key = Math.floor(x / WEAR_CELL) + ',' + Math.floor(y / WEAR_CELL);
    if (wet.has(key)) continue;
    wet.add(key);
    wetCellAt(x, y);
  }
  for (let splash = 0; splash < 2 && ctx.hits.length < 24; splash++)
    ctx.hits.push({ x: obj.x, y: obj.y, speed: 6 + cells * 2, kind: 'water' });
}

/**
 * A barrel split open: its water out, a flat shell driven over (cones/coneConsts.ts BROKEN).
 * @param ctx the cones context
 * @param obj the barrel
 * @param left its water left, cells
 */
function popBarrel(ctx: ConesCtx, obj: Loose, left: number) {
  sprayWater(ctx, obj, left);
  obj.water = 0;
  obj.kind = 'cushionpop';
  obj.mode = 'flat';
  obj.mass = SHELL_KG;
  obj.vx *= 0.4;
  obj.vy *= 0.4;
  obj.down = 1;
}

/**
 * What a car's hit does to a crash-cushion barrel (cones/coneCar.ts hitByCar, after the momentum
 * is shared): on a distinct hit, a roll by its closing speed - it pops, leaks, or is only shoved.
 * @param ctx the cones context
 * @param obj the object hit
 * @param rel the closing speed, m/s
 */
export function hitCushion(ctx: ConesCtx, obj: Loose, rel: number) {
  if (obj.kind !== 'cushion') return;
  const isNewHit = ctx.clock - (obj._lastHit ?? -9) > DISTINCT_S;
  obj._lastHit = ctx.clock;
  if (!isNewHit) return;
  const left = obj.water ?? CELLS_FULL, roll = Math.random();
  const popChance = clampShare((rel - POP_FROM_V) / (POP_SURE_V - POP_FROM_V));
  const leakChance = clampShare((rel - LEAK_FROM_V) / (LEAK_SURE_V - LEAK_FROM_V));
  if (roll < popChance) popBarrel(ctx, obj, left);
  else if (roll < leakChance && left > 0) {
    const out = Math.min(left, LEAK_LEAST + Math.floor(Math.random()
      * (LEAK_MOST - LEAK_LEAST + 1)));
    sprayWater(ctx, obj, out);
    obj.water = left - out;
    obj.mass = EMPTY_KG + (FULL_KG - EMPTY_KG) * (obj.water / CELLS_FULL);
  }
}
