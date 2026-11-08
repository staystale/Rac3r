// _bhflares.mjs [level] - each Armco end of a venue level that meets a catch fence (its end within
// 10 m of one): where, how near the fence its end comes, and whether that end bends (a flare)
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
import { distToLine } from '../../src/world/venuegeo.ts';
const level = buildLevel(LEVELS.find((entry) => entry.id === (process.argv[2] || 'brands-snatch')));
const fences = level.barriers.filter((rail) => rail.kind === 'catchfence');
// whole Armco runs (chunks sharing an end joined)
const runs = [];
for (const rail of level.barriers.filter((entry) => entry.kind === 'armco')) {
  const run = runs.find((pts) => Math.hypot(pts.at(-1)[0] - rail.pts[0][0], pts.at(-1)[1] - rail.pts[0][1]) < 0.5);
  if (run) run.push(...rail.pts.slice(1)); else runs.push(rail.pts.slice());
}
const turn = (a, b, c) => {
  const h1 = Math.atan2(b[1] - a[1], b[0] - a[0]), h2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
  let d = h2 - h1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d) * 180 / Math.PI;
};
let count = 0;
for (const pts of runs)
  for (const [end, inner] of [[pts[0], pts.slice(0, 6)], [pts.at(-1), pts.slice(-6).reverse()]]) {
    const near = Math.min(...fences.map((fence) => distToLine(fence.pts, end[0], end[1])));
    if (near > 10) continue;
    count++;
    const bend = turn(inner[4], inner[2], inner[0]);
    console.log(`  end (${end.map((v) => v.toFixed(1)).join(', ')}): ${near.toFixed(1)} m from a catch fence; the last points turn ${bend.toFixed(0)} deg`);
  }
console.log(`${level.id}: ${count} Armco ends meet a catch fence`);
