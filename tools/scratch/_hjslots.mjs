// _hjslots.mjs - HOLY JEEZ'S GRID SLOTS IN NODE (scratch): game/grid.ts gridPos for slots 0-20,
// each one's distance from the start lane's centreline, its heading and the nearest tree, stand,
// building and barrier point (game m). HOLYJEEZ=1 node tools/scratch/_hjslots.mjs
import * as L from '../../src/lab.ts';
import { gridPos } from '../../src/game/grid.ts';

L.setLevel('holyjeez');
const level = L.LEVEL;
const lane = level.lanes.find((one) => Math.hypot(one.pts.at(-1)[0] - level.subtrack.pts[0].x,
  one.pts.at(-1)[1] - level.subtrack.pts[0].y) < 20);
const toLine = (pts, x, y) => {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
    const along = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(ax + along * dx - x, ay + along * dy - y));
  }
  return best;
};
const near = (list, x, y) => Math.min(Infinity, ...list.map((item) => Math.hypot(item.x - x, item.y - y)));
const trees = level.props.filter((prop) => prop.kind === 'tree');
const solids = level.props.filter((prop) => prop.kind !== 'tree' && prop.w);
const barrierPts = (level.barriers || []).flatMap((barrier) => (barrier.pts || [])
  .map(([x, y]) => ({ x, y })));
for (let slot = 0; slot < 21; slot++) {
  const spot = gridPos(slot);
  console.log(`${String(slot).padStart(2)} (${spot.x.toFixed(1)},${spot.y.toFixed(1)}) h ${spot.h.toFixed(3)}`
    + ` off lane centre ${toLine(lane.pts, spot.x, spot.y).toFixed(2)} m, tree ${near(trees, spot.x, spot.y).toFixed(1)}`
    + `, prop ${near(solids, spot.x, spot.y).toFixed(1)}, barrier pt ${near(barrierPts, spot.x, spot.y).toFixed(1)}`);
}
const nearest = solids.map((prop) => ({ prop, gap: toLine(lane.pts, prop.x, prop.y) }))
  .sort((one, two) => one.gap - two.gap).slice(0, 6);
for (const { prop, gap } of nearest) console.log(`prop ${prop.kind} (${prop.x.toFixed(0)},${prop.y.toFixed(0)}) `
  + `${prop.w}x${prop.h} centre ${gap.toFixed(1)} m from the lane's centreline`);
