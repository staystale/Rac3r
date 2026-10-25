// TREE TRUNKS (?trees=1; owner D): with the reworked trees only a tree's trunk is solid - the cars
// clip under its canopy, which render/trees.ts draws above them. The switch lives here, with the
// trunk's box; the look is render/trees.ts.
import type { Solid } from './types.ts';

// a trunk's solid square, m (a 0.4 m trunk, padded for the wheel arches as the lamp posts are)
const TRUNK_M = 0.7;

let isOn = false;
const trunks = new WeakMap<Solid, Solid>();

/**
 * Turns the reworked trees on or off (?trees=1).
 * @param isWanted true for the reworked trees
 */
export function setTrees(isWanted: boolean): void {
  isOn = isWanted;
}

/**
 * Whether the reworked trees are on.
 * @returns true when on
 */
export function treesOn(): boolean {
  return isOn;
}

/**
 * The box a solid really is: a tree's trunk with the reworked trees, else itself.
 * @param solid the box (world/barriers.ts solidsFromProps)
 * @returns the box to clamp against
 */
export function solidBox(solid: Solid): Solid {
  if (!isOn || solid.kind !== 'tree') return solid;
  let trunk = trunks.get(solid);
  if (!trunk) {
    trunk = { ...solid, w: TRUNK_M, h: TRUNK_M, r: Math.hypot(TRUNK_M, TRUNK_M) / 2 };
    trunks.set(solid, trunk);
  }
  return trunk;
}
