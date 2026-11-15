// _crxmap.mjs - CROUGHED RX'S LEVEL AS DATA (scratch): the lap's length, surfaces by sector, its
// least radius and where, and a JSON of every road, lane, barrier, prop and loose object (game m)
// for a plan drawing (scratchpad). node tools/scratch/_crxmap.mjs <out.json>
import fs from 'node:fs';
import * as L from '../../src/lab.ts';

L.setLevel('croughedrx');
const level = L.LEVEL, sub = level.subtrack;
console.log('lap', sub.totalDist.toFixed(1), 'm, width', sub.width, 'pts', sub.pts.length);
for (const sector of sub.sectors) console.log('  sector', sector.startDist.toFixed(0), '-',
  Math.min(sector.endDist, sub.totalDist).toFixed(0), sector.surface?.id);
// the radius through three points 6 m apart, the least ones
const radii = sub.pts.map((pt, i) => {
  const before = sub.pts[(i - 3 + sub.pts.length) % sub.pts.length];
  const after = sub.pts[(i + 3) % sub.pts.length];
  const ax = pt.x - before.x, ay = pt.y - before.y, bx = after.x - pt.x, by = after.y - pt.y;
  const cross = ax * by - ay * bx, chord = Math.hypot(after.x - before.x, after.y - before.y);
  const radius = Math.abs(cross) < 1e-9 ? Infinity
    : (Math.hypot(ax, ay) * Math.hypot(bx, by) * chord) / (2 * Math.abs(cross));
  return { radius, dist: pt.dist, x: pt.x, y: pt.y };
});
const least = radii.slice().sort((one, two) => one.radius - two.radius)[0];
console.log('least radius', least.radius.toFixed(1), 'm at lap m', least.dist.toFixed(0),
  `(${least.x.toFixed(0)},${least.y.toFixed(0)})`);
console.log('lanes', (level.lanes || []).length, 'barriers', (level.barriers || []).length,
  'props', level.props.length, 'cones', level.cones.length, 'joker', !!level.joker,
  'spawn', JSON.stringify(level.spawn));
const out = {
  lap: sub.pts.map((pt) => [pt.x, pt.y]),
  loose: sub.sectors.filter((sector) => /dirt|gravel/.test(sector.surface?.id || ''))
    .map((sector) => [sector.startDist, sector.endDist]),
  dists: sub.pts.map((pt) => pt.dist),
  lanes: (level.lanes || []).map((lane) => ({ pts: lane.pts, width: lane.width })),
  roads: (level.roads || []).map((road) => ({ pts: road.pts, width: road.width })),
  barriers: (level.barriers || []).map((bar) => ({ kind: bar.kind, pts: bar.pts })),
  props: level.props.map((prop) => ({ kind: prop.kind, x: prop.x, y: prop.y, w: prop.w || prop.size
    || 1, h: prop.h || prop.size || 1, rot: prop.rot || 0 })),
  cones: level.cones.map((cone) => [cone.x, cone.y, cone.kind || '']),
  pads: (level.pads || []).map((pad) => pad),
  bounds: level.bounds || null,
};
fs.writeFileSync(process.argv[2], JSON.stringify(out));
