// _lapradius.mjs - a level's lap: its length, the least radii (through points 3 apart, as
// tools/scratch/_crxmap.mjs, and over an 8 m arc, as world/subtrack.ts traceTrack's rMin check)
// and where, with the surface there. Switches by env (BLIGHTY=1).
// node tools/scratch/_lapradius.mjs <level> [count]
import * as L from '../../src/lab.ts';

const [levelId = 'blightyrx', countArg = '6'] = process.argv.slice(2);
L.setLevel(levelId);
const sub = L.LEVEL.subtrack, pts = sub.pts, count = pts.length;
/**
 * The radius through three points.
 * @param before a point before
 * @param point the point
 * @param after a point after
 * @returns m
 */
function radiusThrough(before, point, after) {
  const ax = point.x - before.x, ay = point.y - before.y, bx = after.x - point.x;
  const by = after.y - point.y, cross = ax * by - ay * bx;
  const chord = Math.hypot(after.x - before.x, after.y - before.y);
  return Math.abs(cross) < 1e-9 ? Infinity
    : (Math.hypot(ax, ay) * Math.hypot(bx, by) * chord) / (2 * Math.abs(cross));
}
const spacing = sub.totalDist / count, half = Math.max(1, Math.round(4 / spacing));
const rows = pts.map((point, i) => {
  const three = radiusThrough(pts[(i - 3 + count) % count], point, pts[(i + 3) % count]);
  const headOf = (j) => {
    const from = pts[(j + count) % count], to = pts[(j + 1 + count) % count];
    return Math.atan2(to.y - from.y, to.x - from.x);
  };
  let turn = headOf(i + half) - headOf(i - half);
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  const arc = (2 * half * spacing) / Math.max(1e-4, Math.abs(turn));
  const sector = sub.sectorAt ? sub.sectorAt(point.dist) : null;
  return { dist: point.dist, three, arc, x: point.x, y: point.y,
    surface: sector && sector.surface ? sector.surface.id : '?' };
});
console.log(`${levelId}: lap ${sub.totalDist.toFixed(1)} m, ${count} points`
  + ` (${spacing.toFixed(2)} m),`
  + ` width ${sub.width}`);
const show = (key) => rows.slice().sort((one, two) => one[key] - two[key]).slice(0, +countArg)
  .map((row) => `${row[key].toFixed(1)} m at lap m ${row.dist.toFixed(0)} (${row.x.toFixed(0)},`
    + `${row.y.toFixed(0)}) ${row.surface}`).join('; ');
console.log('least through points 3 apart:', show('three'));
console.log('least over an 8 m arc:', show('arc'));
