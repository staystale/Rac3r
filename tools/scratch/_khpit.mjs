// _khpit.mjs - Knobhill's pit lane: its distance from each layout's road along it, and the wall's
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
import { querySubtrack } from '../../src/world/tyrewall.ts';
const level = buildLevel(LEVELS.find((entry) => entry.id === (process.argv[2] || 'knobhill')));
const pit = level.lanes.find((lane) => lane.width === 9), wall = level.barriers.find((b) => b.kind === 'pitwall');
const sub = level.subtrack;
console.log('pit pts', pit.pts.length, 'wall', wall ? wall.pts.length : 'none');
for (let i = 0; i < pit.pts.length; i += 6) {
  const [x, y] = pit.pts[i], hit = querySubtrack(sub, x, y);
  console.log(i, x.toFixed(1), y.toFixed(1), 'off road centre', hit.dist.toFixed(1), hit.side);
}
if (wall) { const [x, y] = wall.pts[Math.floor(wall.pts.length / 2)]; console.log('wall mid off centre', querySubtrack(sub, x, y).dist.toFixed(1)); }
