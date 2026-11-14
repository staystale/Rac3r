// _hjnear.mjs - WHAT LIES NEAR A LINE AT HOLY JEEZ (scratch): every mapped item drawn as points (road
// pieces, roads, paddocks; real m, the map's data) within REACH m of the segment from A to B,
// nearest first. Buildings and stands are boxes: tools/scratch/_hjslots.mjs measures those.
// node tools/scratch/_hjnear.mjs ax ay bx by [reach]
import { HOLJES_VENUE } from '../../src/world/levels/venues/holjes.ts';

const [ax, ay, bx, by, reach = 60] = process.argv.slice(2).map(Number);
const toSeg = (x, y) => {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
  const along = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
  return Math.hypot(ax + along * dx - x, ay + along * dy - y);
};
const rows = [];
for (const [kind, list] of Object.entries(HOLJES_VENUE)) {
  if (!Array.isArray(list)) continue;
  list.forEach((item, i) => {
    const pts = item.pts || item.outline || (Array.isArray(item) ? item : null);
    if (!pts || !Array.isArray(pts[0])) return;
    const near = Math.min(...pts.map(([x, y]) => toSeg(x, y)));
    if (near < reach) rows.push({ kind, name: item.name || item.kind || i, near });
  });
}
rows.sort((one, two) => one.near - two.near);
for (const row of rows) console.log(`${row.near.toFixed(1).padStart(6)} m  ${row.kind} ${row.name}`);
