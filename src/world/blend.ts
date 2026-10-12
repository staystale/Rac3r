import { FLOOR, KERB_W, edgeOut } from "./bounds.ts";
import { SURFACES } from "./surfaces.ts";
import type { SurfaceId } from "./surfaces.ts";
import { zoneAt } from "./zones.ts";
import { COVER_IDS } from "./wear.ts";
import { querySubtrack } from "./tyrewall.ts";
import type { CoverId, Level, Patch, Surface, Inclusions, InclusionCover } from "./types.ts";
type Rng = () => number;
// =============================================================================================
// SURFACE BLENDING AT CHANGE POINTS (user, 2026-10-03: "sections of surfaces should rarely come to abrupt
// changes — a blend area where random patches of the under layer show through and the top layer drags over;
// semi random, greater at the point of blend and lower away from it, so we get a natural gradient").
// Generated as PATCHES (the same mechanism as the Grass Track's spots — real ground: grip, wear, graphics):
//   (a) TRACK SECTOR changes: each side's surface scattered into the other along the road, triangular density
//       peaking at the change point and reaching zero BLEND_W metres away.
//   (b) LOOSE ROAD EDGES (dirt, gravel, grass, mud, sand, snow sectors): the road surface drags out onto the
//       verge and the verge creeps onto the road. Hard (tarmac-family) edges stay crisp, as in reality.
//   (c) NATURAL ZONE EDGES (not the boxed / rounded test pads, which are deliberate man-made panels).
// Kerbs always win (layersAt), so no patch ever covers a kerb. Covers (puddles / snow / ice) are not blended yet.
// FIXED PER LEVEL: a seeded RNG (from the level id), so a level looks the same every load — except levels that
// re-randomise (the Grass Track), whose blend is rolled again with the layout.
export const BLEND_W = 6;          // m from the change point to where the blend fades out
// User, 2026-10-03 (after seeing it): "smaller random patches, and only LOOSE surfaces should move to hard surfaces".
// So patches are 0.4-1.4 m (were 1-3.2 m), twice as many to keep the coverage, and a HARD surface (tarmac family,
// lab floor, wet tarmac) never scatters onto anything — loose ground drags onto hard ground, never the reverse.
export const BLEND_DENSITY = 1.4;  // patches per metre of boundary at the change point
export function seededRng(str: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const tri = (rng: Rng): number => rng() * rng();      // 0..1, dense near 0: the "greater at the point of blend" falloff
// SQUARES, not circles (user, 2026-10-03, with the pixel-art pass: "make the surface and transitions squares too,
// no circles"): every blend patch is an axis-aligned square of 0.5, 1.0 or 1.5 m on a half-metre world grid.
const SQ_GRID = 0.5;
const snapG = (v: number): number => Math.round(v / SQ_GRID) * SQ_GRID;
function blendPatch(rng: Rng, x: number, y: number, surface: Surface, rot: number): Patch {
  const w = SQ_GRID * (1 + Math.floor(rng() * 3));
  return { x: snapG(x), y: snapG(y), w, h: w, sq: true, surface, blend: true };
}
export function buildBlend(level: Level, rng: Rng): Patch[] {
  const out: Patch[] = [];
  const st = level.subtrack;
  const onRoad = (x: number, y: number, pad: number) => st && querySubtrack(st, x, y).dist < st.width / 2 + pad;
  const inPad = (x: number, y: number): boolean => level.zones.some((z) => (z.boxed || z.rounded) && Math.abs(x - z.x) < z.w / 2 + 1 && Math.abs(y - z.y) < z.h / 2 + 1);
  if (st && st.sectors && st.sectors.length > 1) {
    const pts = st.pts, total = st.totalDist, hw = st.width / 2;
    // INTERPOLATED between samples. MEASURED (tools/blendcheck): snapping to the ~4 m sample spacing clumped the
    // patches into 4 m steps — 89 / 1 / 25 / 70 per metre from the change point instead of a smooth falloff.
    const at = (d: number) => {
      d = ((d % total) + total) % total;
      let i = 0; while (i < pts.length - 1 && pts[i + 1].dist <= d) i++;
      const a = pts[i], b = pts[(i + 1) % pts.length], seg = (b.dist > a.dist ? b.dist : total) - a.dist, k = seg > 0 ? (d - a.dist) / seg : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, nx: a.nx, ny: a.ny, heading: a.heading };
    };
    const secs = st.sectors.slice().sort((a, b) => a.startDist - b.startDist);
    // (a) sector change points
    for (let i = 0; i < secs.length; i++) {
      const A = secs[(i - 1 + secs.length) % secs.length].surface, B = secs[i].surface, d0 = secs[i].startDist;
      if (A === B || d0 <= 0.5) continue;
      const n = Math.round(2 * BLEND_W * BLEND_DENSITY * (st.width / 8));
      for (let k = 0; k < n; k++) {
        const u = (rng() < 0.5 ? -1 : 1) * tri(rng) * BLEND_W;      // signed distance from the change point
        const p = at(d0 + u), off = (rng() - 0.5) * (st.width - 1);
        const bp = blendPatch(rng, p.x + p.nx * off, p.y + p.ny * off, u < 0 ? B : A, p.heading); bp.src = 'change'; out.push(bp);
      }
    }
    // (b) loose road edges
    for (const sc of secs) {
      const S = sc.surface;
      if (S.hard || COVER_IDS[S.id]) continue;
      const end = Math.min(sc.endDist, total);
      for (let d = sc.startDist; d < end; d += 1) {          // 1 m (was 2 m before patches got smaller)
        const p = at(d);
        for (const side of [-1, 1]) {
          // CLEANER SIDES (user, 2026-10-03: "sides of tracks should be a cleaner transition, like real life"): only a
          // thin, sparse fringe of the road material at the edge — was 55% per metre out to ~5 m, plus the verge
          // creeping onto the road (removed).
          if (rng() < 0.18) {                                          // the road drags a little onto the verge
            const off = side * (hw + 0.2 + tri(rng) * 1.5);
            const x = p.x + p.nx * off, y = p.y + p.ny * off;
            if (!onRoad(x, y, -0.2) && !inPad(x, y)) out.push(blendPatch(rng, x, y, S, p.heading));
          }
        }
      }
    }
  }
  // (c) natural zone edges
  for (const z of level.zones) {
    if (z.boxed || z.rounded) continue;
    const edges = [[z.x - z.w / 2, z.y - z.h / 2, 1, 0, 0, -1, z.w], [z.x - z.w / 2, z.y + z.h / 2, 1, 0, 0, 1, z.w],
                   [z.x - z.w / 2, z.y - z.h / 2, 0, 1, -1, 0, z.h], [z.x + z.w / 2, z.y - z.h / 2, 0, 1, 1, 0, z.h]];
    for (const [ex, ey, tx, ty, nx, ny, len] of edges) {
      for (let s = 0.5; s < len; s += 1) {                   // 1 m (was 2 m before patches got smaller)
        const bx = ex + tx * s, by = ey + ty * s;
        // (S-B) a zone laid in a level's EXTENSION (z.ext: beyond the original square) blends there; every other zone keeps the square
        // rule, so the old lab's blend is bit-identical (tools/_labcheck.mjs)
        if (Math.max(Math.abs(bx), Math.abs(by)) > FLOOR - KERB_W - 2 && !(z.ext && edgeOut(bx, by) < -KERB_W - 2)) continue;
        const outer = zoneAt(bx + nx * 1.5, by + ny * 1.5);
        if (outer === z.surface || outer.id === 'kerb') continue;
        const sides: [number, Surface][] = [[1, z.surface], [-1, outer]];
        for (const [sign, surf] of sides) {     // outward: the zone drags out; inward: the neighbour creeps in
          if (rng() > 0.6) continue;
          const o = sign * (0.3 + tri(rng) * BLEND_W);
          const x = bx + nx * o, y = by + ny * o;
          if (onRoad(x, y, 1.5) || inPad(x, y)) continue;
          out.push(blendPatch(rng, x, y, surf, Math.atan2(ty, tx)));
        }
      }
    }
  }
  return out.filter((p) => !p.surface.hard);      // only loose surfaces travel (user)
}
// Per-level preparation: re-roll random layouts, build (or reuse) the blend, index every patch in the grid.
// SURFACE INCLUSIONS (user, 2026-10-03: "can surfaces have a chance to contain other like surfaces % wise ... keep it proportional
// and realistic"; table APPROVED as proposed). Share of each surface's AREA covered by small patches of a related surface; '@x'
// is a COVER (puddle / snow / ice) rather than a ground patch. Seeded per level (the Grass Track re-rolls with its layout).
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
// USER, after seeing it (2026-10-03): "it looks awful, too much too often — it should be like 10% of that, and ideally smaller
// patches". So: the same table, but INCL_RATE 0.1 of the patch COUNT the table implies at the original 1.5-5 m size, and the
// patches themselves 0.75-2 m.
const INCL_STEP = 6, INCL_MIN = 0.75, INCL_MAX = 2, INCL_COVER_CAP = 30, INCL_RATE = 0.1, INCL_REF_SIZE = 3.25;
export function buildInclusions(level: Level, rng: Rng): Inclusions {
  const patches: Patch[] = [], covers: InclusionCover[] = [];
  // ENDLESS levels (the highway, 100 km a side): the FLOOR-wide 6 m scan below is ~1e9 cells there (MEASURED 2026-10-05: froze the
  // Test Mode menu, ran node out of heap). The road window moves anyway, so no inclusions on an endless level.
  if (level.endless) return { patches, covers };
  // expected patch area: ellipse of w x h, w and h uniform in [MIN, MAX] -> pi/4 x E[w]^2 (independent)
  const ew = (INCL_MIN + INCL_MAX) / 2, patchArea = (Math.PI / 4) * ew * ew, cellArea = INCL_STEP * INCL_STEP;
  const refArea = (Math.PI / 4) * INCL_REF_SIZE * INCL_REF_SIZE;   // the count is set at the original size, then x INCL_RATE
  const boxed = (level.zones || []).filter((z) => z.boxed);
  // hand-placed covers (the lab's ice sheet, puddle and snow features) are test features too: keep the ground under them pure.
  // MEASURED: a long-grass patch under the lab ice sheet broke tools/wearcheck (scrubbed ice exposed long grass, not grass).
  const authored = (level._coversBase || []).map((c) => ({ x: c.x, y: c.y, w: Math.max(c.w, c.h), h: Math.max(c.w, c.h) }));
  const lim = FLOOR - KERB_W - 2;
  for (let x = -lim; x <= lim; x += INCL_STEP) for (let y = -lim; y <= lim; y += INCL_STEP) {
    const px = x + (rng() - 0.5) * INCL_STEP, py = y + (rng() - 0.5) * INCL_STEP;
    if (boxed.some((z) => Math.abs(px - z.x) < z.w / 2 + 3 && Math.abs(py - z.y) < z.h / 2 + 3)) continue;
    if (authored.some((z) => Math.abs(px - z.x) < z.w / 2 + 4 && Math.abs(py - z.y) < z.h / 2 + 4)) continue;
    const base = zoneAt(px, py);
    const list = base && INCLUDE[base.id];
    if (!list) continue;
    let r = rng(), pick = null;
    for (const [id, pct] of list) { const p = INCL_RATE * (pct * cellArea) / refArea; if (r < p) { pick = id; break; } r -= p; }
    if (!pick) continue;
    const w = INCL_MIN + rng() * (INCL_MAX - INCL_MIN), h = INCL_MIN + rng() * (INCL_MAX - INCL_MIN), rot = rng() * Math.PI;
    if (pick[0] === '@') { if (covers.length < INCL_COVER_CAP) covers.push({ x: px, y: py, w, h, rot, cover: pick.slice(1) as CoverId, shape: 'ellipse' }); }
    else {
      // a CLUSTER of 2-3 overlapping squares on the world grid (pixel-art rule: squares, not circles — photographed, smooth
      // ellipses read as a different art style from the Grass Track's square patches). Same expected area as one ellipse.
      const n = 1 + (rng() < 0.6 ? 1 : 0), side = Math.sqrt(patchArea / n) * 1.15;
      for (let k = 0; k < n; k++) {
        const sw = Math.round(side * (0.7 + rng() * 0.6) * 2) / 2, sh = Math.round(side * (0.7 + rng() * 0.6) * 2) / 2;
        const ox = Math.round((px + (rng() - 0.5) * side) * 2) / 2, oy = Math.round((py + (rng() - 0.5) * side) * 2) / 2;
        patches.push({ x: ox, y: oy, w: Math.max(1, sw), h: Math.max(1, sh), sq: true,
          surface: SURFACES[pick as SurfaceId] });
      }
    }
  }
  return { patches, covers };
}
