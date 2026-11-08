// _ccspot.mjs <realX> <realY> [r] - where a REAL point (the venue's turned real metres) lands in the
// game (the venue's placer), and what of the built level lies within r m of it
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
import { venueBuild } from '../../src/world/venue.ts';
import { CASTLE_CUM_SPEC } from '../../src/world/levels/castle-cum-venue.ts';
import { makePlacer, VENUE_ROAD_M } from '../../src/world/venuegeo.ts';
import { querySubtrack } from '../../src/world/tyrewall.ts';
const [realX, realY, reach = 20] = process.argv.slice(2).map(Number);
const build = venueBuild(CASTLE_CUM_SPEC), loops = Object.values(build.loops);
const place = makePlacer(build.scale, loops,
  (VENUE_ROAD_M - CASTLE_CUM_SPEC.realRoadM * build.scale) / 2);
const [x, y] = place([realX, realY]);
const hit = querySubtrack(loops[0], x, y);
console.log(`real (${realX}, ${realY}) -> game (${x.toFixed(1)}, ${y.toFixed(1)}), scale ${build.scale.toFixed(4)};`
  + ` ${hit.dist.toFixed(1)} m from the centreline (${hit.side}) at lap m ${hit.trackDist.toFixed(1)}`);
const level = buildLevel(LEVELS.find((entry) => entry.id === 'castle-cum'));
const near = ([px, py]) => Math.hypot(px - x, py - y) < reach;
const segDist = (pts) => {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return best;
};
for (const rail of level.barriers) {
  const dist = segDist(rail.pts);
  if (dist < reach) console.log(`barrier ${rail.kind}: ${dist.toFixed(1)} m`);
}
for (const lane of level.lanes || []) {
  const dist = segDist(lane.pts.map((p) => Array.isArray(p) ? p : [p.x, p.y])) - lane.width / 2;
  if (dist < reach) console.log(`lane ${lane.surface || ''} w ${lane.width}: edge ${dist.toFixed(1)} m`);
}
for (const prop of level.props) if (prop.kind !== 'tree' && near([prop.x, prop.y]))
  console.log('prop', prop.kind, prop.x.toFixed(1), prop.y.toFixed(1), prop.w || prop.wid || prop.size || '', prop.h || '');
