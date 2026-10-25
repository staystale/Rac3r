import { FLOOR } from "../bounds.ts";
import { SURFACES } from "../surfaces.ts";
import { alongTrack, solidsFromProps } from "../barriers.ts";
import { autoKerbs, traceTrack, createSubtrack } from "../subtrack.ts";
import { prepBumps } from "../terrain.ts";
import { onTrack, querySubtrack } from "../tyrewall.ts";
import { openSmooth, jokerArrow, jokerApproach } from "./slidden-hill.ts";
import { trackKit, rxDress, jokerBales } from "./kit.ts";
import { RX_BUSHES } from "./bushes.ts";
import type { Point, Lane, Trap, Cone, Prop, Barrier, Bump, Subtrack } from "../types.ts";
// =============================================================================================
// KNOBHILL — parody of Knockhill (Fife), the rallycross layout. Built. Decisions (user):
// the TARMAC CIRCUIT + an INFIELD DIRT section (~40 % dirt like the real RX lap: 1.4 km, 39 %
// dirt), DRY, hills FELT like Brands ("twists, drops and climbs 60 m"). TRACED from Wikimedia
// "Knockhill_circuit_map.png" (art/ref/kh3.png, 800 px; 100 m = 76 px) at 0.62 game m/px. Clockwise
// from the line: DUFFUS DIP (fast blind downhill right) -> SCOTSMAN (90 right) -> BUTCHERS -> the
// chicane -> bottom straight [JOKER: a dirt loop off the LEFT after turn 4, as the real one] ->
// CLARK'S (blind uphill right, "onto two wheels") -> DIRT: HISLOP'S -> up to the hairpin -> back
// onto the start straight. No published RX map: the dirt runs where the real circuit's tarmac does
// from Clark's to the hairpin.
const KH_CAL = { mpp: 0.62, cx: 400, cy: 520 };
const khXY = (pixX: number, pixY: number): Point =>
  [+((pixX - KH_CAL.cx) * KH_CAL.mpp).toFixed(2), +((pixY - KH_CAL.cy) * KH_CAL.mpp).toFixed(2)];
// DUFFUS DIP
const KH_MAP: Point[] = [[365, 378], [420, 384], [480, 392], [540, 402], [578, 412], [592, 430],
  [605, 455], [622, 475], [650, 485], [690, 495], [705, 508],
  // SCOTSMAN, BUTCHERS, chicane
  [708, 532], [700, 560], [690, 590], [670, 610], [645, 625], [622, 642], [600, 655], [560, 662],
    [500, 670], [440, 675], [405, 676],
  // CLARK'S, HISLOP'S, HAIRPIN
  [388, 665], [378, 640], [366, 602], [345, 572], [320, 545], [280, 510], [220, 470], [160, 435],
    [112, 405], [90, 385], [92, 366], [110, 357],
  [150, 360], [220, 366], [290, 372]];
const KH_SUB0 = createSubtrack(traceTrack(KH_MAP,
  { mpp: KH_CAL.mpp, cx: KH_CAL.cx, cy: KH_CAL.cy, rMin: 15.5 }), 13, [], [], true);
const khD = (pixX: number, pixY: number) => {
  const [x, y] = khXY(pixX, pixY);
  let best = 0, bestSq = Infinity;
  for (const point of KH_SUB0.pts) {
    const distSq = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distSq < bestSq) {
      bestSq = distSq;
      best = point.dist;
    }
  }
  return best;
};
const KH_D = { dirtIn: khD(395, 670), dirtOut: khD(215, 366) };
const KH_SUBTRACK = createSubtrack(KH_SUB0.pts.map((point) => [point.x, point.y]), 13, [
  { startDist: 0, endDist: KH_D.dirtIn, surface: SURFACES.racetarmac },
  { startDist: KH_D.dirtIn, endDist: KH_D.dirtOut, surface: SURFACES.dirt },
  { startDist: KH_D.dirtOut, endDist: 1e9, surface: SURFACES.racetarmac },
], [], true);
// no kerbs on dirt
KH_SUBTRACK.curvedKerbs = autoKerbs(KH_SUBTRACK,
  { maxR: 70, exitR: 30, heavyR: 22, minTurn: 20, mergeGap: 12 }).filter((kerb) =>
  kerb.endDist < KH_D.dirtIn || kerb.startDist > KH_D.dirtOut);
// the JOKER: a dirt loop off the LEFT (south) of the bottom straight after the chicane SHALLOW
// (MEASURED, tools/jokercost: the first loop, 34 m deep, cost 7-16.5 s; a real RX joker costs ~1-3
// s) + 4 m further out in the middle (user wanted bales between joker and track: the strip was 1-2
// m)
const KH_JOKER: Lane = { pts: openSmooth(
  [[590, 657], [572, 684], [540, 699], [500, 701], [468, 694],
  [448, 678]].map(([x, y]) => khXY(x, y))), width: 12, surface: SURFACES.dirt };
const KH_JOKER_RULE = (() => {
  const jokerPts = KH_JOKER.pts, mid = jokerPts[Math.floor(jokerPts.length / 2)];
  return { gate: { x: mid[0], y: mid[1], r: 7 }, penalty: 30, laps: 5,
    arrows: [jokerArrow(KH_SUBTRACK, jokerPts),
    jokerApproach(KH_SUBTRACK, jokerPts)].filter(Boolean) };
  })();
type KhKit = ReturnType<typeof trackKit>;
/**
 * Builds the gravel traps on the outside of the tarmac corners; the dirt corners get tyre walls.
 * @param sub the track
 * @param halfWidth half the track width
 * @param traps gravel trap lanes, appended to
 * @param cones tyre stacks, appended to
 */
function buildKhTraps(sub: Subtrack, halfWidth: number, traps: Trap[], cones: Cone[]): void {
  const isDirt = (dist: number) => dist > KH_D.dirtIn - 5 && dist < KH_D.dirtOut + 5;
  for (const kerb of autoKerbs(sub, { maxR: 45, exitR: 0, minTurn: 35, mergeGap: 15 })) {
    const out = kerb.side === 'left' ? -1 : 1;
    if (isDirt(kerb.startDist) && isDirt(kerb.endDist)) {
      for (const [x, y] of alongTrack(sub, kerb.startDist - 5, kerb.endDist + 15,
        out * (halfWidth + 4), 0.95)) cones.push({ x, y, kind: 'tyrestack' });
      continue;
    }
    traps.push({ out, d0: kerb.startDist - 5, d1: kerb.endDist + 30,
      pts: alongTrack(sub, kerb.startDist - 5, kerb.endDist + 30, out * (halfWidth + 2 + 6), 2),
      width: 12, surface: SURFACES.gravel });
  }
}
/**
 * Builds the armco and tyre-stack walls behind each gravel trap, skipping any part near a road.
 * @param sub the track
 * @param kit the track kit
 * @param halfWidth half the track width
 * @param traps gravel trap lanes
 * @param barriers armco barriers, appended to
 * @param cones tyre stacks, appended to
 */
function buildKhTrapWalls(
  sub: Subtrack, kit: KhKit, halfWidth: number, traps: Trap[], barriers: Barrier[],
  cones: Cone[],
): void {
  const nearRoad = (x: number, y: number) =>
    querySubtrack(sub, x, y).dist < halfWidth + 4 || kit.onLane(x, y, 0.6);
  const runs = (pts: Point[]) => {
    const out: Point[][] = [];
    let cur: Point[] = [];
    for (const point of pts) {
      if (nearRoad(point[0], point[1])) {
        if (cur.length > 1) out.push(cur);
        cur = [];
      } else cur.push(point);
    }
    if (cur.length > 1) out.push(cur);
    return out;
  };
  for (const trap of traps) {
    const offset = trap.out * (halfWidth + 2 + 12 + 2.5);
    for (const run of runs(alongTrack(sub, trap.d0, trap.d1, offset, 2))) barriers.push(
      { kind: 'armco', pts: run });
    for (const [rowOffset, shift] of [[offset - trap.out * 1.4, 0],
      [offset - trap.out * 2.35, 0.475]]) for (const [x, y] of alongTrack(sub, trap.d0 + shift,
      trap.d1, rowOffset, 0.95)) if (!nearRoad(x, y)) cones.push({ x, y, kind: 'tyrestack' });
  }
}
// footprint check, as Brands (props on the road were a real bug there)
const FOOT: Record<string, (prop: Prop) => number[]> =
  { grandstand: (prop) => [prop.w!, prop.h!], tower: (prop) => [prop.size!, prop.size!],
  truck: () => [14, 2.5], marshal: () => [2.4, 2], board: () => [18, 1.2],
  tree: (prop) => [prop.s! * 0.5, prop.s! * 0.5] };
/**
 * Tells whether a prop's footprint keeps clear of the road, the lanes and the floor edge.
 * @param sub the track
 * @param kit the track kit
 * @param halfWidth half the track width
 * @param prop the prop to test
 * @return true when the prop is clear
 */
function isKhPropClear(sub: Subtrack, kit: KhKit, halfWidth: number, prop: Prop): boolean {
  const footprint = FOOT[prop.kind];
  if (!footprint) return true;
  const [width, height] = footprint(prop), cosR = Math.cos(prop.rot || 0),
    sinR = Math.sin(prop.rot || 0);
  for (let across = -width / 2 - 1.5; across <= width / 2
    + 1.5; across += 1.5) for (let along = -height / 2 - 1.5; along <= height / 2
    + 1.5; along += 1.5) {
    const x = prop.x + cosR * across - sinR * along, y = prop.y + sinR * across + cosR * along;
    if (querySubtrack(sub, x, y).dist < halfWidth + 0.5 || kit.onLane(x, y, 0)
      || Math.abs(x) > FLOOR - 4 || Math.abs(y) > FLOOR - 4) return false;
    }
  return true;
}
/**
 * Scatters Fife farmland trees round the outside, few inside.
 * @param kit the track kit
 * @param props prop list, appended to
 */
function scatterKhTrees(kit: KhKit, props: Prop[]): void {
  for (let attempt = 0; attempt < 600 && props.filter((prop) =>
    prop.kind === 'tree').length < 110; attempt++) {
    const x = (kit.rnd() - 0.5) * 2 * (FLOOR - 12), y = (kit.rnd() - 0.5) * 2 * (FLOOR - 12);
    if ((Math.abs(y) > 120 || Math.abs(x) > 230 || kit.rnd() < 0.15)
      && kit.clear(x, y, 10)) props.push({ kind: 'tree', x, y, s: 3.5 + kit.rnd() * 3,
      seed: attempt });
  }
}
export const KH_LEVEL = (() => {
  const sub = KH_SUBTRACK, halfWidth = sub.width / 2;
  // gravel traps on the outside of the TARMAC corners only (the real Clark's has one); tyre walls
  // on the dirt corners instead
  const traps: Trap[] = [], barriers: Barrier[] = [], cones: Cone[] = [];
  buildKhTraps(sub, halfWidth, traps, cones);
  const kit = trackKit(sub, 1974, [KH_JOKER, ...traps]);   // Knockhill opened 1974
  buildKhTrapWalls(sub, kit, halfWidth, traps, barriers, cones);
  const finalCones = cones.filter((cone) => querySubtrack(sub, cone.x, cone.y).dist > halfWidth
    + 1.2 && !kit.onLane(cone.x, cone.y, 0.3));
  const props: Prop[] = [
    kit.prop(2, 0, { kind: 'gantry', wid: 24, rot: Math.PI / 2 }),
    // the main stand above the start straight (north)
    kit.prop(khD(470, 390), -28, { kind: 'grandstand', w: 80, h: 9 }),
    kit.prop(khD(600, 440), -30, { kind: 'grandstand', w: 34, h: 8 }),          // Duffus Dip
    kit.prop(khD(380, 650), 34, { kind: 'grandstand', w: 30, h: 8 }),           // Clark's
    kit.prop(khD(330, 378), -40, { kind: 'tower', size: 8 }),
    kit.prop(khD(230, 368), -26, { kind: 'board', label: 'KNOBHILL' }),
      kit.prop(khD(700, 540), -26, { kind: 'board', label: 'KUM TYRES' }),
    // the paddock (north)
    ...[[420, 300], [470, 296], [520, 300], [570, 304]].map(([x, y], truckIdx) => {
      const [worldX, worldY] = khXY(x, y);
      return { kind: 'truck', x: worldX, y: worldY, rot: 0.08,
        col: ['#c8302c', '#2b56b5', '#e2c13a', '#2f7d4f'][truckIdx] };
    }),
  ];
  for (const kerb of sub.curvedKerbs) props.push(
    kit.prop((kerb.startDist + kerb.endDist) / 2,
    (kerb.side === 'left' ? 1 : -1) * (halfWidth + 28), { kind: 'marshal' }));
  // Fife farmland: trees round the outside, few inside
  scatterKhTrees(kit, props);
  const okProps = props.filter((prop) => prop.kind === 'gantry'
    || isKhPropClear(sub, kit, halfWidth, prop));
  const hills: Bump[] = [
    { kind: 'dip', ...(([x, y]) => ({ x, y }))(khXY(625, 480)), r: 55, d: 3.5 },      // DUFFUS DIP
    // CLARK'S blind uphill crest
    { kind: 'hump', ...(([x, y]) => ({ x, y }))(khXY(372, 628)), r: 32, h: 2.2 },
    // the hairpin on the hill top
    { kind: 'hump', ...(([x, y]) => ({ x, y }))(khXY(150, 395)), r: 95, h: 4.0 },
  ];
  return {
    id: 'knobhill', name: 'Knobhill', base: SURFACES.grass, subtrack: sub, bushes: RX_BUSHES,
    camber: { maxDeg: 2, refR: 60, crown: 0.02, edge: 6, sections: [] },
    zones: [], bumps: prepBumps([...hills, ...kit.bank(khD(560, 402), khD(690, 495), -34, 7, 1.4),
      ...kit.bank(khD(320, 545), khD(112, 405), 34, 7, 1.3)]),
    paint: [{ kind: 'chequered', x: sub.pts[0].x, y: sub.pts[0].y, len: 1.6, wid: 13,
      rot: sub.pts[0].heading }],
    boards: [], seams: false, cones: [...finalCones,
      ...rxDress(sub, [KH_JOKER, ...traps], finalCones, [[KH_D.dirtIn, KH_D.dirtOut]]),
      ...jokerBales(sub, KH_JOKER, finalCones)],
    lanes: [KH_JOKER, ...traps], joker: KH_JOKER_RULE, barriers, props: okProps,
      solids: solidsFromProps(okProps),
    spawn: (() => {
      const pos = onTrack(sub, sub.totalDist - 15, 0, {});
      return { x: pos.x, y: pos.y, heading: pos.rot };
    })(),
  };
})();
