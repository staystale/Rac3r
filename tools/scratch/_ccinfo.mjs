// _ccinfo.mjs - the Castle Cum venue's numbers: lap, bounds, counts by kind (CASTLECUMVENUE=1)
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
const level = buildLevel(LEVELS.find((entry) => entry.id === (process.argv[2] || 'castle-cum')));
const count = (list, key) => list.reduce((out, item) => ({ ...out, [item[key]]: (out[item[key]] || 0) + 1 }), {});
console.log('lap', level.subtrack.totalDist.toFixed(1), 'bounds', JSON.stringify(level.bounds), 'floor', level.floor);
console.log('props', JSON.stringify(count(level.props, 'kind')));
console.log('barriers', JSON.stringify(count(level.barriers, 'kind')));
console.log('lanes', level.lanes.map((lane) => `${lane.surface.id}/${lane.width}/${lane.pts.length}`).join(' '));
console.log('zones', level.zones.map((zone) => `${zone.surface.id}@${zone.x.toFixed(0)},${zone.y.toFixed(0)}`).join(' '));
console.log('cones', level.cones.length, 'bumps', level.bumps.length, 'crossings', (level.crossings || []).length);
console.log('spawn', JSON.stringify(level.spawn));
