import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const level = LEVELS.find((entry) => entry.id === (process.env.LEVEL || 'brands-snatch'));
const [qx, qy] = process.argv.slice(2).map(Number);
level.lanes.forEach((lane, i) => {
  const n = lane.pts.length;
  for (const [end, idx] of [['start', [0, 1, 2, 3, 4]], ['end', [n - 5, n - 4, n - 3, n - 2, n - 1]]]) {
    const p = lane.pts[end === 'start' ? 0 : n - 1];
    if (Math.hypot(p[0] - qx, p[1] - qy) > 2) continue;
    console.log(`L${i} ${end}:`, idx.filter((j) => j >= 0 && j < n).map((j) => lane.pts[j].map((v) => v.toFixed(2)).join(',')).join('  '));
  }
});
