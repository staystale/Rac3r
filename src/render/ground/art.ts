// The surface art of the ground painter: the table saying how each surface is painted,
// and the painters of its base colour and pattern layers, live or from a cached texture.
import type { ArtLayer, SurfaceArt } from "../types.ts";
import { TEX_PPM, fillTexture, paintTexture } from "../textures.ts";
import type { GroundCtx } from "./types.ts";

// HOW EACH SURFACE IS PAINTED: a base colour, then layers drawn in order. One table — a new
// surface is a row here and a row in lab.js (SURFACES) and nothing else. Read by drawFloor,
// drawZones, drawTrackRibbon and drawWear, so a surface looks the same wherever it appears. Each
// surface has a SIGNATURE SHAPE so no two are told apart by colour alone:
//   tarmac — fine light aggregate        race tarmac — smooth, dark, long rubber streaks
//   broken — pale, cracked, dark patches dirt — warm brown, pale pebbles
//   mud — dark wet pools + gloss         thick mud — near-black, ridged ruts + gloss
//   gravel — dense round stones          sand — pale yellow, wind ripples
//   grass / short grass — mown stripes   long grass — dark, blade tufts
//   snow — white, blue drift shadows     ice — blue, polish sheen + white cracks
//   wet — dark, puddles, reflections, rain rings

/**
 * Builds the SURFACE_ART table: the base colour and pattern layers of every surface.
 *
 * @returns the table, keyed by surface id
 */
export function makeSurfaceArt(): Record<string, SurfaceArt | null> {
  const SURFACE_ART: Record<string, SurfaceArt | null> = {
    ...makeHardArt(),
    ...makeLooseArt(),
    ...makeSoftArt(),
  };
  addFieldLooks(SURFACE_ART);
  return SURFACE_ART;
}

/**
 * Returns the art rows of the hard surfaces: lab, tarmac, race tarmac, broken, concrete.
 *
 * @returns the rows
 */
function makeHardArt(): Record<string, SurfaceArt | null> {
  return {
    lab: null,                                   // the lab surface IS the floor colour already
    tarmac: {
      base: '#3a3c46',
      layers: [
        ['grain', '#5a5d6a', 0.9, 0.09],
        ['grain', '#2b2d35', 1.7, 0.12],
      ],
    },
    racetarmac: {
      base: '#2a2d36',
      layers: [
        ['blobs', 'rgba(16,17,22,0.55)', 3.2, 1.6, 0.10, 0.6, 0.08],
      ],
    },
    // circles (repair patches) removed (requirement: the circles on broken concrete look weird,
    // just keep the cracks)
    broken: {
      base: '#8e9099',
      layers: [
        ['cracks', '#4a4b54', 2.2, 1.7, 0.07],
        ['grain', '#a3a5ad', 1.0, 0.10],
      ],
    },
    // pale slabs, faint joints
    concrete: {
      base: '#a9a7a0',
      layers: [
        ['grain', '#bdbbb4', 0.8, 0.10],
        ['cracks', '#8c8a83', 6.0, 3.0, 0.05],
      ],
    },
  };
}

/**
 * Returns the art rows of the loose surfaces: dirt, mud, thick mud, gravel, sand.
 *
 * @returns the rows
 */
function makeLooseArt(): Record<string, SurfaceArt | null> {
  return {
    dirt: {
      base: '#8a6e50',
      layers: [
        ['grain', '#74593d', 0.7, 0.12],
        ['stones', '#b59672', 1.5, 0.06, 0.13],
        ['grain', '#5d4329', 2.2, 0.22],
      ],
    },
    mud: {
      base: '#5a4231',
      layers: [
        ['blobs', '#3f2d20', 2.2, 0.95, 0.70, 0.6, 0.25],
        ['blobs', 'rgba(255,238,215,0.20)', 1.9, 0.30, 0.08, 0.45, 0.25],
        ['grain', '#4a3626', 0.9, 0.12],
      ],
    },
    thickMud: {
      base: '#3a291d',
      layers: [
        ['ripples', '#24180f', 0.9, 0.16, 3.0, 0.20],
        ['blobs', 'rgba(255,238,215,0.30)', 1.3, 0.30, 0.08, 0.6],
      ],
    },
    gravel: {
      base: '#a99c84',
      layers: [
        ['stones', '#d4cab5', 0.75, 0.05, 0.11],
        ['stones', '#7d725d', 0.85, 0.05, 0.10],
      ],
    },
    // sand REDONE (requirement: I don't love how sand looks) — the bold squiggles read as cartoon.
    // Now fine two-tone grains with faint, long, soft wind ripples.
    sand: {
      base: '#e0c994',
      layers: [
        ['ripples', 'rgba(176,146,92,0.30)', 0.85, 0.10, 3.6, 0.07],
        ['grain', '#c9ad74', 0.5, 0.06],
        ['grain', '#f3e5bf', 0.62, 0.06],
      ],
    },
  };
}

/**
 * Returns the art rows of grass, snow, ice and wet tarmac.
 *
 * @returns the rows
 */
function makeSoftArt(): Record<string, SurfaceArt | null> {
  return {
    grass: {
      base: '#7e9c5e',
      layers: [
        ['stripes', '#89a868', 4],
        ['grain', '#6a8850', 1.2, 0.18],
      ],
    },
    grassShort: {
      base: '#7e9c5e',
      layers: [
        ['stripes', '#89a868', 4],
        ['grain', '#6a8850', 1.2, 0.18],
      ],
    },
    grassLong: {
      base: '#4d6b33',
      layers: [
        ['blades', '#6f904a', 0.5, 0.42, 0.07],
        ['blades', '#3a5226', 0.62, 0.48, 0.07],
      ],
    },
    // (field looks: added below SURFACE_ART - the grass / long grass / mud textures recoloured,
    // highway.js FIELD_SURF)
    snow: {
      base: '#f3f7fb',
      layers: [
        ['blobs', 'rgba(140,170,210,0.20)', 3.0, 1.9, 0.5, 0.6, 0.15],
        ['grain', '#ffffff', 0.9, 0.12],
      ],
    },
    packedSnow: {
      base: '#c4cfda',
      layers: [
        ['blobs', 'rgba(96,118,150,0.22)', 2.6, 1.3, 0.4, 0.6, 0.15],
        ['grain', '#e9eff5', 0.8, 0.14],
        ['grain', '#9fb0c2', 1.6, 0.10],
      ],
    },
    ice: {
      base: '#b9daee',
      layers: [
        ['sheen', 'rgba(255,255,255,0.32)', 4.5, 0.55, 0.5],
        ['cracks', 'rgba(255,255,255,0.80)', 3.6, 1.7, 0.05],
      ],
    },
    // wet tarmac REDONE (requirement: I don't love how wet tarmac looks) — the blue blobs read as
    // paint. Real wet asphalt is DARKER tarmac with its aggregate still showing, broad soft
    // reflections and dark glossy standing water in the low spots. + BLUE-ISH PUDDLES (user,
    // "wet tarmac isn't clear enough, maybe needs blue-ish puddles")
    wet: {
      base: '#2c3039',
      layers: [
        ['grain', '#454a57', 0.9, 0.08],
        ['blobs', 'rgba(86,120,176,0.55)', 4.2, 1.6, 0.8, 0.55, 0.2],
        ['sheen', 'rgba(205,218,238,0.10)', 6.0, 1.6, -0.35],
        ['sheen', 'rgba(230,238,250,0.16)', 6.0, 0.18, -0.35],
        ['rings', 'rgba(200,220,250,0.35)', 4.6, 0.35, 0.03, 0.4],
      ],
    },
  };
}

/**
 * Adds the field looks: existing textures with only their colours swapped.
 *
 * @param SURFACE_ART the table to extend; it must already hold grass, grassLong and mud
 */
function addFieldLooks(SURFACE_ART: Record<string, SurfaceArt | null>) {
  // FIELD LOOKS (highway.js fields, zone.art; the zone DRIVES as its own surface). User,
  // "jsut reuse mud and grass or long grass textures for field, and maybe colour them"
  // - so each is an existing texture with only its COLOURS swapped (same layers). SURFACE_ART[id]!
  // is set for the ids below; the cast: slice(2) of an ArtLayer is all numbers
  const recolour = (artId: string, base: string, cols: string[]): SurfaceArt => ({
    base,
    layers: SURFACE_ART[artId]!.layers.map(
      (layer, idx): ArtLayer => [layer[0], cols[idx] || layer[1], ...layer.slice(2) as number[]]
    ),
  });
  // long grass, ripe gold
  SURFACE_ART.wheat = recolour('grassLong', '#bf9f4e', ['#dcc074', '#9c7f38']);
  // long grass, yellow flower over green
  SURFACE_ART.rapeseed = recolour('grassLong', '#c9b02a', ['#ecd84a', '#8f9a2e']);
  // grass, a fresher green than the verge
  SURFACE_ART.pastureG = recolour('grass', '#86a35c', ['#92b068', '#6f8c4c']);
  // mud, a lighter turned-earth brown
  SURFACE_ART.plough = recolour(
    'mud', '#6a4c34', ['#4e3624', 'rgba(255,238,215,0.14)', '#5a412c']
  );
  // the long-grass BORDER round each field, darker
  SURFACE_ART.hedgerow = recolour('grassLong', '#3c5a28', ['#5a7c3a', '#2c4220']);
}

/**
 * Paints one surface's pattern layers over a region. The caller has set any clip and
 * translated to the world origin; the caller fills the base colour, since it knows the
 * shape.
 *
 * @param groundCtx the shared ground painter context
 * @param artId the SURFACE_ART key
 * @param minX west edge in world metres
 * @param minY north edge in world metres
 * @param maxX east edge in world metres
 * @param maxY south edge in world metres
 */
export function paintLayers(
  groundCtx: GroundCtx, artId: string, minX: number, minY: number, maxX: number,
  maxY: number
) {
  const { view, surfaceTextures, SURFACE_ART, PRIM } = groundCtx;
  if (view.noPatterns) return;
  const art = SURFACE_ART[artId];
  if (!art) return;
  if (surfaceTextures && paintTextured(groundCtx, artId, art, [minX, minY, maxX, maxY])) return;
  for (const layer of art.layers) PRIM[layer[0]](layer, minX, minY, maxX, maxY);
}

// default (?tex=0 = live): one pattern fill from the pre-painted texture (see textures.ts);
// false = draw live
/**
 * Fills a region with the pre-painted texture of a surface.
 *
 * @param groundCtx the shared ground painter context
 * @param name the SURFACE_ART key
 * @param art the surface art
 * @param rect [minX, minY, maxX, maxY] in metres
 * @returns false when no texture is available, so the caller draws live
 */
function paintTextured(groundCtx: GroundCtx, name: string, art: SurfaceArt, rect: number[]) {
  const { view, PPMz } = groundCtx;
  const tex = surfaceTexture(groundCtx, name, art);
  if (!tex) return false;
  fillTexture(view.ctx, tex, PPMz(), rect);
  return true;
}

// the texture cache key of each surface and blade-end style, built once (looked up every frame)
const TEXTURE_KEYS = new Map<string, string>();

/**
 * The texture cache key of a surface.
 *
 * @param name the SURFACE_ART key
 * @param square true for square grass blade ends
 * @returns the key
 */
function textureKey(name: string, square: boolean) {
  const lookup = square ? name + '#' : name;
  let key = TEXTURE_KEYS.get(lookup);
  if (!key) {
    key = `${name}|${square}`;
    TEXTURE_KEYS.set(lookup, key);
  }
  return key;
}

/**
 * The pre-painted repeating texture of a surface (textures.ts), painted on first use.
 *
 * @param groundCtx the shared ground painter context
 * @param name the SURFACE_ART key
 * @param art the surface art
 * @returns the texture canvas
 */
export function surfaceTexture(groundCtx: GroundCtx, name: string, art: SurfaceArt) {
  const square = groundCtx.grassEnds === 'square';
  return groundCtx.textures.get(textureKey(name, square),
    (gfx, period) => paintTexture(gfx, period, TEX_PPM, art.layers, square));
}

/**
 * Returns the base colour of a surface.
 *
 * @param groundCtx the shared ground painter context
 * @param artId the SURFACE_ART key
 * @param fallback the colour when the surface has no art
 * @returns the colour
 */
export function artBase(groundCtx: GroundCtx, artId: string, fallback: string) {
  const { SURFACE_ART } = groundCtx;
  return SURFACE_ART[artId] ? SURFACE_ART[artId]!.base : fallback;
}
