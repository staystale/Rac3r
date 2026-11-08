import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const level = LEVELS.find((entry) => entry.id === 'brands-snatch');
const f = (pts, n = 8) => pts.filter((_, j) => j % Math.max(1, Math.floor(pts.length / n)) === 0 || j === pts.length - 1).map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(' ');
const row = level.props.find((p) => p.kind === 'garagerow');
console.log('garage front', f(row.front)); console.log('garage back', f(row.back));
for (const b of level.barriers) if (b.pts.some(([x, y]) => x > -130 && x < 80 && y > -185 && y < -140)) console.log(b.kind, f(b.pts));
for (const p of level.props) if (p.x > -130 && p.x < 80 && p.y > -185 && p.y < -140 && p.kind !== 'tree') console.log('prop', p.kind, p.x.toFixed(0), p.y.toFixed(0));
