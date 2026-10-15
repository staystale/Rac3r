import { SURFACES } from "../surfaces.ts";
import { createSubtrack } from "../subtrack.ts";
import { prepBumps } from "../terrain.ts";
import { courseCones } from "../tyrewall.ts";
import type { SurfaceId } from "../surfaces.ts";
import type {
  Point, Sector, CurvedKerb, Zone, Prop, Paint, Board, Cone, Bump, Cover, Spawn,
} from "../types.ts";
// ============================================================================================= THE
// SURFACE SANDBOX — REBUILT as a real circuit (requirement: rebuild the surface sandbox to cover
// all surface types, cones, tyres and make it similar to the test track in the sense it's a real
// track with lap timer and reset functions but unique and better. Beautiful and functional. Put
// some mixed testing functions like wet spots and snow or ice patches, long and short grass
// patches).
//
// It is a SUBTRACK, like the Test Track, so the lap timer, the lap counter and RESET-to-the-track
// all work with no new code. One lap (~1.67 km) runs through EVERY surface in the game, in an order
// that flows:
//   start straight RACE TARMAC > T1 sweeper TARMAC > chicane BROKEN TARMAC (kerbs) >
//   fast sweeper RALLY GRAVEL > top hairpin DIRT > esses SAND > MUD > THICK MUD hairpin >
//   LONG GRASS > SHORT GRASS > SNOW > ICE > WET TARMAC > home.
// On the road: COVERS as surprises — a puddle on the start straight, black ice in the T1 sweeper, a
// snow drift across the gravel, a puddle in the dirt hairpin, an ice patch on the short grass. In
// the infield: rounded TEST PADS (wet, snow, ice, mud, gravel, sand) like the Test Track's, and
// patches of long and short grass to drive across and wear. Everything is placed BY DISTANCE ALONG
// THE TRACK (sbAt), and kerbs / barriers find the inside or outside of a corner from the track's
// own curvature — so moving an apex keeps them all where they belong. The old ring version
// laid surface boxes across a circular cone course; it had no lap.
const SB_APEXES: Point[] = [
  [-100, 190], [60, 190], [160, 170], [200, 110], [188, 48], [140, 22], [158, -32], [200, -80],
  [190, -160], [130, -200], [60, -170], [40, -110], [-20, -80], [-80, -120], [-140, -180],
  [-200, -150],
  [-210, -70], [-160, -20], [-120, 30], [-170, 80], [-200, 140], [-170, 190],
];
// geometry measured (scratch design script): lap 1669 m, tightest centreline radius 11.8
// m (the chicane), closest approach of two parts of the track 49.7 m, max extent 213 m (floor edge
// 256).
const SB_W = 13;
const SB_SECTORS: Sector[] = [];   // filled below, by apex distance, once the track exists
const SB_KERBS: CurvedKerb[] = [];
export const SB_SUBTRACK = createSubtrack(SB_APEXES, SB_W, SB_SECTORS, SB_KERBS);
// distance along the lap of apex i (smoothPath samples 20 points per apex segment)
const sbApex = (i: number) => SB_SUBTRACK.pts[(i * 20) % SB_SUBTRACK.pts.length].dist;
function sbPt(dist: number) {
  const pts = SB_SUBTRACK.pts, total = SB_SUBTRACK.totalDist;
  dist = ((dist % total) + total) % total;
  let best = pts[0];
  for (const point of pts) if (point.dist <= dist) best = point;
  return best;
}
// +1 if the track turns toward +n (the 'left' side) around d, -1 if toward -n
function sbTurn(dist: number) {
  let dHeading = sbPt(dist + 10).heading - sbPt(dist - 10).heading;
  dHeading = Math.atan2(Math.sin(dHeading), Math.cos(dHeading));
  return dHeading >= 0 ? 1 : -1;
}
// a point \`off\` metres from the centreline at d; off > 0 = toward +n
function sbAt(dist: number, off = 0) {
  const point = sbPt(dist);
  return { x: point.x + point.nx * off, y: point.y + point.ny * off, rot: point.heading };
}
// sectors, by apex index: [from apex, to apex, surface]
([[0, 2, 'racetarmac'], [2, 4, 'tarmac'], [4, 7, 'broken'], [7, 9, 'gravel'], [9, 11, 'dirt'],
  [11, 13, 'sand'],
 [13, 14, 'mud'], [14, 15, 'thickMud'], [15, 16, 'grassLong'], [16, 17, 'grassShort'],
 [17, 18, 'snow'],
 [18, 19, 'ice'], [19, 21, 'wet'], [21, 22, 'racetarmac']] satisfies [number, number, SurfaceId][])
  .forEach(([fromApex, toApex, surfaceId]) => {
  SB_SECTORS.push({ startDist: sbApex(fromApex),
    endDist: toApex >= SB_APEXES.length ? 1e9 : sbApex(toApex), surface: SURFACES[surfaceId] });
});
// kerbs on the INSIDE of the tarmac corners (T1, the chicane's three bends, the last corner)
[[3, 30], [4, 22], [5, 22], [6, 22], [20, 30]].forEach(([i, half]) => {
  const apexDist = sbApex(i);
  SB_KERBS.push({ side: sbTurn(apexDist) > 0 ? 'left' : 'right', startDist: apexDist - half,
    endDist: apexDist + half, width: 2.4, h: 0.11 });
});
// a row of loose tyre stacks on the OUTSIDE of a corner, from d0 to d1, \`gap\` m out from the edge
function sbBarrier(fromDist: number, toDist: number, gap = 4, spacing = 1.2) {
  const out: Cone[] = [];
  for (let dist = fromDist; dist <= toDist; dist += spacing) {
    const side = -sbTurn(dist);
    const point = sbAt(dist, side * (SB_W / 2 + gap));
    out.push({ x: point.x, y: point.y, kind: 'tyrestack' });
  }
  return out;
}
export const SB_CONES: Cone[] = [
  ...courseCones(SB_APEXES, SB_W, 18),                              // gates lining the whole lap
  ...sbBarrier(sbApex(2) + 10, sbApex(3) + 30),                     // T1, end of the long straight
  ...sbBarrier(sbApex(8) + 20, sbApex(9) + 40),                     // top hairpin
  ...sbBarrier(sbApex(14) - 20, sbApex(15) + 10),                   // thick mud hairpin
  ...sbBarrier(sbApex(18) - 10, sbApex(18) + 25),                   // ice corner
];
export const SB_COVERS: Cover[] = [
  // puddle on the start straight
  { ...sbAt(120, 3), w: 9, h: 5, cover: 'wet', shape: 'ellipse' },
  // black ice in the T1 sweeper
  { ...sbAt(sbApex(3), 0), w: 16, h: 9, cover: 'ice', shape: 'ellipse' },
  // snow drift across the gravel
  { ...sbAt(sbApex(8) - 25, 0), w: 22, h: 10, cover: 'snow', shape: 'ellipse' },
  // puddle in the dirt hairpin
  { ...sbAt(sbApex(10), -2), w: 8, h: 5, cover: 'wet', shape: 'ellipse' },
  // ice on the short grass
  { ...sbAt((sbApex(16) + sbApex(17)) / 2, 1), w: 14, h: 8, cover: 'ice', shape: 'ellipse' },
];
// INFIELD: rounded test pads + long / short grass patches (all checked clear of the road, see
// ENGINE.md)
export const SB_ZONES: Zone[] = [
  { x: -40, y: 120, w: 50, h: 30, surface: SURFACES.wet, boxed: true, rounded: true },
  { x: 20, y: 120, w: 50, h: 30, surface: SURFACES.snow, boxed: true, rounded: true },
  { x: 80, y: 120, w: 50, h: 30, surface: SURFACES.ice, boxed: true, rounded: true },
  { x: -10, y: 70, w: 50, h: 30, surface: SURFACES.mud, boxed: true, rounded: true },
  { x: 50, y: 70, w: 50, h: 30, surface: SURFACES.gravel, boxed: true, rounded: true },
  { x: 110, y: 70, w: 40, h: 30, surface: SURFACES.sand, boxed: true, rounded: true },
  { x: -60, y: 20, w: 60, h: 34, surface: SURFACES.grassLong },
  { x: 20, y: 15, w: 50, h: 26, surface: SURFACES.grassLong },
  { x: 90, y: -10, w: 36, h: 40, surface: SURFACES.grassLong },
  { x: -10, y: -30, w: 40, h: 20, surface: SURFACES.grassLong },
  { x: 140, y: -120, w: 50, h: 40, surface: SURFACES.grassLong },
  { x: 60, y: 160, w: 80, h: 18, surface: SURFACES.grassLong },
];
// NO JUMPS on this level (requirement: no jumps on the surface sandbox new level please).
// The ramp, the gravel table and the dirt whoops were removed; the lab keeps its own jumps.
export const SB_BUMPS: Bump[] = [];
const SB_START = sbAt(0);
export const SB_PAINT: Paint[] = [{ kind: 'chequered', x: SB_START.x, y: SB_START.y, len: 1.6,
  wid: SB_W, rot: SB_START.rot }];
export const SB_BOARDS: Board[] = [{ ...sbAt(0, -(SB_W / 2 + 3)), label: 'FINISH' }];
export const SB_PROPS: Prop[] = [
  { kind: 'grandstand', x: -20, y: 222, w: 60, h: 8, rot: 0 },
  { kind: 'pylon', x: -150, y: 225 }, { kind: 'pylon', x: 110, y: 225 },
  { kind: 'board', x: 70, y: 212, label: 'SURFACE SANDBOX' },
];
export const SB_SPAWN: Spawn = { ...sbAt(-12), heading: sbAt(-12).rot };

// A couple of bumps in the LAB too, on the tarmac quarter, well away from the drag strip and the
// skidpad — the measured benches must keep running on flat ground.
export const LAB_BUMPS = prepBumps([
  { kind: 'ramp', x: 120, y: -80, rot: Math.PI / 2, len: 16, wid: 13, h: 1.30 },
  { kind: 'table', x: 120, y: -140, rot: Math.PI / 2, len: 26, wid: 14, h: 0.85 },
  ...[0, 1, 2, 3].map((i) => ({ kind: 'hump', x: 60, y: -60 - i * 14, r: 6.5, h: 0.30 })),
  { kind: 'kerb', x: 185, y: -40, rot: 0, len: 44, wid: 3.4, h: 0.11 },
  // ---- SUSPENSION TEST ZONE (requirement: add some bumps and dips to the lab level and mark it
  // out as a suspension test zone); chose whoops + dips/compressions + washboard + banked bowl).
  // The bare lab floor, south-west, x -245..0, y 162..214 — scanned clear of cones, panels, the
  // drag strip (y 240) and the benches. Drive WEST -> EAST. Lane 1 (y 172): WHOOPS, six round humps
  // rising 0.15 -> 0.40 m, 9 m apart.
  ...[0.15, 0.20, 0.25, 0.30, 0.35, 0.40].map((height, i) =>
    ({ kind: 'hump', x: -228 + i * 9, y: 172, r: 3.2, h: height })),
  // Lane 2 (y 187): DIPS, five hollows 0.15 -> 0.45 m deep, then one BIG COMPRESSION (wide, 0.8 m).
  ...[0.15, 0.22, 0.30, 0.37, 0.45].map((depth, i) =>
    ({ kind: 'dip', x: -228 + i * 10, y: 187, r: 3.6, d: depth })),
  { kind: 'dip', x: -160, y: 187, r: 9, d: 0.8 },
  // Lane 3 (y 203): WASHBOARD, 50 m of 0.9 m ripples, 5 cm deep.
  { kind: 'washboard', x: -205, y: 203, rot: 0, len: 50, wid: 7, amp: 0.05, wave: 0.9 },
  // BANKED BOWL at the east end: flat floor to 6 m, wall rising to 2.5 m at 18 m (flat at the
  // bottom, steep at the top), back slope out over 6 m.
  { kind: 'bowl', x: -36, y: 188, r0: 6, R: 18, h: 2.5, B: 6 },
]);

export const LAB_PANELS: Zone[] = ([
  ['ice', 'snow', 'wet'],
  ['mud', 'sand', 'broken'],
] satisfies SurfaceId[][]).flatMap((row, rowIdx) => row.map((surfaceId, colIdx) => ({
  x: -228 + colIdx * 66, y: 74 + rowIdx * 66, w: 56, h: 56, surface: SURFACES[surfaceId],
    boxed: true,
}))).concat([
  // long grass was defined but on no level, and thick mud is new — so both get a test
  // panel, in the clear north-west grass quarter (scanned clear of cones, bumps, paint and the
  // spawn).
  { x: -143, y: -106, w: 56, h: 56, surface: SURFACES.grassLong, boxed: true },
  { x: -77, y: -106, w: 56, h: 56, surface: SURFACES.thickMud, boxed: true },
]);
