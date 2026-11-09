// _railsnear.mjs - a level's barrier lines near a spot (each with its points there):
// node tools/scratch/_railsnear.mjs <level> <x> <y> [reach m, 15]
import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const { buildLevel } = await imp('/src/world/load.ts');
const [levelId, xArg, yArg, reachArg = '15'] = process.argv.slice(2);
const level = buildLevel(LEVELS.find((entry) => entry.id === levelId));
const [x0, y0, reach] = [+xArg, +yArg, +reachArg];
for (const [index, rail] of (level.barriers || []).entries()) {
  const near = rail.pts.map((p, i) => [i, p]).filter(([, p]) => Math.hypot(p[0] - x0, p[1] - y0) < reach);
  if (near.length) console.log(index, rail.kind, rail.pts.length, 'pts; near:', near.map(([i, p]) => `${i}:${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
}
