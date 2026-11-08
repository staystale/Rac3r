import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const level = LEVELS.find((entry) => entry.id === (process.env.LEVEL || 'brands-snatch'));
const [qx, qy, r] = process.argv.slice(2).map(Number);
level.lanes.forEach((lane, i) => {
  if (!lane.pts.some(([x, y]) => Math.hypot(x - qx, y - qy) < r)) return;
  console.log(`L${i} w${lane.width} ${lane.surface.id} n${lane.pts.length}: ` + lane.pts.filter((_, j) => j % Math.max(1, Math.floor(lane.pts.length / 14)) === 0 || j === lane.pts.length - 1).map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(' '));
});
for (const p of level.props.filter((p) => p.kind === 'tunnel' && Math.hypot(p.x - qx, p.y - qy) < r))
  console.log('portal', p.x.toFixed(1), p.y.toFixed(1), 'rot', p.rot.toFixed(2), 'h', p.h);
