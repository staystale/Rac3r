import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const level = LEVELS.find((entry) => entry.id === 'brands-snatch');
const [qx, qy, r] = process.argv.slice(2).map(Number);
const area = (poly) => Math.abs(poly.reduce((s, [x, y], i) => { const [nx, ny] = poly[(i + 1) % poly.length]; return s + x * ny - nx * y; }, 0) / 2);
for (const zone of level.zones.filter((z) => z.poly))
  if (zone.poly.some(([x, y]) => Math.hypot(x - qx, y - qy) < r))
    console.log(zone.surface.id, 'n', zone.poly.length, 'area', area(zone.poly).toFixed(0), zone.poly.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(' '));
