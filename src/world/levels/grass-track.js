import { SURFACES } from "../surfaces.js";
import { createSubtrack } from "../subtrack.js";
// =============================================================================================
// GRASS OVAL (Dirt/Grass/Mud Track — PLAN.md §3)
// Counter-clockwise (turning left). Start/finish at x=0, y=38.
// =============================================================================================
const GO_APEXES = [
  [0, 38], [55, 38], [85, 18], [85, -18], [55, -38], [0, -38], [-55, -38], [-85, -18], [-85, 18], [-55, 38]
];
export const GO_SECTORS = [
  { startDist: 0, endDist: 55, surface: SURFACES.grassShort },
  { startDist: 55, endDist: 185, surface: SURFACES.dirt },
  { startDist: 185, endDist: 240, surface: SURFACES.grassShort },
  { startDist: 240, endDist: 1000, surface: SURFACES.dirt },
];
const GO_CURVED_KERBS = [
  // Inner kerb hugging the inside edge (right of path vector)
  { side: 'right', startDist: 0, endDist: 1000, width: 2.0, h: 0.08 }
];
export const GO_SUBTRACK = createSubtrack(GO_APEXES, 14, GO_SECTORS, GO_CURVED_KERBS);
export const GO_RANDOM_PATCHES = [];      // filled by randomiseGrassTrack on every load

// GRASS TRACK LAYOUT (user, 2026-10-03, second pass): "it should be mostly as I asked — grass on the straights
// and dirt on the corners — however random patches, single squares etc of grass, long grass or mud or dirt,
// randomly throughout the normal course. The course should change just these random patches."
//   1. the BASE is fixed: every corner dirt, every straight short grass (heading change over 12 m > GO_TURN).
//   2. each load scatters GO_PATCHES random PATCHES over the racing surface (LEVEL.patches): small blobs
//      1-5 m across of long grass, mud, thick mud, dirt or grass, chosen by what they sit in. They are real
//      ground — physics, wear and graphics all read them (layersAt / drawPatches) — and only they change.
// The first version randomised the sectors themselves in 10-30 m runs; the user found that too uniform.
const GO_TURN = 0.25;
const GO_MIN_RUN = 20;             // m; shorter base runs are absorbed into their neighbours
const GO_PATCHES = 46;
const GO_PATCH_ON_STRAIGHT = [['dirt', 0.30], ['mud', 0.25], ['grassLong', 0.30], ['thickMud', 0.15]];
const GO_PATCH_ON_CORNER = [['grassShort', 0.30], ['mud', 0.35], ['grassLong', 0.15], ['thickMud', 0.20]];
function pick(table, x) { for (const [id, w] of table) { if ((x -= w) < 0) return id; } return table[table.length - 1][0]; }
export function randomiseGrassTrack(sub, sectors, patches, rng = Math.random) {
  const pts = sub.pts, total = sub.totalDist;
  const headingAt = (d) => { let p = pts[0]; for (const q of pts) if (q.dist <= d) p = q; return p; };
  const isCorner = (d) => {
    const dh = headingAt((d + 12) % total).heading - headingAt(d).heading;
    return Math.abs(Math.atan2(Math.sin(dh), Math.cos(dh))) > GO_TURN;
  };
  // 1. fixed base
  sectors.length = 0;
  for (let d = 0; d < total; d += 1) {
    const surface = isCorner(d) ? SURFACES.dirt : SURFACES.grassShort;
    const last = sectors[sectors.length - 1];
    if (last && last.surface === surface) last.endDist = d + 1;
    else sectors.push({ startDist: d, endDist: d + 1, surface });
  }
  // absorb runs shorter than GO_MIN_RUN into their neighbours. MEASURED 2026-10-03: the raw corner test
  // flickered 1 m dirt/grass slivers at every corner boundary and left an 11 m grass strip between the two
  // bends at each end of the oval — 23 sectors where the design is 4 (two straights, two dirt ends).
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < sectors.length; i++) {
      const sc = sectors[i];
      if (sc.endDist - sc.startDist >= GO_MIN_RUN) continue;
      const prev = sectors[(i - 1 + sectors.length) % sectors.length];
      sc.surface = prev.surface; changed = true;
    }
    for (let i = sectors.length - 1; i > 0; i--) {
      if (sectors[i].surface === sectors[i - 1].surface) { sectors[i - 1].endDist = sectors[i].endDist; sectors.splice(i, 1); }
    }
    if (sectors.length < 2) break;
  }
  sectors[sectors.length - 1].endDist = 1e9;
  // 2. random patches across the racing surface
  patches.length = 0;
  for (let n = 0; n < GO_PATCHES; n++) {
    const d = rng() * total, p = headingAt(d);
    const off = (rng() - 0.5) * (sub.width - 2);
    // a CLUSTER of 0.5-1 m squares (squares, not ellipses — user, with the pixel-art pass): 1-3 for a single
    // spot, up to ~12 for a bigger patch
    const surface = SURFACES[pick(isCorner(d) ? GO_PATCH_ON_CORNER : GO_PATCH_ON_STRAIGHT, rng())];
    const cx0 = p.x + p.nx * off, cy0 = p.y + p.ny * off, spread = rng() < 0.3 ? 2.2 : 0.8;
    const count = spread > 1 ? 6 + Math.floor(rng() * 7) : 1 + Math.floor(rng() * 3);
    for (let k = 0; k < count; k++) {
      const w = 0.5 * (1 + Math.floor(rng() * 2));
      patches.push({ x: Math.round((cx0 + (rng() - 0.5) * 2 * spread) * 2) / 2, y: Math.round((cy0 + (rng() - 0.5) * 2 * spread) * 2) / 2, w, h: w, sq: true, surface });
    }
  }
  sub.layoutId = (sub.layoutId || 0) + 1;       // tells the renderer its cached ground is out of date
}

export const GO_ZONES = [
  // Infield natural grass & mud patches (odd squares around edges of grass)
  { x: 0, y: 0, w: 110, h: 45, surface: SURFACES.grass },
  { x: -35, y: -4, w: 28, h: 22, surface: SURFACES.mud },
  { x: 30, y: 6, w: 24, h: 20, surface: SURFACES.mud },
  { x: 0, y: 14, w: 32, h: 16, surface: SURFACES.grassShort },
  { x: 0, y: -16, w: 36, h: 18, surface: SURFACES.grassShort },
  // (2026-10-03) three mud RECTANGLES at the outer edges were removed: with mud's new pattern their hard
  // straight sides cut across the track edge and under the tyre wall. Variety on this level now comes from
  // the random PATCHES rolled every load (randomiseGrassTrack), which the user asked for instead.
];

export const GO_PROPS = [
  { kind: 'podium', x: 0, y: 0, rot: 0 },
  { kind: 'caravan', x: -26, y: -4, rot: 0.16 },
  { kind: 'grandstand', x: 0, y: 66, w: 38, h: 7, rot: 0 },
  { kind: 'pylon', x: -65, y: 48 }, { kind: 'pylon', x: 65, y: 48 },
  { kind: 'pylon', x: -65, y: -48 }, { kind: 'pylon', x: 65, y: -48 },
];

export const GO_PAINT = [
  // White chalk start/finish line across the front straight
  { kind: 'lane', x: 0, y: 38, w: 0.8, h: 14, tone: 0.95 },
];

export const GO_BOARDS = [
  { x: 0, y: 47, label: 'FINISH' },
];
