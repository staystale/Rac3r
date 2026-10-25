// shared by render.ts and src/render/*.js
// art px per metre: a 4 m hatch is 69 px, the reference is ~70
export const SPRITE_PPM = 17.3;

// THE LOOKS' OWN RANDOM NUMBERS (a hash of a count). Drawing never draws from Math.random: the
// tools seed ONE Math.random for the page, so a look that used it (how many marbles, sparks or
// puffs) shifted every later dice roll of the physics - puncture, wear - and a change to a look
// read as a change to the race.
let fxCount = 0;
/**
 * A random number for a look (particles, marks, flicker, rain).
 * @returns 0..1
 */
export function fxRandom(): number {
  fxCount = (fxCount + 1) | 0;
  let hash = Math.imul(fxCount, 0x9e3779b1);
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}
