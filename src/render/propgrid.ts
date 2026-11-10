// The PROP GRID of the renderer: the level's props filed by 32 m cell, so a frame tests only the
// props in the cells round the screen instead of every prop, twice (props.ts draws an under-cars
// and an overhead layer). MEASURED (11-10): Spa in the forest (?spaforest=1) has 8000 trees and
// both layers walked all of them every frame. The props are still drawn in list order and each
// still passes props.ts propVisible, so the same props are drawn, in the same order (renderhash).
import type { Prop } from '../world/types.ts';
import type { View } from './types.ts';

const CELL_M = 32;
// at most this many cells (bigger cells on a level spread wider)
const MAX_CELLS = 1 << 16;
// a prop that reaches further than this is tested every frame (it would fill too many cells)
const WIDE_M = 256;
// a screen over more of the grid's cells than this share walks the whole list (zoomed far out)
const MOST_CELLS = 0.5;
// metres added round the screen's box: float rounding never loses a prop at its edge
const SLACK_M = 1;

/** the props of a level, filed by cell (cell c holds items[starts[c] .. starts[c + 1])) */
interface PropGrid {
  props: Prop[];
  count: number;
  left: number;
  top: number;
  cell: number;
  cols: number;
  rows: number;
  starts: Int32Array;
  items: Int32Array;
  /** props drawn without the on-screen test (a slip, a garage row), or too wide, or not placed */
  always: Int32Array;
  /** the query of this frame: each prop's stamp, and the props found */
  seen: Uint32Array;
  stamp: number;
  found: Int32Array;
}

let grid: PropGrid | null = null;

/**
 * How far past its place a prop is still drawn, in metres, beyond the 150 px every prop gets
 * (props.ts propVisible: its size x 0.75 with an 18 m floor, or its reach).
 * @param prop the prop
 * @returns the reach in metres
 */
function reachOf(prop: Prop) {
  return Math.max(
    Math.max(prop.w || 0, prop.h || 0, prop.size || 0, prop.wid || 0, prop.s || 0, 18) * 0.75,
    prop.reach || 0,
  );
}

/**
 * Whether a prop is tested every frame rather than filed in the cells.
 * @param prop the prop
 * @param reach its reach
 * @returns true for one
 */
const alwaysTested = (prop: Prop, reach: number) => prop.kind === 'garagerow'
  || prop.kind === 'slip' || !(reach <= WIDE_M) || !Number.isFinite(prop.x)
  || !Number.isFinite(prop.y);

/**
 * Files the props by cell: each into every cell its reach box overlaps.
 * @param props the level's props
 * @returns the grid
 */
function buildGrid(props: Prop[]): PropGrid {
  const reach = props.map(reachOf), always: number[] = [];
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  props.forEach((prop, idx) => {
    if (alwaysTested(prop, reach[idx])) { always.push(idx); return; }
    left = Math.min(left, prop.x - reach[idx]); right = Math.max(right, prop.x + reach[idx]);
    top = Math.min(top, prop.y - reach[idx]); bottom = Math.max(bottom, prop.y + reach[idx]);
  });
  const filed = always.length < props.length, wide = right - left, tall = bottom - top;
  const cell = filed ? Math.max(CELL_M, Math.ceil(Math.sqrt(wide * tall / MAX_CELLS))) : CELL_M;
  const cols = filed ? Math.floor(wide / cell) + 1 : 0;
  const rows = filed ? Math.floor(tall / cell) + 1 : 0;
  const starts = new Int32Array(cols * rows + 1);
  const isAlways = new Uint8Array(props.length);
  for (const idx of always) isAlways[idx] = 1;
  // count each cell's props, then lay them out cell after cell, in list order within a cell
  const eachCell = (visit: (into: number, idx: number) => void) => props.forEach((prop, idx) => {
    if (isAlways[idx]) return;
    const col0 = Math.floor((prop.x - reach[idx] - left) / cell);
    const col1 = Math.floor((prop.x + reach[idx] - left) / cell);
    const row0 = Math.floor((prop.y - reach[idx] - top) / cell);
    const row1 = Math.floor((prop.y + reach[idx] - top) / cell);
    for (let j = row0; j <= row1; j++) for (let i = col0; i <= col1; i++) visit(j * cols + i, idx);
  });
  eachCell((into) => { starts[into + 1]++; });
  for (let into = 0; into < cols * rows; into++) starts[into + 1] += starts[into];
  const items = new Int32Array(starts[cols * rows]), fill = starts.slice(0, cols * rows);
  eachCell((into, idx) => { items[fill[into]++] = idx; });
  return {
    props, count: props.length, left, top, cell, cols, rows, starts, items,
    always: Int32Array.from(always), seen: new Uint32Array(props.length), stamp: 0,
    found: new Int32Array(props.length),
  };
}

/**
 * The props that may be on screen, in list order: those filed in the cells under the screen's
 * world box grown by 150 px (each filed prop sits in every cell its reach covers), and the always
 * tested ones. Null when the grid saves nothing (zoomed far out): walk the whole list.
 * @param props the level's props (built into the grid on first use, again when the list changes)
 * @param screen the screen's world box, 150 px round it included
 * @param screen.left the left world edge
 * @param screen.top the top world edge
 * @param screen.right the right world edge
 * @param screen.bottom the bottom world edge
 * @returns the props' indices, ascending, or null
 */
export function propsNear(
  props: Prop[], screen: { left: number; top: number; right: number; bottom: number },
): Int32Array | null {
  if (!grid || grid.props !== props || grid.count !== props.length) grid = buildGrid(props);
  const near = grid;
  const col0 = Math.max(0, Math.floor((screen.left - SLACK_M - near.left) / near.cell));
  const col1 = Math.min(near.cols - 1,
    Math.floor((screen.right + SLACK_M - near.left) / near.cell));
  const row0 = Math.max(0, Math.floor((screen.top - SLACK_M - near.top) / near.cell));
  const row1 = Math.min(near.rows - 1,
    Math.floor((screen.bottom + SLACK_M - near.top) / near.cell));
  if (col1 < col0 || row1 < row0) return near.always;     // the screen is off the grid
  // NaN (an unmeasured screen) fails this test too: walk the whole list
  const cells = (col1 - col0 + 1) * (row1 - row0 + 1);
  if (!(cells <= near.cols * near.rows * MOST_CELLS)) return null;
  near.stamp = (near.stamp + 1) >>> 0 || 1;
  if (near.stamp === 1) near.seen.fill(0);
  let count = 0;
  for (let j = row0; j <= row1; j++) {
    for (let i = col0; i <= col1; i++) {
      const into = j * near.cols + i;
      for (let item = near.starts[into]; item < near.starts[into + 1]; item++) {
        const idx = near.items[item];
        if (near.seen[idx] === near.stamp) continue;
        near.seen[idx] = near.stamp; near.found[count++] = idx;
      }
    }
  }
  for (const idx of near.always) near.found[count++] = idx;
  return near.found.subarray(0, count).sort();
}

/**
 * The world box of the screen grown by some pixels each side - the inverse of the renderer's
 * toScreenX / toScreenY (a scale and a shift on each axis).
 * @param view the canvas view (W, H)
 * @param toScreenX world x -> screen x
 * @param toScreenY world y -> screen y
 * @param padPx the pixels added round the screen
 * @returns the box (NaN if the projection is degenerate)
 */
export function screenBox(
  view: View, toScreenX: (wx: number) => number, toScreenY: (wy: number) => number,
  padPx: number,
) {
  const atX0 = toScreenX(0), perX = toScreenX(1) - atX0;
  const atY0 = toScreenY(0), perY = toScreenY(1) - atY0;
  const xLow = (-padPx - atX0) / perX, xHigh = (view.W + padPx - atX0) / perX;
  const yLow = (-padPx - atY0) / perY, yHigh = (view.H + padPx - atY0) / perY;
  const sane = Number.isFinite(xLow + xHigh + yLow + yHigh);
  return {
    left: sane ? Math.min(xLow, xHigh) : NaN, right: sane ? Math.max(xLow, xHigh) : NaN,
    top: sane ? Math.min(yLow, yHigh) : NaN, bottom: sane ? Math.max(yLow, yHigh) : NaN,
  };
}
