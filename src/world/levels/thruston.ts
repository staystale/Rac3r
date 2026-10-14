import { parkMiller } from "../../core/random.ts";
import { alongTrack } from "../barriers.ts";
import { autoKerbs, createSubtrack, traceTrack } from "../subtrack.ts";
import { SURFACES } from "../surfaces.ts";
import { prepBumps } from "../terrain.ts";
import { onTrack, querySubtrack } from "../tyrewall.ts";
import { ss01 } from "./kit.ts";
import type { Point, Bump, Zone, Cone, Paint, Lane, Prop } from "../types.ts";
// =============================================================================================
// THRUSTON — parody of Thruxton, "the fastest circuit in the UK" (user's roster + build guide,
// SPECS-2026-10-03.md; track list approved 2026-10-03). Clockwise, all race tarmac, an old
// airfield: S/F straight -> ALLARD (fast right) -> the COMPLEX (CAMPBELL 90 right, COBB open left,
// SEAGRAVE flat right with "a nasty bump just before the apex") -> back straight -> NOBLE (fast
// right) -> GOODWOOD ("very bumpy", long right) -> VILLAGE (kink) -> CHURCH (fast and "deceptively
// tight", the apex kerb takes a beating) -> BROOKLANDS (fast) -> WOODHAM -> CLUB chicane
// (right-left-right, heavy kerbs + tyre markers) -> line. Sources: fastcar.co.uk Thruxton track
// guide; Wikipedia "Thruxton Circuit" (3.79 km, 12 turns).
// SCALE: the real lap is 3.79 km; every level shares one 520 m world (the tyre-mark layer is sized
// to it), so this is the real corner sequence at 1567 m (measured), proportions kept, real width
// (14 m). Corner distances along the lap (measured): ALLARD 187 CAMPBELL 312 COBB 374 SEAGRAVE 444
// NOBLE 686 GOODWOOD 810 VILLAGE 869 CHURCH 1032 BROOKLANDS 1089
//   WOODHAM 1285  CLUB 1343-1422.
// INTENDED FAILURE: carrying Church's speed into a tight apex; arriving at Club too hot after the
// fastest part of the lap; tyre heat (sustained right-handers load the left-side tyres — user:
// "high tyre-heat generator"). RE-LAID 2026-10-03 from the REAL MAP (Wikimedia
// "Thuxton_Motor_Racing_Circuit_map.svg", 369 m = 255 px), traced clockwise from the line and
// scaled 0.47 (1254 m, measured). The first layout had the right corners in a made-up shape —
// re-laid, not patched. RE-TRACED 2026-10-04 (user: "kerbs still broken on tight corners, not like
// the real corner"): centreline read off the map at 4x zoom on a 10 px grid
// (art/ref/thruxton-map.png, 960 px wide; game (0,0) = map centre, 0.47 m per px), clockwise from
// the line, then traceTrack() (no kinks, every corner R >= 12 m). Check against the map: node
// tools/traceoverlay.mjs thruston. The previous trace (hand points through Catmull-Rom, kinked at
// Campbell / Cobb / Club) is in _archive/; the FIRST layout is _archive/thruston-old-layout.cjs.
const TH_MAP: Point[] = [
  // S/F straight up the west side, ALLARD
  [51,532],[46,515],[40,500],[33,480],[25,455],[21,430],[21,405],[30,380],[55,355],[70,345],
  [100,330],
  // up to CAMPBELL (right)
  [120,305],[155,260],[180,210],[191,172],[194,150],[197,120],[204,105],[214,99],
  // the dip to COBB (left)
  [225,101],[242,104],[265,104],[280,102],[287,97],
  // up to SEAGRAVE (right)
  [296,82],[310,57],[322,37],[332,25],[347,19],[372,15],[397,14],[450,22],[480,35],[530,52],
  // NOBLE, the back straight
  [580,85],[600,102],[630,110],[660,112],[690,107],[730,87],[780,67],[820,62],[860,67],
  // GOODWOOD (long right)
  [905,95],[930,130],[947,175],[952,225],[950,275],[940,325],[922,365],[900,400],
  // VILLAGE, CHURCH, BROOKLANDS
  [860,460],[825,500],[780,520],[740,527],[690,522],[630,522],[555,530],[480,545],[400,565],
  [300,625],
  // WOODHAM, CLUB (right-left-right)
  [270,647],[232,657],[195,656],[182,651],[176,642],[170,632],[164,630],[156,632],[150,637],
  [140,640],
  [125,636],[110,625],[100,615],[85,597],[70,575],[57,552]];
export const TH_SUBTRACK = createSubtrack(traceTrack(TH_MAP, { rMin: 15.5 }), 14,
  [{ startDist: 0, endDist: 1e9, surface: SURFACES.racetarmac }], [], true);
TH_SUBTRACK.curvedKerbs = autoKerbs(TH_SUBTRACK, { maxR: 70, exitR: 30, heavyR: 22, minTurn: 20,
  mergeGap: 12 });
const thAt = (dist: number, off: number) =>
  {
    const pose = onTrack(TH_SUBTRACK, dist, off, {});
    return { x: pose.x, y: pose.y };
  };
// clear of the road? (centre at least hw + reach + margin from the centreline, and off every lane)
const thClear = (x: number, y: number, reach: number) =>
  querySubtrack(TH_SUBTRACK, x, y).dist >= TH_SUBTRACK.width / 2 + reach;
const thRnd = parkMiller(1968);   // Thruxton opened in 1968
// EARTH BANKS round the outside (ukcircuits: "extensive earthen banks ... from Club through Noble";
// Woodham Hill Bank on the approach to Club, 2025) — a chain of humps, filtered off the road
const thBank = (fromDist: number, toDist: number, off: number, step: number, radius: number,
  height: number) => {
  const out: Bump[] = [];
  const span = ((toDist - fromDist) + TH_SUBTRACK.totalDist) % TH_SUBTRACK.totalDist;
  for (let along = 0; along <= span; along += step) {
    const point = thAt((fromDist + along) % TH_SUBTRACK.totalDist, off);
    if (thClear(point.x, point.y, radius + 3)) out.push({ kind: 'hump', ...point, r: radius,
      h: height });
  }
  return out;
};
export const TH_BUMPS = prepBumps([
  // SEAGRAVE: "a nasty bump just before the apex will unsettle the car"
  { kind: 'hump', ...thAt(306, -1), r: 3.4, h: 0.09 },   // re-traced 2026-10-04: Seagrave apex ~315
  // GOODWOOD: "a very bumpy corner" — a short field of low humps and dips across the racing line
  ...[0, 1, 2, 3, 4, 5].map((idx) => ({ kind: idx % 2 ? 'dip' : 'hump',
    ...thAt(575 + idx * 13, (idx % 3) * 3 - 3), r: 3, h: 0.06, d: 0.05 })),
  // SPECTATOR BANKS (race-day photo): grass earth banks behind the fence at Church and outside
  // Noble
  ...thBank(778, 877, -31, 4, 7, 1.3),
  ...thBank(440, 500, 27, 4, 7, 1.1),
  // spacing 4 m with r 7: at 10 m apart they photographed as a row of separate pale blobs, not a
  // bank
  // the perimeter banking, Club -> line -> Allard -> Complex -> Noble
  ...thBank(1120, 480, -33, 4, 7, 1.2),
  ...thBank(1035, 1100, -31, 4, 7, 1.4),      // Woodham Hill Bank
]);
// THE AIRFIELD, from the real map (first match wins, so the paved runway is listed before the
// remnants it lies on):
export const TH_ZONES: Zone[] = [
  // paved active runway (SW-NE)
  { x: 61.1, y: -38.8, w: 245.3, h: 9, rot: -0.4036, surface: SURFACES.tarmac },
  // grass active runway (NW-SE), mown short
  { x: 11.8, y: -2.3, w: 245.1, h: 10, rot: 0.5667, surface: SURFACES.grassShort },
  // what is left of the original runway (SW-NE). SHORTENED 2026-10-04 (user: "pits look messy"): it
  // ran ~26 m past its real west end (map px ~118,442), out over the S/F straight and under the pit
  // lane, merging both into one ragged concrete blob.
  { x: 12.4, y: -26.4, w: 395, h: 22, rot: -0.3926, surface: SURFACES.concrete },
  // and the other one (NW-SE)
  { x: 16.5, y: -27.7, w: 323.9, h: 20, rot: 0.5703, surface: SURFACES.concrete },
];
// ARMCO runs (outside of the right-handers) and the TYRE WALLS in front of them (user, 2026-10-04:
// "lots of tyres between the track and the Armco"): two staggered rows of knockable tyre stacks
// (cones.js r 0.48 -> 0.95 m apart), rows at -14 and -15 (rail face -15.7).
export const TH_ARMCO = [[35, 125], [205, 250], [290, 345], [560, 760], [785, 870], [1080, 1112]];
const TH_TYREWALL = TH_ARMCO.flatMap(([startDist, endDist]) =>
  [[-14.0, 0], [-15.0, 0.475]].flatMap(([off, shift]) =>
  alongTrack(TH_SUBTRACK, startDist + shift, endDist, off,
    0.95).map(([x, y]) => ({ x, y, kind: 'tyrestack' }))));
export const TH_CONES: Cone[] = [
  ...TH_TYREWALL,
  // CLUB: tyre markers on the outside of each flick (user: "heavy kerbing and tyre markers strictly
  // at the final Club chicane")
  ...[1126, 1136, 1146, 1156, 1166, 1176].flatMap((dist, idx) =>
    [{ ...thAt(dist, (idx % 2 ? 12 : -12)), kind: 'tyrestack' }]),
  { ...thAt(1146, 0.5), kind: 'cone' },     // the apex cone in the middle flick
];
export const TH_PAINT: Paint[] = [
  { kind: 'chequered', x: TH_SUBTRACK.pts[0].x, y: TH_SUBTRACK.pts[0].y, len: 1.6, wid: 14,
    rot: TH_SUBTRACK.pts[0].heading },
];
// PITS + PERIMETER (2026-10-04; user: "aerial / race-day photos for pit layouts and perimeter
// decorations — if you need ARMCO or FENCES, do"). From the map (pit lane on the INSIDE between
// Club and the line) and the photos (art/ref/: concrete lane, yellow line, low red/white/blue pit
// wall, block garages under a red tyre-brand banner, control tower, grandstand, Armco, catch fence,
// spectator banks). Layout only — working pit stops come later (user). Everything by DISTANCE +
// OFFSET (+ = inside).
// lane leaves after Club, rejoins before Allard (R >= 67 m here)
export const TH_PIT = { d0: 1178, d1: 48, off: 17, w: 9, ramp: 28 };
const TH_PIT_LANE = alongTrack(TH_SUBTRACK, TH_PIT.d0, TH_PIT.d1,
  (along, len) => 4 + (TH_PIT.off - 4) * ss01(Math.min(along, len - along) / TH_PIT.ramp), 2);
// garage fronts flush with the lane (a 1 m grass strip showed)
export const TH_GAR = { d0: 1204, d1: 22, off: TH_PIT.off + TH_PIT.w / 2 + 5, depth: 10, n: 4 };
// THE INFIELD (2026-10-04; user: "isn't there more decorating to make it look like the real race
// track?"). Read off the map (art/ref/thruxton-map.png: paved taxiway system, paved apron, hangars,
// grass aircraft parking) and the 1945 RAF photo (art/ref/may45.jpg). Map px -> game m exactly as
// TH_MAP. Widths EXAGGERATED (the lap is ~1/3 scale, the cars full size).
const thM = (pixelX: number, pixelY: number): Point =>
  [+((pixelX - 480) * 0.47).toFixed(2), +((pixelY - 338) * 0.47).toFixed(2)];
export const TH_LANES: Lane[] = [
  { pts: TH_PIT_LANE, width: TH_PIT.w, surface: SURFACES.concrete },
  // PADDOCK (paved apron)
  { pts: [thM(207, 492), thM(180, 590)], width: 18, surface: SURFACES.tarmac },
  // taxiway to the runway
  { pts: [thM(207, 492), thM(222, 450), thM(245, 432), thM(310, 404), thM(372, 372)], width: 7,
    surface: SURFACES.broken },
  { pts: [thM(313, 402), thM(312, 330), thM(309, 272), thM(298, 251), thM(278, 243), thM(215, 238),
    thM(205, 244)], width: 7, surface: SURFACES.broken },
  { pts: [thM(283, 243), thM(292, 190), thM(300, 152)], width: 7, surface: SURFACES.broken },
  // north apron
  { pts: [thM(312, 147), thM(366, 181)], width: 12, surface: SURFACES.broken },
  // hangar road
  { pts: [thM(205, 244), thM(188, 295), thM(172, 345)], width: 6, surface: SURFACES.broken },
];
// hangars on the INFIELD side of the hangar road (on the map they stand west of it, but at this
// scale that is on the track)
const TH_HANGARS = [0.2, 0.5, 0.8].map((frac) => {
  const from = thM(205, 244), dest = thM(172, 345), x = from[0] + (dest[0] - from[0]) * frac,
    y = from[1] + (dest[1] - from[1]) * frac;
  // points EAST (infield); the first sign put two hangars on the track (measured 4.8 m from the
  // centreline)
  const dirX = (dest[0] - from[0]), dirY = (dest[1] - from[1]), len = Math.hypot(dirX, dirY),
    perpX = dirY / len, perpY = -dirX / len;
  // 12 m deep: at 15 they touched (one long shed, and a car between two was pushed back and forth)
  return { kind: 'hangar', x: x + perpX * 14, y: y + perpY * 14, w: 20, h: 12,
    rot: Math.atan2(perpY, perpX) };
});
const TH_PLANES: Prop[] = ([[478, 488, 0.5, '#c8302c'], [500, 482, 2.4, '#2b56b5'],
  [560, 470, 1.2, '#e2c13a'], [640, 455, 3.6, '#2f7d4f'],
  [690, 432, 0.1, '#c8302c'], [600, 425, 4.6, '#5a5e66']] satisfies [number, number, number,
    string][]).map(([pixelX, pixelY, rot, col]) => {
    const [x, y] = thM(pixelX, pixelY);
    return { kind: 'plane', x, y, rot, col };
  });
const TH_PADDOCK = [0.18, 0.42, 0.66].flatMap((frac, idx) => {
  const from = thM(207, 492), dest = thM(180, 590), x = from[0] + (dest[0] - from[0]) * frac,
    y = from[1] + (dest[1] - from[1]) * frac;
  const dirX = dest[0] - from[0], dirY = dest[1] - from[1], len = Math.hypot(dirX, dirY),
    rot = Math.atan2(dirY, dirX), perpX = -dirY / len, perpY = dirX / len;
  const cols = ['#c8302c', '#2b56b5', '#e2c13a', '#2f7d4f', '#f2f2f2', '#7a3fa0'];
  return [{ kind: 'truck', x: x + perpX * 5.5, y: y + perpY * 5.5, rot, col: cols[idx * 2] },
    { kind: 'truck', x: x - perpX * 5.5, y: y - perpY * 5.5, rot: rot + Math.PI,
    col: cols[idx * 2 + 1] }];
});
// WOODS on the west side (1945 photo) + hedgerow trees round the outside; seeded, filtered off the
// road
const TH_TREES: Prop[] = [];
for (let attempt = 0; attempt < 46; attempt++) {
  const dist = 40 + thRnd() * 190, off = -46 - thRnd() * 34, point = thAt(dist, off);
  if (thClear(point.x, point.y, 10)) TH_TREES.push({ kind: 'tree', ...point, s: 3 + thRnd() * 3,
    seed: attempt });
}
for (let dist = 0; dist < TH_SUBTRACK.totalDist; dist += 26) {
  const point = thAt(dist, -44 - thRnd() * 10);
  if (thClear(point.x, point.y, 12)) TH_TREES.push({ kind: 'tree', ...point, s: 2.5 + thRnd() * 2.5,
    seed: 100 + dist });
}
// MARSHAL POSTS behind the Armco at each corner
const TH_POSTS = [70, 230, 315, 470, 600, 700, 830, 1000, 1090, 1150].map((dist) => {
  const post = onTrack(TH_SUBTRACK, dist, -20, {});
  return { kind: 'marshal', x: post.x, y: post.y, rot: post.rot };
}).filter((prop) => thClear(prop.x, prop.y, 4));
// placed BY DISTANCE (2026-10-04 re-trace): fixed x/y left the gantry off the line and the stand
// off the straight when the track moved. Clockwise lap: +offset = inside (right of travel), -offset
// = outside. Grandstand: OUTSIDE the S/F straight, opposite the pits.
const thProp = (dist: number, off: number, spec: Omit<Prop, "x" | "y">): Prop => {
  const pose = onTrack(TH_SUBTRACK, dist, off, {});
  return { ...spec, x: pose.x, y: pose.y, rot: pose.rot + (spec.rot || 0) };
};
export const TH_STAND = { d0: 1188, d1: 1228, off: -14 };
export const TH_PROPS: Prop[] = [
  thProp((TH_STAND.d0 + TH_STAND.d1) / 2, TH_STAND.off,
    { kind: 'grandstand', w: TH_STAND.d1 - TH_STAND.d0, h: 8 }),
  thProp(3, 0, { kind: 'gantry', wid: 26, rot: Math.PI / 2 }),
  // garages: ONE row that follows the lane (the first cut, 4 rotated blocks, stepped and overlapped
  // on the curve — user: "messy")
  { kind: 'garagerow', brand: 'KUM TYRES', x: 0, y: 0,
    front: alongTrack(TH_SUBTRACK, TH_GAR.d0, TH_GAR.d1, TH_GAR.off - TH_GAR.depth / 2, 2.5),
    back: alongTrack(TH_SUBTRACK, TH_GAR.d0, TH_GAR.d1, TH_GAR.off + TH_GAR.depth / 2, 2.5),
    banner: alongTrack(TH_SUBTRACK, TH_GAR.d0, TH_GAR.d1, TH_GAR.off - TH_GAR.depth / 2 + 0.9,
      2.5) },
  thProp(1214, TH_GAR.off + 14, { kind: 'tower', size: 9 }),
  thProp(100, -26, { kind: 'board', label: 'THRUSTON' }),
  thProp(1100, -24, { kind: 'board', label: 'KUM TYRES' }),
  thProp(640, -28, { kind: 'board', label: 'SPUM OIL' }),
  // CLUB: two grandstands (ukcircuits) — approach ...
  thProp(1106, -27, { kind: 'grandstand', w: 26, h: 8 }),
  ...TH_HANGARS, ...TH_PLANES, ...TH_PADDOCK, ...TH_TREES, ...TH_POSTS,
  { kind: 'windsock', x: 53, y: -57, rot: 0.6 },
  // (the sign stood ON the re-laid start straight — user: "there's a sign over the track"; now
  // placed by the track, see below)
];
