import { alongTrack } from "../barriers.ts";
import { autoKerbs, createSubtrack, traceTrack } from "../subtrack.ts";
import { SURFACES } from "../surfaces.ts";
import { prepBumps } from "../terrain.ts";
import { onTrack } from "../tyrewall.ts";
import { trackKit } from "./kit.ts";
import type { Point, Cover, Lane, Cone, Prop, Paint, Barrier } from "../types.ts";
// =============================================================================================
// KILLDER — parody of the Kielder Forest rally stages (Northumberland). Built 2026-10-04. DECIDED (user): "FAST + FLOWING"; "be LIBERAL
// with hay bales, tyres, cones, flags and other event decorations"; a staggered-start stage like Sweaty Lamb (main.js / raceflow stage).
// Real Kielder: fast gravel forest roads through dense conifer plantations, long straights into tight JUNCTION hairpins, big crests and
// jumps, log piles at the junctions, the reservoir (Kielder Water). ~2 km of stage (1966 m traced), in order: the FOREST STRAIGHT out of
// the start, flowing right-left SWEEPERS north, the big CREST, JUNCTION HAIRPIN 1 (right), south past the plantation, the DAM STRAIGHT
// along Kielder Water, a fast right, THE JUMP, a long fast left, the LOG-PILE SQUARE right, north-east S-bends, JUNCTION HAIRPIN 2
// (left), the long crest-y TOP ROAD west, sweeping down the west side, fast S-BENDS, the flying FINISH; then the forest road back.
// MEASURED (layout check): tightest R 24 m (the junction hairpins), road never within 32 m of another part of itself.
const KD_STAGE: Point[] = [[-200, 230], [-140, 232], [-80, 228], [-30, 215], [10, 190], [30, 150], [35, 110], [32, 70], [25, 30], [22, -2], [38, -16], [58, -10], [70, 10],
  [76, 60], [92, 108], [122, 140], [170, 150], [210, 140], [230, 100], [232, 50], [230, 10], [222, -22], [205, -50], [170, -68], [130, -74], [100, -78],
  [93, -110], [96, -160], [115, -195], [150, -212], [190, -208], [218, -214], [226, -234], [205, -248], [170, -246], [120, -240], [60, -226], [0, -236],
  [-60, -226], [-110, -200], [-140, -160], [-150, -110], [-132, -70], [-150, -30], [-126, 10], [-140, 50], [-142, 92]];
const KD_LIAISON: Point[] = [[-150, 130], [-185, 160], [-222, 185], [-240, 210], [-228, 230]];
const KD_SUB0 = createSubtrack(traceTrack([...KD_STAGE, ...KD_LIAISON], { mpp: 1, cx: 0, cy: 0, rMin: 12 }), 9, [], [], true);
const kdD = ([x, y]: Point) => { let best = 0, bd = Infinity; for (const p of KD_SUB0.pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p.dist; } } return best; };
export const KD_FINISH = kdD([-142, 92]), KD_LIAISON_D = kdD([-150, 130]);
export const KD_SUBTRACK = createSubtrack(KD_SUB0.pts.map((p): Point => [p.x, p.y]), 9, [
  { startDist: 0, endDist: KD_LIAISON_D, surface: SURFACES.gravel },          // the STAGE: forest gravel
  { startDist: KD_LIAISON_D, endDist: 1e9, surface: SURFACES.dirt },          // the forest road back (untimed)
], [], true);
const KD_KIT = trackKit(KD_SUBTRACK, 1982, []);   // Kielder Water filled 1982
const KD_C = { sweep: kdD([10, 190]), crest: kdD([30, 50]), hp1: kdD([40, -14]), dam: kdD([150, 150]), fastR: kdD([222, 120]), jump: kdD([231, 30]),
  longL: kdD([190, -60]), sq: kdD([98, -80]), ess: kdD([150, -212]), hp2: kdD([222, -236]), top1: kdD([90, -233]), top2: kdD([-30, -232]),
  down: kdD([-125, -180]), sb: kdD([-140, -50]) };
// KIELDER WATER: the reservoir south-east of the dam straight (shallow edges you can drive into — a wet cover), plus a forest pond
export const KD_WATER: Cover[] = [
  { x: 150, y: 205, w: 170, h: 52, cover: 'wet', shape: 'ellipse', rot: -0.05 },
  { x: 225, y: 228, w: 60, h: 40, cover: 'wet', shape: 'ellipse', rot: 0.3 },
  { x: -40, y: -120, w: 26, h: 16, cover: 'wet', shape: 'ellipse', rot: 0.4 },
];
export const KD_YARD: Lane = { pts: [[-232, 246], [-160, 246]], width: 18, surface: SURFACES.gravel };   // the service park, south of the start
export const KD_BUMPS = prepBumps([
  { kind: 'hump', x: 60, y: -150, r: 140, h: 12 },                               // the forest hill in the north (the top road runs over its edge)
  { kind: 'hump', x: -170, y: -60, r: 90, h: 7 },                                // the west hill the S-bends come down
  { kind: 'hump', ...KD_KIT.at(KD_C.crest, 0), r: 22, h: 1.8 },                  // THE BIG CREST (light car, long view)
  { kind: 'hump', ...KD_KIT.at(KD_C.jump, 0), r: 8, h: 1.3 },                    // THE JUMP (sharp: you fly)
  { kind: 'hump', ...KD_KIT.at(KD_C.top1, 0), r: 18, h: 1.4 }, { kind: 'hump', ...KD_KIT.at(KD_C.top2, 0), r: 18, h: 1.4 },   // crests on the top road
  ...KD_KIT.bank(KD_C.hp1 - 30, KD_C.hp1 + 30, -20, 6, 1.4), ...KD_KIT.bank(KD_C.hp2 - 30, KD_C.hp2 + 30, 20, 6, 1.4),          // spectator banks
]);
// EVENT DRESSING (user: "be liberal"): on EVERY corner chevrons on the outside, hay bales lining the outside, cones on the inside apex,
// flags; tyre-stack walls at the junction hairpins and the square; spectator tape + marquees at the hairpins and the jump; log piles.
const kdTurn = (d: number) => { const a = KD_KIT.rot(d - 8), b = KD_KIT.rot(d + 8); let t = b - a; t = Math.atan2(Math.sin(t), Math.cos(t)); return t > 0 ? 1 : -1; };
export const KD_DRESS: Prop[] = [], KD_CONES: Cone[] = [];
const KD_FLAGC = ['#c8302c', '#e2c13a', '#2b56b5', '#2f7d4f', '#f2f2f2', '#e07a1f'];
for (const c of autoKerbs(KD_SUBTRACK, { maxR: 70, exitR: 0, minTurn: 18, mergeGap: 10 })) {
  if (c.startDist > KD_FINISH - 10) continue;
  const mid = (c.startDist + c.endDist) / 2, dir = kdTurn(mid), out = -dir;   // outside of the corner
  for (let d = c.startDist - 10; d <= Math.min(c.endDist + 14, KD_FINISH - 6); d += 2.2) { const p = KD_KIT.at(d, out * 7.4); KD_CONES.push({ x: p.x, y: p.y, kind: 'bale', rot: KD_KIT.rot(d) }); }
  KD_DRESS.push(KD_KIT.prop(c.startDist - 14, out * 9.5, { kind: 'chevron', rot: dir > 0 ? Math.PI / 2 : -Math.PI / 2 }), KD_KIT.prop(mid, out * 10.5, { kind: 'chevron', rot: dir > 0 ? Math.PI / 2 : -Math.PI / 2 }));
  for (const k of [-5, 0, 5]) { const p = KD_KIT.at(mid + k, -out * 5.2); KD_CONES.push({ x: p.x, y: p.y, kind: 'cone' }); }
  for (let k = 0; k < 3; k++) KD_DRESS.push(KD_KIT.prop(mid - 10 + k * 10, out * 12.5, { kind: 'flag', col: KD_FLAGC[(k + (mid | 0)) % KD_FLAGC.length] }));
}
// tyre walls: the outside of the two junction hairpins and the square (3 rows deep)
for (const [d, side] of [[KD_C.hp1, 1], [KD_C.hp2, -1], [KD_C.sq, 1]]) for (let k = -12; k <= 12; k += 0.95) for (const w of [0, 1, 2]) {
  const p = KD_KIT.at(d + k, side * (8 + w * 0.95)); if (KD_KIT.clear(p.x, p.y, 0.5)) KD_CONES.push({ x: p.x, y: p.y, kind: 'tyrestack' });
}
// cones down the middle of the start and finish straights' run-in, and loose tyres at the stop zone
for (let d = KD_FINISH + 8; d < KD_FINISH + 40; d += 6) { const p = KD_KIT.at(d, 3.5); KD_CONES.push({ x: p.x, y: p.y, kind: 'cone' }); }
// START / FINISH flag lines
for (let k = 0; k < 8; k++) KD_DRESS.push(KD_KIT.prop(4 + k * 5, -7.5, { kind: 'flag', col: ['#c8302c', '#f2f2f2'][k % 2] }), KD_KIT.prop(4 + k * 5, 7.5, { kind: 'flag', col: ['#2b56b5', '#f2f2f2'][k % 2] }),
  KD_KIT.prop(KD_FINISH - 30 + k * 5, -7.5, { kind: 'flag', col: ['#2b56b5', '#f2f2f2'][k % 2] }));
export const KD_TAPE: Barrier[] = [KD_C.hp1, KD_C.hp2, KD_C.jump].map((d, i) => ({ kind: 'line', col: '#e23b2e', pts: alongTrack(KD_SUBTRACK, d - 35, d + 35, (i === 1 ? 1 : -1) * 15, 3) }));
// LOG PILES (Kielder: timber stacks at the forest junctions) — solid blocks of stacked logs
const KD_LOGS: Prop[] = [[KD_C.hp1 + 22, 16], [KD_C.sq - 18, -15], [KD_C.sq + 25, 15], [KD_C.hp2 + 24, -16], [KD_C.down + 30, 15], [KD_C.longL, -16], [KD_C.dam - 60, -15]]
  .map(([d, off]) => KD_KIT.prop(d, off, { kind: 'block', w: 9, h: 3.2, roof: '#7a5232' }));
// THE FOREST: conifer plantations in blocks between the roads (dark seeds), clear of the road by 8 m
const KD_TREES: Prop[] = [];
for (const [cx, cy, w, h, n] of [[-60, 120, 70, 120, 35], [140, 40, 100, 120, 40], [10, -120, 120, 90, 40], [-200, -120, 70, 160, 35], [170, -140, 80, 60, 25],
  [-60, -60, 80, 80, 28], [70, 210, 90, 30, 15], [-190, 60, 50, 70, 18], [200, -200, 50, 30, 10]]) for (let k = 0; k < n; k++) {
  const x = cx + (KD_KIT.rnd() - 0.5) * w, y = cy + (KD_KIT.rnd() - 0.5) * h;
  if (KD_KIT.clear(x, y, 8)) KD_TREES.push({ kind: 'tree', x, y, s: 4 + KD_KIT.rnd() * 2.5, seed: 2 * k + 1 });
}
// the TREE WALLS of a forest stage (photographed v1: plantations only, so the road ran through open grass): both sides, 10-16 m out,
// every ~8 m with gaps, along the whole stage (the corners' bales / chevrons sit inside 13 m; clear() keeps 8 m off any road)
for (let d = 20; d < KD_FINISH - 10; d += 8) for (const side of [-1, 1]) {
  if (KD_KIT.rnd() < 0.3) continue;
  const p = KD_KIT.at(d + KD_KIT.rnd() * 4, side * (14 + KD_KIT.rnd() * 6));
  if (KD_KIT.clear(p.x, p.y, 8)) KD_TREES.push({ kind: 'tree', x: p.x, y: p.y, s: 4.5 + KD_KIT.rnd() * 2.5, seed: 2 * ((d | 0) % 50) + 1 });
}
// along the STRAIGHTS too (user: "be liberal"): a marshal post every ~240 m, a sponsor board every ~300 m, a flag pair every ~120 m
const KD_ALONG: Prop[] = [];
for (let d = 120; d < KD_FINISH - 40; d += 240) KD_ALONG.push(KD_KIT.prop(d, (d / 240 | 0) % 2 ? 11 : -11, { kind: 'marshal' }));
['KUM TYRES', 'KILLDER', 'FORESTRY RALLY', 'SLIPPY PISTONS', 'MUDDY BANK'].forEach((label, i) => KD_ALONG.push(KD_KIT.prop(260 + i * 330, i % 2 ? 13 : -13, { kind: 'board', label })));
for (let d = 60; d < KD_FINISH - 30; d += 120) for (const side of [-1, 1]) KD_ALONG.push(KD_KIT.prop(d, side * 9.5, { kind: 'flag', col: KD_FLAGC[((d / 120) | 0) % KD_FLAGC.length] }));
export const KD_PROPS: Prop[] = [
  ...[[-128, 248], [-104, 248]].map(([x, y]) => ({ kind: 'block', x, y, w: 14, h: 7, rot: 0, roof: '#eef0f2' })),                            // service marquees
  { kind: 'truck', x: -220, y: 244, rot: 0, col: '#2f7d4f' }, { kind: 'truck', x: -195, y: 249, rot: 0, col: '#c8302c' }, { kind: 'truck', x: -170, y: 244, rot: 0, col: '#2b56b5' },
  KD_KIT.prop(2, 0, { kind: 'gantry', wid: 17, rot: Math.PI / 2 }),                                                                         // the START arch
  KD_KIT.prop(KD_FINISH, 0, { kind: 'gantry', wid: 17, rot: Math.PI / 2 }),                                                                 // the FINISH arch
  KD_KIT.prop(KD_FINISH + 3, -9, { kind: 'board', label: 'FINISH' }), KD_KIT.prop(KD_FINISH + 42, -9, { kind: 'board', label: 'STOP' }),
  KD_KIT.prop(40, -11, { kind: 'board', label: 'KILLDER FOREST RALLY' }), KD_KIT.prop(KD_C.dam, -12, { kind: 'board', label: 'KUM TYRES' }),
  KD_KIT.prop(KD_C.jump - 25, 12, { kind: 'board', label: 'JUMP' }), KD_KIT.prop(KD_C.hp1 - 30, -12, { kind: 'board', label: 'SPECTATORS' }),
  ...[[KD_C.hp1, -26], [KD_C.hp2, 26], [KD_C.jump, -26]].map(([d, off]) => KD_KIT.prop(d, off, { kind: 'block', w: 5, h: 5, roof: '#eef0f2' })),   // spectator marquees
  ...KD_LOGS, ...KD_DRESS, ...KD_ALONG, ...KD_TREES,
].filter((p) => p.kind === 'gantry' || p.kind === 'truck' || p.kind === 'chevron' || p.kind === 'flag' || (p.kind === 'block' && p.w! > 10) ? true : KD_KIT.clear(p.x, p.y, p.kind === 'tree' ? 8 : 3));
export const KD_PAINT: Paint[] = [
  { kind: 'chequered', x: KD_SUBTRACK.pts[0].x, y: KD_SUBTRACK.pts[0].y, len: 1.6, wid: 9, rot: KD_SUBTRACK.pts[0].heading },
  (() => { const p = onTrack(KD_SUBTRACK, KD_FINISH, 0, {}); return { kind: 'chequered', x: p.x, y: p.y, len: 1.6, wid: 9, rot: p.rot }; })(),
];
