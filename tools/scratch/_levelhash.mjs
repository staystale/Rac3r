// _levelhash.mjs - a short hash of each level's built data (lanes, barriers, props, cones, zones,
// subtrack points), to prove a change behind a switch leaves the plain level the same:
// node tools/scratch/_levelhash.mjs <level,level,...>
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const { buildLevel } = await imp('/src/world/load.ts');
for (const id of process.argv[2].split(',')) {
  const level = buildLevel(LEVELS.find((entry) => entry.id === id));
  const data = JSON.stringify([level.lanes.map((lane) => [lane.pts, lane.width]), level.barriers,
    level.props, level.cones, (level.zones || []).map((zone) => zone.poly),
    level.subtrack.pts.map((p) => [p.x, p.y])]);
  console.log(id, createHash('sha256').update(data).digest('hex').slice(0, 16));
}
