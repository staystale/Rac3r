// The pixel-mode palette of the ground tiles: the surfaces' own colours and every translucent
// layer blended over its own base, as a lookup from a 5-bit-a-channel colour to the nearest entry.
import { COL } from "../world/colours.ts";
import type { SurfaceArt } from "./types.ts";

/** the part of the renderer helpers the palette reads */
interface PaletteHelpers {
  SURFACE_ART: Record<string, SurfaceArt | null>;
  PUDDLE_TINT: Record<string, string>;
}

/**
 * Parses a #rrggbb / rgb / rgba colour string.
 * @param text the colour (anything else gives null)
 * @returns [r, g, b, a] or null
 */
function parseCol(text: unknown) {
  if (typeof text !== 'string') return null;
  let match = text.match(/^#([0-9a-f]{6})$/i);
  if (match) {
    const rgb = parseInt(match[1], 16);
    return [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, 1];
  }
  match = text.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (match) return [+match[1], +match[2], +match[3], match[4] === undefined ? 1 : +match[4]];
  return null;
}

/**
 * The palette of PIXEL MODE: the surfaces' own colours (SURFACE_ART + COL), plus every
 * translucent layer blended over its own surface's base.
 * @param helpers the renderer helpers (SURFACE_ART, PUDDLE_TINT)
 * @returns the palette as [r, g, b] entries
 */
function collectPalette(helpers: PaletteHelpers) {
  const pal: number[][] = [];
  const over = (under: number[], overlay: number[]) =>
    [0, 1, 2].map((i) => Math.round(under[i] * (1 - overlay[3]) + overlay[i] * overlay[3]));
  // MEASURED: blending every translucent layer over every base gave ~1,500 shades on
  // screen and the blur survived. Now each layer is blended only over ITS OWN surface's base.
  for (const [surfaceId, art] of Object.entries(helpers.SURFACE_ART)) {
    if (!art) continue;
    const base = parseCol(art.base)!; pal.push(base.slice(0, 3));
    for (const layer of art.layers) {
      const layerColour = parseCol(layer[1]);
      if (layerColour) pal.push(layerColour[3] >= 0.999 ? layerColour.slice(0, 3) : over(base,
          layerColour));
    }
    const tint = parseCol(helpers.PUDDLE_TINT[surfaceId]); if (tint) pal.push(over(base, tint));
  }
  for (const value of Object.values(COL)) {
    const colour = parseCol(value);
    if (colour && colour[3] >= 0.999) pal.push(colour.slice(0, 3));
  }
  ['#f2f2f4', '#d9d9e2', '#ffffff', '#14161c', '#c9c4bc',
      '#fff6e6'].forEach((hex) => pal.push(parseCol(hex)!.slice(0, 3)));
  return pal;
}

/**
 * The 32768-entry lookup (5 bits a channel) from a colour to its nearest palette entry.
 * @param helpers the renderer helpers (SURFACE_ART, PUDDLE_TINT)
 * @returns the lookup, ABGR pixels
 */
export function buildPalette(helpers: PaletteHelpers) {
  const pal = collectPalette(helpers);
  const lut = new Uint32Array(32768);
  for (let index = 0; index < 32768; index++) {
    const red = ((index >> 10) & 31) * 8 + 4, green = ((index >> 5) & 31) * 8 + 4, blue = (index
        & 31) * 8 + 4;
    let best = 0, bestDist = 1e9;
    for (let i = 0; i < pal.length; i++) {
      const entry = pal[i], dist = (entry[0] - red) ** 2 * 3 + (entry[1] - green) ** 2 * 4
          + (entry[2] - blue) ** 2 * 2;
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    const chosen = pal[best];
    lut[index] = (255 << 24) | (chosen[2] << 16) | (chosen[1] << 8) | chosen[0];
  }
  return lut;
}
