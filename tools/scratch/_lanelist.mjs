// _lanelist.mjs - a level's lanes: index, width, surface, ends and length (game m), optionally only
// those passing within reach of a spot: node tools/scratch/_lanelist.mjs <level> [x y reach]
import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const { buildLevel } = await imp('/src/world/load.ts');
const [levelId, xArg, yArg, reachArg] = process.argv.slice(2);
const level = buildLevel(LEVELS.find((entry) => entry.id === levelId));
const fmt = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;
for (const [i, lane] of level.lanes.entries()) {
  if (xArg !== undefined && !lane.pts.some(([x, y]) => Math.hypot(x - +xArg, y - +yArg) < +reachArg)) continue;
  let len = 0;
  for (let k = 1; k < lane.pts.length; k++) len += Math.hypot(lane.pts[k][0] - lane.pts[k - 1][0], lane.pts[k][1] - lane.pts[k - 1][1]);
  console.log(`L${i} w${lane.width} ${lane.surface.id} ${fmt(lane.pts[0])} -> ${fmt(lane.pts.at(-1))} ${len.toFixed(0)} m, ${lane.pts.length} pts`);
}
