// _pitprobe.mjs - the Brands venue's pit area in numbers: the pit lane's distance from the track's
// centre along it, the pit wall, the gantry, tunnel portals and the lanes / buildings by them.
// BIGBRANDS=1 node tools/scratch/_pitprobe.mjs
import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const { querySubtrack } = await imp('/src/world/tyrewall.ts');
const level = LEVELS.find((entry) => entry.id === (process.argv[2] || 'brands-snatch'));
const sub = level.subtrack, half = sub.width / 2;
const fmt = (v) => v.toFixed(1);
const pit = level.lanes.find((lane) => lane.width === 9);
console.log('track half', half, 'pit pts', pit.pts.length);
for (let i = 0; i < pit.pts.length; i += Math.max(1, Math.floor(pit.pts.length / 30))) {
  const [x, y] = pit.pts[i], hit = querySubtrack(sub, x, y);
  console.log(`pit ${i} ${fmt(x)},${fmt(y)} centre ${fmt(hit.dist)} edge-gap ${fmt(hit.dist - half - pit.width / 2)}`);
}
const walls = level.barriers.filter((barrier) => barrier.pts.some(([x, y]) => x > -120 && x < 80 && y > -240 && y < -170));
for (const wall of walls) {
  const mid = wall.pts[Math.floor(wall.pts.length / 2)], hit = querySubtrack(sub, mid[0], mid[1]);
  console.log(`barrier ${wall.kind} n${wall.pts.length} ${wall.pts[0].map(fmt)} .. ${wall.pts.at(-1).map(fmt)} mid centre ${fmt(hit.dist)}`);
}
for (const prop of level.props.filter((p) => ['gantry', 'tunnel', 'garagerow', 'grandstand', 'pitbuilding'].includes(p.kind) || p.kind.includes('stand')))
  if (prop.x > -150 && prop.x < 200 && prop.y > -260 && prop.y < -140)
    console.log(`prop ${prop.kind} ${fmt(prop.x)},${fmt(prop.y)} w${fmt(prop.w || prop.wid || 0)} h${fmt(prop.h || 0)} rot${fmt(prop.rot || 0)} centre ${fmt(querySubtrack(sub, prop.x, prop.y).dist)}`);
for (const lane of level.lanes.filter((l) => l.width !== 9 && l.pts.some(([x, y]) => x > -40 && x < 80 && y > -260 && y < -160)))
  console.log(`lane w${lane.width} ${lane.surface.id} n${lane.pts.length} ${lane.pts[0].map(fmt)} .. ${lane.pts.at(-1).map(fmt)}`);
