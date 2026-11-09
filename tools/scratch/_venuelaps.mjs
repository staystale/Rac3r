// _venuelaps.mjs - each venue level's lap, spawn, props, tyres and barriers (node, no browser):
// node tools/scratch/_venuelaps.mjs <level,level,...>
import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const { buildLevel } = await imp('/src/world/load.ts');
for (const id of process.argv[2].split(',')) {
  const t0 = Date.now(), level = buildLevel(LEVELS.find((entry) => entry.id === id));
  const sub = level.subtrack, start = level.spawn || {};
  console.log(`${id}: lap ${sub.totalDist.toFixed(0)} m, width ${sub.width}, spawn ${[start.x, start.y].map((v) => (+v).toFixed(1))}, ${level.props.length} props, ${level.cones.length} cones, ${level.barriers.length} barriers, ${level.lanes.length} lanes, built ${Date.now() - t0} ms`);
}
