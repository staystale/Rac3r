// _barriergaps.mjs - barrier ends standing 0.3 .. MAX m from another barrier (a gap a car could
// pass through), each with what lies in the gap (a lane: a road or pit lane going through is an
// opening, not a gap). node tools/scratch/_barriergaps.mjs <level> [max m, 12], from the repo
// root (a level under test with its switch as env: MONZA=1 ...)
import { pathToFileURL } from 'node:url';
const root = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p) => import(pathToFileURL(root + p).href);
const L = await imp('/src/lab.ts');
const { distToLine } = await imp('/src/world/venuegeo.ts');
const lvId = process.argv[2], MAX = +(process.argv[3] || 12);
L.setLevel(lvId);
const lv = L.LEVEL, bars = lv.barriers.filter((b) => b.kind !== 'line');
const nearest = (b, [x, y]) => {
  let best = { gap: Infinity, at: null };
  for (const o of bars) {
    if (o === b) continue;
    for (let i = 0; i < o.pts.length - 1; i++) {
      const [ax, ay] = o.pts[i], [bx, by] = o.pts[i + 1], dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      const g = Math.hypot(x - ax - dx * t, y - ay - dy * t);
      if (g < best.gap) best = { gap: g, at: [ax + dx * t, ay + dy * t], kind: o.kind };
    }
  }
  return best;
};
let n = 0;
for (const b of bars) for (const end of [b.pts[0], b.pts[b.pts.length - 1]]) {
  const { gap, at, kind } = nearest(b, end);
  if (gap < 0.3 || gap > MAX) continue;
  const mid = [(end[0] + at[0]) / 2, (end[1] + at[1]) / 2];
  const lane = lv.lanes.find((l) => distToLine(l.pts, mid[0], mid[1]) < l.width / 2 + 1);
  const track = L.querySubtrack(lv.subtrack, mid[0], mid[1]).dist;
  console.log(`${b.kind} end ${end.map((v) => v.toFixed(1))} -> ${kind} ${gap.toFixed(1)} m`
    + `${lane ? ` (a lane w${lane.width} through it)` : ''} track ${track.toFixed(0)} m`);
  n++;
}
console.log(lvId, n, 'ends near another barrier');
