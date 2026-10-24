// GRASS G1 (owner-approved spec, 10-18; built 10-24): short grass told apart from grass - they
// were identical (the same art, mu 0.47, everything). ?shortgrass=1: short grass a lighter, drier
// mown look with tighter stripes and no blades, dirt patches ~4 -> 10 % of its area (an extra
// pass on its own random stream: the existing patches stay where they are), mu 0.47 -> 0.46, its
// grip peaking a touch earlier (peakK 1.25 -> 1.15) and ~20 % less bumpy (rough 0.014 -> 0.011).
// ?grassblades=1: grass a sparse layer of fine blades. Each its own switch, set before any level,
// surface or texture is built (main.js).
import { SURFACES } from './surfaces.ts';

// short grass under ?shortgrass=1: grip, the slip angle of its peak, bumpiness
const SHORT_MU = 0.46, SHORT_PEAK_K = 1.15, SHORT_ROUGH = 0.011;
// the extra dirt patches' share of short grass's area (on the inclusion table's scale: blend.ts)
export const SHORT_EXTRA_DIRT = 0.06;

let isShortGrassOn = false, isGrassBladesOn = false;

/**
 * Turns the short-grass look and feel on or off (?shortgrass=1): sets its surface row.
 * @param isOn true for the new short grass
 */
export function setShortGrass(isOn: boolean): void {
  isShortGrassOn = isOn;
  if (!isOn) return;
  Object.assign(SURFACES.grassShort, { mu: SHORT_MU, peakK: SHORT_PEAK_K, rough: SHORT_ROUGH });
}

/** Whether short grass has its own look and feel (?shortgrass=1). */
export function shortGrassOn(): boolean {
  return isShortGrassOn;
}

/**
 * Turns grass's fine blades on or off (?grassblades=1).
 * @param isOn true for the blades
 */
export function setGrassBlades(isOn: boolean): void {
  isGrassBladesOn = isOn;
}

/** Whether grass has its sparse fine blades (?grassblades=1). */
export function grassBladesOn(): boolean {
  return isGrassBladesOn;
}
