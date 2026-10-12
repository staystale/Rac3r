import { FLOOR } from "../bounds.ts";
import { SURFACES } from "../surfaces.js";
import { alongTrack, solidsFromProps } from "../barriers.js";
import { autoKerbs, traceTrack, createSubtrack } from "../subtrack.js";
import { prepBumps } from "../terrain.js";
import { onTrack, querySubtrack } from "../tyrewall.js";
import { openSmooth, jokerArrow, jokerApproach } from "./slidden-hill.js";
import { trackKit, rxDress, jokerBales } from "./kit.js";
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
export const KH_LEVEL = (() => {
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
