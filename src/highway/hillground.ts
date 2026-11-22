// highway/hillground.ts - THE HILL CLIMB'S GROUND (?hillclimb; highway/hillplan.ts): the road
// rises along its length (riseAt), and the ground off it is the hillside between the road's legs.
// Heights from the nearest road point alone made a cliff halfway between two switchback legs
// (30-60 m apart, their rises 4-26 m apart): here the ground off the road is blended from the
// nearest point of each part of the road within BLEND_M (inverse distance), on a grid of
// CELL_M cells built as the road grows, eased in from the road's own rise over EASE_M past its
// edge. DROPS: past the verge on the outside of a bend tighter than DROP_R_M (not in a switchback
// cluster: there the outside is the hillside up to the next leg) the ground falls away DROP_M -
// over the edge is a fall (the world's reset).
import type { HwLevel } from './hwtypes.ts';
import { hillStretchAt, riseAt } from './hillplan.ts';
import { STEP } from './presets.ts';
import { REACH } from './gorge.ts';

// m: a grid cell's side; how far a road point shapes the ground; the parts of the road one cell
// keeps apart (one nearest point each), m along the road; the ease from the road's rise to the
// hillside past its edge
const CELL_M = 4, BLEND_M = 100, PART_M = 60, EASE_M = 8;
// the far ground's weight in a cell (tiny: only where no part reaches)
const FAR_WEIGHT = 1e-7;
// m: the drop's depth, the verge before it, the width it falls over; the bends that have one
// (their radius under this, m)
const DROP_M = 25, DROP_VERGE_M = 1.5, DROP_FALL_M = 3, DROP_R_M = 150;
// m: no drop where another part of the road (this far along it) comes within DROP_CLEAR_M; a drop
// eased in and out over DROP_EASE_M of road; it eases back up over DROP_BACK_M before the reach
const DROP_APART_M = 150, DROP_CLEAR_M = 120, DROP_EASE_M = 40, DROP_BACK_M = 12;

/** A grid cell: per part of the road its nearest point's distance and rise; its blended height. */
interface Cell { parts: number[]; dists: number[]; rises: number[]; height: number | null }

/** One road's hillside: its cells, its far rows, the road distance laid up to, its finish line. */
interface Hillside { cells: Map<number, Cell>; rows: Map<number, { sum: number; count: number }>;
  laidS: number; finishS: number }

// m: a far row's depth up the screen (FAR GROUND: past the hillside, the road's average rise
// along each row - the hill rising as the road climbs up the screen)
const FAR_ROW_M = 20;

const KEY_ROW = 1 << 16, KEY_MID = 1 << 15;
const keyOf = (cellX: number, cellY: number) => (cellX + KEY_MID) * KEY_ROW + cellY + KEY_MID;

/**
 * Adds one road point to the cells round it (each keeps, per part of the road, the nearest point).
 * @param side the hillside
 * @param point the road point (its place and road distance)
 * @param rise its rise, m
 */
function layPoint(side: Hillside, point: { x: number; y: number; s: number }, rise: number) {
  const part = Math.floor(point.s / PART_M), reach = Math.ceil(BLEND_M / CELL_M);
  const baseX = Math.round(point.x / CELL_M), baseY = Math.round(point.y / CELL_M);
  for (let cellX = baseX - reach; cellX <= baseX + reach; cellX++) {
    for (let cellY = baseY - reach; cellY <= baseY + reach; cellY++) {
      const dist = Math.hypot(cellX * CELL_M - point.x, cellY * CELL_M - point.y);
      if (dist > BLEND_M) continue;
      const key = keyOf(cellX, cellY);
      let cell = side.cells.get(key);
      if (!cell) side.cells.set(key, (cell = { parts: [], dists: [], rises: [], height: null }));
      const slot = cell.parts.indexOf(part);
      if (slot < 0) {
        cell.parts.push(part);
        cell.dists.push(dist);
        cell.rises.push(rise);
      } else if (dist < cell.dists[slot]) {
        cell.dists[slot] = dist;
        cell.rises[slot] = rise;
      } else continue;
      cell.height = null;
    }
  }
}

/**
 * A cell's height: its parts' rises, each weighted by its nearest point's inverse distance (less
 * BLEND_M's), and the far ground's a little. (By the inverse distance squared each part held its
 * rise out to the middle and the hillside fell in a band there: 118 of 1125 points between two
 * parts past a 0.75 slope, _hillclimb.mjs - now linear between two parts.)
 * @param cell the cell
 * @param far the far ground there, m
 * @returns m
 */
function cellHeight(cell: Cell, far: number): number {
  if (cell.height !== null) return cell.height;
  // (each part's weight falls to none at BLEND_M, where the far ground takes over: no step)
  let sum = FAR_WEIGHT * far, weights = FAR_WEIGHT;
  for (let i = 0; i < cell.parts.length; i++) {
    const weight = Math.max(0, 1 / Math.max(1, cell.dists[i]) - 1 / BLEND_M);
    sum += weight * cell.rises[i];
    weights += weight;
  }
  return (cell.height = sum / weights);
}

/**
 * The hillside's height at a point, bilinear between the four cells round it (a cell not laid: the
 * far ground).
 * @param side the hillside
 * @param x world x, m
 * @param y world y, m
 * @returns m
 */
function hillsideAt(side: Hillside, x: number, y: number): number {
  const gridX = x / CELL_M, gridY = y / CELL_M, cellX = Math.floor(gridX),
    cellY = Math.floor(gridY), fracX = gridX - cellX, fracY = gridY - cellY;
  const corner = (offX: number, offY: number) => side.cells.get(keyOf(cellX + offX, cellY + offY));
  const far = farAt(side, y);
  const heightOf = (cell: Cell | undefined) => (cell ? cellHeight(cell, far) : far);
  return (heightOf(corner(0, 0)) * (1 - fracX) + heightOf(corner(1, 0)) * fracX) * (1 - fracY)
    + (heightOf(corner(0, 1)) * (1 - fracX) + heightOf(corner(1, 1)) * fracX) * fracY;
}

/**
 * The far ground at a world y: the road's average rise on that row up the screen, between rows
 * linear, past the laid ones the nearest.
 * @param side the hillside
 * @param y world y, m
 * @returns m
 */
function farAt(side: Hillside, y: number): number {
  const rowF = y / FAR_ROW_M, row = Math.floor(rowF), frac = rowF - row;
  const mean = (key: number): number | null => {
    const known = side.rows.get(key);
    return known ? known.sum / known.count : null;
  };
  const low = mean(row), high = mean(row + 1);
  if (low !== null && high !== null) return low + (high - low) * frac;
  if (low !== null || high !== null) return (low ?? high)!;
  // (off the laid rows: the nearest laid row's)
  let best = 0, bestGap = Infinity;
  for (const [key, known] of side.rows) {
    if (Math.abs(key - rowF) >= bestGap) continue;
    bestGap = Math.abs(key - rowF);
    best = known.sum / known.count;
  }
  return best;
}

/**
 * Lays the road points grown since the last call onto the hillside.
 * @param level the highway level
 * @param side the hillside
 */
function layNewRoad(level: HwLevel, side: Hillside) {
  const pts = level._hw.pts;
  let first = pts.length;
  while (first > 0 && pts[first - 1].s > side.laidS) first--;
  for (let i = first; i < pts.length; i++) {
    const rise = riseAt(pts[i].s, level._hw.seed, side.finishS);
    layPoint(side, pts[i], rise);
    const row = Math.round(pts[i].y / FAR_ROW_M), known = side.rows.get(row);
    if (known) {
      known.sum += rise;
      known.count++;
    } else side.rows.set(row, { sum: rise, count: 1 });
  }
  if (pts.length) side.laidS = Math.max(side.laidS, pts[pts.length - 1].s);
}

/**
 * The hill climb's climb (world/types.ts Level.climb): on the road its own rise at its road
 * distance; past its edge eased into the hillside (the blended grid; none laid yet: the road's).
 * @param level the highway level
 * @param finishS the finish line's road distance, m
 * @returns the climb
 */
export function hillClimbOf(level: HwLevel, finishS: number) {
  const side: Hillside = { cells: new Map(), rows: new Map(), laidS: -Infinity, finishS };
  return (dist: number, x: number, y: number, outM: number): number => {
    if (level._hw.pts.length && level._hw.pts[level._hw.pts.length - 1].s > side.laidS)
      layNewRoad(level, side);
    // (past the road lookup's reach: the hillside, the far ground past that)
    if (Number.isNaN(dist)) return hillsideAt(side, x, y);
    const road = riseAt(dist, level._hw.seed, finishS);
    if (outM <= 0) return road;
    const hill = hillsideAt(side, x, y);
    const ease = Math.min(1, outM / EASE_M), smooth = ease * ease * (3 - 2 * ease);
    return road + (hill - road) * smooth;
  };
}

/**
 * The road's curvature at a road distance (its nearest laid point), 1/m.
 * @param level the highway level
 * @param dist road distance, m
 * @returns 1/m (+ turning one way, - the other), 0 off the laid road
 */
function curvatureAt(level: HwLevel, dist: number): number {
  const pts = level._hw.pts;
  if (pts.length < 3) return 0;
  const i = Math.round((dist - pts[0].s) / STEP);
  if (i < 1 || i >= pts.length - 1) return 0;
  const before = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x),
    after = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
  return Math.atan2(Math.sin(after - before), Math.cos(after - before)) / STEP;
}

/**
 * The hill climb's ground off the road (world/types.ts Level.roadside): a DROP past the verge on
 * the outside of a bend tighter than DROP_R_M, outside the switchback clusters.
 * @param level the highway level
 * @returns the roadside (road distance, offset across - + the left -, half width), m
 */
export function hillRoadsideOf(level: HwLevel) {
  const open = new Map<number, boolean>();
  return (dist: number, offset: number, halfWidth: number): number => {
    const past = Math.abs(offset) - halfWidth - DROP_VERGE_M;
    if (past <= 0 || hillStretchAt(dist, level._hw.seed).kind === 'switchbacks') return 0;
    const curv = curvatureAt(level, dist);
    // (the outside: the side the bend turns away from; + offset the left)
    if (Math.abs(curv) < 1 / DROP_R_M || Math.sign(offset) === Math.sign(curv)) return 0;
    const clear = dropClear(level, open, dist);
    if (clear <= 0) return 0;
    // (it falls past the verge, and eases back up before the road's lookup ends - as Deaf
    // Valley's gorges: no step at REACH)
    const fall = smooth(past / DROP_FALL_M), back = smooth((past - (REACH - DROP_VERGE_M
      - DROP_BACK_M - 2)) / DROP_BACK_M);
    return -DROP_M * fall * (1 - back) * clear;
  };
}

/** 0..1 eased (a smoothstep), clamped. */
const smooth = (share: number) => {
  const clamped = Math.max(0, Math.min(1, share));
  return clamped * clamped * (3 - 2 * clamped);
};

/**
 * Whether a drop may fall away at a road distance: none where another part of the road (more than
 * DROP_APART_M along it) comes within DROP_CLEAR_M - there the ground is the hillside to it (a drop
 * there met the other part's ground in a cliff) - eased in and out over DROP_EASE_M of road.
 * @param level the highway level
 * @param open the road points known clear (by road distance)
 * @param dist road distance, m
 * @returns 0..1
 */
function dropClear(level: HwLevel, open: Map<number, boolean>, dist: number): number {
  let clear = 1;
  for (let along = -DROP_EASE_M; along <= DROP_EASE_M; along += STEP) {
    if (!isOpenAt(level, open, Math.round((dist + along) / STEP) * STEP))
      clear = Math.min(clear, Math.abs(along) / DROP_EASE_M);
  }
  return clear;
}

/**
 * Whether no other part of the road comes near a road point (cached by its road distance).
 * @param level the highway level
 * @param open the cache
 * @param dist the road point's distance, m
 * @returns clear (off the laid road: not)
 */
function isOpenAt(level: HwLevel, open: Map<number, boolean>, dist: number): boolean {
  const known = open.get(dist);
  if (known !== undefined) return known;
  const pts = level._hw.pts, i = Math.round((dist - (pts[0]?.s ?? 0)) / STEP);
  if (i < 0 || i >= pts.length) return false;
  const here = pts[i];
  const clear = !pts.some((other) => Math.abs(other.s - here.s) > DROP_APART_M
    && Math.hypot(other.x - here.x, other.y - here.y) < DROP_CLEAR_M);
  // (only once the road past it is laid far enough to tell)
  if (pts[pts.length - 1].s > dist + DROP_APART_M + DROP_CLEAR_M) open.set(dist, clear);
  return clear;
}

// the WORST CORNERS (owner 11-22: barriers only there): armco on the outside of a bend tighter
// than this radius (m), off the switchback clusters, this far off the road's edge (m)
const WORST_R_M = 55, ARMCO_GAP_M = 0.8;

/**
 * The hill climb's barriers (highway/dress.ts layWalls): armco on the outside of the worst corners
 * - the same side the drop falls away (hillRoadsideOf) -, nowhere else.
 * @param level the highway level
 * @returns the wall by road distance and side (dress.ts pointAt: + the side a positive curvature
 *   turns toward), or none
 */
export function hillWallOf(level: HwLevel) {
  return (dist: number, side: number): { kind: 'armco'; gap: number } | null => {
    if (hillStretchAt(dist, level._hw.seed).kind === 'switchbacks') return null;
    const curv = curvatureAt(level, dist);
    return Math.abs(curv) > 1 / WORST_R_M && Math.sign(side) !== Math.sign(curv)
      ? { kind: 'armco', gap: ARMCO_GAP_M } : null;
  };
}
