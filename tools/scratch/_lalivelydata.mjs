// _lalivelydata.mjs - L.A. LIVELY's venue data (world/levels/venues/lalively.ts), laid by hand (no
// map: the X Gayms rallycross course was laid for a weekend in the streets and lots round the
// arena, Los Angeles 2012): ONE path crossing itself once on the street grid - a figure of eight
// of two blocks, the north-south street running under the east-west avenue (the crossover bridge,
// world/venuecross.ts, at 90 deg) - tarmac on the streets and dirt laid over the street in the two
// lots (the east lot and the north street, and the west lot), the JOKER a dirt lane round the
// north lot's outside with the 16 m (52 ft) gap jump on its straight (the game's ramp and table
// terrain pieces). Game m = real m (share 1). The barriers' lines are written as data.rails (10 m
// off every road but the crossover's, none within 9.5 m of another road). node
// tools/scratch/_lalivelydata.mjs (scratch)
import fs from 'node:fs';
import { dressLines, layKit } from './_dresskits.mjs';

const STEP = 2;
const r1 = (v) => Math.round(v * 10) / 10;
// THE LAP's corners in driving order [x, y, radius] (y down, north up): the avenue east over the
// bridge, the east jog into the east lot, north up it, west along the north street, south down the
// street under the bridge, west along the south street (the start), north up the west lot, east
// onto the avenue
const LAP = [
  [-150, 0, 16], [80, 0, 16], [80, -35, 16], [150, -35, 16], [150, -110, 18], [0, -110, 18],
  [0, 90, 16], [-150, 90, 18],
];
// THE JOKER's corners: on north from the east lot past the north street's corner, west along the
// joker straight, south onto the street after its corner
const JOKER = { from: [150, -80], corners: [[150, -140, 20], [0, -140, 35]], to: [0, -70] };
// where the lap is cut into pieces [x, y, name of the piece that starts there, surface]
const CUTS = [
  [-40, 0, 'Crossover over'], [40, 0, 'Avenue east'], [64, 0, 'East lot', 'dirt'],
  [150, -80, 'North lot', 'dirt'], [40, -110, 'North corner'], [0, -70, 'Street north'], [0, -40, 'Crossover under'],
  [0, 40, 'South street'], [-132, 90, 'West lot', 'dirt'], [-120, 0, 'Avenue west'],
];
// THE GAP JUMP on the joker straight (heading west, rot PI): the kicker's lip at LIP_X, the gap
// GAP_M to the landing deck - the kicker a ramp (world/terrain.ts: t^2, steepest at its lip, the
// ground falling away there) KICK_H high over KICK_LEN, the landing a table (its rising face in
// the gap's last 9 m - a table's first 30 % - then the deck and the run down) LAND_H high over
// LAND_LEN. ACROSS THE WHOLE ROAD: a terrain piece is full height only on its middle line (its
// height tapers cos^2 to its edges), so one piece the road's width was a kicker only for a car
// on the joker's middle (MEASURED, tools/scratch/_aigapcheck.mjs: the AI, on its line a few
// metres off it, 0 of 20 cleared, most never left the ground). Each is JUMP_PIECES pieces side
// by side, JUMP_STEP apart and twice that wide: cos^2 and its neighbour's sin^2 sum to one, so
// the jump stands full height from JUMP_STEP * 2 left of the middle to as far right - the whole
// road - and tapers to the ground JUMP_STEP past that (inside the joker's run-off).
// MEASURED (tools/scratch/_gapjump.mjs): the cars clear it from 60-70 km/h, short below
const LIP_X = 85, JOKER_Y = -140, GAP_M = 16, KICK_H = 2, KICK_LEN = 10, LAND_H = 2,
  LAND_LEN = 30, JUMP_STEP = 3.5, JUMP_PIECES = 5;

const arc = (cx, cy, r, a0, a1) => { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / STEP)); const out = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return out; };
const line = (from, to) => { const n = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / STEP)); const out = []; for (let i = 0; i <= n; i++) out.push([from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n]); return out; };
const unit = ([ax, ay], [bx, by]) => { const len = Math.hypot(bx - ax, by - ay); return [(bx - ax) / len, (by - ay) / len]; };
// a corner's fillet: the arc of radius r between the line in and the line out
function fillet(prev, vert, next, radius) {
  const inDir = unit(prev, vert), outDir = unit(vert, next);
  const cross = inDir[0] * outDir[1] - inDir[1] * outDir[0];
  const turn = Math.acos(Math.max(-1, Math.min(1, inDir[0] * outDir[0] + inDir[1] * outDir[1])));
  const reach = radius * Math.tan(turn / 2), side = Math.sign(cross);
  const from = [vert[0] - inDir[0] * reach, vert[1] - inDir[1] * reach];
  // (the centre to the left of the way in for a left turn: y down, so a negative cross)
  const centre = [from[0] - inDir[1] * radius * side, from[1] + inDir[0] * radius * side];
  const a0 = Math.atan2(from[1] - centre[1], from[0] - centre[0]);
  return arc(centre[0], centre[1], radius, a0, a0 + turn * side);
}
const join = (parts) => parts.reduce((all, part) => {
  if (!all.length) return part.slice();
  const last = all[all.length - 1], first = part[0];
  return Math.hypot(last[0] - first[0], last[1] - first[1]) < 0.3 ? [...all, ...part.slice(1)]
    : [...all, ...part];
}, []);
// a path through corners (open: from, the corners, to)
function openPath(from, corners, to) {
  const verts = [from, ...corners.map(([x, y]) => [x, y]), to], parts = [];
  for (let i = 1; i < verts.length - 1; i++) {
    const arcPts = fillet(verts[i - 1], verts[i], verts[i + 1], corners[i - 1][2]);
    parts.push(line(parts.length ? parts[parts.length - 1].at(-1) : from, arcPts[0]), arcPts);
  }
  parts.push(line(parts.at(-1).at(-1), to));
  return join(parts);
}
// the closed lap from the first cut round to it again
const lapVerts = LAP.map(([x, y]) => [x, y]), count = LAP.length;
const arcs = LAP.map((corner, i) => fillet(lapVerts[(i - 1 + count) % count], lapVerts[i],
  lapVerts[(i + 1) % count], corner[2]));
const loopParts = [];
for (let i = 0; i < count; i++) loopParts.push(arcs[i], line(arcs[i].at(-1), arcs[(i + 1) % count][0]));
let loop = join(loopParts);
// densified: every STEP m, then the cuts' points put in
const nearestIdx = (pts, [x, y]) => { let best = 0, bd = Infinity; pts.forEach(([px, py], i) => { const d = Math.hypot(px - x, py - y); if (d < bd) [bd, best] = [d, i]; }); return [best, bd]; };
// (each cut on the loop's line: a straight's point; insert it exactly)
for (const [x, y] of CUTS) {
  const [i, d] = nearestIdx(loop, [x, y]);
  if (d > 1.01 * STEP) throw new Error(`cut ${x},${y} is ${d.toFixed(1)} m off the lap`);
  if (d > 0.01) {
    const prev = loop[(i - 1 + loop.length) % loop.length], next = loop[(i + 1) % loop.length];
    const before = Math.hypot(prev[0] - x, prev[1] - y) < Math.hypot(next[0] - x, next[1] - y);
    loop.splice(before ? i : i + 1, 0, [x, y]);
  }
}
// rotated to start at the first cut
const startIdx = nearestIdx(loop, CUTS[0])[0];
loop = [...loop.slice(startIdx), ...loop.slice(0, startIdx)];
const cutIdx = CUTS.map((cut) => nearestIdx(loop, cut)[0]);
const pieces = CUTS.map(([, , name, surface], k) => {
  const from = cutIdx[k], until = k + 1 < CUTS.length ? cutIdx[k + 1] : loop.length;
  const pts = loop.slice(from, until + 1);
  if (k + 1 === CUTS.length) pts.push(loop[0]);
  return { name, ...(surface ? { surface } : {}), pts: pts.map(([x, y]) => [r1(x), r1(y)]) };
});
const jokerPts = openPath(JOKER.from, JOKER.corners, JOKER.to).map(([x, y]) => [r1(x), r1(y)]);
pieces.push({ name: 'Joker', surface: 'dirt', pts: jokerPts });
const lapNames = CUTS.map((cut) => cut[2]);
const jokerNames = lapNames.flatMap((name) => (name === 'North lot' ? ['Joker'] : name === 'North corner' ? [] : [name]));
// THE BARRIERS: a line RAIL_M off each side of every road (the course's concrete blocks and
// Armco), none along the crossover's pieces (the bridge's parapets and the cut's walls), none
// within KEEP_M of another road's centre (the joker's mouths, the crossing), runs of fewer than
// MIN_PTS points dropped
const RAIL_M = 10, KEEP_M = 9.5, MIN_PTS = 4;
const offset = (pts, side, out) => pts.map(([x, y], i) => { const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(pts.length - 1, i + 1)], len = Math.hypot(bx - ax, by - ay) || 1; return [r1(x - (by - ay) / len * out * side), r1(y + (bx - ax) / len * out * side)]; });
const segGap = (pts, [x, y]) => { let best = Infinity; for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t)); } return best; };
const allRoads = [loop, jokerPts];
const roadGap = (at) => Math.min(...allRoads.map((road) => segGap(road, at)));
// THE STRIP between the joker and the lap where they run apart holds no barrier: the joker's
// bales (world/levels/kit.ts jokerBales) - a rail there ended at the joker's mouths, an Armco end
// at a road. A point is in it when the lap and the joker's own road (its points off the lap)
// both lie within STRIP_M, on opposite sides
const STRIP_M = 30, JOKER_OWN_M = 8;
const jokerOwn = jokerPts.filter((point) => segGap(loop, point) > JOKER_OWN_M);
const nearestOn = (pts, [x, y]) => { let best = null, bd = Infinity; for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); const px = ax + dx * t, py = ay + dy * t, d = Math.hypot(x - px, y - py); if (d < bd) [bd, best] = [d, [px - x, py - y]]; } return [bd, best]; };
const inStrip = (at) => {
  const [lapGap, toLap] = nearestOn(loop, at), [jokerGap, toJoker] = nearestOn(jokerOwn, at);
  if (lapGap > STRIP_M || jokerGap > STRIP_M) return false;
  return (toLap[0] * toJoker[0] + toLap[1] * toJoker[1]) / (lapGap * jokerGap || 1) < -0.3;
};
const rails = [];
for (const piece of pieces.filter((entry) => !/Crossover/.test(entry.name))) {
  for (const side of [1, -1]) {
    let run = [];
    for (const point of offset(piece.pts, side, RAIL_M)) {
      if (roadGap(point) > KEEP_M && !inStrip(point)) { run.push(point); continue; }
      if (run.length >= MIN_PTS) rails.push(run);
      run = [];
    }
    if (run.length >= MIN_PTS) rails.push(run);
  }
}
// THE BLOCKS round the course (VenueData.buildings, real m boxes): the arena (north-west of the
// crossing, in the block the course leaves out), the convention halls (south-east), offices and
// shops on the corners outside; the kinds the venue's own (world/venuescenery.ts: a flat-roofed
// block)
const BLOCKS = [
  ['L.A. Lively Arena', -85, -75, 80, 70, 0, 'public'],
  ['Convention hall', 75, 50, 90, 50, 0, 'commercial'],
  ['Convention hall west', 22, 62, 14, 30, 0, 'commercial'],
  ['Hotel tower', -205, -40, 36, 50, 0, 'commercial'],
  ['Offices', -205, 45, 36, 40, 0, 'office'],
  ['Offices south', -205, 125, 36, 34, 0, 'office'],
  ['Shops', -75, 140, 90, 26, 0, 'retail'],
  ['Shops east', 70, 140, 80, 26, 0, 'retail'],
  ['Parking deck', 205, -70, 34, 90, 0, 'commercial'],
  ['Studios', 75, -200, 120, 26, 0, 'office'],
  ['Studios west', -75, -200, 100, 26, 0, 'office'],
  ['Theatre', 205, 30, 34, 60, 0, 'public'],
];
// (each box kept BLOCK_KEEP_M off every road's centre: its corners and edges' middles)
const BLOCK_KEEP_M = 15;
const boxPts = ([, x, y, w, h]) => [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2], [x, y - h / 2], [x, y + h / 2], [x - w / 2, y], [x + w / 2, y], [x, y]];
const insideBox = ([, x, y, w, h], [px, py], grow = 0) => Math.abs(px - x) < w / 2 + grow && Math.abs(py - y) < h / 2 + grow;
const roadInBox = (box) => allRoads.some((road) => road.some((point) => insideBox(box, point, BLOCK_KEEP_M)));
const blockReport = BLOCKS.map((box) => `${box[0]}: ${Math.min(...boxPts(box).map(roadGap)).toFixed(1)} m${roadInBox(box) ? ' ROAD IN IT' : ''}`);
const buildings = BLOCKS.filter((box) => !roadInBox(box)).map(([name, x, y, w, h, rot, kind]) => ({ name, x, y, w, h, rot, kind }));
// THE STANDS (VenueData.stands): temporary bleachers behind the barriers where the crowd watches -
// the start, the jump (north of the joker straight), the crossover (both sides of the avenue)
const STANDS = [
  ['Start stand', -80, 115, 50, 8, 0], ['Jump stand', 75, -165, 70, 8, 0],
  ['Avenue stand', -70, -25, 50, 8, 0], ['East lot stand', 175, -40, 8, 34, 0],
];
const stands = STANDS.map(([name, x, y, w, h, rot]) => ({ name, x, y, w, h, rot }));
const standReport = STANDS.map((box) => `${box[0]}: ${Math.min(...boxPts(box).map(roadGap)).toFixed(1)} m`);
// THE FLOODLIGHTS (VenueSpec.landmarks 'pylon': world/lamps.ts, a pool 34 m round) every
// FLOOD_EVERY m round the lap and the joker, FLOOD_OUT m off the road's centre, on the side away
// from the nearest other road; none within FLOOD_KEEP_M of a road, a block, a stand or another,
// 6 m of a barrier line or FLOOD_CROSS_M of the crossing (a pylon there stood where the edge
// joins the portals' walls: a gap)
const FLOOD_EVERY = 50, FLOOD_OUT = 16, FLOOD_KEEP_M = 12, FLOOD_APART_M = 20, FLOOD_CROSS_M = 30;
const floods = [];
const floodClear = (at) => roadGap(at) > FLOOD_KEEP_M
  && ![...BLOCKS, ...STANDS].some((box) => insideBox(box, at, 3))
  && rails.every((rail) => segGap(rail, at) > 6) && Math.hypot(at[0], at[1]) > FLOOD_CROSS_M
  && floods.every((flood) => Math.hypot(flood.at[0] - at[0], flood.at[1] - at[1]) > FLOOD_APART_M);
for (const road of allRoads) {
  let run = FLOOD_EVERY / 2;
  for (let i = 1; i < road.length; i++) {
    run += Math.hypot(road[i][0] - road[i - 1][0], road[i][1] - road[i - 1][1]);
    if (run < FLOOD_EVERY) continue;
    const spots = [1, -1].map((side) => offset(road.slice(Math.max(0, i - 1), i + 2), side, FLOOD_OUT)[1]).filter(floodClear);
    if (!spots.length) continue;
    run = 0;
    floods.push({ at: spots[0], kind: 'pylon', size: 2 });
  }
}
// THE FLAGS (VenueSpec.landmarks): the event's colours, orange, black and white, along the front
// of the stands
const FLAG_COLS = ['#f07a1a', '#1d1f24', '#e8e6e0'];
const flags = STANDS.flatMap(([, x, y, w, h]) => {
  const along = w >= h, len = Math.max(w, h), out = [];
  for (let t = -len / 2 + 4; t <= len / 2 - 4; t += 12) {
    const spot = along ? [r1(x + t), r1(y + (y > 0 ? -h / 2 - 2 : h / 2 + 2))]
      : [r1(x - w / 2 - 2), r1(y + t)];
    if (roadGap(spot) > 8 && rails.every((rail) => segGap(rail, spot) > 1.5)) out.push(spot);
  }
  return out;
}).map((at, i) => ({ at, kind: 'flag', size: 1, col: FLAG_COLS[i % FLAG_COLS.length] }));
// THE LITTER (VenueSpec.litter): heaps of the highway's debris kinds behind the barriers - spare
// tyres in the lots, the event's barrels, pallets by the halls, a tarp - each [x, y, kit]
const KITS = {
  tyres: [[0, 0, 'tyre'], [0.9, 0.2, 'tyre'], [1.8, -0.1, 'tyre'], [0.4, 0.9, 'tyre'], [1.3, 1.0, 'tyre']],
  barrels: [[0, 0, 'barrel', '#f07a1a'], [0.9, 0.1, 'barrel', '#f07a1a'], [0.45, 0.85, 'barrel', '#1d1f24']],
  pallets: [[0, 0, 'pallet'], [1.6, 0.3, 'pallet'], [0.8, 1.5, 'box'], [2.6, 1.2, 'crate']],
  tarp: [[0, 0, 'tarp', '#f07a1a'], [1.7, 0.4, 'sandbag'], [1.9, -0.6, 'sandbag']],
};
const HEAPS = [[118, -78, 'tyres'], [40, -78, 'barrels'], [-118, 45, 'tyres'], [-40, 55, 'pallets'],
  [128, -172, 'barrels'], [-40, 112, 'tarp'], [40, 22, 'pallets'], [-118, 22, 'barrels']];
const litter = HEAPS.flatMap(([x, y, kit]) => KITS[kit].map(([dx, dy, kind, col]) =>
  ({ at: [r1(x + dx), r1(y + dy)], kind, ...(col ? { col } : {}) })));
const litterReport = HEAPS.map(([x, y, kit]) => `${kit}@${x},${y}: road ${roadGap([x, y]).toFixed(1)} rail ${Math.min(...rails.map((rail) => segGap(rail, [x, y]))).toFixed(1)}`);
// THE DRESSING (VenueSpec.dress): the shared kits (_dresskits.mjs) in the
// event's orange, black and white, each [x, y, heading deg, kit] (the kit laid along the heading,
// out to its right), where a street event has them: the PADDOCK in the lot east of the convention
// hall, off the course (its transporters, the teams' cars, flight cases, spare tyres, a motorhome
// with its bins); a TV CAMERA platform and FANS either end of the jump's stand; fans at the
// start's stand's west end; show cars in the infield by the avenue's stand. Each item kept
// DRESS_ROAD_M off every road's centre and DRESS_KEEP_M off a block, a stand's own keep-off, a
// flag or pylon (the kits' DRESS_*_M) and the litter; one that is not is left out and reported
const DRESS = [
  [140, 5, 0, 'paddock'], [105, -8, 0, 'transporters'], [170, 8, 0, 'motorhome'],
  [30, -160, 0, 'tvcamera'], [118, -158, 0, 'fans'], [-113, 111, 180, 'fans'],
  [-100, 30, 0, 'showcars'],
];
const DRESS_ROAD_M = 9.5, DRESS_KEEP_M = 2, DRESS_LITTER_M = 1.5;
const dressDropped = [];
const dressSite = { rails, stands, marks: [...flags, ...floods], isFree: (at, reach) =>
  roadGap(at) > DRESS_ROAD_M + reach
  && !BLOCKS.some((box) => insideBox(box, at, DRESS_KEEP_M + reach))
  && litter.every((item) => Math.hypot(item.at[0] - at[0], item.at[1] - at[1])
    > DRESS_LITTER_M + reach) };
const dressItems = DRESS.flatMap(([x, y, headingDeg, kit]) => {
  const heading = headingDeg * Math.PI / 180;
  const along = [Math.cos(heading), Math.sin(heading)], across = [-along[1], along[0]];
  const rot = Math.round(Math.atan2(along[1], along[0]) * 1000) / 1000;
  return layKit(kit, { origin: [x, y], along, across, rot, cols: FLAG_COLS }, dressSite,
    dressDropped);
});
// the jump as terrain (the level adds them: world/levels/lalively-venue.ts)
const across = Array.from({ length: JUMP_PIECES }, (_, i) => (i - (JUMP_PIECES - 1) / 2) * JUMP_STEP);
const jump = [
  ...across.map((off) => ({ kind: 'ramp', x: LIP_X + KICK_LEN / 2, y: JOKER_Y + off, rot: Math.PI, len: KICK_LEN, wid: 2 * JUMP_STEP, h: KICK_H })),
  ...across.map((off) => ({ kind: 'table', x: LIP_X - GAP_M + 0.3 * LAND_LEN - LAND_LEN / 2, y: JOKER_Y + off, rot: Math.PI, len: LAND_LEN, wid: 2 * JUMP_STEP, h: LAND_H })),
];
// WRITE
const json = (value) => JSON.stringify(value).replace(/,(?=["[{\d-])/g, ', ').replace(/":(?=["[{\d-]|true|false)/g, '": ');
const lines = [
  '// lalively.ts - written by tools/scratch/_lalivelydata.mjs (laid by hand: the X Gayms',
  "// rallycross course round the arena's streets and lots, Los Angeles 2012, a figure of eight with",
  '// one crossover bridge and the joker\'s gap jump). Game m (share 1). Edit the generator, not this',
  '// file.',
  "import type { Bump } from '../../types.ts';",
  "import type { VenueData, VenueSpec } from '../../venue.ts';", '',
  'export const LALIVELY_VENUE: VenueData = {', '  pieces: ['];
for (const piece of pieces) lines.push(`    ${json(piece)},`);
lines.push('  ],', '  layouts: {', `    rx: ${json(lapNames.map((name) => [name, 1]))},`,
  `    joker: ${json(jokerNames.map((name) => [name, 1]))},`, '  },');
for (const key of ['pitLanes', 'roads', 'footbridges', 'dirt', 'karting', 'tunnels', 'traps', 'tyres']) lines.push(`  ${key}: [],`);
lines.push('  stands: [');
for (const box of stands) lines.push(`    ${json(box)},`);
lines.push('  ],', '  buildings: [');
for (const box of buildings) lines.push(`    ${json(box)},`);
lines.push('  ],');
for (const key of ['paddocks', 'woods', 'homes']) lines.push(`  ${key}: [],`);
lines.push('  rails: [');
for (const pts of rails) lines.push(`    ${json({ kind: 'seen', pts })},`);
lines.push('  ],', '};', '',
  '// the floodlight pylons round the lap and the joker (VenueSpec.landmarks)',
  "export const LALIVELY_FLOODS: NonNullable<VenueSpec['landmarks']> = [");
for (const flood of floods) lines.push(`  ${json(flood)},`);
lines.push('];', '', "// the event's flags along the front of the stands (VenueSpec.landmarks)",
  "export const LALIVELY_FLAGS: NonNullable<VenueSpec['landmarks']> = [");
for (const flag of flags) lines.push(`  ${json(flag)},`);
lines.push('];', '', '// the litter behind the barriers (VenueSpec.litter)',
  "export const LALIVELY_LITTER: NonNullable<VenueSpec['litter']> = [");
for (const item of litter) lines.push(`  ${json(item)},`);
lines.push('];', '', ...dressLines('LALIVELY', dressItems, json, 'in the lots off the course'));
lines.push("// the joker's gap jump: the kicker (a ramp) and the landing (a table), game m",
  'export const LALIVELY_JUMP: Bump[] = [');
for (const bump of jump) lines.push(`  ${json({ ...bump, rot: Math.round(bump.rot * 1e6) / 1e6 })},`);
lines.push('];', '');
const wrapped = lines.flatMap((text) => { if (text.length <= 100) return [text]; const parts = []; let rest = text; while (rest.length > 100) { const cut = rest.lastIndexOf(', ', 98); if (cut < 12) break; parts.push(rest.slice(0, cut + 1)); rest = `      ${rest.slice(cut + 2)}`; } parts.push(rest); return parts; });
fs.writeFileSync('src/world/levels/venues/lalively.ts', wrapped.join(String.fromCharCode(10)));
const len = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const lapLen = pieces.filter((piece) => lapNames.includes(piece.name)).reduce((s, p) => s + len(p.pts), 0);
const dirtLen = pieces.filter((piece) => lapNames.includes(piece.name) && piece.surface).reduce((s, p) => s + len(p.pts), 0);
const jokerLen = pieces.filter((piece) => jokerNames.includes(piece.name)).reduce((s, p) => s + len(p.pts), 0);
console.log('lap', lapLen.toFixed(1), 'm (dirt', dirtLen.toFixed(0), 'm,', (100 * dirtLen / lapLen).toFixed(0), '%); joker loop', jokerLen.toFixed(1), 'm (+', (jokerLen - lapLen).toFixed(1), ')');
console.log('rails', rails.length, 'floods', floods.length, 'flags', flags.length, 'litter', litter.length);
console.log('blocks:', blockReport.join('; '));
console.log('stands:', standReport.join('; '));
console.log('litter:', litterReport.join('; '));
console.log('jump', JSON.stringify(jump));
console.log('dressing:', dressItems.filter((item) => item.prop).length, 'props,',
  dressItems.filter((item) => !item.prop).length, 'loose; left out',
  dressDropped.length ? dressDropped.join('; ') : 'none');
