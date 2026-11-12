// _rocdata.mjs - THE RACE OF CHAMPIONS' STADIUMS' venue data (world/levels/venues/<id>.ts), laid by
// hand (no map: each track was laid on the stadium's pitch for a weekend): ONE path crossing itself
// once - the outer lane round the bowl, over the crossover bridge to the inner lane, round again
// inside it, under the bridge back out to the outer lane (the ROC's "two interwoven lanes side by
// side"); the lanes GAP m apart centre to centre, gravel in the same place on both lanes; the stands
// in two tiers round the bowl, the roof behind them. Game m = real m (share 1). Each stadium is a
// config below (its lanes, crossover, gravel and bowl); the rails seen are written to
// tools/scratch/_<id>rails.json. node tools/scratch/_rocdata.mjs <id> (scratch)
import fs from 'node:fs';
import { PENNANTS } from '../../src/world/colours.ts';
const VENUES = {
  // Wembley, 2007-08: the lanes round a rounded rectangle, the crossover mid south straight,
  // gravel on both north straights, a rounded-rectangle bowl. The outer lane's corners clockwise
  // from the south east [x, y, radius m, side], each its own: a tight south-east hairpin, the
  // east side leaning in to a wider north-east, the north straight bowed out a little, a wider
  // north-west, the west side leaning out to a tight south-west (the south corners far enough out
  // that the lanes run straight either side of the crossover)
  wobbly: { out: { ax: 80, ay: 52, r: 30 }, gap: 20, crossAt: 0, gravel: /north/,
    corners: [[82, 52, 30, 'east'], [71, -51, 34, 'east'], [4, -55, 160, 'north'],
      [-75, -49, 42, 'west'], [-80, 52, 31, 'west']],
    bowl: 'rounded', exportName: 'WOBBLY_VENUE', header: [
      "// wobbly.ts - written by tools/scratch/_rocdata.mjs wobbly (laid by hand: the Race of",
      "// Champions' track at Wembley, 2007-08, as two lanes interwoven round the bowl, one crossover",
      '// bridge). Game m (share 1). Edit the generator, not this file.'],
    // London's, all in the infield (its apron between the catch fence and the
    // flags is a few metres): red, blue and white transporters, the podium and its crowd, show
    // cars, a TV camera platform, a motorhome with its bins, cones
    dressCols: ['#c8302c', '#2b56b5', '#e8e6e0'],
    dress: [['Inner north', 0.3, -1, 21, 'transporters'], ['Inner west', 0.25, -1, 17, 'tvcamera'],
      ['Inner north', 0.5, -1, 27, 'fans'], ['Inner west', 0.8, -1, 18, 'motorhome'],
      ['Inner north', 0.75, -1, 17, 'podium'], ['Inner west', 0.5, -1, 15, 'cones'],
      ['Inner east', 0.45, -1, 19, 'showcars']] },
  // the Stade de France, 2004-06: the lanes round a long rounded rectangle with tight ends ("tight
  // hairpins"), the crossover east of the south straight's middle (2006: "a long straight leads to
  // a cross-over bridge"), gravel on both lanes' west ends, an oval bowl. Its corners: the east end
  // a double apex (a bend out mid side between two hairpins), the north straight kinked a little
  // west of the start, a tighter north-west, the west side leaning in to a wide south-west
  stadeprance: { out: { ax: 103, ay: 48, r: 30 }, gap: 20, crossAt: 28, gravel: /west/,
    corners: [[104, 48, 31, 'east'], [107, 2, 70, 'east'], [97, -46, 33, 'east'],
      [-24, -50, 220, 'north'], [-100, -45, 30, 'west'], [-96, 48, 40, 'west']],
    bowl: 'oval', exportName: 'STADEPRANCE_VENUE', header: [
      "// stadeprance.ts - written by tools/scratch/_rocdata.mjs stadeprance (laid by hand: the Race of",
      "// Champions' track at the Stade de France, 2004-06, as two lanes interwoven round the bowl, one",
      '// crossover bridge). Game m (share 1). Edit the generator, not this file.'],
    // Paris's: a paddock and a row of transporters in blue, white and red along
    // the long north apron, a TV camera platform, a motorhome by the double apex, fans on the west,
    // show cars in the infield, spare tyres and cones
    dressCols: ['#2b56b5', '#e8e6e0', '#c8302c'],
    dress: [['Outer north', 0.24, 1, 22, 'paddock'], ['Outer north', 0.55, 1, 25, 'transporters'],
      ['Outer north', 0.8, 1, 22, 'tvcamera'], ['Outer east', 0.5, 1, 17, 'motorhome'],
      ['Outer west', 0.5, 1, 16, 'fans'], ['Inner north', 0.3, -1, 17, 'showcars'],
      ['Inner west', 0.4, -1, 15, 'cones'], ['Outer west', 0.8, 1, 20, 'tyres']] },
  // the Bird's Nest (Beijing National Stadium), 2009: the lanes round a fat egg (the Nest's bowl is
  // an ellipse), the crossover west of the south straight's middle, gravel on both lanes' east
  // end, an elliptical bowl. Its corners: a sweeping south-east, the east end a tight hairpin, the
  // north side pinched in (a bend out between two corners - the one bend the other way round
  // the lap), a tighter north-west, the west end one long sweeper into the south-west. Its flags
  // red and gold
  birdsmess: { out: { ax: 100, ay: 62, r: 30 }, gap: 20, crossAt: -12, gravel: /east/,
    corners: [[94, 62, 44, 'east'], [96, -52, 30, 'east'], [40, -66, 40, 'north'],
      [0, -44, 50, 'north'], [-46, -66, 40, 'north'], [-92, -50, 34, 'west'],
      [-108, 4, 58, 'west'], [-88, 62, 34, 'west']],
    bowl: 'oval', oval: { power: 2.15, out: [8, 10] }, flagCols: ['#d4202a', '#f2c230'],
    floods: { out: 16, every: 55, extra: [[-12, 80], [-12, 14]] },
    litter: [['Outer east', 0.2, 1, 20, 'tyres'], ['Outer east', 0.85, 1, 19, 'barrels'],
      ['Outer north', 0.5, 1, 20, 'pallets'], ['Outer west', 0.55, 1, 20, 'barrels'],
      ['Outer west', 0.93, 1, 19, 'tarp'], ['Inner north', 0.3, -1, 18, 'tyres'],
      ['Inner west', 0.5, -1, 18, 'pallets']],
    // Beijing's: red and gold transporters and a paddock, a motorhome on the west
    // apron, a TV camera platform, a red steel sculpture in the infield, show cars, bins
    dressCols: ['#c8302c', '#d6a21e'],
    dress: [['Outer north', 0.26, 1, 20, 'transporters'], ['Outer east', 0.5, 1, 19, 'paddock'],
      ['Outer west', 0.3, 1, 21, 'motorhome'], ['Outer north', 0.9, 1, 20, 'tvcamera'],
      ['Inner north', 0.35, -1, 17, 'sculpture'], ['Inner west', 0.3, -1, 17, 'showcars'],
      ['Outer north', 0.6, 1, 19, 'bins'], ['Outer west', 0.65, 1, 19, 'fans']],
    exportName: 'BIRDSMESS_VENUE', header: [
      "// birdsmess.ts - written by tools/scratch/_rocdata.mjs birdsmess (laid by hand: the Race of",
      "// Champions' track in the Bird's Nest, Beijing 2009, as two lanes interwoven round the bowl,",
      '// one crossover bridge). Game m (share 1). Edit the generator, not this file.'] },
};
const venueId = process.argv[2] || 'wobbly', venue = VENUES[venueId];
if (!venue) throw new Error(`no stadium ${venueId}`);
const OUT = venue.out, GAP = venue.gap;
// m between the lanes' centres along the south straight that carries the crossover (GAP round
// the rest): room for the crossover's X to cross steeply enough (below)
const CROSS_GAP = 32;
const IN = { ax: OUT.ax - GAP, ay: OUT.ay - CROSS_GAP, r: OUT.r - GAP };
const AT = venue.crossAt, STEP = 3;
// m wider the underpass's cut each side than the 0.6 m by its road, and m further its lintels
// stand from the road over (the stadium specs' crossover.spareM and clearM, world/venuecross.ts):
// a car on the lane's edge still turning out of the bend met the end of a portal's wall, and one
// on the bridge road's edge the barrier met at a portal's corner
const CUT_SPARE = 1.5, LINTEL_EXTRA = 2.4;
// THE CROSSOVER (a real ROC crossover: a straight bridge over a straight lane): two straight
// diagonals CROSS_ANGLE off the lanes (2 x that between them), each leaving its lane by a
// CROSS_BEND_R bend - so the underpass runs straight from portal to portal, each portal's walls
// along its road and its open end on it. Its straight must reach past the underpass's end
// (world/venuecross.ts halfLength: the road over, its parapet, the lintel's clearance over the
// crossing's sine, then the 9 m portal), and the crossing be steep enough that the cut's corner
// at the lintel (half the cut and its wall out from the road under) stands CORNER_CLEAR past the
// road over's edge - 1 m left a car on the bridge road's edge touching the Armco met there. At
// the lanes' CROSS_GAP 32 m apart, 25 deg each (50 between) and a 30 m bend do (steeper, its
// bends tighter: cars on the lane's edges strayed out of them into the walls)
const CROSS_ANGLE = 25 * Math.PI / 180, CROSS_BEND_R = 30;
// m: half the straight, crossing to bend; the crossover's half width along the lanes
const CROSS_HALF = (CROSS_GAP / 2 - CROSS_BEND_R * (1 - Math.cos(CROSS_ANGLE)))
  / Math.sin(CROSS_ANGLE);
const CROSS_X = CROSS_HALF * Math.cos(CROSS_ANGLE) + CROSS_BEND_R * Math.sin(CROSS_ANGLE);
// m the underpass reaches from the crossing (as world/venuecross.ts halfLength: half the road 6.5,
// the parapet 3, the lintel's clearance 3, the portal 9)
const UNDER_HALF = (6.5 + 3 + 3 + LINTEL_EXTRA) / Math.sin(2 * CROSS_ANGLE) + 9;
// m the cut's corner at the lintel stands past the road over's edge (half the road 6.5 off its
// centre; the corner half the cut, 7.1 m, its spare and its 0.6 m wall out from the road under)
const CORNER_CLEAR = (UNDER_HALF - 9) * Math.sin(2 * CROSS_ANGLE)
  - (7.7 + CUT_SPARE) * Math.cos(2 * CROSS_ANGLE) - 6.5;
const r1 = (v) => Math.round(v * 10) / 10;
const line = (from, to) => { const n = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / STEP)); const out = []; for (let i = 0; i <= n; i++) out.push([from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n]); return out; };
const arc = (cx, cy, r, a0, a1) => { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / STEP)); const out = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return out; };
const join = (...parts) => parts.reduce((all, part) => all.length ? [...all, ...part.slice(1)] : part, []);
const H = Math.PI / 2;
// A LANE from its corners (y down, clockwise: the south edge runs east): the outer lane's corners
// as given, the inner lane's on the same lines GAP m inward, each corner rounded with its own
// radius (the inner's GAP less where the lane turns in, GAP more where it bends out) - so the
// lanes run GAP apart all round. Its stretches by side: south east (the S's end to the first
// corner), each corner's side (a straight between two sides: north), south west (the last
// corner to the S's start).
const inwardOf = ([dx, dy]) => [dy, -dx];
const unit = ([ax, ay], [bx, by]) => {
  const len = Math.hypot(bx - ax, by - ay);
  return [(bx - ax) / len, (by - ay) / len];
};
const meet = (p1, d1, p2, d2) => {
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den;
  return [p1[0] + d1[0] * t, p1[1] + d1[1] * t];
};
function laneSides(corners, inset, southY, southInset = inset) {
  const ring = corners.map(([x, y]) => [x, y]);
  const count = ring.length;
  // the edges' lines moved inset m inward; the corners where they meet
  const dirs = ring.map((point, i) => unit(point, ring[(i + 1) % count]));
  // (the last edge, from the last corner round to the first, is the south straight)
  const bases = ring.map((point, i) => {
    const [nx, ny] = inwardOf(dirs[i]), by = i === count - 1 ? southInset : inset;
    return [point[0] + nx * by, point[1] + ny * by];
  });
  const verts = ring.map((_, i) => {
    const prev = (i - 1 + count) % count;
    return meet(bases[prev], dirs[prev], bases[i], dirs[i]);
  });
  const fillets = verts.map((vert, i) => {
    const inDir = dirs[(i - 1 + count) % count], outDir = dirs[i];
    const cross = inDir[0] * outDir[1] - inDir[1] * outDir[0];
    const dot = inDir[0] * outDir[0] + inDir[1] * outDir[1];
    const turn = Math.acos(Math.max(-1, Math.min(1, dot)));
    const convex = cross < 0, radius = corners[i][2] + (convex ? -inset : inset);
    const reach = radius * Math.tan(turn / 2);
    const from = [vert[0] - inDir[0] * reach, vert[1] - inDir[1] * reach];
    const [inX, inY] = inwardOf(inDir), toward = convex ? 1 : -1;
    const centre = [from[0] + inX * toward * radius, from[1] + inY * toward * radius];
    const a0 = Math.atan2(from[1] - centre[1], from[0] - centre[0]);
    const pts = arc(centre[0], centre[1], radius, a0, a0 + (convex ? -turn : turn));
    if (convex && corners[i][2] <= HAIRPIN_R) HAIRPINS.push(pts);
    return { side: corners[i][3], pts };
  });
  // (a straight between two corners that runs backward: the corners' arcs overlap - the lane
  // folds back on itself, a notch in its edge; reported with its length, m, below, and closed:
  // the next corner's arc starts past where this one ends, its points behind that dropped)
  fillets.forEach((fillet, i) => {
    const next = fillets[(i + 1) % count], end = fillet.pts[fillet.pts.length - 1];
    const along = (point) => (point[0] - end[0]) * dirs[i][0] + (point[1] - end[1]) * dirs[i][1];
    const ahead = along(next.pts[0]);
    if (i < count - 1 && ahead < 0) {
      FOLDS.push(`${inset ? 'inner' : 'outer'} after corner ${i} ${ahead.toFixed(1)} m (closed)`);
      next.pts = next.pts.filter((point) => along(point) > 1);
    }
  });
  const sides = [['south east', line([AT + CROSS_X, southY], fillets[0].pts[0])]];
  const add = (side, pts) => {
    const last = sides[sides.length - 1];
    if (last[0] === side) last[1] = join(last[1], pts);
    else sides.push([side, pts]);
  };
  fillets.forEach((fillet, i) => {
    add(fillet.side, fillet.pts);
    const next = fillets[i + 1], end = fillet.pts[fillet.pts.length - 1];
    const owner = !next ? 'south west' : next.side === fillet.side ? fillet.side : 'north';
    add(owner, line(end, next ? next.pts[0] : [AT - CROSS_X, southY]));
  });
  return sides;
}
// the outer lane's corners (the south edge between the last and the first carries the S)
const CORNERS = venue.corners;
// m: a corner this tight or tighter (the outer lane's radius) is a hairpin - tyres round its
// outside (the ROC's tyres in front of the barrier where a car goes straight on); their arcs
const HAIRPIN_R = 45, HAIRPINS = [], FOLDS = [];
// a diagonal from one lane (y0) to the other (y1): walked along, its heading eased in over the
// first bend, held along the straight, eased out over the last; a point every 2 m
const diag = (y0, y1) => {
  const turn = Math.sign(y1 - y0) * CROSS_ANGLE, bend = CROSS_BEND_R * CROSS_ANGLE;
  const total = 2 * bend + 2 * CROSS_HALF, step = 0.25;
  const heading = (along) => (along < bend ? turn * along / bend
    : along > total - bend ? turn * (total - along) / bend : turn);
  const out = [[AT - CROSS_X, y0]];
  let x = AT - CROSS_X, y = y0, next = 2;
  for (let along = 0; along + step <= total + 1e-9; along += step) {
    const head = heading(along + step / 2);
    x += Math.cos(head) * step;
    y += Math.sin(head) * step;
    if (along + step >= next - 1e-9) {
      out.push([x, y]);
      next += 2;
    }
  }
  const end = [AT + CROSS_X, y1], last = out[out.length - 1];
  if (Math.hypot(last[0] - end[0], last[1] - end[1]) < 1) out[out.length - 1] = end;
  else out.push(end);
  return out;
};
const named = (lane, sides) => sides.map(([side, pts]) => [lane + ' ' + side, pts]);
const pieces = [
  ['Crossover over', diag(OUT.ay, IN.ay)],
  ...named('Inner', laneSides(CORNERS, GAP, IN.ay, CROSS_GAP)),
  ['Crossover under', diag(IN.ay, OUT.ay)],
  ...named('Outer', laneSides(CORNERS, 0, OUT.ay)),
].map(([name, pts]) => [name, pts, venue.gravel.test(name) ? 'gravel' : null])
  .map(([name, pts, surface]) => ({ name, ...(surface ? { surface } : {}), pts: pts.map(([x, y]) => [r1(x), r1(y)]) }));
// the bowl: a rounded rectangle round the outer lane, its stands in slices along it
const ring = (ax, ay, r) => join(line([-ax + r, ay], [ax - r, ay]), arc(ax - r, ay - r, r, H, 0), line([ax, ay - r], [ax, -ay + r]), arc(ax - r, -ay + r, r, 0, -H), line([ax - r, -ay], [-ax + r, -ay]), arc(-ax + r, -ay + r, r, -H, -2 * H), line([-ax, -ay + r], [-ax, ay - r]), arc(-ax + r, ay - r, r, -2 * H, -3 * H));
// (an oval bowl: a superellipse, power OVAL_POWER - squarer than an ellipse, as the Stade de
// France's plan - OVAL_OUT m further out along x and y than the lanes' box grown: an ellipse came
// within 25 m of the hairpins' outside, no room for the catch fence 10 m past the edge)
// (a stadium's own: the Bird's Nest's rounder, an ellipse nearly)
const OVAL_POWER = venue.oval ? venue.oval.power : 2.5;
const OVAL_OUT = venue.oval ? venue.oval.out : [12, 8];
const superCos = (angle) => Math.sign(Math.cos(angle)) * Math.abs(Math.cos(angle)) ** (2 / OVAL_POWER);
const superSin = (angle) => Math.sign(Math.sin(angle)) * Math.abs(Math.sin(angle)) ** (2 / OVAL_POWER);
const oval = (ax, ay) => { const out = []; for (let i = 0; i <= 160; i++) { const a = H - i / 160 * 4 * H; out.push([superCos(a) * ax, superSin(a) * ay]); } return out; };
const bowl = (grow) => (venue.bowl === 'oval'
  ? oval(OUT.ax + grow * 1.35 + OVAL_OUT[0], OUT.ay + grow * 1.15 + OVAL_OUT[1])
  : ring(OUT.ax + grow, OUT.ay + grow, OUT.r + grow));
const slices = (pts, every, depth, name) => {
  const out = [];
  let carry = 0, from = pts[0];
  const dense = [];
  for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay); for (let t = 0; t < len; t += 1) dense.push([ax + (bx - ax) * t / len, ay + (by - ay) * t / len]); }
  for (let i = 0; i + every < dense.length; i += every) {
    const [ax, ay] = dense[i], [bx, by] = dense[i + every];
    out.push({ name, x: r1((ax + bx) / 2), y: r1((ay + by) / 2), w: Math.hypot(bx - ax, by - ay), h: depth, rot: Math.round(Math.atan2(by - ay, bx - ax) * 1000) / 1000 });
  }
  // each slice its chord long, narrowed by its aisle: STAND_GAP_M, more where the tier turns (its inner corners
  // close up by its depth times the turn to the next slice)
  return out.map((box, i) => {
    const turn = (other) => Math.abs(Math.atan2(Math.sin(other.rot - box.rot), Math.cos(other.rot - box.rot)));
    const most = Math.max(turn(out[(i + 1) % out.length]), turn(out[(i - 1 + out.length) % out.length]));
    return { ...box, w: r1(box.w - STAND_GAP_M - depth * most) };
  });
};
// m between two slices of a tier (its aisles: the bowl reads as one packed stand)
const STAND_GAP_M = 1;
const lower = slices(bowl(28), 13, 10, 'Lower tier');
const upper = slices(bowl(42), 15, 12, 'Upper tier');
const roof = slices(bowl(58), 18, 14, 'Roof').map((box) => ({ ...box, kind: 'roof' }));
// THE FLAGS: a row along the front of the lower tier, FLAG_EVERY m apart, the pennants' colours
// in turn (VenueSpec.landmarks)
// m: FLAG_OUT past the lanes' box (behind the catch fence's boards, before the stands)
const FLAG_EVERY = 16, FLAG_OUT = 21;
// (the pennants' colours, or the stadium's own)
const FLAG_COLS = venue.flagCols || PENNANTS;
const flags = slices(bowl(FLAG_OUT), FLAG_EVERY, 1, 'Flag').map((box, i) => ({ at: [box.x, box.y],
  kind: 'flag', size: 1, col: FLAG_COLS[i % FLAG_COLS.length] }));
// the barriers: a line RAIL_M off each side of every lane (the ROC's motorway barrier and concrete
// blocks both sides all round), none along the crossover (its bridge's parapets and cut walls)
const RAIL_M = 10;
const offset = (pts, side, out = RAIL_M) => pts.map(([x, y], i) => { const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(pts.length - 1, i + 1)], len = Math.hypot(bx - ax, by - ay) || 1; return [r1(x - (by - ay) / len * out * side), r1(y + (bx - ax) / len * out * side)]; });
const rails = pieces.filter((piece) => !/Crossover/.test(piece.name)).flatMap((piece) => [offset(piece.pts, 1), offset(piece.pts, -1)]);
// m from a lane's centre: each hairpin's two rows of tyre stacks round its outside, in front of
// its barrier (RAIL_M, at the rim 9.5 m out: a stack 0.48 m round) - VenueData.tyres, laid a stack
// a metre
const TYRE_ROWS_M = [7.6, 8.6];
const tyreRows = HAIRPINS.flatMap((pts) => TYRE_ROWS_M.map((out) => offset(pts, 1, out)));
// and at the crossover's ends: both sides of the bridge's road for its first and last
// CROSS_TYRES_M m, in front of its parapets' ends (a stack on a portal's wall is left out:
// world/venue.ts tidyLoose)
const CROSS_TYRES_M = 10;
const overPts = pieces.find((piece) => piece.name === 'Crossover over').pts;
const nearEnd = (pts, fromStart) => { const out = []; let run = 0; const list = fromStart ? pts : [...pts].reverse(); for (let i = 0; i < list.length && run <= CROSS_TYRES_M; i++) { out.push(list[i]); if (i) run += Math.hypot(list[i][0] - list[i - 1][0], list[i][1] - list[i - 1][1]); } return out; };
for (const pts of [nearEnd(overPts, true), nearEnd(overPts, false)])
  for (const side of [1, -1]) for (const out of TYRE_ROWS_M) tyreRows.push(offset(pts, side, out));
// THE FLOODLIGHTS (a stadium that asks: venue.floods, a night race - The Bird's Mess): floodlight
// pylons (VenueSpec.landmarks kind 'pylon', world/lamps.ts: a pool 34 m round) every `every` m along
// the outer lane's outside on the apron and along the inner lane's inside in the infield, `out` m
// from the lane's centre (behind the barrier RAIL_M out, clear of its boards) - so both lanes lie
// in light all round; and its `extra` spots (the crossover's: no lane runs along it)
const floodsAlong = (names, side) => {
  const pts = join(...names.map((name) => pieces.find((piece) => piece.name === name).pts));
  const out = offset(pts, side, venue.floods.out), spots = [];
  let run = venue.floods.every / 2;
  for (let i = 1; i < out.length; i++) {
    run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (run < venue.floods.every) continue;
    run = 0;
    spots.push({ at: out[i], kind: 'pylon', size: 2 });
  }
  return spots;
};
const laneNames = (lane) => pieces.map((piece) => piece.name).filter((name) => name.startsWith(lane));
const floods = venue.floods ? [...floodsAlong(laneNames('Outer'), 1),
  ...floodsAlong(laneNames('Inner'), -1),
  ...(venue.floods.extra || []).map((at) => ({ at, kind: 'pylon', size: 2 }))] : [];
// THE LITTER (a stadium that asks: venue.litter, [piece, share along it, side, m out, kit]): a
// heap of the highway's debris kinds on the apron or in the infield, behind the barrier - LITTER_KITS
// each a heap [m along, m out, kind, colour] (the colours the debris' own: highway/litter.ts)
const LITTER_KITS = {
  tyres: [[0, 0, 'tyre'], [0.9, 0.2, 'tyre'], [1.8, -0.1, 'tyre'], [0.4, 0.9, 'tyre'],
    [1.3, 1.0, 'tyre']],
  pallets: [[0, 0, 'pallet'], [1.6, 0.3, 'pallet'], [0.8, 1.5, 'box'], [2.6, 1.2, 'crate']],
  barrels: [[0, 0, 'barrel', '#c8302c'], [0.9, 0.1, 'barrel', '#c8302c'],
    [0.45, 0.85, 'barrel', '#d6a21e']],
  tarp: [[0, 0, 'tarp', '#d6a21e'], [1.7, 0.4, 'sandbag'], [1.9, -0.6, 'sandbag']],
};
const litter = (venue.litter || []).flatMap(([name, share, side, out, kit]) => {
  const pts = pieces.find((piece) => piece.name === name).pts;
  const at = Math.min(pts.length - 2, Math.round(share * (pts.length - 1)));
  const [ax, ay] = pts[at], [bx, by] = pts[at + 1], len = Math.hypot(bx - ax, by - ay) || 1;
  const along = [(bx - ax) / len, (by - ay) / len], across = [-along[1] * side, along[0] * side];
  return LITTER_KITS[kit].map(([forward, outward, kind, col]) => ({
    at: [r1(ax + along[0] * forward + across[0] * (out + outward)),
      r1(ay + along[1] * forward + across[1] * (out + outward))], kind, ...(col ? { col } : {}) }));
});
// THE DRESSING (venue.dress, [piece, share along it, side, m out, kit]): kits of
// the existing prop kinds (DRESS_PROPS: VenueSpec.landmarks, solid where their kind is) and loose
// objects (VenueSpec.litter), each [m along, m out, kind, { c: colour index into
// venue.dressCols, size, len, seed }] in the lane's frame, behind the barrier on the apron or in
// the infield. An item that comes within DRESS_RAIL_M of a barrier line, inside a stand grown
// DRESS_STAND_M, or within DRESS_FLAG_M of a flag or floodlight is left out (and reported)
const DRESS_PROPS = { truck: [2.5, 14], parkedcar: [1.8, 4.2], tower: [4, 4], crowd: [3, 9],
  sculpture: [4, 4] };
const DRESS_KITS = {
  transporters: [[0, 0, 'truck', { c: 0 }], [16, 0, 'truck', { c: 1 }]],
  paddock: [[0, 0, 'truck', { c: 0 }], [0, 4.5, 'truck', { c: 1 }], [-11, 1, 'parkedcar', { c: 2 }],
    [-11, 3.6, 'parkedcar', { c: 0 }], [10, 7.5, 'crate'], [11.2, 7.6, 'box'], [12.4, 7.4, 'crate'],
    [-12, 6.5, 'tyre'], [-11.1, 6.7, 'tyre'], [-10.2, 6.4, 'tyre'], [-11.6, 7.4, 'tyre']],
  motorhome: [[0, 0, 'caravan'], [6.5, 0.5, 'parkedcar', { c: 1 }], [-4.5, 0.3, 'bin'],
    [-5.3, 0.2, 'bin'], [-6.1, 0.35, 'bin']],
  tvcamera: [[0, 0, 'tower'], [-6.5, 0.5, 'box'], [-7.3, -0.3, 'crate'], [-6.7, -1.1, 'box']],
  fans: [[0, 0, 'crowd', { seed: 1 }], [11, 0.4, 'crowd', { len: 7, seed: 2 }]],
  showcars: [[0, 0, 'parkedcar', { c: 0 }], [5.5, 0, 'parkedcar', { c: 1 }],
    [11, 0, 'parkedcar', { c: 2 }]],
  podium: [[0, 0, 'podium'], [0, 4.5, 'crowd', { len: 8, seed: 3 }]],
  cones: [[0, 0, 'cone'], [0.6, 0.3, 'cone'], [1.2, 0, 'cone'], [0.6, -0.4, 'cone'],
    [2.2, 0.2, 'cone']],
  bins: [[0, 0, 'bin'], [0.9, 0, 'bin'], [1.8, 0, 'bin'], [3.2, 0.2, 'pallet']],
  tyres: [[0, 0, 'tyre'], [0.9, 0.2, 'tyre'], [1.8, -0.1, 'tyre'], [0.4, 0.9, 'tyre'],
    [1.3, 1.0, 'tyre']],
  sculpture: [[0, 0, 'sculpture']],
};
const DRESS_RAIL_M = 3.5, DRESS_STAND_M = 1.5, DRESS_FLAG_M = 2.5;
const inBox = (box, [x, y], grow) => {
  const cosR = Math.cos(box.rot), sinR = Math.sin(box.rot), dx = x - box.x, dy = y - box.y;
  return Math.abs(dx * cosR + dy * sinR) < box.w / 2 + grow
    && Math.abs(-dx * sinR + dy * cosR) < box.h / 2 + grow;
};
const lineGap = (pts, [x, y]) => {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
};
const dressDropped = [];
const dressClear = (at, reach) => rails.every((rail) => lineGap(rail, at) > DRESS_RAIL_M + reach)
  && ![...lower, ...upper].some((box) => inBox(box, at, DRESS_STAND_M + reach))
  && [...flags, ...floods].every((mark) => Math.hypot(mark.at[0] - at[0], mark.at[1] - at[1])
    > DRESS_FLAG_M + reach);
const dressItems = (venue.dress || []).flatMap(([name, share, side, out, kit]) => {
  const pts = pieces.find((piece) => piece.name === name).pts;
  const at = Math.min(pts.length - 2, Math.round(share * (pts.length - 1)));
  const [ax, ay] = pts[at], [bx, by] = pts[at + 1], len = Math.hypot(bx - ax, by - ay) || 1;
  const along = [(bx - ax) / len, (by - ay) / len], across = [-along[1] * side, along[0] * side];
  const rot = Math.round(Math.atan2(along[1], along[0]) * 1000) / 1000;
  return DRESS_KITS[kit].flatMap(([forward, outward, kind, opts = {}]) => {
    const spot = [r1(ax + along[0] * forward + across[0] * (out + outward)),
      r1(ay + along[1] * forward + across[1] * (out + outward))];
    const shape = DRESS_PROPS[kind], size = opts.size || (shape ? shape[0] : 1);
    const long = opts.len || (shape ? shape[1] : 1);
    // (its middle and both ends along the lane, each with half its width round it)
    const ends = [-long / 2, 0, long / 2].map((shift) => [spot[0] + along[0] * shift,
      spot[1] + along[1] * shift]);
    if (!ends.every((end) => dressClear(end, size / 2))) {
      dressDropped.push(`${kit} ${kind} at ${spot}`);
      return [];
    }
    const col = opts.c === undefined ? undefined : venue.dressCols[opts.c % venue.dressCols.length];
    return [{ at: spot, kind, ...(shape ? { size, ...(long !== size ? { len: long } : {}) } : {}),
      rot, ...(col ? { col } : {}), ...(opts.seed ? { seed: opts.seed } : {}), prop: !!shape }];
  });
});
const strip = ({ prop, ...item }) => item;
const dressProps = dressItems.filter((item) => item.prop).map(strip);
const dressLoose = dressItems.filter((item) => !item.prop).map(strip);
const json = (value) => JSON.stringify(value).replace(/,(?=["[{\d-])/g, ', ').replace(/":(?=["[{\d-]|true|false)/g, '": ');
const lines = [...venue.header, "import type { VenueData, VenueSpec } from '../../venue.ts';", '', `export const ${venue.exportName}: VenueData = {`, '  pieces: ['];
for (const piece of pieces) lines.push(`    ${json(piece)},`);
lines.push('  ],', '  layouts: {', `    roc: ${json(pieces.map((piece) => [piece.name, 1]))},`, '  },');
for (const key of ['pitLanes', 'roads', 'footbridges', 'dirt', 'karting', 'tunnels', 'traps']) lines.push(`  ${key}: [],`);
lines.push('  tyres: [');
for (const pts of tyreRows) lines.push(`    ${json({ pts })},`);
lines.push('  ],');
lines.push('  stands: [');
for (const box of [...lower, ...upper]) lines.push(`    ${json(box)},`);
lines.push('  ],', '  buildings: [');
for (const box of roof) lines.push(`    ${json(box)},`);
lines.push('  ],');
for (const key of ['paddocks', 'woods', 'homes']) lines.push(`  ${key}: [],`);
// the barriers' lines (VenueSpec.followRails: the edge's Armco along them, a catch fence by the
// stands)
lines.push('  rails: [');
for (const pts of rails) lines.push(`    ${json({ kind: 'seen', pts })},`);
lines.push('  ],');
lines.push('};', '', '// the flags along the front of the bowl (VenueSpec.landmarks)',
  `export const ${venue.exportName.replace('_VENUE', '_FLAGS')}: NonNullable<VenueSpec['landmarks']> = [`);
for (const flag of flags) lines.push(`  ${json(flag)},`);
lines.push('];', '');
if (floods.length) {
  lines.push('// the floodlight pylons round both lanes (VenueSpec.landmarks; a night race)',
    `export const ${venue.exportName.replace('_VENUE', '_FLOODS')}: NonNullable<VenueSpec['landmarks']> = [`);
  for (const flood of floods) lines.push(`  ${json(flood)},`);
  lines.push('];', '');
}
if (litter.length) {
  lines.push('// the litter on the apron and in the infield, behind the barriers (VenueSpec.litter)',
    `export const ${venue.exportName.replace('_VENUE', '_LITTER')}: NonNullable<VenueSpec['litter']> = [`);
  for (const item of litter) lines.push(`  ${json(item)},`);
  lines.push('];', '');
}
if (dressItems.length) {
  const name = venue.exportName.replace('_VENUE', '');
  lines.push("// the dressing pass's props, on the apron and in the infield (",
    '// VenueSpec.landmarks)',
    `export const ${name}_DRESS: NonNullable<VenueSpec['landmarks']> = [`);
  for (const item of dressProps) lines.push(`  ${json(item)},`);
  lines.push('];', '', "// and its loose objects (VenueSpec.litter)",
    `export const ${name}_DRESS_LITTER: NonNullable<VenueSpec['litter']> = [`);
  for (const item of dressLoose) lines.push(`  ${json(item)},`);
  lines.push('];', '');
}
const wrapped = lines.flatMap((text) => { if (text.length <= 100) return [text]; const parts = []; let rest = text; while (rest.length > 100) { const cut = rest.lastIndexOf(', ', 98); if (cut < 12) break; parts.push(rest.slice(0, cut + 1)); rest = `      ${rest.slice(cut + 2)}`; } parts.push(rest); return parts; });
fs.writeFileSync(`src/world/levels/venues/${venueId}.ts`, wrapped.join(String.fromCharCode(10)));
const len = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
console.log('path', pieces.reduce((s, p) => s + len(p.pts), 0).toFixed(0), 'm; stands', lower.length + upper.length, 'roof', roof.length);
const straightOf = (name) => len(pieces.find((piece) => piece.name === name).pts);
console.log('crossover: straight', CROSS_HALF.toFixed(1), 'm each side of the crossing, the underpass',
  UNDER_HALF.toFixed(1), 'm (margin', (CROSS_HALF - UNDER_HALF).toFixed(1), 'm), its corner',
  CORNER_CLEAR.toFixed(2), 'm clear of the road over; x', (AT - CROSS_X).toFixed(1),
  'to', (AT + CROSS_X).toFixed(1), '; lane straights before the corners', ['Inner south east', 'Inner south west',
  'Outer south east', 'Outer south west'].map((name) => straightOf(name).toFixed(1)).join(' / '));
console.log('folds:', FOLDS.length ? FOLDS.join('; ') : 'none');
console.log('dressing:', dressProps.length, 'props,', dressLoose.length, 'loose; left out', dressDropped.length ? dressDropped.join('; ') : 'none');
