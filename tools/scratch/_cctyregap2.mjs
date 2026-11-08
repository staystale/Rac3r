// _cctyregap2.mjs - the edge tyre rows behind traps: per trap, the nearest tyre to the road edge
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
import { querySubtrack } from '../../src/world/tyrewall.ts';
import { distToLine } from '../../src/world/venuegeo.ts';
import { insidePolygon } from '../../src/world/zones.ts';
const level = buildLevel(LEVELS.find((entry) => entry.id === process.argv[2]));
const half = level.subtrack.width / 2;
const pieces = level.lanes.filter((lane) => lane.surface.id === 'racetarmac' || lane.width === 4);
const traps = level.zones.filter((zone) => zone.surface.id === 'gravel' && zone.poly);
const nearTrap = (x, y) => traps.findIndex((zone) => insidePolygon(zone.poly, x, y) || distToLine([...zone.poly, zone.poly[0]], x, y) < 4);
const per = {};
for (const cone of level.cones) {
  if (pieces.some((lane) => distToLine(lane.pts, cone.x, cone.y) < lane.width / 2 + 1)) continue;
  const trap = nearTrap(cone.x, cone.y);
  const key = trap >= 0 ? `trap${trap}` : 'no trap';
  const gap = querySubtrack(level.subtrack, cone.x, cone.y).dist - half;
  if (!per[key] || gap < per[key].gap) per[key] = { gap, at: `${cone.x.toFixed(0)},${cone.y.toFixed(0)}` };
}
for (const [key, value] of Object.entries(per)) console.log(process.argv[2], key, value.gap.toFixed(2), 'm at', value.at);
