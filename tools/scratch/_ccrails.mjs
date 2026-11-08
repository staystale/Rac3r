// _ccrails.mjs - the real rails (OSM) along the Castle Combe lap, in real metres: per side, the
// stretches with a rail within [edge, edge + look] and its distance from the centre
import { CASTLE_CUM_VENUE as DATA } from '../../src/world/levels/venues/castle-cum.ts';
const LOOK = +(process.argv[2] || 30), HIT = 1.5, HALF = 5;
const line = [];
for (const [name, way] of DATA.layouts.circuit) {
  const piece = DATA.pieces.find((entry) => entry.name === name);
  const pts = way > 0 ? piece.pts : piece.pts.slice().reverse();
  line.push(...(line.length ? pts.slice(1) : pts));
}
const START = [184, 470];
let best = 0, bestSq = Infinity;
line.forEach(([x, y], i) => { const sq = (x - START[0]) ** 2 + (y - START[1]) ** 2; if (sq < bestSq) { bestSq = sq; best = i; } });
const loop = [...line.slice(best), ...line.slice(0, best), line[best]];
const distTo = (pts, x, y) => { let b = Infinity; for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-9))); b = Math.min(b, Math.hypot(x - ax - dx * t, y - ay - dy * t)); } return b; };
const rails = DATA.rails;
let railLen = 0;
for (const rail of rails) for (let i = 1; i < rail.pts.length; i++) railLen += Math.hypot(rail.pts[i][0] - rail.pts[i - 1][0], rail.pts[i][1] - rail.pts[i - 1][1]);
const samples = [];
let along = 0;
for (let i = 0; i < loop.length - 1; i++) {
  const [ax, ay] = loop[i], [bx, by] = loop[i + 1], len = Math.hypot(bx - ax, by - ay), dx = (bx - ax) / len, dy = (by - ay) / len;
  for (let t = 0; t < len; t += 2) {
    const x = ax + dx * t, y = ay + dy * t, row = { d: along + t };
    for (const [side, nx, ny] of [['left', dy, -dx], ['right', -dy, dx]]) {
      row[side] = 0;
      for (let out = HALF; out <= HALF + LOOK; out += 0.5)
        if (rails.some((rail) => distTo(rail.pts, x + nx * out, y + ny * out) < HIT)) { row[side] = out; break; }
    }
    samples.push(row);
  }
  along += len;
}
console.log('lap', along.toFixed(0), 'm; OSM rails', rails.length, 'ways,', railLen.toFixed(0), 'm');
for (const side of ['left', 'right']) {
  const on = samples.filter((row) => row[side]).length;
  const runs = []; let run = null;
  for (const row of samples) { if (row[side]) { if (!run) run = { from: row.d, outs: [] }; run.to = row.d; run.outs.push(row[side]); } else if (run) { runs.push(run); run = null; } }
  if (run) runs.push(run);
  console.log(`${side} (${side === 'left' ? 'outside' : 'inside'}): rail along ${(on * 2).toFixed(0)} m of ${along.toFixed(0)} (${(100 * on / samples.length).toFixed(0)} %)`);
  console.log('   ' + runs.map((r) => `${r.from.toFixed(0)}-${r.to.toFixed(0)} @${Math.min(...r.outs).toFixed(0)}-${Math.max(...r.outs).toFixed(0)}`).join('  '));
}
