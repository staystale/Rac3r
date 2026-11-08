import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const { querySubtrack } = await imp('/src/world/tyrewall.ts');
const level = LEVELS.find((entry) => entry.id === (process.env.LEVEL || 'brands-snatch'));
const [qx, qy, r] = process.argv.slice(2).map(Number);
console.log('track dist', querySubtrack(level.subtrack, qx, qy).dist.toFixed(1));
for (const p of level.props) if (Math.hypot(p.x - qx, p.y - qy) < r) console.log('prop', p.kind, p.x.toFixed(1), p.y.toFixed(1), p.w, p.h, p.wid);
for (const z of level.zones) if (z.poly && z.poly.some(([x, y]) => Math.hypot(x - qx, y - qy) < r)) console.log('zone', z.surface.id);
