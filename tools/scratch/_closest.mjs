// _closest.mjs - THE CLOSEST TWO STRETCHES OF A LAYOUT (two 13 m roads need 18 game m between
// centres for a barrier between, NOTES 11-09): every pair of lap points more than GAP_LAP m apart
// along the lap, the nearest ones listed with their lap distances. node tools/scratch/_closest.mjs
// <level> [n, 8]
import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const { buildLevel } = await imp('/src/world/load.ts');
const [levelId, nArg = '8'] = process.argv.slice(2);
const level = buildLevel(LEVELS.find((entry) => entry.id === levelId));
const sub = level.subtrack, pts = sub.pts.filter((_, i) => i % 2 === 0), total = sub.totalDist;
const GAP_LAP = 60, near = [];
for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
  const along = Math.abs(pts[i].dist - pts[j].dist);
  if (Math.min(along, total - along) < GAP_LAP) continue;
  const gap = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
  if (gap < 30) near.push({ gap, a: pts[i].dist, b: pts[j].dist, x: pts[i].x, y: pts[i].y,
    x2: pts[j].x, y2: pts[j].y });
}
near.sort((p, q) => p.gap - q.gap);
const shown = [];
for (const item of near) {
  if (shown.some((s) => Math.abs(s.a - item.a) < 40 && Math.abs(s.b - item.b) < 40)) continue;
  shown.push(item);
  if (shown.length >= +nArg) break;
}
const at = (x, y) => `${x.toFixed(0)},${y.toFixed(0)}`;
for (const s of shown)
  console.log(`${s.gap.toFixed(1)} m between lap ${s.a.toFixed(0)} and ${s.b.toFixed(0)}`,
    `at ${at(s.x, s.y)} and ${at(s.x2, s.y2)}`);
if (!shown.length) console.log('no two stretches within 30 m');
