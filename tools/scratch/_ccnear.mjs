// _ccnear.mjs <x> <y> <r> - what of the built level lies within r m of a point (CASTLECUMVENUE=1)
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
const [x, y, r] = process.argv.slice(2).map(Number);
const level = buildLevel(LEVELS.find((entry) => entry.id === (process.env.LEVEL || 'castle-cum')));
const near = ([px, py]) => Math.hypot(px - x, py - y) < r;
for (const rail of level.barriers) {
  const pts = rail.pts.filter(near);
  if (pts.length) console.log(rail.kind, rail.pts.length, 'pts; near:', pts.slice(0, 4).map((p) => p.map(Math.round).join(',')).join(' '));
}
for (const prop of level.props) if (prop.kind !== 'tree' && near([prop.x, prop.y]))
  console.log('prop', prop.kind, Math.round(prop.x), Math.round(prop.y), prop.w || prop.wid || '', prop.h || '');
const cones = level.cones.filter((cone) => near([cone.x, cone.y]));
console.log('cones', cones.length, cones.slice(0, 3).map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '));
