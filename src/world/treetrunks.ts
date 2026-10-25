// TREE TRUNKS (owner D): only a tree's trunk is solid - the cars clip under its canopy, which
// render/trees.ts draws above them; the look is render/trees.ts.
import type { Solid } from './types.ts';

// a trunk's solid square, m (a 0.4 m trunk, padded for the wheel arches as the lamp posts are)
const TRUNK_M = 0.7;

const trunks = new WeakMap<Solid, Solid>();

/**
 * The box a solid really is: a tree's trunk, else itself.
 * @param solid the box (world/barriers.ts solidsFromProps)
 * @returns the box to clamp against
 */
export function solidBox(solid: Solid): Solid {
  if (solid.kind !== 'tree') return solid;
  let trunk = trunks.get(solid);
  if (!trunk) {
    trunk = { ...solid, w: TRUNK_M, h: TRUNK_M, r: Math.hypot(TRUNK_M, TRUNK_M) / 2 };
    trunks.set(solid, trunk);
  }
  return trunk;
}
