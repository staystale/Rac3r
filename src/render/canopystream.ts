// render/canopystream.ts - THE CANOPY CUT ON THE ENDLESS ROAD (render/canopycut.ts):
// its props and lamps stream - a stretch is laid ahead as the road grows and dropped behind - so
// the still lights' reach cannot be walked once per level. Here it is worked out PER STRETCH: when
// the props list or the lamps change, only the props and lamps not seen before are walked - each
// new tree filed in a grid of its own (the road's list has no fixed indices) and given its gap to
// the still lights near it, each new still light (a lamp's pool, a board) filed and lowering the
// gap of the trees near it - and those no longer in the list are dropped from the grids with them.
// A dropped light leaves its trees' gaps as they were (traced the more: never wrongly left dark).
// The moving lights are noted each frame as on any level (canopycut.ts noteMovingLights).
import { activeLamps } from '../world/lamps.ts';
import { noteStillLightsOf } from './eventglows.ts';
import { CANOPY_STATS, DEFAULT_SIDE_M, MARGIN_PX, STILL_SEARCH_M, lampReachM, noteMovingLights }
  from './canopycut.ts';
import type { CanopyCutInput } from './canopycut.ts';
import type { Prop } from '../world/types.ts';
import type { Lamp } from '../world/lamps.ts';

// m: the side of the stream's grid cells
const CELL_M = 32;
// cell coordinates are offset by this much to make one numeric key of the two
const CELL_OFFSET = 1 << 20;

/** A still light filed in the stream's grid: its centre and reach, m, and what gives it. */
interface StillLight { x: number; y: number; reachM: number; owner: Prop | Lamp }

// the list and lamps last walked (the props list is changed in place: its length and ends too)
const SEEN = {
  props: null as Prop[] | null, count: -1, first: null as Prop | null, last: null as Prop | null,
  lamps: null as Lamp[] | null, walked: new WeakSet<object>(), generation: 0,
  alive: new WeakMap<object, number>(),
};
// the trees and the still lights by cell; each tree's gap to its nearest still light, m; a lamp's
// heads as walked
const GRID = {
  trees: new Map<number, Prop[]>(), lights: new Map<number, StillLight[]>(),
  gapM: new WeakMap<Prop, number>(), heads: new WeakMap<Lamp, number[]>(), sideM: DEFAULT_SIDE_M,
};
// this frame: the stamp of the trees a moving light reaches, and the margin, m
const MOVING = { stamp: 0, marks: new WeakMap<Prop, number>(), marginM: 0 };
// the input this frame (the probe's game, the props list)
let current: CanopyCutInput | null = null;
// the largest still light reach filed so far, m (a floodlight's pool; trees look this far out)
let largestReachM = 0;

/**
 * The grid key of a cell.
 * @param col the cell's column
 * @param row the cell's row
 * @returns the key
 */
const cellKey = (col: number, row: number) => (col + CELL_OFFSET) * 2 * CELL_OFFSET + row
  + CELL_OFFSET;

/**
 * Calls visit with every entry of a grid in the cells under a box.
 * @param grid the grid
 * @param box [left, top, right, bottom], m
 * @param visit called per entry
 */
function visitBox<T>(grid: Map<number, T[]>, box: number[], visit: (entry: T) => void) {
  const col0 = Math.floor(box[0] / CELL_M), col1 = Math.floor(box[2] / CELL_M);
  const row0 = Math.floor(box[1] / CELL_M), row1 = Math.floor(box[3] / CELL_M);
  for (let col = col0; col <= col1; col++) {
    for (let row = row0; row <= row1; row++) {
      const entries = grid.get(cellKey(col, row));
      if (entries) for (let i = 0; i < entries.length; i++) visit(entries[i]);
    }
  }
}

/**
 * Files an entry in a grid's cell at a point.
 * @param grid the grid
 * @param x the point, m
 * @param y the point, m
 * @param entry the entry
 */
function file<T>(grid: Map<number, T[]>, x: number, y: number, entry: T) {
  const key = cellKey(Math.floor(x / CELL_M), Math.floor(y / CELL_M));
  const entries = grid.get(key);
  if (entries) entries.push(entry);
  else grid.set(key, [entry]);
}

/**
 * The gap, m, between a tree's canopy square and a light's square reach.
 * @param tree the tree
 * @param x the light's centre, m
 * @param y the light's centre, m
 * @param reachM its radius, m
 * @returns the gap (negative: overlapping)
 */
function gapTo(tree: Prop, x: number, y: number, reachM: number): number {
  const half = (tree.s || DEFAULT_SIDE_M) / 2;
  return Math.max(Math.abs(tree.x - x), Math.abs(tree.y - y)) - reachM - half;
}

/**
 * A box round a light, m, out past its reach.
 * @param x the light's centre, m
 * @param y the light's centre, m
 * @param pastM the reach plus how far past it, m
 * @returns [left, top, right, bottom]
 */
const boxAround = (x: number, y: number, pastM: number) => {
  const size = pastM + GRID.sideM / 2;
  return [x - size, y - size, x + size, y + size];
};

/**
 * Files a new still light and lowers the gap of the trees near it.
 * @param light the light
 */
function addLight(light: StillLight) {
  file(GRID.lights, light.x, light.y, light);
  visitBox(GRID.trees, boxAround(light.x, light.y, light.reachM + STILL_SEARCH_M), (tree) => {
    const gap = gapTo(tree, light.x, light.y, light.reachM);
    if (gap < (GRID.gapM.get(tree) ?? Infinity)) GRID.gapM.set(tree, gap);
  });
}

/**
 * Files a new tree with its gap to the still lights near it.
 * @param tree the tree
 */
function addTree(tree: Prop) {
  GRID.sideM = Math.max(GRID.sideM, tree.s || 0);
  file(GRID.trees, tree.x, tree.y, tree);
  let gap = Infinity;
  const reachOut = STILL_SEARCH_M + 2 * maxLightReachM();
  visitBox(GRID.lights, boxAround(tree.x, tree.y, reachOut), (light) => {
    gap = Math.min(gap, gapTo(tree, light.x, light.y, light.reachM));
  });
  GRID.gapM.set(tree, gap);
}


/**
 * The largest still light reach filed so far, m.
 * @returns the reach
 */
const maxLightReachM = () => largestReachM;

/**
 * Notes a still light of a lamp or prop.
 * @param owner what gives it
 * @returns note(x, y, reachM)
 */
const stillOf = (owner: Prop | Lamp) => (x: number, y: number, reachM: number) => {
  largestReachM = Math.max(largestReachM, reachM);
  addLight({ x, y, reachM, owner });
};

/**
 * Walks the lamps and props not walked before (a stretch arrived), and drops from the grids what is
 * no longer in the list or the lamps (a stretch left).
 * @param input the frame's input
 */
function refreshStream(input: CanopyCutInput) {
  const props = input.props, lamps = activeLamps();
  const first = props[0] || null, last = props[props.length - 1] || null;
  if (SEEN.props === props && SEEN.count === props.length && SEEN.first === first
    && SEEN.last === last && SEEN.lamps === lamps) return;
  Object.assign(SEEN, { props, count: props.length, first, last, lamps });
  const began = performance.now(), generation = ++SEEN.generation;
  for (const lamp of lamps) {
    SEEN.alive.set(lamp, generation);
    if (SEEN.walked.has(lamp)) continue;
    SEEN.walked.add(lamp);
    GRID.heads.set(lamp, [lamp.headX, lamp.headY, lamp.twinX, lamp.twinY]);
    const note = stillOf(lamp);
    note(lamp.headX, lamp.headY, lampReachM(lamp));
    if (lamp.twin) note(lamp.twinX, lamp.twinY, lampReachM(lamp));
  }
  for (const prop of props) {
    SEEN.alive.set(prop, generation);
    if (SEEN.walked.has(prop)) continue;
    SEEN.walked.add(prop);
    if (prop.kind === 'tree') addTree(prop);
    else noteStillLightsOf(stillOf(prop), prop, input.game);
  }
  dropGone(generation);
  CANOPY_STATS.walkMs = performance.now() - began;
  CANOPY_STATS.walkMostMs = Math.max(CANOPY_STATS.walkMostMs, CANOPY_STATS.walkMs);
  CANOPY_STATS.walks++;
}

/**
 * Whether a tree or a light's owner was in this walk; if not it is forgotten (walked again, as
 * new, should it come back).
 * @param owner the tree, prop or lamp
 * @param generation this walk's
 * @returns true when it stays
 */
function isKept(owner: Prop | Lamp, generation: number): boolean {
  if (SEEN.alive.get(owner) === generation) return true;
  SEEN.walked.delete(owner);
  GRID.gapM.delete(owner as Prop);
  return false;
}

/**
 * Drops from the grids the trees and lights whose owner was not in this walk.
 * @param generation this walk's
 */
function dropGone(generation: number) {
  for (const [key, trees] of GRID.trees) {
    const kept = trees.filter((tree) => isKept(tree, generation));
    if (!kept.length) GRID.trees.delete(key);
    else if (kept.length !== trees.length) GRID.trees.set(key, kept);
  }
  for (const [key, lights] of GRID.lights) {
    const kept = lights.filter((light) => isKept(light.owner, generation));
    if (!kept.length) GRID.lights.delete(key);
    else if (kept.length !== lights.length) GRID.lights.set(key, kept);
  }
}

// the moving light being noted, and its box (reused)
const moving = { x: 0, y: 0, reachM: 0 };
const movingBox = [0, 0, 0, 0];

/**
 * Stamps a tree the moving light being noted reaches.
 * @param tree the tree
 */
function stampTree(tree: Prop) {
  if (gapTo(tree, moving.x, moving.y, moving.reachM) <= MOVING.marginM) {
    MOVING.marks.set(tree, MOVING.stamp);
  }
}

/**
 * Notes a moving light: stamps the trees it reaches this frame.
 * @param x its centre, m
 * @param y its centre, m
 * @param reachM its radius, m
 */
function noteMoving(x: number, y: number, reachM: number) {
  moving.x = x;
  moving.y = y;
  moving.reachM = reachM;
  const size = reachM + MOVING.marginM + GRID.sideM / 2;
  movingBox[0] = x - size;
  movingBox[1] = y - size;
  movingBox[2] = x + size;
  movingBox[3] = y + size;
  visitBox(GRID.trees, movingBox, stampTree);
}

/**
 * Whether a lamp's head is not where the stream's walk found it (a knock moved it).
 * @param lamp the lamp
 * @returns true when moved
 */
function isHeadMoved(lamp: Lamp): boolean {
  const heads = GRID.heads.get(lamp);
  return !heads || lamp.headX !== heads[0] || lamp.headY !== heads[1] || lamp.twinX !== heads[2]
    || lamp.twinY !== heads[3];
}

/**
 * Whether a tree's canopy may hold light this frame.
 * @param index the tree's index in the props
 * @returns true to trace it
 */
function isStreamCanopyLit(index: number): boolean {
  const tree = current!.props[index];
  return (GRID.gapM.get(tree) ?? -Infinity) <= MOVING.marginM
    || MOVING.marks.get(tree) === MOVING.stamp;
}

/**
 * The canopies the dark must go back over this frame on the endless road, as a test
 * on a tree's index; null to trace them all (a map too coarse for the still lights' walk).
 * @param input the frame's input
 * @returns the test, or null
 */
export function streamCanopiesLit(input: CanopyCutInput): ((index: number) => boolean) | null {
  if (!(input.artPerMetre > 0)) return null;
  const marginM = MARGIN_PX / input.artPerMetre;
  if (marginM > STILL_SEARCH_M) return null;
  current = input;
  refreshStream(input);
  MOVING.marginM = marginM;
  MOVING.stamp = (MOVING.stamp + 1) >>> 0 || 1;
  noteMovingLights(input, noteMoving, SEEN.lamps || [], isHeadMoved);
  return isStreamCanopyLit;
}
