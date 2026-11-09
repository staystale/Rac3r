// _datarails.mjs - a venue's mapped rails (data.rails) near a game spot, at game scale:
// node tools/scratch/_datarails.mjs <spec module, from the repo root> <SPEC export> <x> <y> [reach m, 15]
import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const [modPath, specName, xArg, yArg, reachArg = '15'] = process.argv.slice(2);
const spec = (await imp('/' + modPath))[specName];
const { venueBuild } = await imp('/src/world/venue.ts');
const build = venueBuild(spec), scale = build.scale;
for (const [index, rail] of (spec.data.rails || []).entries()) {
  const pts = rail.pts.map(([x, y]) => [x * scale, y * scale]);
  const near = pts.map((p, i) => [i, p]).filter(([, p]) => Math.hypot(p[0] - +xArg, p[1] - +yArg) < +reachArg);
  if (near.length) console.log('rail', index, rail.kind, near.map(([i, p]) => `${i}:${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
}
console.log('scale', scale.toFixed(4), 'railsSeen', (spec.railsSeen || []).length);
