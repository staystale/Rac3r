// _loosecount.mjs - a level's loose objects by kind and its fullest 2 m cell
import { pathToFileURL } from 'node:url';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const { buildLevel } = await imp('/src/world/load.ts');
const { cornerTyres } = await imp('/src/world/lampplan.ts');
const level = buildLevel(LEVELS.find((entry) => entry.id === process.argv[2]));
const loose = [...level.cones, ...cornerTyres(level)];
const kinds = {};
for (const obj of loose) kinds[obj.kind || 'cone'] = (kinds[obj.kind || 'cone'] || 0) + 1;
const cells = new Map();
for (const obj of loose) { const key = Math.floor(obj.x / 2) + ',' + Math.floor(obj.y / 2); cells.set(key, (cells.get(key) || 0) + 1); }
const worst = [...cells].sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log(loose.length, JSON.stringify(kinds), JSON.stringify(worst));
const bad = loose.filter((obj) => !Number.isFinite(obj.x) || !Number.isFinite(obj.y));
console.log('not finite', bad.length, JSON.stringify(bad.slice(0, 4)));
console.log('cones not finite', level.cones.filter((obj) => !Number.isFinite(obj.x + obj.y)).length);
