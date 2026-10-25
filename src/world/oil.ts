// oil.ts - OIL ON THE GROUND (car systems C6; owner: it acts like water, not a new kind of
// thing - one cover in the wear cells, as the tyres' water - only slippier, and drawn like ice but
// purple). A wear cell's cover 'oil' (wet.ts oilSurface: about a third of the dry grip on hard
// ground and short grass); sand, gravel, dirt, mud and long grass SOAK it up (no cover, no grip
// lost). It never dries and the rain does not wash it off (the puddles.ts / coverfield.ts water
// rules only move 'wet').
// Where it comes from: a cracked sump drips it (physics/engineheat.ts), a big crash spills a
// patch and a rolling car sprays some (damage.ts). How it moves (owner): DRIVEN THROUGH, a
// puddle spreads a little the way the wheel was going (a chance per pass onto the next cell
// ahead); WATER SPREADS IT - oil next to water has a 50:50 chance a second to run into that wet
// cell (oil floats on water: the cell becomes oil). Each spread is a generation weaker
// (cell.oilGen), so a spill grows a few cells and stops.
import { getCell, wearDirty, wearKey, wearMap, WEAR_CELL } from "./wear.ts";
import { fieldCoverAt } from "./coverfield.ts";
import type { WearCell } from "./types.ts";

// the ground that soaks oil up (no cover, no grip lost)
const SOAKS = new Set(['sand', 'gravel', 'dirt', 'mud', 'thickMud', 'grassLong', 'bush', 'trap']);
// generations: a crash spill spreads up to SPILL_GEN - 1 times, a sump drip DRIP_GEN - 1
export const SPILL_GEN = 3, DRIP_GEN = 2;
// a pass through an oil cell spreads it to the next cell ahead DRAG_SPREAD of the time
const DRAG_SPREAD = 0.25;
// oil next to water runs into it WATER_SPREAD of the time, checked every SPREAD_TICK_S
const WATER_SPREAD = 0.5, SPREAD_TICK_S = 1;
// a crash's damage OIL_HIT+ spills oil, likelier the bigger (OIL_P_MIN at OIL_HIT, sure at
// OIL_HIT + OIL_SPAN), 1 .. OIL_PATCH cells within OIL_REACH_M of the car; a rollover impact
// OIL_ROLL_P of the time, 1-2 cells
const OIL_HIT = 0.2, OIL_SPAN = 0.6, OIL_P_MIN = 0.15, OIL_PATCH = 4, OIL_REACH_M = 2;
const OIL_ROLL_P = 0.25;

let tickS = 0;
// the oil cells, for the water spreading (checked against the wear map: a reset drops them)
const oilCells = new Set<WearCell>();
// the wheel making this pass: its motion this step, m (wear.ts stepWear notes it)
const passMotion = { dx: 0, dy: 0 };


/**
 * Oil lands at a point: bare ground (or water) in that wear cell becomes oil; soaking ground takes
 * it in; snow and ice keep it under them.
 * @param x world x, m
 * @param y world y, m
 * @param gen how many more times it can spread, + 1
 * @returns true when the cell is oil now
 */
export function spillOil(x: number, y: number, gen: number): boolean {
  return oilCell(getCell(Math.floor(x / WEAR_CELL), Math.floor(y / WEAR_CELL), true), gen);
}

/** A car as the spills read it. */
interface SpillCar { x?: number; y?: number; vx: number; vy: number }

/**
 * Oil round a car: count cells within OIL_REACH_M of it.
 * @param car the car
 * @param count cells
 * @param rnd the random source
 */
function spillPatch(car: SpillCar, count: number, rnd: () => number): void {
  for (let i = 0; i < count; i++) {
    const angle = rnd() * Math.PI * 2, reach = rnd() * OIL_REACH_M;
    spillOil((car.x || 0) + Math.cos(angle) * reach, (car.y || 0) + Math.sin(angle) * reach,
      SPILL_GEN);
  }
}

/**
 * A hard hit (damage.ts hit) may spill oil: likelier and more the bigger.
 * @param car the car
 * @param amt the hit's damage
 * @param rnd the random source
 */
export function crashOil(car: SpillCar, amt: number, rnd: () => number): void {
  if (amt < OIL_HIT) return;
  if (rnd() >= Math.min(1, OIL_P_MIN + (amt - OIL_HIT) / OIL_SPAN)) return;
  spillPatch(car, 1 + Math.floor(rnd() * Math.min(OIL_PATCH, 1 + amt * 4)), rnd);
}

/**
 * A rollover impact (damage.ts hitRoll) may spray a little oil.
 * @param car the car
 */
export function rollOil(car: SpillCar): void {
  if (Math.random() >= OIL_ROLL_P) return;
  spillPatch(car, 1 + Math.floor(Math.random() * 2), Math.random);
}

/**
 * Makes a wear cell oil (see spillOil).
 * @param cell the wear cell, or null
 * @param gen its generation
 * @returns true when the cell is oil now
 */
function oilCell(cell: WearCell | null, gen: number): boolean {
  if (!cell || cell.fixed || SOAKS.has(cell.base)) return false;
  if (cell.cover === 'oil') {
    cell.oilGen = Math.max(cell.oilGen || 0, gen);
    return true;
  }
  if (cell.cover && cell.cover !== 'wet') return false;
  cell.cover = 'oil';
  cell.oilGen = gen;
  cell.standing = true;
  cell.dry = 0;
  cell.scrub = 0;
  cell.passes = 0;
  cell.current = 'oil';
  wearDirty.push(cell);
  oilCells.add(cell);
  return true;
}

/**
 * The wheel about to pass over its cells this step (wear.ts stepWear).
 * @param dx its motion this step, x, m
 * @param dy its motion this step, y, m
 */
export function noteWheelMotion(dx: number, dy: number): void {
  passMotion.dx = dx;
  passMotion.dy = dy;
}

/**
 * A tyre's pass through an oil cell (wear.ts passCell): by chance the oil spreads to the next
 * cell the way the wheel was going.
 * @param cell the oil cell
 */
export function passOilCell(cell: WearCell): void {
  if ((cell.oilGen || 0) <= 1 || Math.random() >= DRAG_SPREAD) return;
  const length = Math.hypot(passMotion.dx, passMotion.dy);
  if (length < 1e-6) return;
  const aheadX = (cell.cx + 0.5) * WEAR_CELL + (passMotion.dx / length) * WEAR_CELL;
  const aheadY = (cell.cy + 0.5) * WEAR_CELL + (passMotion.dy / length) * WEAR_CELL;
  spillOil(aheadX, aheadY, cell.oilGen! - 1);
}

/**
 * Whether the cell at (cellX, cellY) holds water: the tyres' water, or the field's.
 * @param cellX column
 * @param cellY row
 * @returns the cell when it is water, else null
 */
function waterCellAt(cellX: number, cellY: number): WearCell | null {
  const cell = wearMap.get(wearKey(cellX, cellY));
  if (cell) return cell.cover === 'wet' ? cell : null;
  const isWet = fieldCoverAt((cellX + 0.5) * WEAR_CELL, (cellY + 0.5) * WEAR_CELL) === 'wet';
  return isWet ? getCell(cellX, cellY, true) : null;
}

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/**
 * One oil cell next to water: a 50:50 chance its oil runs into one wet neighbour.
 * @param cell the oil cell
 */
function spreadIntoWater(cell: WearCell): void {
  if ((cell.oilGen || 0) <= 1) return;
  const wet: WearCell[] = [];
  for (const [stepX, stepY] of NEIGHBOURS) {
    const near = waterCellAt(cell.cx + stepX, cell.cy + stepY);
    if (near) wet.push(near);
  }
  if (!wet.length || Math.random() >= WATER_SPREAD) return;
  oilCell(wet[Math.floor(Math.random() * wet.length)], cell.oilGen! - 1);
}

/**
 * The oil a physics step: once a SPREAD_TICK_S, oil next to water spreads into it.
 * @param dt the step, s
 */
export function stepOil(dt: number): void {
  if (!oilCells.size) return;
  tickS += dt;
  if (tickS < SPREAD_TICK_S) return;
  tickS = 0;
  for (const cell of [...oilCells]) {
    if (cell.cover !== 'oil' || wearMap.get(wearKey(cell.cx, cell.cy)) !== cell) {
      oilCells.delete(cell);
      continue;
    }
    spreadIntoWater(cell);
  }
}
