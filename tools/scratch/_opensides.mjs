// _opensides.mjs - stretches of the lap with no barrier on a side within REACH m of the road's
// centre (open run-off). node tools/scratch/_opensides.mjs <level> [reach m, 30], from the repo
// root (a level under test with its switch as env: MONZA=1 ...)
import { pathToFileURL } from 'node:url';
const root = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p) => import(pathToFileURL(root + p).href);
const L = await imp('/src/lab.ts');
L.setLevel(process.argv[2] || 'spa');
const lv = L.LEVEL, sub = lv.subtrack, REACH = +(process.argv[3] || 30);
const pts = [];
for (const b of lv.barriers) for (let i = 0; i < b.pts.length - 1; i++) {
  const [ax, ay] = b.pts[i], [bx, by] = b.pts[i + 1], len = Math.hypot(bx - ax, by - ay);
  for (let t = 0; t <= len; t += 1) pts.push([ax + (bx - ax) * t / len, ay + (by - ay) * t / len, b.kind]);
}
for (const side of [1, -1]) {
  let run = null;
  const runs = [];
  for (let d = 0; d < sub.totalDist; d += 4) {
    const p = L.onTrack(sub, d, 0, {}), nx = Math.cos(p.rot + Math.PI / 2) * side, ny = Math.sin(p.rot + Math.PI / 2) * side;
    // any barrier point on this side, within REACH of the centre, roughly across from here
    const has = pts.some(([x, y]) => {
      const dx = x - p.x, dy = y - p.y, across = dx * nx + dy * ny, along = Math.abs(dx * ny - dy * nx);
      return across > 6.5 && across < REACH && along < 6;
    });
    if (!has) { if (!run) run = { from: d }; run.to = d; } else if (run) { runs.push(run); run = null; }
  }
  if (run) runs.push(run);
  console.log(side > 0 ? '+normal side' : '-normal side', runs.filter((r) => r.to - r.from >= 20)
    .map((r) => `${r.from}-${r.to}`).join(', '));
}
