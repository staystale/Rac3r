import { alongTrack } from "../barriers.ts";
import { autoKerbs, createSubtrack, traceTrack } from "../subtrack.ts";
import { SURFACES } from "../surfaces.ts";
import { prepBumps } from "../terrain.ts";
import { onTrack } from "../tyrewall.ts";
import { trackKit } from "./kit.ts";
import type { Point, Cover, Lane, Cone, Prop, Paint, Barrier } from "../types.ts";
// =============================================================================================
// KILLDER — parody of the Kielder Forest rally stages (Northumberland). Built. DECIDED
// (user): "FAST + FLOWING"; "be LIBERAL with hay bales, tyres, cones, flags and other event
// decorations"; a staggered-start stage like Sweaty Lamb (main.js / raceflow stage). Real Kielder:
// fast gravel forest roads through dense conifer plantations, long straights into tight JUNCTION
// hairpins, big crests and jumps, log piles at the junctions, the reservoir (Kielder Water). ~2 km
// of stage (1966 m traced), in order: the FOREST STRAIGHT out of the start, flowing right-left
// SWEEPERS north, the big CREST, JUNCTION HAIRPIN 1 (right), south past the plantation, the DAM
// STRAIGHT along Kielder Water, a fast right, THE JUMP, a long fast left, the LOG-PILE SQUARE
// right, north-east S-bends, JUNCTION HAIRPIN 2 (left), the long crest-y TOP ROAD west, sweeping
// down the west side, fast S-BENDS, the flying FINISH; then the forest road back. MEASURED (layout
// check): tightest R 24 m (the junction hairpins), road never within 32 m of another part of
// itself.
const KD_STAGE: Point[] = [[-200, 230], [-140, 232], [-80, 228], [-30, 215], [10, 190], [30, 150],
  [35, 110], [32, 70], [25, 30], [22, -2], [38, -16], [58, -10], [70, 10],
  [76, 60], [92, 108], [122, 140], [170, 150], [210, 140], [230, 100], [232, 50], [230, 10],
    [222, -22], [205, -50], [170, -68], [130, -74], [100, -78],
  [93, -110], [96, -160], [115, -195], [150, -212], [190, -208], [218, -214], [226, -234],
    [205, -248], [170, -246], [120, -240], [60, -226], [0, -236],
  [-60, -226], [-110, -200], [-140, -160], [-150, -110], [-132, -70], [-150, -30], [-126, 10],
    [-140, 50], [-142, 92]];
const KD_LIAISON: Point[] = [[-150, 130], [-185, 160], [-222, 185], [-240, 210], [-228, 230]];
const KD_SUB0 = createSubtrack(traceTrack([...KD_STAGE, ...KD_LIAISON],
  { mpp: 1, cx: 0, cy: 0, rMin: 12 }), 9, [], [], true);
const kdD = ([x, y]: Point) => {
  let best = 0, bestSq = Infinity;
  for (const point of KD_SUB0.pts) {
    const distSq = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distSq < bestSq) {
      bestSq = distSq;
      best = point.dist;
    }
  }
  return best;
};
export const KD_FINISH = kdD([-142, 92]), KD_LIAISON_D = kdD([-150, 130]);
export const KD_SUBTRACK = createSubtrack(KD_SUB0.pts.map((point): Point => [point.x, point.y]), 9,
  [
  // the STAGE: forest gravel
  { startDist: 0, endDist: KD_LIAISON_D, surface: SURFACES.gravel },
  // the forest road back (untimed)
  { startDist: KD_LIAISON_D, endDist: 1e9, surface: SURFACES.dirt },
], [], true);
const KD_KIT = trackKit(KD_SUBTRACK, 1982, []);   // Kielder Water filled 1982
const KD_C = { sweep: kdD([10, 190]), crest: kdD([30, 50]), hp1: kdD([40, -14]),
  dam: kdD([150, 150]), fastR: kdD([222, 120]), jump: kdD([231, 30]),
  longL: kdD([190, -60]), sq: kdD([98, -80]), ess: kdD([150, -212]), hp2: kdD([222, -236]),
    top1: kdD([90, -233]), top2: kdD([-30, -232]),
  down: kdD([-125, -180]), sb: kdD([-140, -50]) };
// KIELDER WATER: the reservoir south-east of the dam straight (shallow edges you can drive into —
// a wet cover), plus a forest pond
export const KD_WATER: Cover[] = [
  { x: 150, y: 205, w: 170, h: 52, cover: 'wet', shape: 'ellipse', rot: -0.05 },
  { x: 225, y: 228, w: 60, h: 40, cover: 'wet', shape: 'ellipse', rot: 0.3 },
  { x: -40, y: -120, w: 26, h: 16, cover: 'wet', shape: 'ellipse', rot: 0.4 },
];
// the service park, south of the start
export const KD_YARD: Lane = { pts: [[-232, 246], [-160, 246]], width: 18,
  surface: SURFACES.gravel };
export const KD_BUMPS = prepBumps([
  // the forest hill in the north (the top road runs over its edge)
  { kind: 'hump', x: 60, y: -150, r: 140, h: 12 },
  // the west hill the S-bends come down
  { kind: 'hump', x: -170, y: -60, r: 90, h: 7 },
  // THE BIG CREST (light car, long view)
  { kind: 'hump', ...KD_KIT.at(KD_C.crest, 0), r: 22, h: 1.8 },
  // THE JUMP (sharp: you fly)
  { kind: 'hump', ...KD_KIT.at(KD_C.jump, 0), r: 8, h: 1.3 },
  // crests on the top road
  { kind: 'hump', ...KD_KIT.at(KD_C.top1, 0), r: 18, h: 1.4 },
    { kind: 'hump', ...KD_KIT.at(KD_C.top2, 0), r: 18, h: 1.4 },
  // spectator banks
  ...KD_KIT.bank(KD_C.hp1 - 30, KD_C.hp1 + 30, -20, 6, 1.4),
    ...KD_KIT.bank(KD_C.hp2 - 30, KD_C.hp2 + 30, 20, 6, 1.4),
]);
// EVENT DRESSING (user: "be liberal"): on EVERY corner chevrons on the outside, hay bales lining
// the outside, cones on the inside apex, flags; tyre-stack walls at the junction hairpins and the
// square; spectator tape + marquees at the hairpins and the jump; log piles.
const kdTurn = (dist: number) => {
  const before = KD_KIT.rot(dist - 8), after = KD_KIT.rot(dist + 8);
  let turn = after - before;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  return turn > 0 ? 1 : -1;
};
export const KD_DRESS: Prop[] = [], KD_CONES: Cone[] = [];
const KD_FLAGC = ['#c8302c', '#e2c13a', '#2b56b5', '#2f7d4f', '#f2f2f2', '#e07a1f'];
for (const kerb of autoKerbs(KD_SUBTRACK, { maxR: 70, exitR: 0, minTurn: 18, mergeGap: 10 })) {
  if (kerb.startDist > KD_FINISH - 10) continue;
  // outside of the corner
  const mid = (kerb.startDist + kerb.endDist) / 2, dir = kdTurn(mid), out = -dir;
  for (let dist = kerb.startDist - 10; dist <= Math.min(kerb.endDist + 14,
    KD_FINISH - 6); dist += 2.2) {
    const pos = KD_KIT.at(dist, out * 7.4);
    KD_CONES.push({ x: pos.x, y: pos.y, kind: 'bale', rot: KD_KIT.rot(dist) });
  }
  KD_DRESS.push(KD_KIT.prop(kerb.startDist - 14, out * 9.5,
    { kind: 'chevron', rot: dir > 0 ? Math.PI / 2 : -Math.PI / 2 }), KD_KIT.prop(mid, out * 10.5,
    { kind: 'chevron', rot: dir > 0 ? Math.PI / 2 : -Math.PI / 2 }));
  for (const offset of [-5, 0, 5]) {
    const pos = KD_KIT.at(mid + offset, -out * 5.2);
    KD_CONES.push({ x: pos.x, y: pos.y, kind: 'cone' });
  }
  for (let flagIdx = 0; flagIdx < 3; flagIdx++) KD_DRESS.push(
    KD_KIT.prop(mid - 10 + flagIdx * 10, out * 12.5,
    { kind: 'flag', col: KD_FLAGC[(flagIdx + (mid | 0)) % KD_FLAGC.length] }));
}
// tyre walls: the outside of the two junction hairpins and the square (3 rows deep)
for (const [dist, side] of [[KD_C.hp1, 1], [KD_C.hp2, -1], [KD_C.sq, 1]]) for (let along =
  -12; along <= 12; along += 0.95) for (const row of [0, 1, 2]) {
  const pos = KD_KIT.at(dist + along, side * (8 + row * 0.95));
  if (KD_KIT.clear(pos.x, pos.y, 0.5)) KD_CONES.push({ x: pos.x, y: pos.y, kind: 'tyrestack' });
}
// cones down the middle of the start and finish straights' run-in, and loose tyres at the stop
// zone
for (let dist = KD_FINISH + 8; dist < KD_FINISH + 40; dist += 6) {
  const pos = KD_KIT.at(dist, 3.5);
  KD_CONES.push({ x: pos.x, y: pos.y, kind: 'cone' });
}
// START / FINISH flag lines
for (let flagIdx = 0; flagIdx < 8; flagIdx++) KD_DRESS.push(
  KD_KIT.prop(4 + flagIdx * 5, -7.5, { kind: 'flag', col: ['#c8302c', '#f2f2f2'][flagIdx % 2] }),
  KD_KIT.prop(4 + flagIdx * 5, 7.5, { kind: 'flag', col: ['#2b56b5', '#f2f2f2'][flagIdx % 2] }),
  KD_KIT.prop(KD_FINISH - 30 + flagIdx * 5, -7.5,
    { kind: 'flag', col: ['#2b56b5', '#f2f2f2'][flagIdx % 2] }));
export const KD_TAPE: Barrier[] = [KD_C.hp1, KD_C.hp2,
  KD_C.jump].map((dist, i) => ({ kind: 'line', col: '#e23b2e',
  pts: alongTrack(KD_SUBTRACK, dist - 35, dist + 35, (i === 1 ? 1 : -1) * 15, 3) }));
// LOG PILES (Kielder: timber stacks at the forest junctions) — solid blocks of stacked logs
const KD_LOGS: Prop[] = [[KD_C.hp1 + 22, 16], [KD_C.sq - 18, -15], [KD_C.sq + 25, 15],
  [KD_C.hp2 + 24, -16], [KD_C.down + 30, 15], [KD_C.longL, -16], [KD_C.dam - 60, -15]]
  .map(([dist, off]) => KD_KIT.prop(dist, off, { kind: 'block', w: 9, h: 3.2, roof: '#7a5232' }));
// THE FOREST: conifer plantations in blocks between the roads (dark seeds), clear of the road by 8
// m
const KD_TREES: Prop[] = [];
for (const [clusterX, clusterY, width, depth, count] of [[-60, 120, 70, 120, 35],
  [140, 40, 100, 120, 40], [10, -120, 120, 90, 40], [-200, -120, 70, 160, 35],
  [170, -140, 80, 60, 25],
  [-60, -60, 80, 80, 28], [70, 210, 90, 30, 15], [-190, 60, 50, 70, 18],
    [200, -200, 50, 30, 10]]) for (let treeIdx = 0; treeIdx < count; treeIdx++) {
  const x = clusterX + (KD_KIT.rnd() - 0.5) * width, y = clusterY + (KD_KIT.rnd() - 0.5) * depth;
  if (KD_KIT.clear(x, y, 8)) KD_TREES.push(
    { kind: 'tree', x, y, s: 4 + KD_KIT.rnd() * 2.5, seed: 2 * treeIdx + 1 });
}
// the TREE WALLS of a forest stage (photographed v1: plantations only, so the road ran through open
// grass): both sides, 10-16 m out, every ~8 m with gaps, along the whole stage (the corners' bales
// / chevrons sit inside 13 m; clear keeps 8 m off any road)
for (let dist = 20; dist < KD_FINISH - 10; dist += 8) for (const side of [-1, 1]) {
  if (KD_KIT.rnd() < 0.3) continue;
  const pos = KD_KIT.at(dist + KD_KIT.rnd() * 4, side * (14 + KD_KIT.rnd() * 6));
  if (KD_KIT.clear(pos.x, pos.y, 8)) KD_TREES.push(
    { kind: 'tree', x: pos.x, y: pos.y, s: 4.5 + KD_KIT.rnd() * 2.5,
    seed: 2 * ((dist | 0) % 50) + 1 });
}
// along the STRAIGHTS too (user: "be liberal"): a marshal post every ~240 m, a sponsor board every
// ~300 m, a flag pair every ~120 m
const KD_ALONG: Prop[] = [];
for (let dist = 120; dist < KD_FINISH - 40; dist += 240) KD_ALONG.push(
  KD_KIT.prop(dist, (dist / 240 | 0) % 2 ? 11 : -11, { kind: 'marshal' }));
['KUM TYRES', 'KILLDER', 'FORESTRY RALLY', 'SLIPPY PISTONS',
  'MUDDY BANK'].forEach((label, i) => KD_ALONG.push(
  KD_KIT.prop(260 + i * 330, i % 2 ? 13 : -13, { kind: 'board', label })));
for (let dist = 60; dist < KD_FINISH - 30; dist += 120) for (const side of [-1, 1]) KD_ALONG.push(
  KD_KIT.prop(dist, side * 9.5, { kind: 'flag',
  col: KD_FLAGC[((dist / 120) | 0) % KD_FLAGC.length] }));
export const KD_PROPS: Prop[] = [
  // service marquees
  ...[[-128, 248], [-104, 248]].map(([x, y]) =>
    ({ kind: 'block', x, y, w: 14, h: 7, rot: 0, roof: '#eef0f2' })),
  { kind: 'truck', x: -220, y: 244, rot: 0, col: '#2f7d4f' },
    { kind: 'truck', x: -195, y: 249, rot: 0, col: '#c8302c' },
    { kind: 'truck', x: -170, y: 244, rot: 0, col: '#2b56b5' },
  // the START arch
  KD_KIT.prop(2, 0, { kind: 'gantry', wid: 17, rot: Math.PI / 2 }),
  // the FINISH arch
  KD_KIT.prop(KD_FINISH, 0, { kind: 'gantry', wid: 17, rot: Math.PI / 2 }),
  KD_KIT.prop(KD_FINISH + 3, -9, { kind: 'board', label: 'FINISH' }),
    KD_KIT.prop(KD_FINISH + 42, -9, { kind: 'board', label: 'STOP' }),
  KD_KIT.prop(40, -11, { kind: 'board', label: 'KILLDER FOREST RALLY' }),
    KD_KIT.prop(KD_C.dam, -12, { kind: 'board', label: 'KUM TYRES' }),
  KD_KIT.prop(KD_C.jump - 25, 12, { kind: 'board', label: 'JUMP' }),
    KD_KIT.prop(KD_C.hp1 - 30, -12, { kind: 'board', label: 'SPECTATORS' }),
  // spectator marquees
  ...[[KD_C.hp1, -26], [KD_C.hp2, 26], [KD_C.jump, -26]].map(([dist, off]) =>
    KD_KIT.prop(dist, off, { kind: 'block', w: 5, h: 5, roof: '#eef0f2' })),
  ...KD_LOGS, ...KD_DRESS, ...KD_ALONG, ...KD_TREES,
].filter((prop) => prop.kind === 'gantry' || prop.kind === 'truck' || prop.kind === 'chevron'
  || prop.kind === 'flag' || (prop.kind === 'block' && prop.w! > 10)
  ? true : KD_KIT.clear(prop.x, prop.y, prop.kind === 'tree' ? 8 : 3));
export const KD_PAINT: Paint[] = [
  { kind: 'chequered', x: KD_SUBTRACK.pts[0].x, y: KD_SUBTRACK.pts[0].y, len: 1.6, wid: 9,
    rot: KD_SUBTRACK.pts[0].heading },
  (() => {
    const pos = onTrack(KD_SUBTRACK, KD_FINISH, 0, {});
    return { kind: 'chequered', x: pos.x, y: pos.y, len: 1.6, wid: 9, rot: pos.rot };
  })(),
];
