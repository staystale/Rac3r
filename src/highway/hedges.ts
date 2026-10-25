// hedges.ts - HEDGEROWS round the highway's farm fields (owner: "highways should have bushes
// around farmers fields"; ?hedges=1). Each field's long-grass border (highway/fields.js, HEDGE_W
// m all round) gets clumps of the bushes the other levels have (world/bushplan.ts, the 'bush'
// surface: drag, scratches, punctures, flattened to long grass; drawn as its square pixel clumps
// with tufts over the cars) along all four sides, with gaps and a gateway on the road side. They
// stream with the field: laid with it, dropped with it (passed, or cleared for a bridge / slip
// road), and indexed in the patch grid (world/load.ts reindexBushes), so the ground lookup stays
// a grid query however many are loaded. Own random stream per field: nothing else moves.

import { seededRng } from '../world/blend.ts';
import { SURFACES } from '../world/surfaces.ts';
import { reindexBushes } from '../world/load.ts';
import type { Level, Patch } from '../world/types.ts';

/** A field plot as highway/fields.js lays it (the parts a hedge reads). */
export interface FieldPlot {
  centre: { x: number; y: number };
  axisX: number; axisY: number; nx: number; ny: number; side: number;
  fieldLen: number; depth: number; fieldId: number; dist: number;
}
/** A hedge bush: a bush patch that knows its field and its road distance. */
type HedgeBush = Patch & { field: number; _s: number };
/** The highway level as the hedges read it. */
type HedgeLevel = Level & { _bushes?: Patch[] | null };

// m: the border the hedge stands in (highway/fields.js HEDGE_W)
const BAND_M = 2.5;
// m between clump spots along an edge, and the chance a spot is a gap
const STEP_MIN_M = 3, STEP_SPREAD_M = 2.5, GAP_CHANCE = 0.15;
// m: the gateway left in the road-side hedge
const GATE_M = 8;
// m: a clump's main bush (its side; fits the band), the extra ones smaller
const MAIN_MIN_M = 1.8, MAIN_SPREAD_M = 0.7;
// m a bush's centre keeps from a hedgerow tree's trunk
const TRUNK_CLEAR_M = 1.6;
// the kinds of bush (render/ground/art.ts addBushLooks)
const BUSH_LOOKS = ['bush', 'bushOlive', 'bushTeal'];

let hedgesOn = false;
/**
 * ?hedges=1: hedgerows round the highway's fields (owner test).
 * @param isOn the switch
 */
export function setHedges(isOn: boolean): void { hedgesOn = isOn; }

/**
 * A point of a field by its own axes (along the road, across away from it), m.
 * @param plot the field
 * @param along m along the road from the centre
 * @param across m away from the road from the centre
 * @returns world x, y
 */
function fieldPoint(plot: FieldPlot, along: number, across: number): [number, number] {
  return [plot.centre.x + plot.axisX * along + plot.nx * across * plot.side,
    plot.centre.y + plot.axisY * along + plot.ny * across * plot.side];
}

/**
 * Lays the hedge round one field (after its trees: highway/fields.js).
 * @param level the highway level
 * @param plot the field
 */
export function addFieldHedges(level: HedgeLevel, plot: FieldPlot): void {
  if (!hedgesOn) return;
  const rnd = seededRng('hedge' + plot.fieldId);
  const list = level._bushes || (level._bushes = []);
  const halfL = plot.fieldLen / 2 + BAND_M / 2, halfD = plot.depth / 2 + BAND_M / 2;
  const trunks = (level.props || []).filter((prop) => prop.kind === 'tree'
    && (prop as { field?: number }).field === plot.fieldId);
  const gateAt = (rnd() - 0.5) * (plot.fieldLen - 2 * GATE_M);
  // the four sides: [from (along, across), to (along, across), the road side?]
  const sides: [number, number, number, number, boolean][] = [
    [-halfL, -halfD, halfL, -halfD, true], [-halfL, halfD, halfL, halfD, false],
    [-halfL, -halfD, -halfL, halfD, false], [halfL, -halfD, halfL, halfD, false],
  ];
  for (const [fromU, fromV, toU, toV, roadSide] of sides) {
    const length = Math.hypot(toU - fromU, toV - fromV);
    for (let run = rnd() * STEP_MIN_M; run < length; run += STEP_MIN_M + rnd() * STEP_SPREAD_M) {
      const along = fromU + (toU - fromU) * run / length;
      const across = fromV + (toV - fromV) * run / length;
      if (rnd() < GAP_CHANCE || (roadSide && Math.abs(along - gateAt) < GATE_M / 2)) continue;
      const [x, y] = fieldPoint(plot, along, across);
      if (trunks.some((tree) => Math.hypot(tree.x - x, tree.y - y) < TRUNK_CLEAR_M)) continue;
      growHedgeClump(list, plot, x, y, rnd);
    }
  }
  reindexBushes(level);
}

/**
 * One clump of the hedge: a main square bush and up to two smaller ones beside it.
 * @param list the level's bushes (added to)
 * @param plot the field
 * @param x world x, m
 * @param y world y, m
 * @param rnd the field's hedge random stream
 */
function growHedgeClump(list: Patch[], plot: FieldPlot, x: number, y: number,
  rnd: () => number) {
  const main = MAIN_MIN_M + rnd() * MAIN_SPREAD_M, art = BUSH_LOOKS[Math.floor(rnd() * 3)];
  for (let part = 0, parts = 1 + Math.floor(rnd() * 3); part < parts; part++) {
    const side = part === 0 ? main : main * (0.55 + rnd() * 0.25);
    const shift = part === 0 ? 0 : (rnd() - 0.5) * main;
    const bush: HedgeBush = { x: x + plot.axisX * shift, y: y + plot.axisY * shift, w: side,
      h: side, sq: true, surface: SURFACES.bush, bush: true, art, field: plot.fieldId,
      _s: plot.dist };
    list.push(bush);
  }
}

/**
 * A new motorway (resetHighway: launch, RESTART): no hedges until its fields are laid.
 * @param level the highway level
 */
export function resetHedges(level: HedgeLevel): void {
  if (!level._bushes || !level._bushes.length) return;
  level._bushes = [];
  reindexBushes(level);
}

/**
 * Drops the hedges the road has left behind (highway.js slide: what is before startDist).
 * @param level the highway level
 * @param startDist the road distance everything before is dropped, m
 */
export function pruneHedges(level: HedgeLevel, startDist: number): void {
  keepHedges(level, (bush) => bush._s >= startDist);
}

/**
 * Drops the hedges of fields cleared for a later feature (highway/fields.js clearFields).
 * @param level the highway level
 * @param fieldIds the cleared fields
 */
export function dropFieldHedges(level: HedgeLevel, fieldIds: Set<number>): void {
  keepHedges(level, (bush) => !fieldIds.has(bush.field));
}

/**
 * Keeps the hedge bushes that pass a test; re-indexes when any went.
 * @param level the highway level
 * @param keep the test
 */
function keepHedges(level: HedgeLevel, keep: (bush: HedgeBush) => boolean) {
  const list = level._bushes;
  if (!list || !list.length) return;
  const kept = (list as HedgeBush[]).filter((bush) => bush.field == null || keep(bush));
  if (kept.length === list.length) return;
  level._bushes = kept;
  reindexBushes(level);
}
