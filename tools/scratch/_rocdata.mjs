// _rocdata.mjs - THE RACE OF CHAMPIONS' STADIUMS' venue data (world/levels/venues/<id>.ts), laid by
// hand (no map: each track was laid on the stadium's pitch for a weekend): ONE path crossing itself
// once - the outer lane round the bowl, over the crossover bridge to the inner lane, round again
// inside it, under the bridge back out to the outer lane (the ROC's "two interwoven lanes side by
// side"); the lanes GAP m apart centre to centre, gravel in the same place on both lanes; the stands
// in two tiers round the bowl, the roof behind them. Game m = real m (share 1). Each stadium is a
// config below (its lanes, crossover, gravel and bowl); the rails seen are written to
// tools/scratch/_<id>rails.json. node tools/scratch/_rocdata.mjs <id> (scratch)
import fs from 'node:fs';
const VENUES = {
  // Wembley, 2007-08: the lanes round a rounded rectangle, the crossover mid south straight,
  // gravel on both north straights, a rounded-rectangle bowl
  wobbly: { out: { ax: 75, ay: 52, r: 30 }, gap: 20, crossX: 20, crossAt: 0, gravel: /north/,
    bowl: 'rounded', exportName: 'WOBBLY_VENUE', header: [
      "// wobbly.ts - written by tools/scratch/_rocdata.mjs wobbly (laid by hand: the Race of",
      "// Champions' track at Wembley, 2007-08, as two lanes interwoven round the bowl, one crossover",
      '// bridge). Game m (share 1). Edit the generator, not this file.'] },
  // the Stade de France, 2004-06: the lanes round a long rounded rectangle with tight ends ("tight
  // hairpins"), the crossover east of the south straight's middle (2006: "a long straight leads to
  // a cross-over bridge"), gravel on both lanes' west ends, an oval bowl
  stadeprance: { out: { ax: 100, ay: 48, r: 30 }, gap: 20, crossX: 20, crossAt: 35, gravel: /west/,
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
// a lane's east side: from its south straight's end round to its north straight's start (y down: south is +y)
const east = (lane) => join(arc(lane.ax - lane.r, lane.ay - lane.r, lane.r, H, 0), line([lane.ax, lane.ay - lane.r], [lane.ax, -lane.ay + lane.r]), arc(lane.ax - lane.r, -lane.ay + lane.r, lane.r, 0, -H));
const west = (lane) => join(arc(-lane.ax + lane.r, -lane.ay + lane.r, lane.r, -H, -2 * H), line([-lane.ax, -lane.ay + lane.r], [-lane.ax, lane.ay - lane.r]), arc(-lane.ax + lane.r, lane.ay - lane.r, lane.r, -2 * H, -3 * H));
// the S between the lanes: smoothstep across CROSS_X either side of the middle
const diag = (y0, y1) => { const out = []; for (let x = -CROSS_X; x <= CROSS_X + 0.01; x += 2) { const t = (x + CROSS_X) / (2 * CROSS_X); out.push([AT + x, y0 + (y1 - y0) * t * t * (3 - 2 * t)]); } return out; };
const pieces = [
  ['Crossover over', diag(OUT.ay, IN.ay)],
  ['Inner south east', line([AT + CROSS_X, IN.ay], [IN.ax - IN.r, IN.ay])],
  ['Inner east', east(IN)],
  ['Inner north', line([IN.ax - IN.r, -IN.ay], [-IN.ax + IN.r, -IN.ay])],
  ['Inner west', west(IN)],
  ['Inner south west', line([-IN.ax + IN.r, IN.ay], [AT - CROSS_X, IN.ay])],
  ['Crossover under', diag(IN.ay, OUT.ay)],
  ['Outer south east', line([AT + CROSS_X, OUT.ay], [OUT.ax - OUT.r, OUT.ay])],
  ['Outer east', east(OUT)],
  ['Outer north', line([OUT.ax - OUT.r, -OUT.ay], [-OUT.ax + OUT.r, -OUT.ay])],
  ['Outer west', west(OUT)],
  ['Outer south west', line([-OUT.ax + OUT.r, OUT.ay], [AT - CROSS_X, OUT.ay])],
].map(([name, pts]) => [name, pts, venue.gravel.test(name) ? 'gravel' : null])
  .map(([name, pts, surface]) => ({ name, ...(surface ? { surface } : {}), pts: pts.map(([x, y]) => [r1(x), r1(y)]) }));
// the bowl: a rounded rectangle round the outer lane, its stands in slices along it
const ring = (ax, ay, r) => join(line([-ax + r, ay], [ax - r, ay]), arc(ax - r, ay - r, r, H, 0), line([ax, ay - r], [ax, -ay + r]), arc(ax - r, -ay + r, r, 0, -H), line([ax - r, -ay], [-ax + r, -ay]), arc(-ax + r, -ay + r, r, -H, -2 * H), line([-ax, -ay + r], [-ax, ay - r]), arc(-ax + r, ay - r, r, -2 * H, -3 * H));
// (an oval bowl: an ellipse through the same half sizes)
const oval = (ax, ay) => { const out = []; for (let i = 0; i <= 160; i++) { const a = H - i / 160 * 4 * H; out.push([Math.cos(a) * ax, Math.sin(a) * ay]); } return out; };
const bowl = (grow) => (venue.bowl === 'oval' ? oval(OUT.ax + grow * 1.35, OUT.ay + grow * 1.15)
  : ring(OUT.ax + grow, OUT.ay + grow, OUT.r + grow));
const slices = (pts, every, depth, name) => {
  const out = [];
  let carry = 0, from = pts[0];
  const dense = [];
  for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay); for (let t = 0; t < len; t += 1) dense.push([ax + (bx - ax) * t / len, ay + (by - ay) * t / len]); }
  for (let i = 0; i + every < dense.length; i += every) {
    const [ax, ay] = dense[i], [bx, by] = dense[i + every];
    out.push({ name, x: r1((ax + bx) / 2), y: r1((ay + by) / 2), w: every - 3, h: depth, rot: Math.round(Math.atan2(by - ay, bx - ax) * 1000) / 1000 });
  }
  return out;
};
const lower = slices(bowl(28), 13, 10, 'Lower tier');
const upper = slices(bowl(42), 15, 12, 'Upper tier');
const roof = slices(bowl(58), 18, 14, 'Roof').map((box) => ({ ...box, kind: 'roof' }));
// the barriers: a line RAIL_M off each side of every lane (the ROC's motorway barrier and concrete
// blocks both sides all round), none along the crossover (its bridge's parapets and cut walls)
const RAIL_M = 10;
const offset = (pts, side) => pts.map(([x, y], i) => { const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(pts.length - 1, i + 1)], len = Math.hypot(bx - ax, by - ay) || 1; return [r1(x - (by - ay) / len * RAIL_M * side), r1(y + (bx - ax) / len * RAIL_M * side)]; });
const rails = pieces.filter((piece) => !/Crossover/.test(piece.name)).flatMap((piece) => [offset(piece.pts, 1), offset(piece.pts, -1)]);
fs.writeFileSync(`tools/scratch/_${venueId}rails.json`, JSON.stringify(rails));
const json = (value) => JSON.stringify(value).replace(/,(?=["[{\d-])/g, ', ').replace(/":(?=["[{\d-]|true|false)/g, '": ');
const lines = [...venue.header, "import type { VenueData } from '../../venue.ts';", '', `export const ${venue.exportName}: VenueData = {`, '  pieces: ['];
for (const piece of pieces) lines.push(`    ${json(piece)},`);
lines.push('  ],', '  layouts: {', `    roc: ${json(pieces.map((piece) => [piece.name, 1]))},`, '  },');
for (const key of ['pitLanes', 'roads', 'footbridges', 'dirt', 'karting', 'tunnels', 'traps', 'tyres']) lines.push(`  ${key}: [],`);
lines.push('  stands: [');
for (const box of [...lower, ...upper]) lines.push(`    ${json(box)},`);
lines.push('  ],', '  buildings: [');
for (const box of roof) lines.push(`    ${json(box)},`);
lines.push('  ],');
for (const key of ['paddocks', 'woods', 'homes']) lines.push(`  ${key}: [],`);
lines.push('};', '');
const wrapped = lines.flatMap((text) => { if (text.length <= 100) return [text]; const parts = []; let rest = text; while (rest.length > 100) { const cut = rest.lastIndexOf(', ', 98); if (cut < 12) break; parts.push(rest.slice(0, cut + 1)); rest = `      ${rest.slice(cut + 2)}`; } parts.push(rest); return parts; });
fs.writeFileSync(`src/world/levels/venues/${venueId}.ts`, wrapped.join(String.fromCharCode(10)));
const len = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
console.log('path', pieces.reduce((s, p) => s + len(p.pts), 0).toFixed(0), 'm; stands', lower.length + upper.length, 'roof', roof.length);
