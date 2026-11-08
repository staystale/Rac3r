// does the placer fold the map between two stretches? a line of real points across the infield
import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { venueBuild } = await imp('/src/world/venue.ts');
const { makePlacer, nearestLoop, VENUE_ROAD_M } = await imp('/src/world/venuegeo.ts');
const { BRANDS_SPEC } = await imp('/src/world/levels/brands-venue.ts');
const build = venueBuild(BRANDS_SPEC);
const loops = Object.values(build.loops);
const widen = (VENUE_ROAD_M - build.spec.realRoadM * build.scale) / 2;
const place = makePlacer(build.scale, loops, widen);
const [gx, gy0, gy1] = process.argv.slice(2).map(Number);
let prev = null;
for (let gy = gy0; gy <= gy1; gy += 2) {
  const [x, y] = place([gx / build.scale, gy / build.scale]);
  const { hit } = nearestLoop(loops, gx, gy);
  console.log(`game ${gx},${gy} -> ${x.toFixed(1)},${y.toFixed(1)}  step ${prev ? (y - prev).toFixed(1) : ''}  near ${hit.dist.toFixed(1)}`);
  prev = y;
}
