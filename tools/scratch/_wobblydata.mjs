// _wobblydata.mjs - WOBBLY STADIUM's venue data (world/levels/venues/wobbly.ts), laid by hand (no
// map: the Race of Champions' track was laid on Wembley's pitch for two days): ONE path crossing
// itself once - the outer lane round the bowl, over the crossover bridge to the inner lane, round
// again inside it, under the bridge back out to the outer lane (the ROC's "two interwoven lanes
// side by side"); the lanes LANE_GAP m apart centre to centre, gravel on both north straights; the
// stands in two tiers round the bowl, the roof behind them. Game m = real m (share 1).
// node tools/scratch/_wobblydata.mjs (scratch)
import fs from 'node:fs';
const OUT = { ax: 75, ay: 52, r: 30 }, GAP = 20, IN = { ax: OUT.ax - GAP, ay: OUT.ay - GAP, r: OUT.r - GAP };
const CROSS_X = 20, STEP = 3;
const r1 = (v) => Math.round(v * 10) / 10;
const line = (from, to) => { const n = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / STEP)); const out = []; for (let i = 0; i <= n; i++) out.push([from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n]); return out; };
const arc = (cx, cy, r, a0, a1) => { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / STEP)); const out = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return out; };
const join = (...parts) => parts.reduce((all, part) => all.length ? [...all, ...part.slice(1)] : part, []);
const H = Math.PI / 2;
// a lane's east side: from its south straight's end round to its north straight's start (y down: south is +y)
const east = (lane) => join(arc(lane.ax - lane.r, lane.ay - lane.r, lane.r, H, 0), line([lane.ax, lane.ay - lane.r], [lane.ax, -lane.ay + lane.r]), arc(lane.ax - lane.r, -lane.ay + lane.r, lane.r, 0, -H));
const west = (lane) => join(arc(-lane.ax + lane.r, -lane.ay + lane.r, lane.r, -H, -2 * H), line([-lane.ax, -lane.ay + lane.r], [-lane.ax, lane.ay - lane.r]), arc(-lane.ax + lane.r, lane.ay - lane.r, lane.r, -2 * H, -3 * H));
// the S between the lanes: smoothstep across CROSS_X either side of the middle
const diag = (y0, y1) => { const out = []; for (let x = -CROSS_X; x <= CROSS_X + 0.01; x += 2) { const t = (x + CROSS_X) / (2 * CROSS_X); out.push([x, y0 + (y1 - y0) * t * t * (3 - 2 * t)]); } return out; };
const pieces = [
  ['Crossover over', diag(OUT.ay, IN.ay)],
  ['Inner south east', line([CROSS_X, IN.ay], [IN.ax - IN.r, IN.ay])],
  ['Inner east', east(IN)],
  ['Inner north', line([IN.ax - IN.r, -IN.ay], [-IN.ax + IN.r, -IN.ay]), 'gravel'],
  ['Inner west', west(IN)],
  ['Inner south west', line([-IN.ax + IN.r, IN.ay], [-CROSS_X, IN.ay])],
  ['Crossover under', diag(IN.ay, OUT.ay)],
  ['Outer south east', line([CROSS_X, OUT.ay], [OUT.ax - OUT.r, OUT.ay])],
  ['Outer east', east(OUT)],
  ['Outer north', line([OUT.ax - OUT.r, -OUT.ay], [-OUT.ax + OUT.r, -OUT.ay]), 'gravel'],
  ['Outer west', west(OUT)],
  ['Outer south west', line([-OUT.ax + OUT.r, OUT.ay], [-CROSS_X, OUT.ay])],
].map(([name, pts, surface]) => ({ name, ...(surface ? { surface } : {}), pts: pts.map(([x, y]) => [r1(x), r1(y)]) }));
// the bowl: a rounded rectangle round the outer lane, its stands in slices along it
const ring = (ax, ay, r) => join(line([-ax + r, ay], [ax - r, ay]), arc(ax - r, ay - r, r, H, 0), line([ax, ay - r], [ax, -ay + r]), arc(ax - r, -ay + r, r, 0, -H), line([ax - r, -ay], [-ax + r, -ay]), arc(-ax + r, -ay + r, r, -H, -2 * H), line([-ax, -ay + r], [-ax, ay - r]), arc(-ax + r, ay - r, r, -2 * H, -3 * H));
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
const lower = slices(ring(OUT.ax + 28, OUT.ay + 28, OUT.r + 28), 13, 10, 'Lower tier');
const upper = slices(ring(OUT.ax + 42, OUT.ay + 42, OUT.r + 42), 15, 12, 'Upper tier');
const roof = slices(ring(OUT.ax + 58, OUT.ay + 58, OUT.r + 58), 18, 14, 'Roof').map((box) => ({ ...box, kind: 'roof' }));
// the barriers: a line RAIL_M off each side of every lane (the ROC's motorway barrier and concrete
// blocks both sides all round), none along the crossover (its bridge's parapets and cut walls)
const RAIL_M = 10;
const offset = (pts, side) => pts.map(([x, y], i) => { const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(pts.length - 1, i + 1)], len = Math.hypot(bx - ax, by - ay) || 1; return [r1(x - (by - ay) / len * RAIL_M * side), r1(y + (bx - ax) / len * RAIL_M * side)]; });
const rails = pieces.filter((piece) => !/Crossover/.test(piece.name)).flatMap((piece) => [offset(piece.pts, 1), offset(piece.pts, -1)]);
fs.writeFileSync('tools/scratch/_wobblyrails.json', JSON.stringify(rails));
const json = (value) => JSON.stringify(value).replace(/,(?=["[{\d-])/g, ', ').replace(/":(?=["[{\d-]|true|false)/g, '": ');
const lines = ['// wobbly.ts - written by tools/scratch/_wobblydata.mjs (laid by hand: the Race of Champions\' track', '// at Wembley, 2007-08, as two lanes interwoven round the bowl, one crossover bridge). Game m', '// (share 1). Edit the generator, not this file.', "import type { VenueData } from '../../venue.ts';", '', 'export const WOBBLY_VENUE: VenueData = {', '  pieces: ['];
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
fs.writeFileSync('src/world/levels/venues/wobbly.ts', wrapped.join('\n'));
const len = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
console.log('path', pieces.reduce((s, p) => s + len(p.pts), 0).toFixed(0), 'm; stands', lower.length + upper.length, 'roof', roof.length);
