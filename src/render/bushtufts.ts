// BUSH TUFTS (owner: bushes "poke up past / over the car sometimes"): a few leaf
// squares of each bush drawn ABOVE the cars, in the overhead pass (render/props.ts; the art-pixel
// buffer, so they are pixel squares like the tree canopies, and drawn under the canopies). Over
// an empty bush they are just more of its leaves; a car pushing through shows leaves over its
// body, partly hidden. A tuft goes with the ground under it: once its cell is flattened (wear.ts:
// no longer 'bush') it is not drawn.
import { LEVEL } from '../world/state.ts';
import { WEAR_CELL, wearKey, wearMap } from '../world/wear.ts';
import { BUSH_LOOKS } from './ground/bushes.ts';
import type { Patch } from '../world/types.ts';
import type { PropCtx } from './props/types.ts';

/** One leaf square over the cars. */
interface Tuft {
  x: number;   // centre, world m
  y: number;
  side: number;   // m
  colour: string;
  cell: number;   // its wear cell's key (wear.ts wearKey)
}

// tufts a bush, at least / at most (by its seed)
const TUFTS_MIN = 3, TUFTS_MAX = 6;
// a tuft's side, a share of the bush's side
const TUFT_MIN = 0.16, TUFT_MAX = 0.28;
// tufts stay this share of the side inside the bush's edge
const TUFT_INSET = 0.12;

const tuftsOf = new WeakMap<Patch, Tuft[]>();

/**
 * A bush's 0..1 share from its position (stable per bush and salt).
 * @param patch the bush
 * @param salt a different share per use
 * @returns the share
 */
function bushShare(patch: Patch, salt: number): number {
  const value = Math.sin(patch.x * 12.9898 + patch.y * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * A bush's tufts: a few squares inside it, in its clumps', lit and base greens.
 * @param patch the bush
 * @returns the tufts
 */
function makeTufts(patch: Patch): Tuft[] {
  const look = BUSH_LOOKS[patch.art || 'bush'] || BUSH_LOOKS.bush;
  const colours = [look.clumps, look.lit, look.base];
  const count = TUFTS_MIN + Math.floor(bushShare(patch, 1) * (TUFTS_MAX - TUFTS_MIN + 1));
  const tufts: Tuft[] = [];
  for (let i = 0; i < count; i++) {
    const side = patch.w * (TUFT_MIN + bushShare(patch, 10 + i) * (TUFT_MAX - TUFT_MIN));
    const room = patch.w * (1 - 2 * TUFT_INSET) - side;
    const x = patch.x - room / 2 + bushShare(patch, 20 + i) * room;
    const y = patch.y - room / 2 + bushShare(patch, 30 + i) * room;
    tufts.push({ x, y, side, colour: colours[i % colours.length],
      cell: wearKey(Math.floor(x / WEAR_CELL), Math.floor(y / WEAR_CELL)) });
  }
  return tufts;
}

/**
 * Draws the tufts of every bush on screen, above the cars (the overhead pass).
 * @param propCtx the props painter context
 * @param ppm px a metre
 */
export function drawBushTufts(propCtx: PropCtx, ppm: number): void {
  const list = LEVEL._bushes;
  if (!list || !list.length) return;
  const { view, toScreenX, toScreenY } = propCtx;
  for (const patch of list) {
    const screenX = toScreenX(patch.x), screenY = toScreenY(patch.y), reach = patch.w * ppm;
    if (screenX < -reach || screenX > view.W + reach || screenY < -reach
      || screenY > view.H + reach) continue;
    let tufts = tuftsOf.get(patch);
    if (!tufts) {
      tufts = makeTufts(patch);
      tuftsOf.set(patch, tufts);
    }
    for (const tuft of tufts) {
      const cell = wearMap.get(tuft.cell);
      if (cell && cell.base !== 'bush') continue;
      view.ctx.fillStyle = tuft.colour;
      view.ctx.fillRect(toScreenX(tuft.x - tuft.side / 2), toScreenY(tuft.y - tuft.side / 2),
        tuft.side * ppm, tuft.side * ppm);
    }
  }
}
