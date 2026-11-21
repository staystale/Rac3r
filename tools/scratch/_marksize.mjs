// _marksize.mjs - ?marksage sizing: every level's fenced extent against the marks layer's window
// (marks.ts MARK_EXTENT, 4.2 px/m), what a whole-level layer would cost at 1 px/m, and how many
// of the fine layer's 256 px tiles lie within 25 m of the lap.
// node tools/scratch/_marksize.mjs
import * as L from '../../src/lab.ts';
import { addStageLevels } from '../../src/stagegen.ts';
import * as B from '../../src/world/bounds.ts';
import { MARK_EXTENT } from '../../src/marks.ts';
import { LEVEL } from '../../src/world/state.ts';

addStageLevels();
const rows = [];
for (const level of L.LEVELS) {
  try {
    L.setLevel(level.id, { light: true });
  } catch (error) {
    console.log(level.id, 'build failed', error.message);
    continue;
  }
  if (LEVEL.endless) continue;
  const fits = -B.FX0 + B.RUNOFF_W <= MARK_EXTENT && B.FX1 + B.RUNOFF_W <= MARK_EXTENT
    && -B.FY0 + B.RUNOFF_W <= MARK_EXTENT && B.FY1 + B.RUNOFF_W <= MARK_EXTENT;
  const width = B.FX1 - B.FX0 + 2 * B.RUNOFF_W, height = B.FY1 - B.FY0 + 2 * B.RUNOFF_W;
  // the fine layer's 256 px tiles (61 m at 4.2 px/m) within 25 m of the lap's centre line
  const tileM = 256 / 4.2, tiles = new Set(), sub = LEVEL.subtrack;
  for (const point of sub ? sub.pts : []) {
    for (let dx = -25; dx <= 25; dx += 12.5) for (let dy = -25; dy <= 25; dy += 12.5) {
      tiles.add(Math.floor((point.x + dx) / tileM) + ',' + Math.floor((point.y + dy) / tileM));
    }
  }
  rows.push({ id: level.id, fits, tiles: tiles.size, lapM: sub ? Math.round(sub.totalDist) : 0,
    width: Math.round(width), height: Math.round(height),
    mbAt1: Math.round(width * height * 4 / 1e6) });
}
rows.sort((a, b) => b.mbAt1 - a.mbAt1);
const big = rows.filter((row) => !row.fits);
console.log(`window ${2 * MARK_EXTENT} m; ${big.length} of ${rows.length} levels do not fit`);
for (const row of big) console.log(row.id, row.width + ' x ' + row.height + ' m',
  'whole-level layer at 1 px/m ' + row.mbAt1 + ' MB;',
  'lap ' + row.lapM + ' m, fine tiles by the lap ' + row.tiles + ' (' + Math.round(row.tiles
  * 0.262) + ' MB)');
