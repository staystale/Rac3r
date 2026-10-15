import { FLOOR, FX0, FX1, FY0, FY1, KERB_W, edgeOut } from "./bounds.ts";
import { SURFACES } from "./surfaces.ts";
import type { SurfaceId } from "./surfaces.ts";
import { zoneAt } from "./zones.ts";
import { COVER_IDS } from "./wear.ts";
import { querySubtrack } from "./tyrewall.ts";
import type {
  CoverId, Level, Patch, Surface, Inclusions, InclusionCover, Sector, Subtrack,
} from "./types.ts";
type Rng = () => number;
// =============================================================================================
// SURFACE BLENDING AT CHANGE POINTS (requirement: sections of surfaces should rarely come to abrupt
// changes — a blend area where random patches of the under layer show through and the top layer
// drags over; semi random, greater at the point of blend and lower away from it, so we get a
// natural gradient). Generated as PATCHES (the same mechanism as the Grass Track's spots — real
// ground: grip, wear, graphics):
//   (a) TRACK SECTOR changes: each side's surface scattered into the other along the road,
//       triangular density peaking at the change point and reaching zero BLEND_W metres away.
//   (b) LOOSE ROAD EDGES (dirt, gravel, grass, mud, sand, snow sectors): the road surface drags
//       out onto the verge and the verge creeps onto the road. Hard (tarmac-family) edges stay
//       crisp, as in reality.
//   (c) NATURAL ZONE EDGES (not the boxed / rounded test pads, which are deliberate man-made
//       panels).
// Kerbs always win (layersAt), so no patch ever covers a kerb. Covers (puddles / snow / ice) are
// not blended yet. FIXED PER LEVEL: a seeded RNG (from the level id), so a level looks the same
// every load — except levels that re-randomise (the Grass Track), whose blend is rolled again with
// the layout.
export const BLEND_W = 6;          // m from the change point to where the blend fades out
// User, (after seeing it): "smaller random patches, and only LOOSE surfaces should move
// to hard surfaces". So patches are 0.4-1.4 m (were 1-3.2 m), twice as many to keep the coverage,
// and a HARD surface (tarmac family, lab floor, wet tarmac) never scatters onto anything — loose
// ground drags onto hard ground, never the reverse.
export const BLEND_DENSITY = 1.4;  // patches per metre of boundary at the change point
export function seededRng(str: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) hash = Math.imul(hash ^ str.charCodeAt(i), 16777619);
  return () => {
    hash += 0x6D2B79F5;
    let mix = hash;
    mix = Math.imul(mix ^ (mix >>> 15), mix | 1);
    mix ^= mix + Math.imul(mix ^ (mix >>> 7), mix | 61);
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}
// 0..1, dense near 0: the "greater at the point of blend" falloff
const tri = (rng: Rng): number => rng() * rng();
// SQUARES, not circles (requirement: make the surface and transitions squares too, no circles):
// every blend patch is an axis-aligned square of 0.5, 1.0 or
// 1.5 m on a half-metre world grid.
const SQ_GRID = 0.5;
const snapG = (value: number): number => Math.round(value / SQ_GRID) * SQ_GRID;
function blendPatch(rng: Rng, x: number, y: number, surface: Surface): Patch {
  const size = SQ_GRID * (1 + Math.floor(rng() * 3));
  return { x: snapG(x), y: snapG(y), w: size, h: size, sq: true, surface, blend: true };
}
// buildBlend notes (kept out of the function body to respect the 80-line limit):
// pointAt: INTERPOLATED between samples. MEASURED (tools/blendcheck): snapping to the ~4 m sample
//   spacing clumped the patches into 4 m steps — 89 / 1 / 25 / 70 per metre from the change point
//   instead of a smooth falloff.
// (a) sector change points: `signed` is the signed distance from the change point.
// (b) loose road edges: 1 m steps (was 2 m before patches got smaller). CLEANER SIDES (user,
//   "sides of tracks should be a cleaner transition, like real life"): only a thin,
//   sparse fringe of the road material at the edge — was 55% per metre out to ~5 m, plus the verge
//   creeping onto the road (removed).
//   The `rng < 0.18` branch: the road drags a little onto the verge.
// (c) natural zone edges: 1 m steps (was 2 m before patches got smaller). (S-B) a zone laid in a
//   level's EXTENSION (z.ext: beyond the original square) blends there; every other zone keeps the
//   square rule, so the old lab's blend is bit-identical (tools/_labcheck.mjs). `sides`: outward,
//   the zone drags out; inward, the neighbour creeps in. The final filter: only loose surfaces
//   travel (user).
/** A point on the subtrack centreline: position, left normal and heading. */
interface BlendPoint { x: number; y: number; nx: number; ny: number; heading: number }
/**
 * The interpolated centreline point at a distance along the subtrack (wraps).
 * @param subtrack the subtrack
 * @param dist distance along the track (metres)
 * @returns position, normal and heading there
 */
function blendPointAt(subtrack: Subtrack, dist: number): BlendPoint {
  const pts = subtrack.pts, total = subtrack.totalDist;
  dist = ((dist % total) + total) % total;
  let i = 0;
  while (i < pts.length - 1 && pts[i + 1].dist <= dist) i++;
  const from = pts[i], next = pts[(i + 1) % pts.length],
    seg = (next.dist > from.dist ? next.dist : total) - from.dist,
    frac = seg > 0 ? (dist - from.dist) / seg : 0;
  return { x: from.x + (next.x - from.x) * frac, y: from.y + (next.y - from.y) * frac,
    nx: from.nx, ny: from.ny, heading: from.heading };
}
/**
 * Is a point within `pad` metres of the road edge (inside the road when pad is negative)?
 * @param subtrack the level's subtrack, if any
 * @param x world x
 * @param y world y
 * @param pad extra metres beyond the half width
 * @returns true when on the road (falsy when there is no subtrack)
 */
function isBlendOnRoad(subtrack: Subtrack | undefined, x: number, y: number, pad: number) {
  return subtrack && querySubtrack(subtrack, x, y).dist < subtrack.width / 2 + pad;
}
/**
 * Is a point just inside a boxed / rounded test pad?
 * @param level the level
 * @param x world x
 * @param y world y
 * @returns true when in a pad
 */
function isBlendInPad(level: Level, x: number, y: number): boolean {
  return level.zones.some((z) =>
    (z.boxed || z.rounded) && Math.abs(x - z.x) < z.w / 2 + 1 && Math.abs(y - z.y) < z.h / 2 + 1);
}
/**
 * (a) Scatter each side's surface into the other at every sector change point.
 * @param out the patch list to push to
 * @param rng random source
 * @param subtrack the subtrack
 * @param secs the sectors sorted by start distance
 */
function addSectorChangePatches(
  out: Patch[], rng: Rng, subtrack: Subtrack, secs: Sector[],
): void {
  for (let i = 0; i < secs.length; i++) {
    const before = secs[(i - 1 + secs.length) % secs.length].surface, after = secs[i].surface,
      changeDist = secs[i].startDist;
    if (before === after || changeDist <= 0.5) continue;
    const count = Math.round(2 * BLEND_W * BLEND_DENSITY * (subtrack.width / 8));
    for (let j = 0; j < count; j++) {
      const signed = (rng() < 0.5 ? -1 : 1) * tri(rng) * BLEND_W;
      const point = blendPointAt(subtrack, changeDist + signed),
        off = (rng() - 0.5) * (subtrack.width - 1);
      const patch = blendPatch(rng, point.x + point.nx * off, point.y + point.ny * off,
        signed < 0 ? after : before);
      patch.src = 'change';
      out.push(patch);
    }
  }
}
/**
 * (b) Loose road edges: the road surface drags out onto the verge.
 * @param out the patch list to push to
 * @param rng random source
 * @param level the level
 * @param subtrack the subtrack
 * @param secs the sectors sorted by start distance
 */
function addRoadEdgePatches(
  out: Patch[], rng: Rng, level: Level, subtrack: Subtrack, secs: Sector[],
): void {
  const total = subtrack.totalDist, halfWidth = subtrack.width / 2;
  for (const sector of secs) {
    const surface = sector.surface;
    if (surface.hard || COVER_IDS[surface.id]) continue;
    const end = Math.min(sector.endDist, total);
    for (let dist = sector.startDist; dist < end; dist += 1) {
      const point = blendPointAt(subtrack, dist);
      for (const side of [-1, 1]) {
        if (rng() < 0.18) {
          const off = side * (halfWidth + 0.2 + tri(rng) * 1.5);
          const x = point.x + point.nx * off, y = point.y + point.ny * off;
          if (!isBlendOnRoad(subtrack, x, y, -0.2) && !isBlendInPad(level, x, y))
            out.push(blendPatch(rng, x, y, surface));
        }
      }
    }
  }
}
/**
 * (c) Natural zone edges: each side of every unboxed zone edge scatters into the other.
 * @param out the patch list to push to
 * @param rng random source
 * @param level the level
 */
function addZoneEdgePatches(out: Patch[], rng: Rng, level: Level): void {
  const subtrack = level.subtrack;
  for (const z of level.zones) {
    if (z.boxed || z.rounded) continue;
    const edges = [
      [z.x - z.w / 2, z.y - z.h / 2, 1, 0, 0, -1, z.w],
      [z.x - z.w / 2, z.y + z.h / 2, 1, 0, 0, 1, z.w],
      [z.x - z.w / 2, z.y - z.h / 2, 0, 1, -1, 0, z.h],
      [z.x + z.w / 2, z.y - z.h / 2, 0, 1, 1, 0, z.h],
    ];
    for (const [edgeX, edgeY, tanX, tanY, nx, ny, len] of edges) {
      for (let along = 0.5; along < len; along += 1) {
        const baseX = edgeX + tanX * along, baseY = edgeY + tanY * along;
        if (Math.max(Math.abs(baseX), Math.abs(baseY)) > FLOOR - KERB_W - 2
          && !(z.ext && edgeOut(baseX, baseY) < -KERB_W - 2)) continue;
        const outer = zoneAt(baseX + nx * 1.5, baseY + ny * 1.5);
        if (outer === z.surface || outer.id === 'kerb') continue;
        const sides: [number, Surface][] = [[1, z.surface], [-1, outer]];
        for (const [sign, surf] of sides) {
          if (rng() > 0.6) continue;
          const offset = sign * (0.3 + tri(rng) * BLEND_W);
          const x = baseX + nx * offset, y = baseY + ny * offset;
          if (isBlendOnRoad(subtrack, x, y, 1.5) || isBlendInPad(level, x, y)) continue;
          out.push(blendPatch(rng, x, y, surf));
        }
      }
    }
  }
}
export function buildBlend(level: Level, rng: Rng): Patch[] {
  const out: Patch[] = [];
  const subtrack = level.subtrack;
  if (subtrack && subtrack.sectors && subtrack.sectors.length > 1) {
    const secs = subtrack.sectors.slice().sort((left, right) => left.startDist - right.startDist);
    addSectorChangePatches(out, rng, subtrack, secs);
    addRoadEdgePatches(out, rng, level, subtrack, secs);
  }
  addZoneEdgePatches(out, rng, level);
  return out.filter((patch) => !patch.surface.hard);
}
// Per-level preparation: re-roll random layouts, build (or reuse) the blend, index every patch in
// the grid. SURFACE INCLUSIONS (requirement: can surfaces have a chance to contain other like
// surfaces % wise... keep it proportional and realistic; table APPROVED as proposed). Share of
// each surface's AREA covered by small patches of a related surface; '@x' is a COVER (puddle / snow
// / ice) rather than a ground patch. Seeded per level (the Grass Track re-rolls with its layout).
// Boxed test panels stay pure (the tyre / wear tools and the player's tests depend on them).
const INCLUDE: Record<string, [string, number][]> = {
  gravel: [['sand', 0.08], ['dirt', 0.06]],
  dirt: [['gravel', 0.06], ['mud', 0.05]],
  grass: [['grassLong', 0.10], ['dirt', 0.04], ['mud', 0.02]],
  grassShort: [['grassLong', 0.10], ['dirt', 0.04], ['mud', 0.02]],
  grassLong: [['grassShort', 0.08], ['mud', 0.03]],
  mud: [['thickMud', 0.12], ['@wet', 0.04]],
  thickMud: [['@wet', 0.06]],
  sand: [['gravel', 0.05]],
  broken: [['gravel', 0.06], ['@wet', 0.03]],
  tarmac: [['broken', 0.02]],
  snow: [['@ice', 0.10]],
  ice: [['@snow', 0.10]],
};
// USER, after seeing it: "it looks awful, too much too often — it should be like 10%
// of that, and ideally smaller patches". So: the same table, but INCL_RATE 0.1 of the patch COUNT
// the table implies at the original 1.5-5 m size, and the patches themselves 0.75-2 m.
const INCL_STEP = 6, INCL_MIN = 0.75, INCL_MAX = 2, INCL_COVER_CAP = 30, INCL_RATE = 0.1,
  INCL_REF_SIZE = 3.25;
/**
 * Roll which related surface (if any) an inclusion cell gets.
 * @param rng random source
 * @param list the INCLUDE entries of the base surface: [id, share of area]
 * @param cellArea area of one scan cell (m2)
 * @param refArea reference patch area the shares were written for (m2)
 * @returns the picked ground / '@cover' id, or null for none
 */
function pickInclusion(
  rng: Rng, list: [string, number][], cellArea: number, refArea: number,
): string | null {
  let roll = rng(), pick = null;
  for (const [groundId, pct] of list) {
    const chance = INCL_RATE * (pct * cellArea) / refArea;
    if (roll < chance) { pick = groundId; break; }
    roll -= chance;
  }
  return pick;
}
/**
 * Add a CLUSTER of 1-2 overlapping squares on the world grid for a ground inclusion.
 * @param patches the patch list to push to
 * @param rng random source
 * @param patchX cell centre x
 * @param patchY cell centre y
 * @param pick the ground surface id
 * @param patchArea expected area of one inclusion (m2)
 */
function addInclusionSquares(
  patches: Patch[], rng: Rng, patchX: number, patchY: number, pick: string, patchArea: number,
): void {
  // a CLUSTER of 2-3 overlapping squares on the world grid (pixel-art rule: squares, not
  // circles — photographed, smooth ellipses read as a different art style from the Grass
  // Track's square patches). Same expected area as one ellipse.
  const count = 1 + (rng() < 0.6 ? 1 : 0), side = Math.sqrt(patchArea / count) * 1.15;
  for (let j = 0; j < count; j++) {
    const squareW = Math.round(side * (0.7 + rng() * 0.6) * 2) / 2,
      squareH = Math.round(side * (0.7 + rng() * 0.6) * 2) / 2;
    const squareX = Math.round((patchX + (rng() - 0.5) * side) * 2) / 2,
      squareY = Math.round((patchY + (rng() - 0.5) * side) * 2) / 2;
    patches.push({ x: squareX, y: squareY, w: Math.max(1, squareW), h: Math.max(1, squareH),
      sq: true,
      surface: SURFACES[pick as SurfaceId] });
  }
}
/** A rectangle that keeps inclusions out (zone or authored cover footprint). */
interface KeepOut { x: number; y: number; w: number; h: number }
/**
 * Is a point within `pad` metres of any of the rectangles?
 * @param rects the keep-out rectangles
 * @param x world x
 * @param y world y
 * @param pad metres added to each half extent
 * @returns true when inside one
 */
function isNearKeepOut(rects: KeepOut[], x: number, y: number, pad: number): boolean {
  return rects.some((z) =>
    Math.abs(x - z.x) < z.w / 2 + pad && Math.abs(y - z.y) < z.h / 2 + pad);
}
export function buildInclusions(level: Level, rng: Rng): Inclusions {
  const patches: Patch[] = [], covers: InclusionCover[] = [];
  // ENDLESS levels (the highway, 100 km a side): the FLOOR-wide 6 m scan below is ~1e9 cells there
  // (MEASURED: froze the Test Mode menu, ran node out of heap). The road window moves
  // anyway, so no inclusions on an endless level.
  if (level.endless) return { patches, covers };
  // expected patch area: ellipse of w x h, w and h uniform in [MIN, MAX] -> pi/4 x E[w]^2
  // (independent)
  const meanSize = (INCL_MIN + INCL_MAX) / 2, patchArea = (Math.PI / 4) * meanSize * meanSize,
    cellArea = INCL_STEP * INCL_STEP;
  // the count is set at the original size, then x INCL_RATE
  const refArea = (Math.PI / 4) * INCL_REF_SIZE * INCL_REF_SIZE;
  const boxed = (level.zones || []).filter((z) => z.boxed);
  // hand-placed covers (the lab's ice sheet, puddle and snow features) are test features too: keep
  // the ground under them pure. MEASURED: a long-grass patch under the lab ice sheet broke
  // tools/wearcheck (scrubbed ice exposed long grass, not grass).
  const authored = (level._coversBase || []).map((cover) => ({
    x: cover.x, y: cover.y, w: Math.max(cover.w, cover.h), h: Math.max(cover.w, cover.h),
  }));
  // the scan covers the floor RECTANGLE inside the +-FLOOR square: a long thin level (a straight
  // road 30 km long) scanned as its square was ~1e8 cells. Where the rectangle holds the square
  // (every level; the lab's rectangle is larger) the start and end are exactly the square's.
  const lim = FLOOR - KERB_W - 2;
  const xFrom = Math.max(-lim, -(-FX0 - KERB_W - 2)), xTo = Math.min(lim, FX1 - KERB_W - 2);
  const yFrom = Math.max(-lim, -(-FY0 - KERB_W - 2)), yTo = Math.min(lim, FY1 - KERB_W - 2);
  for (let x = xFrom; x <= xTo; x += INCL_STEP) for (let y = yFrom; y <= yTo; y += INCL_STEP) {
    const patchX = x + (rng() - 0.5) * INCL_STEP, patchY = y + (rng() - 0.5) * INCL_STEP;
    if (isNearKeepOut(boxed, patchX, patchY, 3)) continue;
    if (isNearKeepOut(authored, patchX, patchY, 4)) continue;
    const base = zoneAt(patchX, patchY);
    const list = base && INCLUDE[base.id];
    if (!list) continue;
    const pick = pickInclusion(rng, list, cellArea, refArea);
    if (!pick) continue;
    const width = INCL_MIN + rng() * (INCL_MAX - INCL_MIN),
      height = INCL_MIN + rng() * (INCL_MAX - INCL_MIN), rot = rng() * Math.PI;
    if (pick[0] === '@') { if (covers.length < INCL_COVER_CAP) covers.push({
      x: patchX, y: patchY, w: width, h: height, rot, cover: pick.slice(1) as CoverId,
      shape: 'ellipse' }); }
    else addInclusionSquares(patches, rng, patchX, patchY, pick, patchArea);
  }
  return { patches, covers };
}
