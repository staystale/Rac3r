// _cctyregap.mjs - the edge's tyre rows: nearest tyre stack to the raced road's edge, per run of
// rows (closing rows across unraced pieces are left out: they stand on a road piece)
// node tools/scratch/_cctyregap.mjs <level> [x0 y0 x1 y1 to only count a box]
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
import { querySubtrack } from '../../src/world/tyrewall.ts';
import { distToLine } from '../../src/world/venuegeo.ts';
const [levelId, ...box] = process.argv.slice(2);
const level = buildLevel(LEVELS.find((entry) => entry.id === levelId));
const half = level.subtrack.width / 2;
const pieces = level.lanes.filter((lane) => lane.surface.id === 'racetarmac');
const [x0, y0, x1, y1] = box.length ? box.map(Number) : [-1e9, -1e9, 1e9, 1e9];
let best = null;
for (const cone of level.cones) {
  if (cone.x < x0 || cone.x > x1 || cone.y < y0 || cone.y > y1) continue;
  if (pieces.some((lane) => distToLine(lane.pts, cone.x, cone.y) < lane.width / 2)) continue;
  const gap = querySubtrack(level.subtrack, cone.x, cone.y).dist - half;
  if (!best || gap < best.gap) best = { gap, x: cone.x, y: cone.y };
}
console.log(levelId, 'nearest edge tyre to the road edge', best ? `${best.gap.toFixed(2)} m at ${best.x.toFixed(0)},${best.y.toFixed(0)}` : 'none');
