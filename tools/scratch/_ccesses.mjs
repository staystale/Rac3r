// _ccesses.mjs - what stands within r m of a point after setLevel (props with sizes, lamps,
// cones), and how far each is from every lane's edge: CASTLECUMVENUE=1 node ... <x> <y> <r>
import * as L from '../../src/lab.ts';
import { distToLine } from '../../src/world/venuegeo.ts';
const [x, y, r] = process.argv.slice(2).map(Number);
L.setLevel(process.env.LEVEL || 'castle-cum');
const level = L.LEVEL;
const laneGap = (px, py) => level.lanes.map((lane) => [distToLine(lane.pts, px, py) - lane.width / 2, lane.surface.id]).sort((a, b) => a[0] - b[0]).slice(0, 2).map(([gap, id]) => gap.toFixed(1) + '/' + id).join(' ');
for (const prop of level.props) if (Math.hypot(prop.x - x, prop.y - y) < r)
  console.log('prop', prop.kind, prop.x.toFixed(1), prop.y.toFixed(1), 'w', prop.w || prop.s || '', 'lane edge gap', laneGap(prop.x, prop.y));
for (const cone of level.cones) if (Math.hypot(cone.x - x, cone.y - y) < r)
  console.log('cone', cone.kind || '', cone.x.toFixed(1), cone.y.toFixed(1), 'lane edge gap', laneGap(cone.x, cone.y));
for (const key of Object.keys(level)) if (Array.isArray(level[key]) && !['props', 'cones', 'lanes', 'zones', 'barriers', 'bumps', 'paint', 'solids', 'covers', 'boards', 'bushes', 'crossings'].includes(key)) console.log('array', key, level[key].length);
