import { alongTrack, solidsFromProps } from "../barriers.js";
import { FLOOR } from "../bounds.ts";
import { autoKerbs, createSubtrack, traceTrack } from "../subtrack.ts";
import { SURFACES } from "../surfaces.ts";
import { prepBumps } from "../terrain.js";
import { onTrack, querySubtrack } from "../tyrewall.js";
import { ss01, trackKit } from "./kit.js";
// =============================================================================================
// BRANDS SNATCH — parody of Brands Hatch (Kent). Built 2026-10-04. Decisions (user): BOTH layouts (GP + Indy) from one build, REAL-ISH
// hills from the contour map (art/ref/bh1.png: 115-145 m), GRAVEL TRAPS + tyre walls + Armco, grandstands, pits, woods.
// TRACED from the official map (art/ref/bh2.png = Wikimedia "Brands_Hatch_2003.svg" at 1280 px; 300 m = 460 px -> 0.652 m/px real) at
// 0.31 game m/px (0.48 of real, so the 3.9 km GP fits the world). Clockwise from the line on BRABHAM STRAIGHT: PADDOCK HILL BEND (the
// blind plunge, right) -> down HAILWOOD HILL -> DRUIDS (uphill right hairpin) -> GRAHAM HILL down -> GRAHAM HILL BEND (left) -> COOPER
// STRAIGHT -> SURTEES (left) -> [GP: PILGRIMS DROP -> HAWTHORN HILL -> HAWTHORNS (right) -> DEREK MINTER STRAIGHT -> WESTFIELD (right)
// -> DINGLE DELL (dip) -> SHEENE CURVE (right) -> STIRLINGS (left) -> CLEARWAYS | Indy: McLAREN] -> CLARK CURVE -> line.
const BH = { mpp: 0.31, cx: 635, cy: 895 };
const bhXY = (px, py) => [+((px - BH.cx) * BH.mpp).toFixed(2), +((py - BH.cy) * BH.mpp).toFixed(2)];
const BH_TOP = [[700, 152], [800, 155], [900, 160], [950, 168], [1000, 182], [1050, 205], [1090, 240], [1110, 280], [1115, 330], [1105, 390],   // BRABHAM, PADDOCK HILL
  [1080, 450], [1050, 510], [1020, 560], [985, 615], [955, 665], [930, 690], [905, 698], [880, 680], [866, 645], [875, 600], [900, 545],          // HAILWOOD HILL, DRUIDS
  [925, 490], [940, 440], [946, 395], [946, 355], [932, 325], [905, 310], [850, 300], [780, 285], [720, 272], [650, 268], [550, 268], [480, 272],  // GRAHAM HILL, BEND, COOPER
  [432, 292], [402, 322], [388, 360]];                                                                                                               // SURTEES
const BH_GP = [[395, 400], [418, 435], [460, 470], [510, 515], [570, 565], [632, 625], [675, 675], [720, 735], [780, 820], [850, 915], [920, 1010],   // PILGRIMS DROP
  [990, 1105], [1030, 1160], [1058, 1215], [1074, 1270], [1070, 1325], [1048, 1370], [1015, 1405], [960, 1452], [880, 1520], [805, 1590],          // HAWTHORN HILL, HAWTHORNS, MINTER
  [765, 1625], [738, 1634], [705, 1626], [650, 1605], [590, 1582], [548, 1555], [500, 1508], [452, 1455], [412, 1390], [392, 1325], [380, 1270],   // WESTFIELD, DINGLE DELL
  [374, 1228], [388, 1196], [422, 1140], [470, 1082], [528, 1015], [572, 962], [588, 922], [580, 888], [558, 858], [518, 815], [450, 742],        // SHEENE, STIRLINGS
  [380, 662], [300, 575], [232, 500], [182, 447], [160, 405], [154, 360], [164, 312], [198, 262], [258, 216], [330, 180], [420, 158], [520, 152], [610, 150]];   // CLEARWAYS, CLARK
const BH_INDY = [[378, 400], [350, 432], [300, 455], [250, 466], [205, 463], [176, 440], [160, 405], [154, 360], [164, 312], [198, 262], [258, 216],   // McLAREN, CLARK
  [330, 180], [420, 158], [520, 152], [610, 150]];
// HILLS from the contours, in game metres (heights ~0.5 of real so a car goes LIGHT at the crests, never flies: tools/crestcheck)
const BH_HILLS = [
  { kind: 'dip', ...(([x, y]) => ({ x, y }))(bhXY(1085, 455)), r: 55, d: 4.0 },     // the bottom of PADDOCK HILL: the plunge, then up Hailwood
  { kind: 'hump', ...(([x, y]) => ({ x, y }))(bhXY(905, 690)), r: 42, h: 2.2 },     // DRUIDS on its rise
  { kind: 'dip', ...(([x, y]) => ({ x, y }))(bhXY(860, 1000)), r: 110, d: 4.5 },    // PILGRIMS DROP into the valley, out up HAWTHORN HILL
  { kind: 'dip', ...(([x, y]) => ({ x, y }))(bhXY(470, 1480)), r: 45, d: 2.2 },     // DINGLE DELL
  { kind: 'hump', ...(([x, y]) => ({ x, y }))(bhXY(330, 760)), r: 150, h: 3.0 },    // the high ground west of the infield (145 m contour)
];
const BRANDS_DROPPED = {};   // what the footprint check removed per layout (tools read it)
export { BRANDS_DROPPED };
function brandsLevel(id, name, mapPts) {
  const sub0 = createSubtrack(traceTrack(mapPts, { mpp: BH.mpp, cx: BH.cx, cy: BH.cy, rMin: 15.5 }), 13, [{ startDist: 0, endDist: 1e9, surface: SURFACES.racetarmac }], [], true);
  sub0.curvedKerbs = autoKerbs(sub0, { maxR: 70, exitR: 30, heavyR: 22, minTurn: 20, mergeGap: 12 });
  const sub = sub0, hw = sub.width / 2;
  const dOf = (px, py) => { const [x, y] = bhXY(px, py); let b = 0, bd = Infinity; for (const p of sub.pts) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; b = p.dist; } } return b; };
  // PIT LANE: on the inside (+) of Brabham Straight, from Clark Curve to past the line (map: grey line)
  const pd0 = dOf(200, 262), pd1 = dOf(915, 162);
  const pit = alongTrack(sub, pd0, pd1, (t, len) => 4 + 13 * ss01(Math.min(t, len - t) / 30), 2);
  const PIT = { pts: pit, width: 9, surface: SURFACES.concrete };
  // GRAVEL TRAPS on the OUTSIDE of every real corner (autoKerbs' finder: R < 45, turn > 35 deg): 12 m deep, from the apex to 30 m after
  const traps = [];
  for (const c of autoKerbs(sub, { maxR: 45, exitR: 0, minTurn: 35, mergeGap: 15 })) {
    if (c.startDist < pd1 + 5 && c.endDist > pd0 - 5 && pd0 < pd1) continue;
    const out = c.side === 'left' ? -1 : 1;
    traps.push({ out, d0: c.startDist - 5, d1: c.endDist + 30, pts: alongTrack(sub, c.startDist - 5, c.endDist + 30, out * (hw + 2 + 6), 2), width: 12, surface: SURFACES.gravel });
  }
  const kit = trackKit(sub, id.length * 1999, [PIT, ...traps]);
  const kit0 = trackKit(sub, 7, [PIT]);       // filter only against the road + pit lane (barriers stand behind the traps)
  const barriers = [], cones = [];
  // keep barriers / tyres off EVERY part of the road (behind a trap the Armco can come near another leg — barriercheck failed 2 runs):
  // a run is split wherever it comes within half width + 4 m of any road
  const nearRoad = (x, y) => querySubtrack(sub, x, y).dist < hw + 4 || kit.onLane(x, y, 0.6);   // ... or on another trap / the pit lane
  const runs = (pts) => { const out = []; let cur = []; for (const q of pts) { if (nearRoad(q[0], q[1])) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push(q); } if (cur.length > 1) out.push(cur); return out; };
  for (const t of traps) {
    const o = t.out * (hw + 2 + 12 + 2.5);   // Armco behind the trap; two staggered rows of tyres in front of it
    for (const r of runs(alongTrack(sub, t.d0, t.d1, o, 2))) barriers.push({ kind: 'armco', pts: r });
    for (const [oo, sh] of [[o - t.out * 1.4, 0], [o - t.out * 2.35, 0.475]]) for (const [x, y] of alongTrack(sub, t.d0 + sh, t.d1, oo, 0.95)) if (!nearRoad(x, y)) cones.push({ x, y, kind: 'tyrestack' });
  }
  barriers.push({ kind: 'pitwall', pts: alongTrack(sub, pd0 + 30, pd1 - 30, 9.5, 2) });
  const kitT = trackKit(sub, 3, traps);   // gravel traps only
  for (const r of (() => { const out = []; let cur = []; for (const q of alongTrack(sub, dOf(480, 155), dOf(780, 158), 22.1, 2)) { if (kitT.onLane(q[0], q[1], 0.5)) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push(q); } if (cur.length > 1) out.push(cur); return out; })())
    barriers.push({ kind: 'building', pts: r });   // the garages are solid (split where a gravel trap reaches them — Indy's McLaren trap)
  barriers.push({ kind: 'line', pts: alongTrack(sub, pd0 + 34, pd1 - 34, 13.6, 2) });
  const props = [
    kit0.prop(2, 0, { kind: 'gantry', wid: 24, rot: Math.PI / 2 }),
    // garages 5 m deep, x 430-780 (photographed: 10 m deep they reached Cooper Straight, only ~34 m away, and the Graham Hill trap's tyres)
    { kind: 'garagerow', brand: 'KUM TYRES', x: 0, y: 0, front: alongTrack(sub, dOf(480, 155), dOf(780, 158), 21.8, 2.5), back: alongTrack(sub, dOf(480, 155), dOf(780, 158), 26.8, 2.5), banner: alongTrack(sub, dOf(480, 155), dOf(780, 158), 22.7, 2.5) },
    kit0.prop(dOf(560, 152), -26, { kind: 'grandstand', w: 90, h: 9 }),            // the main grandstand, outside Brabham
    kit0.prop(dOf(1090, 240), -34, { kind: 'grandstand', w: 40, h: 9 }),           // Paddock Hill
    kit0.prop(dOf(250, 480), -34, { kind: 'grandstand', w: 40, h: 9 }),            // Clearways (outside)
    // race control by Druids: the first spot OUTSIDE the hairpin that clears the road (at +40 inside it stood across Hailwood / Graham Hill)
    ...[-40, -48, -56, 52, 64].map((o) => kit0.prop(dOf(905, 698), o, { kind: 'tower', size: 8 })),
    kit0.prop(dOf(200, 262), -30, { kind: 'board', label: 'BRANDS SNATCH' }), kit0.prop(dOf(950, 168), -30, { kind: 'board', label: 'KUM TYRES' }),
    kit0.prop(dOf(480, 272), -24, { kind: 'board', label: 'SPUM OIL' }),
  ];
  for (const [x, y] of [[-40, -130], [70, -150], [40, -60]]) props.push({ kind: 'truck', x, y, rot: 0.1, col: ['#c8302c', '#2b56b5', '#e2c13a'][props.length % 3] });   // paddock inside the Indy loop
  // WOODS: the GP loop runs through them; scattered trees elsewhere — seeded, kept off road / pit / traps
  for (let k = 0; k < 700 && props.filter((p) => p.kind === 'tree').length < 160; k++) {
    const x = (kit.rnd() - 0.5) * 2 * (FLOOR - 12), y = (kit.rnd() - 0.5) * 2 * (FLOOR - 12), woods = y > 30;
    if ((woods || kit.rnd() < 0.25) && kit.clear(x, y, 10)) props.push({ kind: 'tree', x, y, s: 3.5 + kit.rnd() * 3, seed: k });
  }
  for (const c of sub.curvedKerbs) if (c.side === 'left' || c.side === 'right') props.push(kit0.prop((c.startDist + c.endDist) / 2, (c.side === 'left' ? -1 : 1) * -(hw + 30), { kind: 'marshal' }));
  // FOOTPRINT CHECK (user, 2026-10-04: "a truck across the Brands GP track", "a hut across the road near the exit of Druids on the Indy").
  // The first filter skipped big props and tested only a prop's CENTRE. Now every prop's whole box (its solid size + 1.5 m) is sampled on
  // a 1.5 m grid against the road and the pit / trap lanes; anything touching is dropped. Only the gantry and the garages may stand there.
  const FOOT = { grandstand: (p) => [p.w, p.h], tower: (p) => [p.size, p.size], truck: () => [14, 2.5], marshal: () => [2.4, 2], board: () => [18, 1.2], tree: (p) => [p.s * 0.5, p.s * 0.5] };
  const boxClear = (p) => { const f = FOOT[p.kind]; if (!f) return true; const [w, h] = f(p), c = Math.cos(p.rot || 0), sn = Math.sin(p.rot || 0);
    for (let u = -w / 2 - 1.5; u <= w / 2 + 1.5; u += 1.5) for (let v = -h / 2 - 1.5; v <= h / 2 + 1.5; v += 1.5) {
      const x = p.x + c * u - sn * v, y = p.y + sn * u + c * v;
      if (querySubtrack(sub, x, y).dist < hw + 0.5 || kit.onLane(x, y, 0)) return false; }
    return true; };
  let towerDone = false;
  const okProps = props.filter((p) => p.kind === 'gantry' || p.kind === 'garagerow' || (boxClear(p) && (p.kind !== 'tower' || (!towerDone && (towerDone = true)))));
  BRANDS_DROPPED[id] = props.filter((p) => !okProps.includes(p)).map((p) => p.kind).filter((k) => k !== 'tree' && k !== 'tower');
  const banks = [...kit.bank(dOf(1000, 182), dOf(1050, 510), -36, 7, 1.4), ...kit.bank(dOf(400, 320), dOf(650, 268), 30, 7, 1.2)];
  return {
    id, name, base: SURFACES.grass, subtrack: sub,
    camber: { maxDeg: 3, refR: 70, crown: 0.02, edge: 6, sections: [] },
    zones: [], bumps: prepBumps([...BH_HILLS, ...banks]),
    paint: [{ kind: 'chequered', x: sub.pts[0].x, y: sub.pts[0].y, len: 1.6, wid: 13, rot: sub.pts[0].heading }],
    boards: [], seams: false, cones,
    lanes: [PIT, ...traps], barriers, props: okProps, solids: solidsFromProps(okProps),
    spawn: (() => { const p = onTrack(sub, sub.totalDist - 15, 0, {}); return { x: p.x, y: p.y, heading: p.rot }; })(),
  };
}
export const BH_GP_LEVEL = brandsLevel('brands-snatch', 'Brands Snatch GP', [...BH_TOP, ...BH_GP]);
export const BH_INDY_LEVEL = brandsLevel('brands-snatch-indy', 'Brands Snatch Indy', [...BH_TOP, ...BH_INDY]);
