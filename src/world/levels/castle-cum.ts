import { alongTrack, smoothOnTrack } from "../barriers.ts";
import { FLOOR } from "../bounds.ts";
import { autoKerbs, createSubtrack, traceTrack } from "../subtrack.ts";
import { SURFACES } from "../surfaces.ts";
import { prepBumps } from "../terrain.ts";
import { ss01, trackKit } from "./kit.ts";
import type { Point, Lane, Zone, Paint, Prop, Subtrack } from "../types.ts";
// =============================================================================================
// CASTLE CUM — parody of Castle Combe (Wiltshire), built. Track list approved
// Decisions: BIGGER scale (~1250 m lap so the chicanes keep their
// shape), Avon Rise crest FELT (light over the top; braking there can lock — the real Quarry trap),
// all the scenery, DRY tarmac + grass. TRACED from the official map (art/ref/cc2.png, Wikimedia
// "Castle_Combe_Circuit_track_map.svg" at 1280 px; 385 m = 448 px -> 0.859 m/px real) at 0.358 game
// m per px (0.42 of real), centre (637, 532). Clockwise from the line on the bottom straight: FOLLY
// (flat right kink, bumpy) -> AVON RISE (shallow left over the CREST) -> QUARRY (long slow right;
// "statistically the most accident-prone corner in the UK") -> FARM STRAIGHT -> the ESSES (chicane,
// 1999) -> OLD PADDOCK (fast right) -> HAMMERDOWN (flat left kink) -> TOWER (right, braking
// downhill) -> BOBBIES (chicane, 1999) -> WESTWAY / DEAN STRAIGHT -> CAMP (right) -> line. Corner
// guide: bristolpegasus.com Castle Combe turn-by-turn; scenery: the circuit's own site sign
// (art/ref/cc4.jpg — it is drawn rotated 180 deg from the map) and pistonclick.com spectator guide.
const CC_MAP: Point[] = [
  // start / finish straight (west)
  [940, 1031], [900, 1031], [800, 1029], [700, 1026], [640, 1021], [600, 1012],
  // FOLLY, the climb
  [580, 1000], [550, 975], [500, 948], [450, 918], [400, 890], [350, 855], [320, 830],
  [280, 795], [250, 765], [200, 728],
  // AVON RISE (left, crest)
  [165, 705], [130, 697], [80, 688], [45, 678],
  // QUARRY (long right)
  [25, 660], [10, 630], [10, 600], [20, 575], [40, 553], [70, 525],
  // FARM STRAIGHT
  [100, 495], [150, 450], [200, 400], [250, 350], [300, 300],
  // the ESSES
  [310, 285], [330, 272], [345, 270], [370, 278], [385, 275], [400, 260], [410, 240],
  [420, 215], [430, 185], [445, 150],
  // OLD PADDOCK (right)
  [470, 125], [500, 103], [530, 85], [560, 78], [600, 76],
  // HAMMERDOWN (left kink)
  [700, 78], [800, 80], [870, 80], [900, 75], [950, 60], [1000, 48], [1050, 33], [1100, 20],
  // TOWER (right)
  [1130, 17], [1160, 22], [1190, 40], [1210, 65], [1225, 100], [1230, 150], [1233, 200],
  [1237, 250],
  // BOBBIES (chicane)
  [1240, 290], [1225, 305], [1210, 315], [1200, 330], [1202, 350], [1210, 375],
  // WESTWAY
  [1225, 410], [1245, 450], [1260, 480], [1266, 520], [1263, 570], [1250, 620], [1230, 680],
  // DEAN STRAIGHT, CAMP (re-read: first pass ran ~15 px east)
  [1215, 750], [1200, 800], [1185, 850], [1172, 900], [1158, 945], [1138, 980], [1110, 1008],
  [1080, 1025], [1050, 1031], [1000, 1031]];
export const CC_SUBTRACK = createSubtrack(
  traceTrack(CC_MAP, { mpp: 0.358, cx: 637, cy: 532, rMin: 15.5 }),
  13,
  [{ startDist: 0, endDist: 1e9, surface: SURFACES.racetarmac }],
  [],
  true,
);
CC_SUBTRACK.curvedKerbs = autoKerbs(
  CC_SUBTRACK, { maxR: 70, exitR: 30, heavyR: 22, minTurn: 20, mergeGap: 12 },
);
export const CC_PAINT: Paint[] = [{
  kind: 'chequered', x: CC_SUBTRACK.pts[0].x, y: CC_SUBTRACK.pts[0].y, len: 1.6, wid: 13,
  rot: CC_SUBTRACK.pts[0].heading,
}];

// CASTLE CUM SCENERY (all asked for). Distances measured on this trace
// (lap 1338 m): FOLLY 130, AVON RISE 313, QUARRY 384, ESSES 547-624, OLD PADDOCK 663,
// HAMMERDOWN 795, TOWER 904, BOBBIES 997-1033, WESTWAY 1089, CAMP 1261. Pit lane from the
// map: OUTSIDE the start straight, leaving at Camp and rejoining before Folly ("the pit exit
// joins the main circuit before Folly").
const ccMapXY = (mapX: number, mapY: number): Point =>
  [+((mapX - 637) * 0.358).toFixed(2), +((mapY - 532) * 0.358).toFixed(2)];
const CC_PIT = { d0: 1225, d1: 121, off: -17, w: 9, ramp: 28 };
const CC_PIT_LANE = alongTrack(
  CC_SUBTRACK,
  CC_PIT.d0,
  CC_PIT.d1,
  (along, len) => -4 + (CC_PIT.off + 4) * ss01(Math.min(along, len - along) / CC_PIT.ramp),
  2,
);
// Castle Combe circuit opened 1950
const CC_KIT0 = trackKit(CC_SUBTRACK, 1950);
// the KART TRACK, north of the top straight (site sign: "skid pan, kart track, 4x4 course"),
// in its own frame
const CC_KART: Point[] = (() => {
  // (the -56 puts it beyond the ring road, which ran through the kart track at -38)
  const centre = CC_KIT0.at(740, -56), rot = CC_KIT0.rot(740),
    cosRot = Math.cos(rot), sinRot = Math.sin(rot);
  return [
    [-25, -8], [20, -8], [25, -3], [25, 3], [20, 8], [2, 8], [-4, 2], [-10, 8], [-25, 8],
    [-29, 3], [-29, -3], [-25, -8],
  ].map(([localX, localY]) => [
    +(centre.x + cosRot * localX - sinRot * localY).toFixed(2),
    +(centre.y + sinRot * localX + cosRot * localY).toFixed(2),
  ]);
})();
// RING ROAD from the track's OUTLINE, not an offset: an offset of -66 m looped back on
// itself inside the Esses' left-handers and squashed against the world edge (photographed).
// Per 6 deg round the centroid: the furthest track point in a +-12 deg window, + margin,
// smoothed, clamped inside the floor. A star-shaped curve like this cannot self-intersect.
function ringAround(sub: Subtrack, margin: number, lim: number): Point[] {
  let centreX = 0, centreY = 0;
  for (const point of sub.pts) {
    centreX += point.x;
    centreY += point.y;
  }
  centreX /= sub.pts.length;
  centreY /= sub.pts.length;
  const RAYS = 60, reach = new Array(RAYS).fill(0);
  for (const point of sub.pts) {
    const angle = Math.atan2(point.y - centreY, point.x - centreX),
      dist = Math.hypot(point.x - centreX, point.y - centreY);
    for (let ray = 0; ray < RAYS; ray++) {
      let delta = angle - (ray / RAYS) * 2 * Math.PI;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      if (Math.abs(delta) < 0.21) reach[ray] = Math.max(reach[ray], dist * Math.cos(delta));
    }
  }
  let smoothed = reach.map((radius) => radius + margin);
  for (let pass = 0; pass < 3; pass++)
    smoothed = smoothed.map((radius, ray) => (
      smoothed[(ray + RAYS - 1) % RAYS] + 2 * radius + smoothed[(ray + 1) % RAYS]) / 4);
  return smoothed.map((radius, ray) => {
    const angle = (ray / RAYS) * 2 * Math.PI;
    return [
      +Math.max(-lim, Math.min(lim, centreX + Math.cos(angle) * radius)).toFixed(2),
      +Math.max(-lim, Math.min(lim, centreY + Math.sin(angle) * radius)).toFixed(2),
    ];
  });
}
// it ran straight through the paddock (the start straight is the southernmost part of the
// lap): now it STOPS at the paddock at both ends, as a real perimeter road feeds into the
// paddock — the ring minus the points near the pits / paddock, opened there
const CC_RING = (() => {
  const full = ringAround(CC_SUBTRACK, 26, FLOOR - 9),
    pad = alongTrack(CC_SUBTRACK, 1210, 140, -36, 4);
  const near = ([x, y]: Point) => pad.some(([padX, padY]) => Math.hypot(x - padX, y - padY) < 22);
  // last point inside the paddock zone
  const start = full.findIndex((point, i) => near(point) && !near(full[(i + 1) % full.length]));
  const out: Point[] = [];
  for (let i = 1; i <= full.length; i++) {
    const point = full[(start + i) % full.length];
    if (near(point)) break;
    out.push(point);
  }
  // join each end to the nearer END of the paddock (photographed: the open ends dangled 100 m
  // short of it)
  const ends = [smoothOnTrack(CC_SUBTRACK, 1290, -42), smoothOnTrack(CC_SUBTRACK, 65, -42)]
    .map((point): Point => [+point.x.toFixed(2), +point.y.toFixed(2)]);
  const dist = (left: Point, right: Point) => Math.hypot(left[0] - right[0], left[1] - right[1]);
  const first = dist(out[0], ends[0]) < dist(out[0], ends[1]) ? ends[0] : ends[1],
    last = first === ends[0] ? ends[1] : ends[0];
  // the Camp end went straight across the pit lane (photographed): route it round the OUTSIDE
  // of the pit entry first
  const via = [smoothOnTrack(CC_SUBTRACK, 1235, -50)]
    .map((point): Point => [+point.x.toFixed(2), +point.y.toFixed(2)])[0];
  return first === ends[0] ? [first, via, ...out, last] : [first, ...out, via, last];
})();
export const CC_LANES: Lane[] = [
  { pts: CC_PIT_LANE, width: CC_PIT.w, surface: SURFACES.concrete },
  // PADDOCK behind the pits
  { pts: alongTrack(CC_SUBTRACK, 1285, 70, -42, 3), width: 26, surface: SURFACES.tarmac },
  // the ESSES escape road (pre-1999 layout)
  { pts: [ccMapXY(316, 270), ccMapXY(452, 141)], width: 11, surface: SURFACES.broken },
  // the BOBBIES escape road (pre-1999 layout)
  { pts: [ccMapXY(1241, 296), ccMapXY(1266, 472)], width: 10, surface: SURFACES.broken },
  // "braking point: where a concrete strip ends on the left"
  { pts: alongTrack(CC_SUBTRACK, 940, 990, -8.6, 2), width: 2.6, surface: SURFACES.concrete },
  // kart track
  { pts: CC_KART, width: 6, surface: SURFACES.tarmac },
  // circuit ring road (ends at the paddock)
  { pts: CC_RING, width: 6, surface: SURFACES.broken },
];
export const CC_KIT = trackKit(CC_SUBTRACK, 1950, CC_LANES);
// outside of QUARRY, OLD PADDOCK, TOWER
export const CC_ARMCO = [[345, 432], [640, 692], [878, 945]];
export const CC_BUMPS = prepBumps([
  // AVON RISE: the crest before Quarry. cos^2 hump: crest curvature h pi^2 / 2 r^2 = 0.0052/m
  // -> at 145 km/h (40 m/s) 8.3 m/s^2 of the 13.7 vertical gravity: the car goes LIGHT, not
  // airborne. Braking there is the real trap (locks). Measured: see ENGINE.md.
  { kind: 'hump', ...CC_KIT.at(296, 0), r: 30, h: 0.95 },
  // the run down into TOWER: a broad rise on the top straight after Hammerdown, so you brake for
  // Tower going DOWNHILL MEASURED (tools/crestcheck --flat): r 45 h 1.6 put EVERY car airborne
  // 0.2-0.5 s flat out (user asked for light, not flying); r 50 h 0.9 = 46% of that crest curvature
  { kind: 'hump', ...CC_KIT.at(850, 0), r: 50, h: 0.9 },
  // FOLLY: "the track is bumpy here"
  ...[0, 1, 2, 3, 4].map((idx) => ({
    kind: idx % 2 ? 'dip' : 'hump', ...CC_KIT.at(112 + idx * 12, (idx % 3) * 2.5 - 2.5),
    r: 3, h: 0.05, d: 0.045,
  })),
  // VIEWING BANKS (site sign / pistonclick): Folly, Quarry, the Esses, Bobbies, and "quite a
  // high bank along the straight to Camp"
  ...CC_KIT.bank(140, 260, -32, 7, 1.3), ...CC_KIT.bank(350, 440, -34, 7, 1.5),
  ...CC_KIT.bank(530, 640, -30, 7, 1.3),
  ...CC_KIT.bank(970, 1060, -30, 7, 1.3), ...CC_KIT.bank(1110, 1215, -30, 7, 2.0),
]);
const CC_TREES: Prop[] = [];
for (let attempt = 0; attempt < 420 && CC_TREES.length < 110; attempt++) {
  const x = (CC_KIT.rnd() - 0.5) * 2 * (FLOOR - 12), y = (CC_KIT.rnd() - 0.5) * 2 * (FLOOR - 12);
  if (CC_KIT.clear(x, y, 9))
    CC_TREES.push({ kind: 'tree', x, y, s: 3 + CC_KIT.rnd() * 3.5, seed: 500 + attempt });
}
export const CC_PROPS: Prop[] = [
  CC_KIT.prop(3, 0, { kind: 'gantry', wid: 24, rot: Math.PI / 2 }),
  // the red sculpture by the pit wall (photo)
  CC_KIT.prop(1325, -11.3, { kind: 'sculpture' }),
  // AVON footbridge over Dean Straight
  CC_KIT.prop(1195, 0, { kind: 'footbridge', wid: 27, label: 'AVAN TYRES', rot: Math.PI / 2 }),
  // DUNLOP footbridge after Old Paddock
  CC_KIT.prop(712, 0, { kind: 'footbridge', wid: 27, label: 'DUMLOP', rot: Math.PI / 2 }),
  // the clubhouse
  CC_KIT.prop(20, -62, { kind: 'block', w: 26, h: 12, roof: '#7a5a48', label: 'TAVERN' }),
  // circuit administration
  CC_KIT.prop(55, -62, { kind: 'block', w: 18, h: 10, roof: '#5b626b' }),
  // race control
  CC_KIT.prop(1300, -36, { kind: 'tower', size: 7 }),
  // Octagon building by the kart track
  CC_KIT.prop(806, -66, { kind: 'block', w: 14, h: 14, roof: '#6c7280', label: 'OCTAGON' }),
  CC_KIT.prop(176, -21, { kind: 'board', label: 'CASTLE CUM' }),
  CC_KIT.prop(1150, -22, { kind: 'board', label: 'KUM TYRES' }),
  CC_KIT.prop(460, -24, { kind: 'board', label: 'SPUM OIL' }),
  ...[1300, 1315, 10, 25, 40].flatMap((dist, idx) => [
    CC_KIT.prop(dist, -36, {
      kind: 'truck', col: ['#c8302c', '#2b56b5', '#e2c13a', '#2f7d4f', '#7a3fa0'][idx],
    }),
    CC_KIT.prop(dist + 6, -48, {
      kind: 'truck', col: ['#f2f2f2', '#c8302c', '#2b56b5', '#5a5e66', '#e2c13a'][idx],
      rot: Math.PI,
    }),
  ]),
  ...[130, 313, 384, 600, 663, 795, 904, 1015, 1089]
    .map((dist) => CC_KIT.prop(dist, -21, { kind: 'marshal' })),
  ...CC_TREES,
].filter((prop) => prop.kind === 'gantry' || prop.kind === 'footbridge'
  || prop.kind === 'sculpture' || prop.kind === 'tower' || prop.kind === 'truck'
  || prop.kind === 'block' || CC_KIT.clear(prop.x, prop.y, prop.kind === 'tree' ? 9 : 3));
export const CC_TYREWALL = CC_ARMCO.flatMap(([from, end]) => [[-14.0, 0], [-15.0, 0.475]]
  .flatMap(([off, shift]) => alongTrack(CC_SUBTRACK, from + shift, end, off, 0.95)
    .map(([x, y]) => ({ x, y, kind: 'tyrestack' }))));
// SKID PAN
export const CC_ZONES: Zone[] = [(() => {
  const spot = CC_KIT.at(872, -58);
  return { x: spot.x, y: spot.y, w: 34, h: 26, rot: CC_KIT.rot(870), surface: SURFACES.wet };
})()];
