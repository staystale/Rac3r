// _ccacross.mjs <lapM> [from] [to] - what the built Castle Kum has along the normal at a lap distance:
// each barrier and lane edge crossed, by signed distance from the centreline (+ = right)
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
import { centreAt } from '../../src/world/venuegeo.ts';
const [lapM, from = -40, to = 40] = process.argv.slice(2).map(Number);
const level = buildLevel(LEVELS.find((entry) => entry.id === (process.env.LEVEL || 'castle-cum')));
const centre = centreAt(level.subtrack, lapM);
console.log(`lap m ${lapM}: centre (${centre.x.toFixed(1)}, ${centre.y.toFixed(1)}) normal (${centre.nx.toFixed(3)}, ${centre.ny.toFixed(3)})`);
const cross = (pts, label) => {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    // the normal line: centre + n * s; solve for s and the segment t
    const dx = bx - ax, dy = by - ay, det = centre.nx * -dy - centre.ny * -dx;
    if (Math.abs(det) < 1e-9) continue;
    const rx = ax - centre.x, ry = ay - centre.y;
    const s = (rx * -dy - ry * -dx) / det, t = (centre.nx * ry - centre.ny * rx) / det;
    if (t >= 0 && t <= 1 && s >= from && s <= to) console.log(`  ${s.toFixed(1)} m: ${label}`);
  }
};
for (const rail of level.barriers) cross(rail.pts, `barrier ${rail.kind}`);
for (const lane of level.lanes || []) {
  const pts = lane.pts.map((p) => Array.isArray(p) ? p : [p.x, p.y]);
  cross(pts, `lane centre (w ${lane.width}${lane.name ? ' ' + lane.name : ''})`);
}
