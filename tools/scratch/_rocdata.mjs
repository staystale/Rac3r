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
  // from the south east [x, y, radius m, side], each its own: a wide south-east sweep, the east
  // side leaning in to a tight north-east hairpin, the north straight bowed out a little, a
  // wider north-west, the west side leaning out to a tighter south-west
  wobbly: { out: { ax: 75, ay: 52, r: 30 }, gap: 20, crossX: 20, crossAt: 0, gravel: /north/,
    corners: [[76, 52, 36, 'east'], [71, -51, 30, 'east'], [4, -55, 160, 'north'],
      [-75, -49, 42, 'west'], [-73, 52, 32, 'west']],
    bowl: 'rounded', exportName: 'WOBBLY_VENUE', header: [
      "// wobbly.ts - written by tools/scratch/_rocdata.mjs wobbly (laid by hand: the Race of",
      "// Champions' track at Wembley, 2007-08, as two lanes interwoven round the bowl, one crossover",
      '// bridge). Game m (share 1). Edit the generator, not this file.'] },
  // the Stade de France, 2004-06: the lanes round a long rounded rectangle with tight ends ("tight
  // hairpins"), the crossover east of the south straight's middle (2006: "a long straight leads to
  // a cross-over bridge"), gravel on both lanes' west ends, an oval bowl. Its corners: the east end
  // a double apex (a bend out mid side between two hairpins), the north straight kinked a little
  // west of the start, a tighter north-west, the west side leaning in to a wide south-west
  stadeprance: { out: { ax: 100, ay: 48, r: 30 }, gap: 20, crossX: 20, crossAt: 35, gravel: /west/,
    corners: [[99, 48, 31, 'east'], [104, 2, 70, 'east'], [97, -46, 33, 'east'],
      [-24, -50, 220, 'north'], [-100, -45, 30, 'west'], [-96, 48, 40, 'west']],
    bowl: 'oval', exportName: 'STADEPRANCE_VENUE', header: [
      "// stadeprance.ts - written by tools/scratch/_rocdata.mjs stadeprance (laid by hand: the Race of",
      "// Champions' track at the Stade de France, 2004-06, as two lanes interwoven round the bowl, one",
      '// crossover bridge). Game m (share 1). Edit the generator, not this file.'] },
};
const venueId = process.argv[2] || 'wobbly', venue = VENUES[venueId];
if (!venue) throw new Error(`no stadium ${venueId}`);
const OUT = venue.out, GAP = venue.gap, IN = { ax: OUT.ax - GAP, ay: OUT.ay - GAP, r: OUT.r - GAP };
const CROSS_X = venue.crossX, AT = venue.crossAt, STEP = 3;
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
function laneSides(corners, inset, southY) {
  const ring = corners.map(([x, y]) => [x, y]);
  const count = ring.length;
  // the edges' lines moved inset m inward; the corners where they meet
  const dirs = ring.map((point, i) => unit(point, ring[(i + 1) % count]));
  const bases = ring.map((point, i) => {
    const [nx, ny] = inwardOf(dirs[i]);
    return [point[0] + nx * inset, point[1] + ny * inset];
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
const HAIRPIN_R = 45, HAIRPINS = [];
// the S between the lanes: smoothstep across CROSS_X either side of the middle
const diag = (y0, y1) => { const out = []; for (let x = -CROSS_X; x <= CROSS_X + 0.01; x += 2) { const t = (x + CROSS_X) / (2 * CROSS_X); out.push([AT + x, y0 + (y1 - y0) * t * t * (3 - 2 * t)]); } return out; };
const named = (lane, sides) => sides.map(([side, pts]) => [lane + ' ' + side, pts]);
const pieces = [
  ['Crossover over', diag(OUT.ay, IN.ay)],
  ...named('Inner', laneSides(CORNERS, GAP, IN.ay)),
  ['Crossover under', diag(IN.ay, OUT.ay)],
  ...named('Outer', laneSides(CORNERS, 0, OUT.ay)),
].map(([name, pts]) => [name, pts, venue.gravel.test(name) ? 'gravel' : null])
  .map(([name, pts, surface]) => ({ name, ...(surface ? { surface } : {}), pts: pts.map(([x, y]) => [r1(x), r1(y)]) }));
// the bowl: a rounded rectangle round the outer lane, its stands in slices along it
const ring = (ax, ay, r) => join(line([-ax + r, ay], [ax - r, ay]), arc(ax - r, ay - r, r, H, 0), line([ax, ay - r], [ax, -ay + r]), arc(ax - r, -ay + r, r, 0, -H), line([ax - r, -ay], [-ax + r, -ay]), arc(-ax + r, -ay + r, r, -H, -2 * H), line([-ax, -ay + r], [-ax, ay - r]), arc(-ax + r, ay - r, r, -2 * H, -3 * H));
// (an oval bowl: a superellipse, power OVAL_POWER - squarer than an ellipse, as the Stade de
// France's plan - OVAL_OUT m further out along x and y than the lanes' box grown: an ellipse came
// within 25 m of the hairpins' outside, no room for the catch fence 10 m past the edge)
const OVAL_POWER = 2.5, OVAL_OUT = [12, 8];
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
const flags = slices(bowl(FLAG_OUT), FLAG_EVERY, 1, 'Flag').map((box, i) => ({ at: [box.x, box.y],
  kind: 'flag', size: 1, col: PENNANTS[i % PENNANTS.length] }));
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
const wrapped = lines.flatMap((text) => { if (text.length <= 100) return [text]; const parts = []; let rest = text; while (rest.length > 100) { const cut = rest.lastIndexOf(', ', 98); if (cut < 12) break; parts.push(rest.slice(0, cut + 1)); rest = `      ${rest.slice(cut + 2)}`; } parts.push(rest); return parts; });
fs.writeFileSync(`src/world/levels/venues/${venueId}.ts`, wrapped.join(String.fromCharCode(10)));
const len = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
console.log('path', pieces.reduce((s, p) => s + len(p.pts), 0).toFixed(0), 'm; stands', lower.length + upper.length, 'roof', roof.length);
