// _venueloops.mjs [venue] [SPEC export] - each venue layout's traced lap against its real line at game scale: lengths,
// and where the traced road strays furthest from the real line (a corner cut, a folded joint)
import { venueBuild } from '../../src/world/venue.ts';
const [modName = 'snotterton', specName = 'SNOTTERTON_SPEC'] = process.argv.slice(2);
const SPEC = (await import(`../../src/world/levels/${modName}-venue.ts`))[specName];
import { querySubtrack } from '../../src/world/tyrewall.ts';
const build = venueBuild(SPEC);
const pieceOf = Object.fromEntries(build.spec.data.pieces.map((piece) => [piece.name, piece.pts]));
for (const [layout, steps] of Object.entries(build.spec.data.layouts)) {
  const sub = build.loops[layout];
  const line = steps.flatMap(([name, way]) => (way > 0 ? pieceOf[name] : pieceOf[name].slice().reverse()))
    .map(([x, y]) => [x * build.scale, y * build.scale]);
  let real = 0;
  for (let i = 1; i < line.length; i++) real += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  const strays = [];
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1], len = Math.hypot(bx - ax, by - ay);
    for (let t = 0; t < len; t += 4) {
      const x = ax + (bx - ax) * t / len, y = ay + (by - ay) * t / len, hit = querySubtrack(sub, x, y);
      if (hit.dist > 3) strays.push([x, y, hit.dist]);
    }
  }
  const worst = strays.sort((a, b) => b[2] - a[2]).slice(0, 5).map(([x, y, d]) => `${x.toFixed(0)},${y.toFixed(0)} ${d.toFixed(1)} m`);
  console.log(`${layout}: traced ${sub.totalDist.toFixed(0)} m, real line ${real.toFixed(0)} m at game scale; strays > 3 m: ${strays.length * 4} m; worst ${worst.join(' | ')}`);
}
