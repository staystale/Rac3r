// _armconear.mjs - the Armco runs with an end near a point, their ends and length
import * as L from '../../src/lab.ts';
const [levelId = 'brands-snatch', px = '30', py = '-173'] = process.argv.slice(2);
L.setLevel(levelId);
for (const rail of L.LEVEL.barriers.filter((b) => b.kind === 'armco')) {
  const near = rail.pts.some(([x, y]) => Math.hypot(x - px, y - py) < 25);
  if (!near) continue;
  const first = rail.pts[0], last = rail.pts[rail.pts.length - 1];
  console.log(`armco ${rail.pts.length} pts: ${first.map((v) => v.toFixed(1))} -> ${last.map((v) => v.toFixed(1))}`);
}
