// ICE CRACKS (owner: ice cracks when driven - semi-random, spreading over connected
// ice; cracked ice has more grip and degrades faster). A wear cell's ice carries a CRACK, 0..1:
// each pass over it adds some, by chance, more the nearer the ice is to melting (and a sliding
// wheel's pass counts twice, wear.ts); a cracked cell spreads its cracks to the ice cells beside
// it, fainter each step (from a fully cracked cell about two cells out, ~3 m). Cracked ice grips
// more (CRACK_GRIP at a full crack), breaks through to water in fewer passes and a shorter
// slide, and melts faster above freezing (puddles.ts). The GPU field draws it as ice with a
// crack network (render/glfield.ts). The level's fixed ice (frozen scenery water) does not crack.
import { snowTempC } from "./weather.ts";
import type { Surface, WearCell } from "./types.ts";

// a pass's crack at CRACK_WARM_C and warmer, and at CRACK_COLD_C and colder (brittle cold ice
// takes more passes), times a chance of 0.5..1.5
const CRACK_PER_PASS_WARM = 0.2, CRACK_PER_PASS_COLD = 0.08, CRACK_WARM_C = 0, CRACK_COLD_C = -15;
// a cell spreads from this crack, by a chance a second of CRACK_SPREAD_PER_S x its crack, to one
// neighbour, which takes CRACK_SPREAD_FADE of it
const CRACK_SPREAD_FROM = 0.35, CRACK_SPREAD_PER_S = 0.5, CRACK_SPREAD_FADE = 0.6;
// at a full crack: grip x (1 + CRACK_GRIP); passes to break through ICE_WEAR - CRACK_PASSES; the
// break-through chance x (1 + CRACK_WATER); the slide to scrub it x (1 - CRACK_SCRUB); melting
// x (1 + CRACK_MELT)
const CRACK_GRIP = 0.5, CRACK_PASSES = 2, CRACK_WATER = 1, CRACK_SCRUB = 0.5, CRACK_MELT = 1;
// the crack is drawn and felt in CRACK_STEPS steps
export const CRACK_STEPS = 4;
// the four neighbours a crack spreads to
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const crackedSurfaces = new Map<string, Surface>();

/**
 * A cell's crack in steps, 0 (none) .. CRACK_STEPS (fully cracked); 0 for anything but ice.
 * @param cell the wear cell
 * @returns the step
 */
export function crackStep(cell: WearCell): number {
  if (cell.cover !== 'ice' || cell.fixed) return 0;
  return Math.ceil((cell.crack || 0) * CRACK_STEPS - 1e-9);
}

/**
 * Whether a cell's ice is cracked.
 * @param cell the wear cell
 * @returns true when cracked
 */
export function isCracked(cell: WearCell): boolean {
  return crackStep(cell) > 0;
}

/**
 * Sets a cell's crack, marking it for repainting when its drawn step changes.
 * @param cell the wear cell
 * @param crack the new crack, 0..1
 * @param dirty the cells to repaint (wear.ts wearDirty)
 */
function setCrack(cell: WearCell, crack: number, dirty: WearCell[]): void {
  const before = crackStep(cell);
  cell.crack = Math.min(1, crack);
  if (crackStep(cell) !== before) dirty.push(cell);
}

/**
 * One pass over a cell's ice cracks it a little more (by chance; more near melting).
 * @param cell the wear cell (its cover ice)
 * @param dirty the cells to repaint (wear.ts wearDirty)
 */
export function crackPass(cell: WearCell, dirty: WearCell[]): void {
  if (cell.cover !== 'ice' || cell.fixed) return;
  const warmth = Math.max(0, Math.min(1,
    (snowTempC() - CRACK_COLD_C) / (CRACK_WARM_C - CRACK_COLD_C)));
  const perPass = CRACK_PER_PASS_COLD + (CRACK_PER_PASS_WARM - CRACK_PER_PASS_COLD) * warmth;
  setCrack(cell, (cell.crack || 0) + perPass * (0.5 + Math.random()), dirty);
}

/**
 * The passes a cell's ice takes to break through, fewer when cracked.
 * @param cell the wear cell
 * @param passes the uncracked ice's passes (snowwear.ts ICE_WEAR)
 * @returns the passes
 */
export function crackWearPasses(cell: WearCell, passes: number): number {
  return passes - Math.round(CRACK_PASSES * crackShare(cell));
}

/**
 * How much likelier cracked ice breaks through to water on its pass.
 * @param cell the wear cell
 * @returns the factor (1 uncracked)
 */
export function crackWaterFactor(cell: WearCell): number {
  return 1 + CRACK_WATER * crackShare(cell);
}

/**
 * The share of the slide that scrubs cracked ice through.
 * @param cell the wear cell
 * @returns the factor (1 uncracked)
 */
export function crackScrubFactor(cell: WearCell): number {
  return 1 - CRACK_SCRUB * crackShare(cell);
}

/**
 * How much faster cracked ice melts above freezing.
 * @param cell the wear cell
 * @returns the factor (1 uncracked)
 */
export function crackMeltFactor(cell: WearCell): number {
  return 1 + CRACK_MELT * crackShare(cell);
}

/**
 * A cell's crack as felt and drawn, 0..1 in CRACK_STEPS steps.
 * @param cell the wear cell
 * @returns the share
 */
function crackShare(cell: WearCell): number {
  return crackStep(cell) / CRACK_STEPS;
}

/**
 * What a tyre feels on a cell's ice: the ice grips more the more it is cracked (a cached
 * variant of the ice surface per step).
 * @param ice the ice surface (it may already be damp)
 * @param cell the wear cell
 * @returns the surface
 */
export function crackedIce(ice: Surface, cell: WearCell): Surface {
  const step = crackStep(cell);
  if (!step) return ice;
  const key = `${ice.id}|${ice.mu}|${step}`;
  let surface = crackedSurfaces.get(key);
  if (!surface) {
    surface = { ...ice, mu: ice.mu * (1 + CRACK_GRIP * step / CRACK_STEPS) };
    crackedSurfaces.set(key, surface);
  }
  return surface;
}

/**
 * The cracked cells that spread this tick (by chance, more the more cracked), with their crack;
 * a cell whose ice has gone loses its cracks.
 * @param cells the wear cells
 * @param seconds sim seconds since the last tick
 * @param random the event's seeded stream
 * @returns the spreading cells and their cracks
 */
function cellsSpreading(cells: Iterable<WearCell>, seconds: number,
    random: () => number): [WearCell, number][] {
  const spreads: [WearCell, number][] = [];
  for (const cell of cells) {
    // ice gone (melted, scrubbed, broken through) takes its cracks: new ice starts whole
    if (cell.crack && cell.cover !== 'ice') cell.crack = 0;
    const crack = cell.cover === 'ice' && !cell.fixed ? cell.crack || 0 : 0;
    if (crack < CRACK_SPREAD_FROM || random() >= CRACK_SPREAD_PER_S * crack * seconds) continue;
    spreads.push([cell, crack]);
  }
  return spreads;
}

/**
 * Cracks spread over connected ice (a tick): a cracked cell, by chance, cracks one of its four
 * neighbours that holds ice, fainter than itself. New cells are made where the ice lies.
 * @param cells the wear cells
 * @param cellAt the cell of a square, made from the ground there if new (wear.ts getCell)
 * @param seconds sim seconds since the last tick
 * @param random the event's seeded stream (weather.ts weatherRandom)
 * @param dirty the cells to repaint (wear.ts wearDirty)
 */
export function spreadCracks(cells: Iterable<WearCell>,
    cellAt: (cellX: number, cellY: number) => WearCell | null, seconds: number,
    random: () => number, dirty: WearCell[]): void {
  // applied after the walk: the new cells it makes are not walked in the same tick
  for (const [cell, crack] of cellsSpreading(cells, seconds, random)) {
    const [stepX, stepY] = NEIGHBOURS[Math.floor(random() * NEIGHBOURS.length)];
    const next = cellAt(cell.cx + stepX, cell.cy + stepY);
    if (!next || next.cover !== 'ice' || next.fixed) continue;
    const spread = crack * CRACK_SPREAD_FADE;
    if (spread > (next.crack || 0)) setCrack(next, spread, dirty);
  }
}
