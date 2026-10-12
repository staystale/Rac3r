import { alongTrack } from "../barriers.ts";
import { FLOOR } from "../bounds.ts";
import { autoKerbs, createSubtrack, traceTrack } from "../subtrack.ts";
import { SURFACES } from "../surfaces.ts";
import { prepBumps } from "../terrain.ts";
import { onTrack, querySubtrack } from "../tyrewall.ts";
import { trackKit } from "./kit.ts";
// =============================================================================================
// SLIDDEN HILL — parody of Lydden Hill (Kent), the rallycross circuit. Built 2026-10-04. Decisions (user, 2026-10-04): loose sections =
// HARD DIRT + gravel patches (the dirt inclusion table), JOKER = an "RX race" (5 laps from the start grid, joker once, missed = +5 s),
// START on the RX grid (the dead-end start straight), scenery like Castle Cum + the hill.
// TRACED from the official RX map (art/ref/ly2.png = Wikimedia "Lydden_Hill_-_Rallycross.svg" at 1280 px: black = tarmac, yellow =
// gravel; no scale bar — sized for a ~1 km lap, 0.30 game m per px). Lap from the JUNCTION where the start straight meets the loop:
// up the diagonal -> PADDOCK HILL (the outer tarmac sweep, top-left) -> CHESSONS DRIFT (gravel, top) -> down to DEVIL'S ELBOW ("almost
// doubles back") -> the climb to NORTH BEND ("a hairpin at the top of the hill") -> HAIRY HILL ("a steep downhill") -> the gravel run
// back to the junction. JOKER = the inner gravel arc across the top-left (branch on the diagonal, rejoin on Chessons Drift).
const SH = { mpp: 0.30, cx: 640, cy: 358 };
const shXY = (px, py) => [+((px - SH.cx) * SH.mpp).toFixed(2), +((py - SH.cy) * SH.mpp).toFixed(2)];
const SH_MAP = [
  [440, 465], [380, 415], [320, 375], [250, 352], [190, 322], [140, 300], [100, 280], [70, 250], [40, 200], [18, 150], [12, 118],   // PADDOCK HILL (outer)
  [25, 95], [50, 70], [80, 52], [130, 32], [200, 22], [260, 22], [330, 32], [400, 62], [470, 105], [530, 150], [560, 180],          // CHESSONS DRIFT (gravel)
  [590, 212], [615, 250], [640, 300], [660, 350], [680, 400], [700, 450], [720, 500], [745, 548], [775, 580], [812, 594],         // down to DEVIL'S ELBOW
  [852, 586], [882, 560], [910, 522], [932, 480], [962, 418], [1000, 330], [1040, 240], [1080, 150], [1110, 80], [1132, 42],      // the climb
  [1162, 18], [1200, 14], [1238, 38], [1258, 78], [1255, 120], [1240, 160],                                                     // NORTH BEND
  [1210, 212], [1170, 282], [1120, 366], [1080, 436], [1040, 506], [1000, 575], [968, 630], [935, 668], [895, 688],              // HAIRY HILL
  [845, 692], [792, 682], [740, 662], [698, 634], [658, 598], [620, 558], [586, 520], [556, 500], [518, 492], [478, 484]];        // gravel run back
const SH_SUBTRACK0 = createSubtrack(traceTrack(SH_MAP, { mpp: SH.mpp, cx: SH.cx, cy: SH.cy, rMin: 15.5 }), 14, [], [], true);
// sector distances from where the map's colours change (nearest trace point to the colour boundary)
const shD = (px, py) => { const [x, y] = shXY(px, py); let best = 0, bd = Infinity; for (const p of SH_SUBTRACK0.pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p.dist; } } return best; };
const SH_D = { chessIn: shD(80, 52), chessOut: shD(560, 180), runIn: shD(890, 690), runOut: shD(552, 498) };
const SH_SECTORS = [
  { startDist: 0, endDist: SH_D.chessIn, surface: SURFACES.racetarmac },
  { startDist: SH_D.chessIn, endDist: SH_D.chessOut, surface: SURFACES.dirt },
  { startDist: SH_D.chessOut, endDist: SH_D.runIn, surface: SURFACES.racetarmac },
  { startDist: SH_D.runIn, endDist: SH_D.runOut, surface: SURFACES.dirt },
  { startDist: SH_D.runOut, endDist: 1e9, surface: SURFACES.racetarmac },
];
export const SH_SUBTRACK = createSubtrack(SH_SUBTRACK0.pts.map((p) => [p.x, p.y]), 14, SH_SECTORS, [], true);
SH_SUBTRACK.curvedKerbs = autoKerbs(SH_SUBTRACK, { maxR: 70, exitR: 30, heavyR: 22, minTurn: 20, mergeGap: 12 });
// the JOKER (inner gravel arc) and the START STRAIGHT (the RX grid, used once) are LANES: drivable, off the lap's centreline
// OPEN path smoothing (Chaikin, endpoints kept) — traceTrack is for closed loops only
export const openSmooth = (pts, it = 3) => { let p = pts; for (let k = 0; k < it; k++) { const o = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const [ax, ay] = p[i], [bx, by] = p[i + 1]; o.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]); } o.push(p[p.length - 1]); p = o; } return p.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]); };
export const SH_JOKER = { pts: openSmooth([[245, 347], [190, 312], [150, 280], [118, 240], [105, 200], [104, 160], [112, 120], [130, 82], [160, 54], [195, 36], [228, 26]].map(([x, y]) => shXY(x, y))), width: 12, surface: SURFACES.dirt };
export const SH_START = (() => { const a = shXY(725, 700), j = shXY(445, 468), L = Math.hypot(j[0] - a[0], j[1] - a[1]);
  const nx = -(j[1] - a[1]) / L, ny = (j[0] - a[0]) / L, k = -8;   // n = toward the loop; shift 8 m AWAY from it
  const m = [a[0] + (j[0] - a[0]) * 0.62 + nx * k, a[1] + (j[1] - a[1]) * 0.62 + ny * k];
  return { pts: [[+(a[0] + nx * k).toFixed(2), +(a[1] + ny * k).toFixed(2)], [+m[0].toFixed(2), +m[1].toFixed(2)], j], width: 14, surface: SURFACES.racetarmac }; })();
// the tyre wall: along the start straight, in the middle of the grass between its edge and the loop's edge, two staggered rows, only where
// the gap is >= 4 m, stopping before the junction
export const SH_STARTWALL = (() => { const out = [], P = SH_START.pts, half = 7;
  for (let s = 0; s < 2; s++) { const [a, b] = [P[s], P[s + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0; t < L; t += 0.95) { const x = a[0] + (b[0] - a[0]) * t / L, y = a[1] + (b[1] - a[1]) * t / L, q = querySubtrack(SH_SUBTRACK, x, y);
      if (!q.seg || q.dist - 14 < 4) continue;
      const c = onTrack(SH_SUBTRACK, q.trackDist, 0, {}), dx = c.x - x, dy = c.y - y, dd = Math.hypot(dx, dy), mid = (half + (dd - 14) / 2) / dd;
      for (const [row, sh] of [[-0.5, 0], [0.5, 0.475]]) out.push({ x: +(x + dx * mid + (-dy / dd) * 0 + (dx / dd) * row + ((b[0] - a[0]) / L) * sh).toFixed(2), y: +(y + dy * mid + (dy / dd) * row + ((b[1] - a[1]) / L) * sh).toFixed(2), kind: 'tyrestack' });
    } }
  // and never on the start straight itself (at its bend 5 stacks landed on it — tools/tyrewallcheck)
  const onS = (o) => { for (let i = 0; i < P.length - 1; i++) { const [ax, ay] = P[i], [bx, by] = P[i + 1], dx = bx - ax, dy = by - ay; let t = Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.y - ay) * dy) / (dx * dx + dy * dy))); if (Math.hypot(o.x - ax - dx * t, o.y - ay - dy * t) < half + 0.6) return true; } return false; };
  return out.filter((o) => !onS(o)); })();
// JOKER RULES (user, 2026-10-03/04): once per race, mandatory, missed = time penalty; a translucent white arrow, gently pulsing, at
// the entry. The GATE is the middle of the joker lane: drive through it and the joker counts. Normal route branch -> rejoin 180 m,
// joker 134 m but tight and on dirt (MEASURED cost: ENGINE.md).
// ARROWS (user, 2026-10-04: "the arrow needs to be closer and more clearly pointing at the joker lap, and vanish when it has been
// taken"). The first cut sat at the split pointing along BOTH routes (they part slowly: 1 m apart at 72 m, 11 m at 112 m, measured).
// Now: one on the track 7 m before the split, on the joker (+) half, turned 20 deg toward it; one at the joker's mouth where the
// routes are ~9 m apart, pointing down the joker. Both 10 m long. main.js hides them once the gate is driven through.
// JOKER ARROW ACROSS THE TRANSITION (user, 2026-10-04, phone screenshot: "joker arrows should sit across the transition to highlight the
// joker section clearly"): centred where the joker's centre line crosses the ROAD EDGE (half on the tarmac, half on the dirt), aimed along
// the joker there. (Before: on the track ~40 m before the split, aimed at the mouth.)
// the APPROACH arrow (user, 2026-10-04: "not sure the joker suggestion is showing correctly"): the lane-mouth arrow sat just off the road
// and landed at the screen edge at speed; this one is ON the road, 30 m before the turn-off, on the joker's side, angled into the lane
export function jokerApproach(sub, J, len = 12) {
  const hw = sub.width / 2;
  for (let i = 1; i < J.length - 1; i++) if (querySubtrack(sub, J[i][0], J[i][1]).dist > hw) {
    const q = querySubtrack(sub, J[i][0], J[i][1]), p0 = sub.pts[q.seg], side = Math.sign((J[i][0] - p0.x) * p0.nx + (J[i][1] - p0.y) * p0.ny) || 1;
    const d = ((q.trackDist - 30) % sub.totalDist + sub.totalDist) % sub.totalDist, p = onTrack(sub, d, side * (hw - 2.5), {});
    return { x: p.x, y: p.y, rot: p.rot + side * 0.35, len, d: q.trackDist };
  }
  return null;
}
export function jokerArrow(sub, J, len = 10) {
  const hw = sub.width / 2;
  for (let i = 1; i < J.length - 1; i++) if (querySubtrack(sub, J[i][0], J[i][1]).dist > hw) {
    const a = J[Math.max(0, i - 2)], b = J[Math.min(J.length - 1, i + 2)];
    return { x: J[i][0], y: J[i][1], rot: Math.atan2(b[1] - a[1], b[0] - a[0]), len };
  }
  return null;
}
export const SH_JOKER_RULE = (() => { const J = SH_JOKER.pts, m = J[Math.floor(J.length / 2)], a = J[30], b = J[34];   // 30: fully on the gravel (22 straddled the edge, photographed)
  const t = onTrack(SH_SUBTRACK, 60, 3.5, {});
  // PENALTY 5 -> 10 s (MEASURED, tools/jokercost: the joker costs rally 1.8 s but hatch 7.4 / track car 6.4 s — slow on dirt — so at
  // +5 s a road car was FASTER skipping it. The penalty must beat every car's joker cost.)
  // USER (phone screenshot with a red hand-drawn arrow, 2026-10-04): "only ONE arrow, placed where the red arrow is" — on the track
  // at its right edge just before the gravel splits off, pointing into the joker's mouth.
  const u = onTrack(SH_SUBTRACK, 98, 4, {});
  // PENALTY 10 -> 30 s per miss OR extra joker (user, 2026-10-04: "harsh, real-ish")
  return { gate: { x: m[0], y: m[1], r: 7 }, penalty: 30, laps: 5, arrows: [jokerArrow(SH_SUBTRACK, J), jokerApproach(SH_SUBTRACK, J)].filter(Boolean) }; })();

// SLIDDEN HILL SCENERY (user: "same treatment" + the hill). Distances on this trace (lap 1136 m): joker branch 69 / rejoin 249, PADDOCK
// HILL 166, CHESSONS DRIFT 202-361 (dirt), DEVIL'S ELBOW 511 (a LEFT hairpin: its outside is +), NORTH BEND 742, HAIRY HILL 856, the
// gravel run 978-1101. + = inside except at the Elbow (measured against the centroid).
const SH_ST = SH_START.pts, SH_SDIR = (() => { const [a, b] = SH_ST, L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; })();
const shOffStart = (t, side) => [+(SH_ST[0][0] + (SH_ST[1][0] - SH_ST[0][0]) * t + -SH_SDIR[1] * side).toFixed(2), +(SH_ST[0][1] + (SH_ST[1][1] - SH_ST[0][1]) * t + SH_SDIR[0] * side).toFixed(2)];
// the PADDOCK: a tarmac apron beside the start grid, on its south-west side (photo art/ref/ly1.jpg: buildings low down by the start)
export const SH_PADDOCK = { pts: [shOffStart(0.05, -40), shOffStart(0.55, -40)], width: 30, surface: SURFACES.tarmac };
const SH_KIT = trackKit(SH_SUBTRACK, 1955, [SH_START, SH_JOKER, SH_PADDOCK]);   // Lydden opened in 1955
export const SH_ARMCO = [[120, 200, -16], [230, 330, -16], [480, 545, 16], [700, 790, -16]];   // Paddock Hill, Chessons, Devil's Elbow (+), North Bend
export const SH_BUMPS = prepBumps([
  // THE HILL: North Bend is "a hairpin at the top of the hill", then HAIRY HILL "a steep downhill". One broad cos^2 hill over the
  // top-right: 8 m high, 105 m radius -> steepest ~12 %, flat again before Devil's Elbow and Chessons (both > 170 m from its centre).
  { kind: 'hump', x: +((1150 - SH.cx) * SH.mpp).toFixed(2), y: +((140 - SH.cy) * SH.mpp).toFixed(2), r: 105, h: 8 },
  // the natural bowl: viewing banks round the outside
  ...SH_KIT.bank(90, 480, -32, 7, 1.4), ...SH_KIT.bank(470, 560, 32, 7, 1.6), ...SH_KIT.bank(570, 1110, -32, 7, 1.3),
]);
const SH_TREES = [];
for (let k = 0; k < 500 && SH_TREES.length < 130; k++) {
  const x = (SH_KIT.rnd() - 0.5) * 2 * (FLOOR - 12), y = (SH_KIT.rnd() - 0.5) * 2 * (FLOOR - 12);
  if (SH_KIT.clear(x, y, 12)) SH_TREES.push({ kind: 'tree', x, y, s: 3 + SH_KIT.rnd() * 4, seed: 900 + k });
}
export const SH_PROPS = [
  (() => { const [x, y] = shOffStart(0.12, 0); return { kind: 'gantry', x, y, wid: 22, rot: Math.atan2(SH_SDIR[1], SH_SDIR[0]) + Math.PI / 2 }; })(),   // start lights
  ...[0.12, 0.27, 0.42].flatMap((t, k) => { const [x1, y1] = shOffStart(t, -33), [x2, y2] = shOffStart(t + 0.06, -47), r = Math.atan2(SH_SDIR[1], SH_SDIR[0]);
    return [{ kind: 'truck', x: x1, y: y1, rot: r, col: ['#c8302c', '#2b56b5', '#e2c13a'][k] }, { kind: 'truck', x: x2, y: y2, rot: r + Math.PI, col: ['#2f7d4f', '#f2f2f2', '#7a3fa0'][k] }]; }),
  (() => { const [x, y] = shOffStart(0.7, -46); return { kind: 'block', x, y, w: 22, h: 12, rot: Math.atan2(SH_SDIR[1], SH_SDIR[0]), roof: '#7a5a48', label: 'CHESSONS' }; })(),
  SH_KIT.prop(300, -24, { kind: 'board', label: 'SLIDDEN HILL' }),
  SH_KIT.prop(820, -24, { kind: 'board', label: 'KUM TYRES' }),
  ...[166, 279, 742, 856, 1039].map((d) => SH_KIT.prop(d, -21, { kind: 'marshal' })), SH_KIT.prop(511, 21, { kind: 'marshal' }),
  ...SH_TREES,
].filter((p) => p.kind === 'gantry' || p.kind === 'truck' || p.kind === 'block' || SH_KIT.clear(p.x, p.y, p.kind === 'tree' ? 12 : 3));
export const SH_TYREWALL = SH_ARMCO.flatMap(([a, b, off]) => [[off - Math.sign(off) * 2, 0], [off - Math.sign(off) * 1, 0.475]].flatMap(([o, sh]) => alongTrack(SH_SUBTRACK, a + sh, b, o, 0.95).map(([x, y]) => ({ x, y, kind: 'tyrestack' }))));
