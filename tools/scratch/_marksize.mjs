// _marksize.mjs - ?marksage sizing: every level's fenced extent against the marks layer's window
// (marks.ts MARK_EXTENT, 4.2 px/m), and what a whole-level layer would cost at 1 px/m.
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
  rows.push({ id: level.id, fits, width: Math.round(width), height: Math.round(height),
    mbAt1: Math.round(width * height * 4 / 1e6) });
}
rows.sort((a, b) => b.mbAt1 - a.mbAt1);
const big = rows.filter((row) => !row.fits);
console.log(`window ${2 * MARK_EXTENT} m; ${big.length} of ${rows.length} levels do not fit`);
for (const row of big) console.log(row.id, row.width + ' x ' + row.height + ' m',
  'whole-level layer at 1 px/m ' + row.mbAt1 + ' MB');
