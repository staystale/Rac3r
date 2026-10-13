import { alongTrack } from "../barriers.ts";
import { FLOOR } from "../bounds.ts";
import { autoKerbs, createSubtrack, traceTrack } from "../subtrack.ts";
import { SURFACES } from "../surfaces.ts";
import { prepBumps } from "../terrain.ts";
import { onTrack } from "../tyrewall.ts";
import { trackKit } from "./kit.ts";
import type { Point, Cover, Lane, Cone, Prop, Paint, Barrier } from "../types.ts";
// =============================================================================================
// SWEATY LAMB — parody of Sweet Lamb (mid Wales), the gravel rally stage. Built 2026-10-04.
// Decisions (user): layout INSPIRED BY THE
// PHOTOS (no published map — rally-maps needs a browser): Sweet Lamb is 4.24 km of gravel, 373-497
// m (123 m of climb), a valley side
// of switchbacks that make the famous spectator bowl, black corrugated farm sheds round a gravel
// yard, a water splash, moorland and
// conifer plantations (art/ref/sl1-5.jpg). ~1 MINUTE of stage (~1.2 km at this game's scale).
// After the flying finish BOTH: a stop
// zone + RESTART, and an untimed farm road back round to the start. Built as ONE closed loop
// (stage + liaison) so RESET, lap tracking
// and the autodriver all work; LEVEL.stage = { finish } and main.js times start line -> finish.
// World metres (mpp 1). Valley floor in the south, the hill rising to the north (one cos^2 hill,
// 18 m); start in the SW farm yard.
// V2 (user, 2026-10-04: "a bit basic track wise — more unique corners"; "slightly longer, more
// twists and turns, same map size";
// "more tyres, cones, flags so it feels like a rally event"). ~2 km of stage, every corner a
// different kind, in order:
// SQUARE LEFT out of the yard, DOG-LEG square right, fast ESSES along the valley, the WATER
// SPLASH, a long right SWEEPER round the SE
// corner, a TYRE CHICANE on the climb, a square left, the HAIRPIN AROUND THE TREE, a left kink,
// HAIRPIN 2, the CREST YUMP, a right-left
// FLICK, a downhill left sweeper, a SQUARE RIGHT junction, the HAIRPIN AT THE TOP of the second
// hill, the LONG FAST DESCENT, a WIGGLE,
// the flying FINISH; then a short farm road back to the start.
// square left, dog-leg square right
const SL_STAGE: Point[] = [[-215, 205], [-175, 205], [-150, 200], [-148, 172], [-140, 160],
  [-110, 158],
  // ESSES, the SPLASH
  [-80, 172], [-50, 150], [-20, 172], [10, 150], [40, 168], [75, 165],
  // SWEEPER, the TYRE CHICANE straight
  [110, 178], [150, 192], [190, 190], [218, 170], [228, 135], [228, 110], [228, 82],
  // square left, west along the bowl
  [225, 58], [195, 52], [150, 55], [100, 58],
  // HAIRPIN AROUND THE TREE, left kink
  [62, 50], [45, 35], [55, 18], [100, 18], [150, 20], [185, 10], [200, -12],
  // HAIRPIN 2, the CREST YUMP
  [200, -40], [192, -56], [172, -60], [130, -56], [90, -62], [60, -70], [20, -75],
  // FLICK, downhill sweeper, SQUARE RIGHT
  [-20, -60], [-40, -78], [-60, -95], [-100, -118], [-130, -112], [-160, -110],
  // HAIRPIN AT THE TOP, the DESCENT
  [-162, -150], [-168, -192], [-188, -205], [-208, -190], [-215, -150], [-215, -120], [-210, -60],
  // WIGGLE, FINISH
  [-195, -30], [-215, 0], [-200, 30], [-200, 60]];
const SL_LIAISON: Point[] = [[-202, 92], [-222, 130], [-236, 168], [-232, 196]];
const SL_SUB0 = createSubtrack(traceTrack([...SL_STAGE, ...SL_LIAISON],
  { mpp: 1, cx: 0, cy: 0, rMin: 12 }), 10, [], [], true);
const slD = ([x, y]: Point) => {
  let best = 0, bestSq = Infinity;
  for (const point of SL_SUB0.pts) {
    const distSq = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distSq < bestSq) {
      bestSq = distSq;
      best = point.dist;
    }
  }
  return best;
};
export const SL_FINISH = slD([-200, 60]), SL_LIAISON_D = slD([-202, 92]);
export const SL_SUBTRACK = createSubtrack(SL_SUB0.pts.map((point): Point => [point.x, point.y]),
  10, [
  // the STAGE: rally gravel
  { startDist: 0, endDist: SL_LIAISON_D, surface: SURFACES.gravel },
  // the farm road back (untimed)
  { startDist: SL_LIAISON_D, endDist: 1e9, surface: SURFACES.broken },
], [], true);   // no kerbs: a rally stage has none
const SL_KIT = trackKit(SL_SUBTRACK, 1984, []);
// named corners (distance along the stage) — everything event-dressing hangs off these
const SL_C = { sqL: slD([-150, 200]), sqR: slD([-140, 160]), splash: slD([75, 165]),
  sweep: slD([210, 182]), chicane: slD([228, 110]),
  sqL2: slD([225, 58]), tree: slD([45, 35]), hp2: slD([196, -50]), yump: slD([60, -70]),
    flick: slD([-40, -78]), sqR2: slD([-160, -110]),
  top: slD([-188, -205]), wiggle: slD([-215, 0]) };
const SL_SPLASH = SL_KIT.at(SL_C.splash, 0);
// WATER: the stream down to the splash and on south, plus the farm POND — drawn as one body where
// they touch (render mergedCovers)
export const SL_STREAM: Cover[] = [];
for (let frac = 0; frac <= 1.0001; frac += 0.03) {
  const x = 62 + 26 * frac, y = 112 + 140 * frac;
  if (Math.abs(x) < FLOOR - 8 && Math.abs(y) < FLOOR - 8) SL_STREAM.push(
    { x, y, w: 7 + 2 * Math.sin(frac * 9), h: 5, cover: 'wet', shape: 'ellipse', rot: 1.39 });
}
// the WATER SPLASH
SL_STREAM.push({ x: SL_SPLASH.x, y: SL_SPLASH.y, w: 13, h: 9, cover: 'wet', shape: 'ellipse',
  rot: 0.2 });
// the farm POND
SL_STREAM.push({ x: -95, y: 228, w: 30, h: 14, cover: 'wet', shape: 'ellipse', rot: 0.1 },
  { x: -78, y: 232, w: 16, h: 10, cover: 'wet', shape: 'ellipse', rot: -0.3 });
// the farm yard / service park, south of the start
export const SL_YARD: Lane = { pts: [[-235, 228], [-175, 230]], width: 22,
  surface: SURFACES.gravel };
export const SL_BUMPS = prepBumps([
  // THE HILL of the bowl (steepest ~17 %); the yump sits near its top
  { kind: 'hump', x: 70, y: -40, r: 150, h: 16 },
  // the second hill: hairpin at the top, the long descent off it
  { kind: 'hump', x: -175, y: -165, r: 95, h: 10 },
  { kind: 'hump', ...SL_KIT.at(SL_C.yump, 0), r: 9, h: 0.9 },                  // the CREST YUMP
  // the SPECTATOR BOWL
  ...SL_KIT.bank(SL_C.sqL2, SL_C.tree, -24, 7, 1.5),
    ...SL_KIT.bank(SL_C.tree + 40, SL_C.hp2 - 30, 24, 7, 1.5),
]);
// EVENT DRESSING by corner: chevron boards on the OUTSIDE (pointing the way), hay bales lining it,
// cones on the inside apex, flags
// at the spectator spots. Outside of a left-hander is +, of a right-hander -. (dir: +1 = the
// corner turns right)
const slTurn = (dist: number) => {
  const before = SL_KIT.rot(dist - 8), after = SL_KIT.rot(dist + 8);
  let turn = after - before;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  return turn > 0 ? 1 : -1;
};
export const SL_DRESS: Prop[] = [], SL_CONES: Cone[] = [];
for (const dist of [SL_C.sqL, SL_C.sqR, SL_C.sqL2, SL_C.tree, SL_C.hp2, SL_C.sqR2, SL_C.top,
  SL_C.flick]) {
  const dir = slTurn(dist), out = -dir;          // outside of the corner
  SL_DRESS.push(SL_KIT.prop(dist - 6, out * 9.5,
    { kind: 'chevron', rot: dir > 0 ? Math.PI / 2 : -Math.PI / 2 }));
  for (const offset of [-4, 0, 4]) {
    const pos = SL_KIT.at(dist + offset, -out * 5.8);
    SL_CONES.push({ x: pos.x, y: pos.y, kind: 'cone' });
  }
  SL_DRESS.push(SL_KIT.prop(dist + 12, out * 11,
    { kind: 'flag', col: ['#c8302c', '#e2c13a', '#2b56b5', '#2f7d4f'][(dist | 0) % 4] }));
}
// HAY BALES round EVERY corner of the stage (user, 2026-10-04: "more hay bales around the rally
// stage corners"): corners found from the
// curvature (autoKerbs' corner finder: tighter than 45 m, turning > 25 deg), a knockable bale
// every 2.1 m along the OUTSIDE from just
// before the corner to 12 m after it. (First cut: 7 bales at 8 hand-picked corners.)
for (const kerb of autoKerbs(SL_SUBTRACK, { maxR: 45, exitR: 0, minTurn: 25, mergeGap: 10 })) {
  if (kerb.startDist > SL_FINISH) continue;
  // 'left' = +normal = the INSIDE of a right-hander, so the outside is the other side
  const out = kerb.side === 'left' ? -1 : 1;
  for (let dist = kerb.startDist - 8; dist <= Math.min(kerb.endDist + 12,
    SL_FINISH - 5); dist += 2.1) {
    const pos = SL_KIT.at(dist, out * 8);
    SL_CONES.push({ x: pos.x, y: pos.y, kind: 'bale', rot: SL_KIT.rot(dist) });
  }
}
// the TYRE CHICANE (rally style: stacks on the road, alternate sides) on the climb
// 3 deep x 3 long blocks of stacks (photographed: one row of 3 read as debris, not a chicane)
for (const [blockOffset, side] of [[-16, 1], [0, -1], [16, 1]]) for (
  const rowIdx of [0, 1, 2]) for (const colIdx of [-1, 0, 1]) {
  const pos = SL_KIT.at(SL_C.chicane + blockOffset + colIdx * 0.95, side * (5 - rowIdx * 0.95));
  SL_CONES.push({ x: pos.x, y: pos.y, kind: 'tyrestack' });
}
// flags along the start / finish and the bowl; spectator TAPE on the bank tops (non-solid line)
for (let flagIdx = 0; flagIdx < 6; flagIdx++) SL_DRESS.push(
  SL_KIT.prop(8 + flagIdx * 6, -8.5, { kind: 'flag', col: ['#c8302c', '#f2f2f2'][flagIdx % 2] }),
  SL_KIT.prop(SL_FINISH - 20 + flagIdx * 6, -8.5,
  { kind: 'flag', col: ['#2b56b5', '#f2f2f2'][flagIdx % 2] }));
export const SL_TAPE: Barrier[] = [{ kind: 'line', col: '#e23b2e',
  pts: alongTrack(SL_SUBTRACK, SL_C.sqL2 + 10, SL_C.tree - 10, -14, 3) }, { kind: 'line',
  col: '#e23b2e', pts: alongTrack(SL_SUBTRACK, SL_C.tree + 40, SL_C.hp2 - 30, 14, 3) }];
// THE TREE the hairpin goes round (inside of a right-hander)
const SL_TREES: Prop[] = [{ kind: 'tree', ...SL_KIT.at(SL_C.tree, 12), s: 7, seed: 3 }];
for (const [clusterX, clusterY, count] of [[150, 110, 26], [-60, 110, 22], [-110, -30, 26],
  [140, -150, 30], [-60, -170, 18], [-235, -230,
  10]]) for (let treeIdx = 0; treeIdx < count; treeIdx++) {
  const x = clusterX + (SL_KIT.rnd() - 0.5) * 60, y = clusterY + (SL_KIT.rnd() - 0.5) * 50;
  // odd seeds: the darker palette
  if (SL_KIT.clear(x, y, 9)) SL_TREES.push(
    { kind: 'tree', x, y, s: 3.5 + SL_KIT.rnd() * 2, seed: 2 * treeIdx + 1 });
}
export const SL_PROPS: Prop[] = [
  // black corrugated sheds (photo)
  { kind: 'block', x: -238, y: 246, w: 20, h: 10, rot: 0, roof: '#2c2f33', label: 'SWEATY LAMB' },
  { kind: 'block', x: -150, y: 248, w: 24, h: 10, rot: 0, roof: '#2c2f33' },
  // service vans
  { kind: 'truck', x: -220, y: 226, rot: 0, col: '#c8302c' },
    { kind: 'truck', x: -190, y: 232, rot: 0, col: '#2b56b5' },
  // the START arch
  SL_KIT.prop(2, 0, { kind: 'gantry', wid: 18, rot: Math.PI / 2 }),
  // marquees in the bowl
  ...[[SL_C.tree + 60, 34], [SL_C.tree + 120, 34],
    [SL_C.hp2 + 40, -34]].map(([dist, off]) =>
    SL_KIT.prop(dist, off, { kind: 'block', w: 5, h: 5, roof: '#eef0f2' })),
  SL_KIT.prop(SL_FINISH + 2, -9, { kind: 'board', label: 'FINISH' }),
    SL_KIT.prop(SL_FINISH + 40, -9, { kind: 'board', label: 'STOP' }),
  SL_KIT.prop(60, -12, { kind: 'board', label: 'SWEATY LAMB' }),
    SL_KIT.prop(SL_C.sweep, -16, { kind: 'board', label: 'KUM TYRES' }),
  ...SL_DRESS, ...SL_TREES,
].filter((prop) => (prop.kind === 'block' && prop.w! > 10) || prop.kind === 'truck'
  || prop.kind === 'gantry' || prop.kind === 'bale' || prop.kind === 'chevron'
  || prop.kind === 'flag' ? true : SL_KIT.clear(prop.x, prop.y,
  prop.kind === 'tree' ? (prop.s! > 6 ? 6 : 9) : 3));
export const SL_PAINT: Paint[] = [
  { kind: 'chequered', x: SL_SUBTRACK.pts[0].x, y: SL_SUBTRACK.pts[0].y, len: 1.6, wid: 10,
    rot: SL_SUBTRACK.pts[0].heading },
  (() => {
    const pos = onTrack(SL_SUBTRACK, SL_FINISH, 0, {});
    return { kind: 'chequered', x: pos.x, y: pos.y, len: 1.6, wid: 10, rot: pos.rot };
  })(),
];
