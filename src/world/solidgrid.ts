// THE SOLID GRID: the level's solid boxes (LEVEL.solids) and lamp posts (world/lamps.ts) filed by
// 16 m cell (core/cellgrid.ts), so a car's clamp (barriers.ts solidClamp) and a moving loose
// object (cones/coneWalls.js) test the few near them, not every one. The highway keeps up to ~250
// solids loaded (its trees, bales, boards, bridges) and its street lights, and every car clamps
// against them every physics step. Each cell keeps the solids and the lamps in their lists'
// order, so the clamps meet them in the same order as a walk of the whole lists: identical
// answers, only quicker. Rebuilt when the level, its solids or its lamps change (the highway
// sets LEVEL.solidsDirty at every rebuild of its window).
import { addToGrid, cellAt, type CellGrid } from '../core/cellgrid.ts';
import { activeLamps, type Lamp } from './lamps.ts';
import { POST_LONG_M } from './lampdamage.ts';
import { LEVEL } from './state.ts';
import type { Solid } from './types.ts';

// the cell size, m
const CELL_M = 16;
// how far from its centre a body may reach and still be found by its cell, m: the longest car
// (5.1 m) reaches ~2.7 m to a corner, and a push out of one solid moves it on a little before
// the next is tested; a body reaching farther walks the whole lists
const BODY_REACH_M = 8;
// a lamp's own reach, m: a fallen post lies POST_LONG_M along the ground and each pass over it
// shoves it a little (under 1.2 m in all)
const LAMP_REACH_M = POST_LONG_M + 2;

/** The solids and lamp posts near a body (read both at once: the object is reused). */
export interface SolidsNear {
  solids: Solid[];
  lamps: Lamp[];
}

const NO_SOLIDS: Solid[] = [], NO_LAMPS: Lamp[] = [];
const near: SolidsNear = { solids: NO_SOLIDS, lamps: NO_LAMPS };
let solidGrid: CellGrid<Solid> = new Map();
let lampGrid: CellGrid<Lamp> = new Map();
let builtLevel: object | null = null, builtSolids: Solid[] | null = null, builtCount = -1;
let builtLamps: Lamp[] | null = null;

/**
 * Files every solid and lamp post in the cells a body near them could be centred in.
 * @param solids the level's solids
 * @param lamps the level's lamps
 */
function buildGrids(solids: Solid[], lamps: Lamp[]): void {
  solidGrid = new Map();
  lampGrid = new Map();
  for (const solid of solids)
    addToGrid(solidGrid, solid, solid.x, solid.y, (solid.r || 0) + BODY_REACH_M, CELL_M);
  for (const lamp of lamps) {
    const reach = Math.max(LAMP_REACH_M, lamp.solid.r || 0) + BODY_REACH_M;
    addToGrid(lampGrid, lamp, lamp.x, lamp.y, reach, CELL_M);
  }
  builtLevel = LEVEL;
  builtSolids = solids;
  builtCount = solids.length;
  builtLamps = lamps;
  LEVEL.solidsDirty = false;
}

/**
 * The solids and lamp posts that can touch a body centred at a point, in their lists' order
 * (the grids rebuilt first when the level, its solids or its lamps changed).
 * @param x the body's centre, m
 * @param y the body's centre, m
 * @param reach how far the body reaches from its centre, m
 * @returns the near solids and lamps (a reused object), or null when the body reaches too far
 *   for the grid (walk LEVEL.solids and activeLamps())
 */
export function solidsNear(x: number, y: number, reach: number): SolidsNear | null {
  if (reach > BODY_REACH_M) return null;
  const solids = LEVEL.solids || NO_SOLIDS, lamps = activeLamps();
  if (builtLevel !== LEVEL || builtSolids !== solids || builtCount !== solids.length
    || builtLamps !== lamps || LEVEL.solidsDirty) buildGrids(solids, lamps);
  near.solids = cellAt(solidGrid, x, y, CELL_M) || NO_SOLIDS;
  near.lamps = cellAt(lampGrid, x, y, CELL_M) || NO_LAMPS;
  return near;
}
