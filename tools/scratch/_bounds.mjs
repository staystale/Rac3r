import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const level = LEVELS.find((entry) => entry.id === (process.env.LEVEL || 'brands-snatch'));
const xs = level.subtrack.pts.map((p) => p.x), ys = level.subtrack.pts.map((p) => p.y);
console.log('track', Math.min(...xs).toFixed(0), Math.max(...xs).toFixed(0), Math.min(...ys).toFixed(0), Math.max(...ys).toFixed(0), 'bounds', JSON.stringify(level.bounds));
