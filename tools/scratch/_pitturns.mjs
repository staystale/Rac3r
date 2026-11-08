import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const { querySubtrack } = await imp('/src/world/tyrewall.ts');
const level = LEVELS.find((entry) => entry.id === 'brands-snatch');
const pit = level.lanes.find((lane) => lane.width === 9);
const pts = pit.pts;
for (let i = 1; i < Math.min(40, pts.length - 1); i++) {
  const a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
  const b = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
  const turn = ((b - a + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * 180 / Math.PI;
  const hit = querySubtrack(level.subtrack, pts[i][0], pts[i][1]);
  console.log(i, pts[i].map((v) => v.toFixed(1)).join(','), 'turn', turn.toFixed(1), 'seg', Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]).toFixed(2), 'centre', hit.dist.toFixed(1));
}
