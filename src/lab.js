// lab.js — THE SCENE, as data (PLAN.md / CLAUDE.md §6: never hard-code a position that should be a
// number in a file; the first request after the first drive is "move that three metres closer").
//
// A proving-ground floor: pale, bounded by a hazard kerb (A4), with painted figures that give the eye
// something to measure speed and drift angle against, and cones to aim at.
import { setFloor, setRect } from "./world/bounds.js";
export * from "./world/bounds.js";
import { FLOOR, KERB_W, edgeOut } from "./world/bounds.js";
export * from "./world/state.js";
import { LEVEL, setActiveLevel } from "./world/state.js";
export * from "./world/surfaces.js";
import {
  SURFACES, SURFACE_TRAP,
} from "./world/surfaces.js";
export * from "./world/barriers.js";
import {
  smoothOnTrack, alongTrack, prepBarriers, solidsFromProps, LAB_PAINT, LAB_BOARDS,
} from "./world/barriers.js";
export * from "./world/course.js";
export * from "./world/subtrack.js";
import { autoKerbs, traceTrack, createSubtrack } from "./world/subtrack.js";
export * from "./world/levels/lab-extension.js";
import {
  LAB_BOUNDS, LAB_LANE_ZONES, LAB_OFFROAD_ZONES, LAB_OFFROAD_BUMPS,
  LAB_EXT_PAINT, LAB_EXT_BOARDS, LAB_CRASH_OBJECTS,
} from "./world/levels/lab-extension.js";
export * from "./world/zones.js";
import { zoneAt, laneAt } from "./world/zones.js";
export * from "./world/terrain.js";
import { prepBumps, resetNatLevel } from "./world/terrain.js";
export * from "./world/wear.js";
import {
  COVER_IDS, PATCH_CELL, patchKey, PATCH_GRID, resetPATCH_GRID, HEAT_OFFROAD,
} from "./world/wear.js";
export * from "./world/tyrewall.js";
import {
  courseCones, onTrack, querySubtrack, slalom, outerTyreWall, propClearance,
} from "./world/tyrewall.js";
import {
  SB_SUBTRACK, SB_CONES, SB_COVERS, SB_ZONES, SB_BUMPS, SB_PAINT, SB_BOARDS, SB_PROPS, SB_SPAWN,
  LAB_BUMPS, LAB_PANELS,
} from "./world/levels/sandbox.js";
import {
  TT_SUBTRACK, TT_CONES, TT_ZONES, TT_BUMPS, TT_PAINT, TT_BOARDS,
} from "./world/levels/test-track.js";
import {
  GO_SECTORS, GO_SUBTRACK, GO_RANDOM_PATCHES, randomiseGrassTrack, GO_ZONES, GO_PROPS, GO_PAINT,
  GO_BOARDS,
} from "./world/levels/grass-track.js";
import { SO_SUBTRACK, SO_ZONES, SO_PROPS, SO_PAINT, SO_BOARDS } from "./world/levels/stock-car.js";
import { NC_SUBTRACK, NC_ZONES, NC_PROPS, NC_PAINT, NC_BOARDS } from "./world/levels/naffcar.js";
// =============================================================================================
// THE LEVELS. `base` is what you are on where no zone covers you; `zones` are first-hit-wins.

import {
  TH_SUBTRACK, TH_ZONES, TH_BUMPS, TH_PAINT, TH_PROPS, TH_CONES, TH_STAND, TH_PIT, TH_GAR, TH_ARMCO,
  TH_LANES,
} from "./world/levels/thruston.js";
import {
  CC_SUBTRACK, CC_ZONES, CC_BUMPS, CC_PAINT, CC_PROPS, CC_TYREWALL, CC_KIT, CC_LANES, CC_ARMCO,
} from "./world/levels/castle-cum.js";
import {
  openSmooth, jokerArrow, jokerApproach, SH_SUBTRACK, SH_BUMPS, SH_START, SH_JOKER, SH_PADDOCK,
  SH_JOKER_RULE, SH_PROPS, SH_TYREWALL, SH_STARTWALL, SH_ARMCO,
} from "./world/levels/slidden-hill.js";
import {
  SL_SUBTRACK, SL_BUMPS, SL_STREAM, SL_PAINT, SL_CONES, SL_PROPS, SL_TAPE, SL_YARD, SL_FINISH,
} from "./world/levels/sweaty-lamb.js";
import {
  KD_SUBTRACK, KD_BUMPS, KD_WATER, KD_PAINT, KD_CONES, KD_PROPS, KD_TAPE, KD_YARD, KD_FINISH,
} from "./world/levels/killder.js";
import { BH_GP_LEVEL, BH_INDY_LEVEL } from "./world/levels/brands-snatch.js";
import { trackKit } from "./world/levels/kit.js";
export { trackKit };
export { BRANDS_DROPPED } from "./world/levels/brands-snatch.js";
// =============================================================================================
// KNOBHILL — parody of Knockhill (Fife), the rallycross layout. Built 2026-10-04. Decisions (user): the TARMAC CIRCUIT + an INFIELD
// DIRT section (~40 % dirt like the real RX lap: 1.4 km, 39 % dirt), DRY, hills FELT like Brands ("twists, drops and climbs 60 m").
// TRACED from Wikimedia "Knockhill_circuit_map.png" (art/ref/kh3.png, 800 px; 100 m = 76 px) at 0.62 game m/px. Clockwise from the line:
// DUFFUS DIP (fast blind downhill right) -> SCOTSMAN (90 right) -> BUTCHERS -> the chicane -> bottom straight [JOKER: a dirt loop off the
// LEFT after turn 4, as the real one] -> CLARK'S (blind uphill right, "onto two wheels") -> DIRT: HISLOP'S -> up to the hairpin -> back
// onto the start straight. No published RX map: the dirt runs where the real circuit's tarmac does from Clark's to the hairpin.
const KH = { mpp: 0.62, cx: 400, cy: 520 };
const khXY = (px, py) => [+((px - KH.cx) * KH.mpp).toFixed(2), +((py - KH.cy) * KH.mpp).toFixed(2)];
const KH_MAP = [[365, 378], [420, 384], [480, 392], [540, 402], [578, 412], [592, 430], [605, 455], [622, 475], [650, 485], [690, 495], [705, 508],   // DUFFUS DIP
  [708, 532], [700, 560], [690, 590], [670, 610], [645, 625], [622, 642], [600, 655], [560, 662], [500, 670], [440, 675], [405, 676],              // SCOTSMAN, BUTCHERS, chicane
  [388, 665], [378, 640], [366, 602], [345, 572], [320, 545], [280, 510], [220, 470], [160, 435], [112, 405], [90, 385], [92, 366], [110, 357],    // CLARK'S, HISLOP'S, HAIRPIN
  [150, 360], [220, 366], [290, 372]];
const KH_SUB0 = createSubtrack(traceTrack(KH_MAP, { mpp: KH.mpp, cx: KH.cx, cy: KH.cy, rMin: 15.5 }), 13, [], [], true);
const khD = (px, py) => { const [x, y] = khXY(px, py); let b = 0, bd = Infinity; for (const p of KH_SUB0.pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; b = p.dist; } } return b; };
const KH_D = { dirtIn: khD(395, 670), dirtOut: khD(215, 366) };
const KH_SUBTRACK = createSubtrack(KH_SUB0.pts.map((p) => [p.x, p.y]), 13, [
  { startDist: 0, endDist: KH_D.dirtIn, surface: SURFACES.racetarmac },
  { startDist: KH_D.dirtIn, endDist: KH_D.dirtOut, surface: SURFACES.dirt },
  { startDist: KH_D.dirtOut, endDist: 1e9, surface: SURFACES.racetarmac },
], [], true);
KH_SUBTRACK.curvedKerbs = autoKerbs(KH_SUBTRACK, { maxR: 70, exitR: 30, heavyR: 22, minTurn: 20, mergeGap: 12 }).filter((k) => k.endDist < KH_D.dirtIn || k.startDist > KH_D.dirtOut);   // no kerbs on dirt
// the JOKER: a dirt loop off the LEFT (south) of the bottom straight after the chicane
// SHALLOW (MEASURED, tools/jokercost: the first loop, 34 m deep, cost 7-16.5 s; a real RX joker costs ~1-3 s)
// + 4 m further out in the middle (user wanted bales between joker and track: the strip was 1-2 m)
const KH_JOKER = { pts: openSmooth([[590, 657], [572, 684], [540, 699], [500, 701], [468, 694], [448, 678]].map(([x, y]) => khXY(x, y))), width: 12, surface: SURFACES.dirt };
const KH_JOKER_RULE = (() => { const J = KH_JOKER.pts, m = J[Math.floor(J.length / 2)], a = J[6], u = onTrack(KH_SUBTRACK, khD(620, 643), -4, {});
  return { gate: { x: m[0], y: m[1], r: 7 }, penalty: 30, laps: 5, arrows: [jokerArrow(KH_SUBTRACK, J), jokerApproach(KH_SUBTRACK, J)].filter(Boolean) }; })();
const KH_LEVEL = (() => {
  const sub = KH_SUBTRACK, hw = sub.width / 2;
  // gravel traps on the outside of the TARMAC corners only (the real Clark's has one); tyre walls on the dirt corners instead
  const traps = [], barriers = [], cones = [];
  const isDirt = (d) => d > KH_D.dirtIn - 5 && d < KH_D.dirtOut + 5;
  for (const c of autoKerbs(sub, { maxR: 45, exitR: 0, minTurn: 35, mergeGap: 15 })) {
    const out = c.side === 'left' ? -1 : 1;
    if (isDirt(c.startDist) && isDirt(c.endDist)) { for (const [x, y] of alongTrack(sub, c.startDist - 5, c.endDist + 15, out * (hw + 4), 0.95)) cones.push({ x, y, kind: 'tyrestack' }); continue; }
    traps.push({ out, d0: c.startDist - 5, d1: c.endDist + 30, pts: alongTrack(sub, c.startDist - 5, c.endDist + 30, out * (hw + 2 + 6), 2), width: 12, surface: SURFACES.gravel });
  }
  const kit = trackKit(sub, 1974, [KH_JOKER, ...traps]);   // Knockhill opened 1974
  const nearRoad = (x, y) => querySubtrack(sub, x, y).dist < hw + 4 || kit.onLane(x, y, 0.6);
  const runs = (pts) => { const out = []; let cur = []; for (const q of pts) { if (nearRoad(q[0], q[1])) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push(q); } if (cur.length > 1) out.push(cur); return out; };
  for (const t of traps) {
    const o = t.out * (hw + 2 + 12 + 2.5);
    for (const r of runs(alongTrack(sub, t.d0, t.d1, o, 2))) barriers.push({ kind: 'armco', pts: r });
    for (const [oo, sh] of [[o - t.out * 1.4, 0], [o - t.out * 2.35, 0.475]]) for (const [x, y] of alongTrack(sub, t.d0 + sh, t.d1, oo, 0.95)) if (!nearRoad(x, y)) cones.push({ x, y, kind: 'tyrestack' });
  }
  const finalCones = cones.filter((c) => querySubtrack(sub, c.x, c.y).dist > hw + 1.2 && !kit.onLane(c.x, c.y, 0.3));
  const props = [
    kit.prop(2, 0, { kind: 'gantry', wid: 24, rot: Math.PI / 2 }),
    kit.prop(khD(470, 390), -28, { kind: 'grandstand', w: 80, h: 9 }),          // the main stand above the start straight (north)
    kit.prop(khD(600, 440), -30, { kind: 'grandstand', w: 34, h: 8 }),          // Duffus Dip
    kit.prop(khD(380, 650), 34, { kind: 'grandstand', w: 30, h: 8 }),           // Clark's
    kit.prop(khD(330, 378), -40, { kind: 'tower', size: 8 }),
    kit.prop(khD(230, 368), -26, { kind: 'board', label: 'KNOBHILL' }), kit.prop(khD(700, 540), -26, { kind: 'board', label: 'KUM TYRES' }),
    ...[[420, 300], [470, 296], [520, 300], [570, 304]].map(([x, y], k) => { const [wx, wy] = khXY(x, y); return { kind: 'truck', x: wx, y: wy, rot: 0.08, col: ['#c8302c', '#2b56b5', '#e2c13a', '#2f7d4f'][k] }; }),   // the paddock (north)
  ];
  for (const c of sub.curvedKerbs) props.push(kit.prop((c.startDist + c.endDist) / 2, (c.side === 'left' ? 1 : -1) * (hw + 28), { kind: 'marshal' }));
  for (let k = 0; k < 600 && props.filter((p) => p.kind === 'tree').length < 110; k++) {   // Fife farmland: trees round the outside, few inside
    const x = (kit.rnd() - 0.5) * 2 * (FLOOR - 12), y = (kit.rnd() - 0.5) * 2 * (FLOOR - 12);
    if ((Math.abs(y) > 120 || Math.abs(x) > 230 || kit.rnd() < 0.15) && kit.clear(x, y, 10)) props.push({ kind: 'tree', x, y, s: 3.5 + kit.rnd() * 3, seed: k });
  }
  // footprint check, as Brands (props on the road were a real bug there)
  const FOOT = { grandstand: (p) => [p.w, p.h], tower: (p) => [p.size, p.size], truck: () => [14, 2.5], marshal: () => [2.4, 2], board: () => [18, 1.2], tree: (p) => [p.s * 0.5, p.s * 0.5] };
  const boxClear = (p) => { const f = FOOT[p.kind]; if (!f) return true; const [w, h] = f(p), c = Math.cos(p.rot || 0), sn = Math.sin(p.rot || 0);
    for (let u = -w / 2 - 1.5; u <= w / 2 + 1.5; u += 1.5) for (let v = -h / 2 - 1.5; v <= h / 2 + 1.5; v += 1.5) { const x = p.x + c * u - sn * v, y = p.y + sn * u + c * v;
      if (querySubtrack(sub, x, y).dist < hw + 0.5 || kit.onLane(x, y, 0) || Math.abs(x) > FLOOR - 4 || Math.abs(y) > FLOOR - 4) return false; }
    return true; };
  const okProps = props.filter((p) => p.kind === 'gantry' || boxClear(p));
  const hills = [
    { kind: 'dip', ...(([x, y]) => ({ x, y }))(khXY(625, 480)), r: 55, d: 3.5 },      // DUFFUS DIP
    { kind: 'hump', ...(([x, y]) => ({ x, y }))(khXY(372, 628)), r: 32, h: 2.2 },     // CLARK'S blind uphill crest
    { kind: 'hump', ...(([x, y]) => ({ x, y }))(khXY(150, 395)), r: 95, h: 4.0 },     // the hairpin on the hill top
  ];
  return {
    id: 'knobhill', name: 'Knobhill', base: SURFACES.grass, subtrack: sub,
    camber: { maxDeg: 2, refR: 60, crown: 0.02, edge: 6, sections: [] },
    zones: [], bumps: prepBumps([...hills, ...kit.bank(khD(560, 402), khD(690, 495), -34, 7, 1.4), ...kit.bank(khD(320, 545), khD(112, 405), 34, 7, 1.3)]),
    paint: [{ kind: 'chequered', x: sub.pts[0].x, y: sub.pts[0].y, len: 1.6, wid: 13, rot: sub.pts[0].heading }],
    boards: [], seams: false, cones: [...finalCones, ...rxDress(sub, [KH_JOKER, ...traps], finalCones, [[KH_D.dirtIn, KH_D.dirtOut]]), ...jokerBales(sub, KH_JOKER, finalCones)],
    lanes: [KH_JOKER, ...traps], joker: KH_JOKER_RULE, barriers, props: okProps, solids: solidsFromProps(okProps),
    spawn: (() => { const p = onTrack(sub, sub.totalDist - 15, 0, {}); return { x: p.x, y: p.y, heading: p.rot }; })(),
  };
})();

// RALLYCROSS DRESSING (user, 2026-10-04: "a couple more hay bales and tyres around Slidden Hill and Knobhill"): knockable HAY BALES every 2.2 m
// along the OUTSIDE of every corner (hw + 4.5), and a 2 x 3 block of TYRE STACKS on each inside apex (hw + 2.5) — kept off the road, every
// lane (joker, start, traps, paddock) and 1.6 m clear of any existing object.
function rxDress(sub, lanes, existing, lined = []) {   // lined: [[d0, d1]] stretches with bales along BOTH sides every 4.4 m
  const hw = sub.width / 2, out = [], have = [...existing];
  const onLane = (x, y) => lanes.some((ln) => ln.pts.some(([ax, ay], i) => { const q = ln.pts[i + 1]; if (!q) return false; const dx = q[0] - ax, dy = q[1] - ay, l2 = dx * dx + dy * dy || 1;
    let t = ((x - ax) * dx + (y - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(x - ax - dx * t, y - ay - dy * t) <= ln.width / 2 + 1; }));
  const free = (x, y) => querySubtrack(sub, x, y).dist > hw + 1.5 && !onLane(x, y) && Math.abs(x) < FLOOR - 5 && Math.abs(y) < FLOOR - 5 && !have.some((c) => Math.hypot(c.x - x, c.y - y) < 1.6);
  const add = (o) => { if (free(o.x, o.y)) { out.push(o); have.push(o); } };
  for (const c of autoKerbs(sub, { maxR: 60, exitR: 0, minTurn: 25, mergeGap: 10 })) {
    const outS = c.side === 'left' ? -1 : 1, mid = (c.startDist + c.endDist) / 2;
    // ONLY WHERE THERE IS NO WALL YET (user: "they should go where there isn't already Armco and tyre walls" — the first pass lined bales in
    // front of Slidden Hill's tyre walls): skip a bale with an existing tyre stack within 6 m
    for (let d = c.startDist - 6; d <= c.endDist + 10; d += 2.2) { const p = smoothOnTrack(sub, d, outS * (hw + 4.5)); if (existing.some((e) => e.kind === 'tyrestack' && Math.hypot(e.x - p.x, e.y - p.y) < 6)) continue; add({ x: p.x, y: p.y, kind: 'bale', rot: onTrack(sub, ((d % sub.totalDist) + sub.totalDist) % sub.totalDist, 0, {}).rot }); }
    for (const dd of [-1, 0, 1]) for (const w of [0, 1]) { const p = smoothOnTrack(sub, mid + dd * 0.95, -outS * (hw + 2.5 + w * 0.95)); add({ x: p.x, y: p.y, kind: 'tyrestack' }); }
  }
  for (const [d0, d1] of lined) for (let d = d0; d <= d1; d += 4.4) for (const sd of [-1, 1]) { const p = smoothOnTrack(sub, d, sd * (hw + 4.5)); add({ x: p.x, y: p.y, kind: "bale", rot: onTrack(sub, ((d % sub.totalDist) + sub.totalDist) % sub.totalDist, 0, {}).rot }); }
  return out;
}

// JOKER SEPARATION (user, 2026-10-04: "hay bales between the joker section and the normal track on both rallycross tracks — a clear barrier"):
// a line of bales in the MIDDLE of the grass strip between the joker and the main road, every 2.1 m wherever that strip is at least 2.2 m wide
// (so the joker's mouth and exit stay open).
function jokerBales(sub, joker, existing) {
  const hw = sub.width / 2, jw = joker.width / 2, out = [], J = joker.pts;
  let acc = 0;
  for (let i = 1; i < J.length; i++) {
    const [ax, ay] = J[i - 1], [bx, by] = J[i], L = Math.hypot(bx - ax, by - ay);
    for (let t = acc; t < L; t += 2.1) {
      const x = ax + (bx - ax) * t / L, y = ay + (by - ay) * t / L, q = querySubtrack(sub, x, y), gap = q.dist - hw - jw;
      // clear of the main road's KERBS (2.4 m) too: bale centre >= 3.3 m off the road edge and >= 0.9 m off the joker edge (photographed on a kerb)
      if (gap < 4.2) continue;
      const c = onTrack(sub, q.trackDist, 0, {}), dx = c.x - x, dy = c.y - y, dl = Math.hypot(dx, dy) || 1, k = jw + Math.min(gap / 2, gap - 3.3);
      const p = { x: +(x + dx / dl * k).toFixed(2), y: +(y + dy / dl * k).toFixed(2), kind: 'bale', rot: Math.atan2(by - ay, bx - ax) };
      if (![...existing, ...out].some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 1.6)) out.push(p);
    }
    acc = (acc - L) % 2.1; if (acc < 0) acc += 2.1;
  }
  return out;
}

export const LEVELS = [
  {
    id: 'lab', name: 'The Lab',
    coneCount: true,      // show the knocked-cone tally (a cone course)
    // COVERS (2026-10-03): lying ON whatever is under them; see "LAYERED" wear in this file. The ice sheet
    // is over GRASS on purpose — scrub it through and the grass shows, then wears to mud (the user's chain).
    covers: [
      { x: -95, y: -185, w: 60, h: 30, cover: 'ice', shape: 'ellipse' },
      { x: -180, y: -185, w: 50, h: 26, cover: 'snow', shape: 'ellipse' },
      { x: 120, y: 60, w: 16, h: 10, cover: 'wet', shape: 'ellipse', rot: 0.3 },
    ],
    base: SURFACES.lab,
    bounds: LAB_BOUNDS,   // S-B: 520 x 1000 m, the extension south of the old square
    zones: [
      ...LAB_PANELS,
      { x: -FLOOR / 2, y: FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.lab },      // SW
      { x: FLOOR / 2, y: FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.tarmac },    // SE
      { x: FLOOR / 2, y: -FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.gravel },   // NE
      { x: -FLOOR / 2, y: -FLOOR / 2, w: FLOOR, h: FLOOR, surface: SURFACES.grass },   // NW
      // S-B: AFTER the old zones, so the old blend's random stream (and every old patch) is unchanged
      ...LAB_LANE_ZONES, ...LAB_OFFROAD_ZONES,
    ],
    bumps: [...LAB_BUMPS, ...prepBumps(LAB_OFFROAD_BUMPS)],
    paint: [...LAB_PAINT, ...LAB_EXT_PAINT],
    boards: [...LAB_BOARDS, ...LAB_EXT_BOARDS],
    props: [],
    seams: true,
    cones: [
      ...courseCones(),
      ...slalom(-150, 230, 13, 9),
      { x: 30, y: 200 }, { x: 55, y: 215 }, { x: 22, y: 222 },
      { x: 150, y: -10 }, { x: 175, y: -10 },
      ...LAB_CRASH_OBJECTS,   // S-B: every loose object kind, at the ends of the crash lanes
    ],
    spawn: { x: -28.3, y: 28.3, heading: 0 },
  },
  {
    id: 'test-track', name: 'Test Track',
    coneCount: true,      // show the knocked-cone tally (a cone course)
    base: SURFACES.grassShort,
    subtrack: TT_SUBTRACK,
    // CAMBER (user, 2026-10-03): 2% crown on the straights, up to 4 deg of positive camber in the corners (at 40 m radius or
    // tighter). Off-camber sections can be added here as { from, to, deg: -2 } (metres of track distance).
    camber: { maxDeg: 4, refR: 40, crown: 0.02, edge: 6, sections: [] },
    covers: [
      onTrack(TT_SUBTRACK, 250, 2, { w: 9, h: 5, cover: 'wet', shape: 'ellipse' }),     // sweeper, tarmac
      onTrack(TT_SUBTRACK, 740, -2, { w: 7, h: 4, cover: 'wet', shape: 'ellipse' }),    // hairpin, tarmac
      onTrack(TT_SUBTRACK, 580, 0, { w: 14, h: 9, cover: 'ice', shape: 'ellipse' }),    // black ice on the dirt
      onTrack(TT_SUBTRACK, 700, 14, { w: 18, h: 10, cover: 'snow', shape: 'ellipse' }), // drift beside the hairpin
    ],
    zones: TT_ZONES,
    bumps: TT_BUMPS,
    paint: TT_PAINT,
    boards: TT_BOARDS,
    props: [],
    seams: false,
    cones: TT_CONES,
    spawn: { x: -62, y: -96.48, heading: 0.0109 },
  },
  KH_LEVEL,
  BH_GP_LEVEL,
  BH_INDY_LEVEL,
  {
    id: 'sweaty-lamb', name: 'Sweaty Lamb',
    base: SURFACES.grassLong,                 // moorland
    subtrack: SL_SUBTRACK,
    camber: { maxDeg: 0, refR: 60, crown: 0.03, edge: 5, sections: [] },
    zones: [],
    bumps: SL_BUMPS,
    covers: SL_STREAM,
    paint: SL_PAINT,
    boards: [], seams: false, cones: SL_CONES,
    props: SL_PROPS,
    barriers: SL_TAPE,
    solids: solidsFromProps(SL_PROPS),
    lanes: [SL_YARD],
    stage: { finish: SL_FINISH },
    // 6 m behind the START line, facing it: the clock starts as you cross it
    spawn: (() => { const p = onTrack(SL_SUBTRACK, SL_SUBTRACK.totalDist - 6, 0, {}); return { x: p.x, y: p.y, heading: p.rot }; })(),
  },
  {
    id: 'killder', name: 'Killder',
    base: SURFACES.grassLong,                 // forest floor / moorland between the plantations
    subtrack: KD_SUBTRACK,
    camber: { maxDeg: 0, refR: 60, crown: 0.03, edge: 5, sections: [] },
    zones: [],
    bumps: KD_BUMPS,
    covers: KD_WATER,
    paint: KD_PAINT,
    boards: [], seams: false, cones: KD_CONES,
    props: KD_PROPS,
    barriers: KD_TAPE,
    solids: solidsFromProps(KD_PROPS),
    lanes: [KD_YARD],
    stage: { finish: KD_FINISH },
    spawn: (() => { const p = onTrack(KD_SUBTRACK, KD_SUBTRACK.totalDist - 6, 0, {}); return { x: p.x, y: p.y, heading: p.rot }; })(),
  },
  {
    id: 'slidden-hill', name: 'Slidden Hill',
    base: SURFACES.grass,
    subtrack: SH_SUBTRACK,
    camber: { maxDeg: 2, refR: 60, crown: 0.02, edge: 6, sections: [] },
    zones: [],
    bumps: SH_BUMPS,
    paint: [{ kind: 'chequered', x: SH_SUBTRACK.pts[0].x, y: SH_SUBTRACK.pts[0].y, len: 1.6, wid: 14, rot: SH_SUBTRACK.pts[0].heading }],
    boards: [], seams: false,
    lanes: [SH_START, SH_JOKER, SH_PADDOCK],
    joker: SH_JOKER_RULE,
    props: SH_PROPS,
    solids: solidsFromProps(SH_PROPS),
    cones: [...SH_TYREWALL, ...SH_STARTWALL, ...rxDress(SH_SUBTRACK, [SH_START, SH_JOKER, SH_PADDOCK], [...SH_TYREWALL, ...SH_STARTWALL]), ...jokerBales(SH_SUBTRACK, SH_JOKER, [...SH_TYREWALL, ...SH_STARTWALL])],
    barriers: SH_ARMCO.map(([a, b, off]) => ({ kind: 'armco', pts: alongTrack(SH_SUBTRACK, a, b, off, 2) })),
    // on the grid near the dead end of the (moved) start straight, facing the junction
    spawn: (() => { const [p0, p1] = SH_START.pts, x0 = p0[0] + (p1[0] - p0[0]) * 0.08, y0 = p0[1] + (p1[1] - p0[1]) * 0.08; return { x: x0, y: y0, heading: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) }; })(),
  },
  {
    id: 'castle-cum', name: 'Castle Cum',
    base: SURFACES.grass,
    subtrack: CC_SUBTRACK,
    camber: { maxDeg: 3, refR: 70, crown: 0.02, edge: 6, sections: [] },
    zones: CC_ZONES,
    bumps: CC_BUMPS,
    paint: CC_PAINT,
    boards: [],
    props: CC_PROPS,
    seams: false,
    cones: [...CC_TYREWALL, ...[1000, 1012, 1024].map((d, k) => ({ ...CC_KIT.at(d, k % 2 ? 9 : -9), kind: 'tyrestack' }))],
    lanes: CC_LANES,
    solids: solidsFromProps(CC_PROPS),
    barriers: [
      { kind: 'pitwall', pts: alongTrack(CC_SUBTRACK, 1250, 97, -10, 2) },
      { kind: 'line', pts: alongTrack(CC_SUBTRACK, 1255, 92, -15.5, 2) },
      ...CC_ARMCO.map(([a, b]) => ({ kind: 'armco', pts: alongTrack(CC_SUBTRACK, a, b, -16, 2) })),
      { kind: 'fence', pts: alongTrack(CC_SUBTRACK, 1110, 1215, -22, 2) },     // "only a waist high fence" on the Camp bank
    ],
    spawn: (() => { const p = onTrack(CC_SUBTRACK, CC_SUBTRACK.totalDist - 15, 0, {}); return { x: p.x, y: p.y, heading: p.rot }; })(),
  },
  {
    id: 'thruston', name: 'Thruston',
    base: SURFACES.grass,
    subtrack: TH_SUBTRACK,
    // a smooth, fast airfield surface: a gentle crown, up to 3 deg of camber in the corners (Thruxton is FLAT; bumps above)
    camber: { maxDeg: 3, refR: 70, crown: 0.02, edge: 6, sections: [] },
    zones: TH_ZONES,
    bumps: TH_BUMPS,
    paint: TH_PAINT,
    boards: [],
    props: TH_PROPS,
    seams: false,
    cones: TH_CONES,
    // on the grid 15 m BEHIND the line (photographed: at distance 0 the car sat on the chequers)
    spawn: (() => { const p = onTrack(TH_SUBTRACK, TH_SUBTRACK.totalDist - 15, 0, {}); return { x: p.x, y: p.y, heading: p.rot }; })(),
    // the grandstand is solid: an invisible 'building' barrier along its track-side face (obstacles are axis-aligned only)
    barriers: [
      { kind: 'building', pts: alongTrack(TH_SUBTRACK, TH_STAND.d0, TH_STAND.d1, TH_STAND.off + 4.2) },
      { kind: 'building', pts: alongTrack(TH_SUBTRACK, 1093, 1119, -22.6, 2) },
      // pit wall between the track and the lane, only where the lane has fully separated
      { kind: 'pitwall', pts: alongTrack(TH_SUBTRACK, 1201, 25, 10, 2) },
      { kind: 'line', pts: alongTrack(TH_SUBTRACK, 1206, 20, TH_PIT.off - 1.5, 2) },               // the yellow line
      { kind: 'building', pts: alongTrack(TH_SUBTRACK, TH_GAR.d0, TH_GAR.d1, TH_GAR.off - TH_GAR.depth / 2 + 0.3, 2) },
      // ARMCO on the OUTSIDE of the right-handers (an inside offset of a tight corner self-intersects)
      ...TH_ARMCO.map(([a, b]) => ({ kind: 'armco', pts: alongTrack(TH_SUBTRACK, a, b, -16, 2) })),
      // catch fence behind the Armco at Church, where the spectators stand
      { kind: 'fence', pts: alongTrack(TH_SUBTRACK, 780, 875, -22, 2) },
    ],
    lanes: TH_LANES,
    solids: solidsFromProps(TH_PROPS),
  },
  {
    id: 'grass-track', name: 'Grass Track',
    base: SURFACES.grass,
    subtrack: GO_SUBTRACK,
    randomise: () => randomiseGrassTrack(GO_SUBTRACK, GO_SECTORS, GO_RANDOM_PATCHES),   // new random patches every load
    patches: GO_RANDOM_PATCHES,
    covers: [
      onTrack(GO_SUBTRACK, 100, 2, { w: 7, h: 4, cover: 'wet', shape: 'ellipse' }),
      onTrack(GO_SUBTRACK, 300, -3, { w: 9, h: 5, cover: 'wet', shape: 'ellipse' }),
      onTrack(GO_SUBTRACK, 380, 1.5, { w: 6, h: 3.5, cover: 'wet', shape: 'ellipse' }),
    ],
    zones: GO_ZONES,
    bumps: [],
    paint: GO_PAINT,
    boards: GO_BOARDS,
    props: GO_PROPS,
    seams: false,
    cones: [
      { x: 0, y: 0, kind: 'podium' },
      { x: -26, y: -4, kind: 'caravan', rot: 0.16 },
      // Corner apex clipping tyre barriers
      { x: 55, y: 28, kind: 'tyrestack' }, { x: 57, y: 27, kind: 'tyrestack' },
      { x: 55, y: -28, kind: 'tyrestack' }, { x: 57, y: -27, kind: 'tyrestack' },
      { x: -55, y: -28, kind: 'tyrestack' }, { x: -57, y: -27, kind: 'tyrestack' },
      { x: -55, y: 28, kind: 'tyrestack' }, { x: -57, y: 27, kind: 'tyrestack' },
      // Infield caravan protection barrier
      { x: -18, y: -6, kind: 'tyrestack' }, { x: -18, y: -3, kind: 'tyrestack' }, { x: -18, y: 0, kind: 'tyrestack' },
      // Outer tyre wall (2026-10-03): loose stacks 3 m outside the track edge, gapped round the pylons
      ...outerTyreWall(GO_SUBTRACK, { margin: 3, spacing: 1.0, clear: propClearance(GO_PROPS) }),
    ],
    spawn: { x: -4, y: 38, heading: 0 },
    obstacles: [
      { x: 0, y: 66, w: 38, h: 7 }, // Wooden covered grandstand — moved out 10 m (2026-10-02)
    ],
  },
  {
    id: 'stock-car', name: 'Stock Car',
    rollingStart: true,   // races start ROLLING (user, 2026-10-04: the ovals)
    base: SURFACES.grass,
    subtrack: SO_SUBTRACK,
    covers: [
      onTrack(SO_SUBTRACK, 40, -3, { w: 8, h: 4, cover: 'wet', shape: 'ellipse' }),
      onTrack(SO_SUBTRACK, 250, 3, { w: 10, h: 5, cover: 'wet', shape: 'ellipse' }),
      onTrack(SO_SUBTRACK, 470, 0, { w: 6, h: 3, cover: 'wet', shape: 'ellipse' }),
    ],
    zones: SO_ZONES,
    bumps: [],
    paint: SO_PAINT,
    boards: SO_BOARDS,
    props: SO_PROPS,
    seams: false,
    cones: [
      { x: -28, y: 12, kind: 'banger', rot: 0.52 },
      { x: 20, y: -14, kind: 'banger', rot: -0.44 },
      { x: -8, y: -10, kind: 'banger', rot: 2.15 },
      { x: 30, y: 15, kind: 'banger', rot: -1.15 },
      // Continuous infield barrier separating track from wrecked bangers
      { x: -45, y: 36, kind: 'tyrestack' }, { x: -30, y: 36, kind: 'tyrestack' }, { x: 30, y: 36, kind: 'tyrestack' }, { x: 45, y: 36, kind: 'tyrestack' },
      { x: -45, y: -36, kind: 'tyrestack' }, { x: -30, y: -36, kind: 'tyrestack' }, { x: 30, y: -36, kind: 'tyrestack' }, { x: 45, y: -36, kind: 'tyrestack' },
      // Corner apex tyre stacks
      { x: 72, y: 24, kind: 'tyrestack' }, { x: 72, y: -24, kind: 'tyrestack' },
      { x: -72, y: -24, kind: 'tyrestack' }, { x: -72, y: 24, kind: 'tyrestack' },
      // Outer tyre wall (2026-10-03): loose stacks 2 m outside the track edge — 2, not 3, so the wall
      // runs IN FRONT of the sponsor boards (front edge y 60.8) instead of being gapped by 18 m at each
      ...outerTyreWall(SO_SUBTRACK, { margin: 2, spacing: 1.0, clear: propClearance(SO_PROPS) }),
    ],
    spawn: { x: -4, y: 48, heading: 0 },
    obstacles: [
      { x: 18, y: 76, w: 42, h: 7 },    // Grandstand — moved further from the track edge (2026-10-02)
      { x: -14, y: 64, w: 4.4, h: 3.6 }, // Marshal tower / official box
    ],
  },
  {
    id: 'naffcar', name: 'Naffcar Speedway',
    rollingStart: true,   // races start ROLLING (user, 2026-10-04: the ovals)
    base: SURFACES.grassShort,
    subtrack: NC_SUBTRACK,
    zones: NC_ZONES,
    bumps: [],
    paint: NC_PAINT,
    boards: NC_BOARDS,
    props: NC_PROPS,
    bankAngle: 0.31, // ~18 deg banking in the turns
    seams: false,
    cones: [
      // Pit wall impact attenuator crash cushions
      { x: -111, y: 62, kind: 'tyrestack' }, { x: -113, y: 61, kind: 'tyrestack' }, { x: -113, y: 63, kind: 'tyrestack' },
      { x: 111, y: 62, kind: 'tyrestack' }, { x: 113, y: 61, kind: 'tyrestack' }, { x: 113, y: 63, kind: 'tyrestack' },
      // Spare racing tyre sets stacked along pit stalls
      { x: -60, y: 57, kind: 'tyrestack' }, { x: -20, y: 57, kind: 'tyrestack' },
      { x: 20, y: 57, kind: 'tyrestack' }, { x: 60, y: 57, kind: 'tyrestack' },
    ],
    spawn: { x: -4, y: 75, heading: 0 },
    obstacles: [
      { x: 0, y: 62, w: 220, h: 1.4 },  // Solid concrete pit divider wall
      { x: 0, y: 98, w: 180, h: 14 },   // Front stadium grandstand
      { x: 0, y: -98, w: 180, h: 14 },  // Back stadium grandstand
    ],
  },
  {
    id: 'sandbox', name: 'Surface Sandbox',
    base: SURFACES.grassShort,
    subtrack: SB_SUBTRACK,
    covers: SB_COVERS,
    zones: SB_ZONES,
    bumps: SB_BUMPS,
    paint: SB_PAINT,
    boards: SB_BOARDS,
    props: SB_PROPS,
    seams: false,
    cones: SB_CONES,
    spawn: SB_SPAWN,
    obstacles: [{ x: -20, y: 222, w: 60, h: 8 }],   // the grandstand is solid
  },
];

setActiveLevel(LEVELS[0]);

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
function seededRng(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const tri = (rng) => rng() * rng();      // 0..1, dense near 0: the "greater at the point of blend" falloff
// SQUARES, not circles (user, 2026-10-03, with the pixel-art pass: "make the surface and transitions squares too,
// no circles"): every blend patch is an axis-aligned square of 0.5, 1.0 or 1.5 m on a half-metre world grid.
const SQ_GRID = 0.5;
const snapG = (v) => Math.round(v / SQ_GRID) * SQ_GRID;
function blendPatch(rng, x, y, surface, rot) {
  const w = SQ_GRID * (1 + Math.floor(rng() * 3));
  return { x: snapG(x), y: snapG(y), w, h: w, sq: true, surface, blend: true };
}
function buildBlend(level, rng) {
  const out = [];
  const st = level.subtrack;
  const onRoad = (x, y, pad) => st && querySubtrack(st, x, y).dist < st.width / 2 + pad;
  const inPad = (x, y) => level.zones.some((z) => (z.boxed || z.rounded) && Math.abs(x - z.x) < z.w / 2 + 1 && Math.abs(y - z.y) < z.h / 2 + 1);
  if (st && st.sectors && st.sectors.length > 1) {
    const pts = st.pts, total = st.totalDist, hw = st.width / 2;
    // INTERPOLATED between samples. MEASURED (tools/blendcheck): snapping to the ~4 m sample spacing clumped the
    // patches into 4 m steps — 89 / 1 / 25 / 70 per metre from the change point instead of a smooth falloff.
    const at = (d) => {
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
        for (const [sign, surf] of [[1, z.surface], [-1, outer]]) {     // outward: the zone drags out; inward: the neighbour creeps in
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
const INCLUDE = {
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
function buildInclusions(level, rng) {
  const patches = [], covers = [];
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
    if (pick[0] === '@') { if (covers.length < INCL_COVER_CAP) covers.push({ x: px, y: py, w, h, rot, cover: pick.slice(1), shape: 'ellipse' }); }
    else {
      // a CLUSTER of 2-3 overlapping squares on the world grid (pixel-art rule: squares, not circles — photographed, smooth
      // ellipses read as a different art style from the Grass Track's square patches). Same expected area as one ellipse.
      const n = 1 + (rng() < 0.6 ? 1 : 0), side = Math.sqrt(patchArea / n) * 1.15;
      for (let k = 0; k < n; k++) {
        const sw = Math.round(side * (0.7 + rng() * 0.6) * 2) / 2, sh = Math.round(side * (0.7 + rng() * 0.6) * 2) / 2;
        const ox = Math.round((px + (rng() - 0.5) * side) * 2) / 2, oy = Math.round((py + (rng() - 0.5) * side) * 2) / 2;
        patches.push({ x: ox, y: oy, w: Math.max(1, sw), h: Math.max(1, sh), sq: true, surface: SURFACES[pick] });
      }
    }
  }
  return { patches, covers };
}
function prepareLevel() {
  prepBarriers(LEVEL);
  if (LEVEL.randomise) { LEVEL.randomise(); LEVEL._blend = null; }
  // ENDLESS levels get NO blend (MEASURED BUG, 2026-10-06, tools/_dirtroad.mjs: the highway's blend was built ONCE, against whatever road
  // window existed at the first setLevel, then cached through every restart / road type / reseed - 8209 long grass / dirt squares, many
  // on the CURRENT carriageway, which then wore to dirt: "dirt in the road on highway levels". Its zone-edge pass also ignores a zone's
  // rotation, and the fields are all rotated.) The highway draws its own verges; inclusions are skipped there for the same reason.
  if (LEVEL.endless) LEVEL._blend = [];
  if (!LEVEL._blend) LEVEL._blend = buildBlend(LEVEL, LEVEL.randomise ? Math.random : seededRng(LEVEL.id));
  // inclusions: built once per level (per layout on a re-randomising level), patches + covers
  if (LEVEL._coversBase === undefined) LEVEL._coversBase = LEVEL.covers || [];
  if (LEVEL.randomise || !LEVEL._incl) { LEVEL.covers = LEVEL._coversBase; LEVEL._incl = buildInclusions(LEVEL, LEVEL.randomise ? Math.random : seededRng(LEVEL.id + ':incl')); }
  LEVEL.covers = [...LEVEL._coversBase, ...LEVEL._incl.covers];
  // KEEP LANES CLEAN (2026-10-04, user: Thruston "pits look messy"): blend + inclusion squares picked on the grass next to a lane
  // overlapped onto it and chewed its edge ragged. Drop any generated patch that reaches a lane (authored LEVEL.patches stay).
  const offLane = (c) => { const r = Math.max(c.w, c.h) / 2 + 1; for (const d of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) if (laneAt(c.x + d[0], c.y + d[1])) return false; return true; };
  const gen = LEVEL.lanes ? [...LEVEL._blend, ...LEVEL._incl.patches].filter(offLane) : [...LEVEL._blend, ...LEVEL._incl.patches];
  LEVEL.allPatches = [...(LEVEL.patches || []), ...gen];
  resetPATCH_GRID();
  for (const c of LEVEL.allPatches) {
    const r = Math.max(c.w, c.h) / 2;
    for (let cx = Math.floor((c.x - r) / PATCH_CELL); cx <= Math.floor((c.x + r) / PATCH_CELL); cx++)
      for (let cy = Math.floor((c.y - r) / PATCH_CELL); cy <= Math.floor((c.y + r) / PATCH_CELL); cy++) {
        const k = patchKey(cx, cy), cell = PATCH_GRID.get(k);
        if (cell) cell.push(c); else PATCH_GRID.set(k, [c]);
      }
  }
}

// RALLY TAPE (user, 2026-10-04: "rally tape should be contactable and easy to snap — give it POSTS and tape SECTIONS — a chance to STICK to
// cars; used more liberally and CLOSE to the track edge on rally / rallycross stages"): a tape is a run of light POSTS (loose objects,
// kind 'tapepost', every TAPE_STEP m; cones.js strings the sections between them and snaps them). On every stage / joker level: the old
// red spectator lines become tape, and BOTH sides of every corner get a run close to the edge (inside at half width + 2.5 m, outside
// beyond the dressing at half width + 5.5 m). Pit / painted lines stay lines.
const TAPE_STEP = 4, LANE_CLEAR = 2.5;   // m: tape posts keep this far beyond a road lane's edge
let tapeId = 0;
function tapePass(lv) {
  if (!lv.subtrack || !(lv.stage || lv.joker)) return;
  const runs = [], hw = lv.subtrack.width / 2;
  for (const b of lv.barriers || []) if (b.kind === 'line' && b.col === '#e23b2e') runs.push(b.pts);
  lv.barriers = (lv.barriers || []).filter((b) => !(b.kind === 'line' && b.col === '#e23b2e'));
  for (const c of autoKerbs(lv.subtrack, { maxR: 70, exitR: 0, minTurn: 18, mergeGap: 10 })) {
    if (lv.stage && c.startDist > lv.stage.finish) continue;
    const a = onTrack(lv.subtrack, c.startDist, 0, {}).rot, bb = onTrack(lv.subtrack, c.endDist, 0, {}).rot;
    let t = bb - a; t = Math.atan2(Math.sin(t), Math.cos(t)); const out = t > 0 ? -1 : 1;
    runs.push(alongTrack(lv.subtrack, c.startDist - 15, c.endDist + 15, out * (hw + 5.5), TAPE_STEP), alongTrack(lv.subtrack, c.startDist - 10, c.endDist + 10, -out * (hw + 2.5), TAPE_STEP));
  }
  // ...but NEVER across a ROAD LANE (user, 2026-10-04: "tape covering joker track section entries on Knobhill"): a post within half a lane
  // width + LANE_CLEAR of the joker / RX start / pit / service lane is left out, and the run's idx gap leaves that section open (cones.js
  // strings consecutive idx only). Gravel traps (lanes with an 'out' side) are run-off, not road: tape may cross them.
  const roads = (lv.lanes || []).filter((n) => n.out == null);
  const onRoad = (x, y) => roads.some((n) => { for (let k = 0; k + 1 < n.pts.length; k++) {
    const [ax, ay] = n.pts[k], [bx, by] = n.pts[k + 1], vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L2)); if (Math.hypot(x - ax - t * vx, y - ay - t * vy) < n.width / 2 + LANE_CLEAR) return true; } return false; });
  const posts = [];
  for (const pts of runs) {
    const id = tapeId++;
    pts.forEach(([x, y], i) => { if (querySubtrack(lv.subtrack, x, y).dist > hw + 1.5 && !onRoad(x, y)) posts.push({ x, y, kind: 'tapepost', tape: id, idx: i }); });
  }
  lv.cones = [...(lv.cones || []), ...posts];
}
// CHEVRONS + FLAGS are KNOCKABLE (user, 2026-10-04: "heavy but impactable"): every level's chevron boards and flag poles move from the
// static props (drawn into the scenery, solid until today) into its loose objects (cones.js: mass, topple, slide, lie flat)
function knockPass(lv) {
  const mv = (lv.props || []).filter((p) => p.kind === 'chevron' || p.kind === 'flag'); if (!mv.length) return;
  lv.props = lv.props.filter((p) => !(p.kind === 'chevron' || p.kind === 'flag'));
  lv.cones = [...(lv.cones || []), ...mv.map((p) => ({ x: p.x, y: p.y, kind: p.kind, rot: p.rot || 0, col: p.col }))];
}
// the post-passes every level gets (tape, knockable signs) — exported for generated levels (stagegen.js)
export function finishLevel(lv) { tapePass(lv); knockPass(lv); return lv; }
for (const lv of LEVELS) finishLevel(lv);
// the floor rectangle of the current level (S-B): LEVEL.bounds, else the square +-FLOOR
function applyBounds() {
  setRect(LEVEL.bounds);
}
export function setLevel(id) {
  const next = LEVELS.find((l) => l.id === id);
  if (!next) return LEVEL;
  setActiveLevel(next);
  setFloor(LEVEL.floor || 260);   // WORLD SIZE per level (2026-10-05)
  applyBounds();
  prepareLevel();
  resetNatLevel();              // natural-ground amplitudes are per layout (the Grass Track re-randomises every load)
  return LEVEL;
}


// Colour language (CLAUDE.md §4: never pick a colour ad hoc).
export const COL = {
  floor: '#f2f2f4',
  floorWarm: '#ececed',
  grid: '#d9d9e2',
  paint: '#b9b9c6',
  kerbA: '#d8d4cc',
  kerbB: '#b9552f',
  cone: '#f26a1b',
  coneBand: '#f4f4f6',
  coneDark: '#b8410c',
  mark: '40,38,42',        // rgb of a skid mark — dark neutral, not black, so overlaps deepen
  ink: '#2a2c33',
  inkSoft: '#7a7d88',
  hud: '#1b1d22',
  hudText: '#e8e8ee',
  warn: '#e8a13a',
  danger: '#d8453c',
  live: '#4cc2a0',
  gravel: '#cfc6b4',       // the gravel trap. Warm and dead-looking against the cold lab floor.
  rally: '#c2b49a',        // rally-stage gravel — a touch browner, so the two read as different things
  rallyGrit: '#a8987c',
  rallyDark: '#8e8066',
  gravelDark: '#a3977f',
  racetarmac: '#2d303a',   // dark competition circuit asphalt (rich contrast against black tyres)
  dirt: '#8a6e50',         // warm earth brown
  dirtGrit: '#74593d',
  dirtDark: '#5d4329',
  tarmac: '#3a3c46',       // authentic dark road asphalt
  tarmacGrit: '#4e505c',
  grassLight: '#93ad72',
  grassLong: '#557239',
  grassLongDark: '#41592a',
  ice: '#cfe2ee', iceSheen: '#eaf4fa',
  snow: '#eef3f8', snowDark: '#d3dde8',
  wet: '#63656e', wetSheen: '#7b7e8a',
  mud: '#6b5644', mudDark: '#57432f',
  broken: '#9b9ca6', brokenDark: '#7e7f89',
  sand: '#ddc99e', sandDark: '#c4ae82',
  outside: '#3c4048',       // beyond the fence: nothing, and it should LOOK like nothing
  grass: '#7e9c5e',
  grassDark: '#6a8850',
  gravelGrit: '#b4a894',
  fence: '#8a8d99',
  fencePost: '#5f626d',
};

// TYRE HEAT SHARE per surface (vehicle.js TYRE_HEAT): hard ground 1, loose ground HEAT_OFFROAD. Here, at the end,
// because the run-off trap surfaces are built after SURFACES. Puddles copy their base's value (surfaceOf).
for (const s of [...Object.values(SURFACES), ...SURFACE_TRAP]) if (s.heatK === undefined) s.heatK = s.hard ? 1 : HEAT_OFFROAD;

// The first level is active from module load without a setLevel() call, so prepare it here — at the END of the
// module, after every const it reads exists (calling it earlier threw "Cannot access tri before initialization").
applyBounds();
prepareLevel();
