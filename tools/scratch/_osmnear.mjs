// real (spec) roads / tunnels with a point near a real spot
import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { BRANDS_SPEC } = await imp('/src/world/levels/brands-venue.ts');
const [qx, qy, r] = process.argv.slice(2).map(Number);
const data = BRANDS_SPEC.data;
for (const key of ['roads', 'tunnels', 'footbridges', 'dirt', 'karting'])
  (data[key] || []).forEach((road, i) => {
    if (!road.pts.some(([x, y]) => Math.hypot(x - qx, y - qy) < r)) return;
    console.log(key, i, road.kind || '', road.name || '', road.width || '', road.bridge ? 'BRIDGE' : '', road.pts.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(' '));
  });
