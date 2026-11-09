// _dtskull.mjs - Dieatona's mown skull: its box (game m) and how far it keeps from every road
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
const level = buildLevel(LEVELS.find((entry) => entry.id === (process.argv[2] || 'dieatona')));
const patches = level.patches || [];
const x0 = Math.min(...patches.map((p) => p.x - p.w / 2)), x1 = Math.max(...patches.map((p) => p.x + p.w / 2));
const y0 = Math.min(...patches.map((p) => p.y - p.h / 2)), y1 = Math.max(...patches.map((p) => p.y + p.h / 2));
console.log('patches', patches.length, 'box x', x0.toFixed(1), x1.toFixed(1), 'y', y0.toFixed(1), y1.toFixed(1));
const seg = (x, y, [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)); return Math.hypot(x - ax - t * dx, y - ay - t * dy); };
let worst = Infinity, which = '';
for (const patch of patches) for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
  const x = patch.x + u * patch.w / 2, y = patch.y + v * patch.h / 2;
  level.lanes.forEach((lane, i) => { for (let k = 0; k + 1 < lane.pts.length; k++) {
    const gap = seg(x, y, lane.pts[k], lane.pts[k + 1]) - lane.width / 2;
    if (gap < worst) { worst = gap; which = 'lane ' + i + ' w' + lane.width; } } });
}
console.log('nearest road edge', worst.toFixed(1), 'm', which);
const trees = level.props.filter((p) => p.kind === 'tree' && p.x > x0 - 8 && p.x < x1 + 8 && p.y > y0 - 8 && p.y < y1 + 8);
console.log('trees within 8 m of its box', trees.length);
