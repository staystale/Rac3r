// world/torn.ts - WHICH TORN PANELS LEAVE A PIECE HANGING (the drawing: render/torncut.ts; with
// ?dmgmore2 the sim drags them: world/hanging.ts). Seeded per car corner and part, the same every
// frame and on every machine.

/**
 * A seeded 0..range-1 per (first, second).
 * @param first a number
 * @param second a number
 * @param range the count
 * @returns 0..range-1
 */
export const tornHash = (first: number, second: number, range: number) =>
  (((first * 73856093) ^ (second * 19349663)) >>> 0) % range;

/**
 * A lost part's seed: its kind and corner.
 * @param kind the part
 * @param corner its damage corner
 * @returns the seed
 */
export const tornSeed = (kind: string, corner: number) => corner * 7 + kind.length * 131;

/**
 * Whether a lost part leaves a piece hanging on (two times in three; never a bonnet or boot lid).
 * @param kind the part
 * @param corner its damage corner
 * @returns it hangs
 */
export const partHangs = (kind: string, corner: number) => kind !== 'bonnet' && kind !== 'boot'
  && tornHash(tornSeed(kind, corner), 5, 3) !== 0;
