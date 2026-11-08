// _bhlanes.mjs - a level's lanes as JSON lines (to compare a road rule change): <level> <out>
import fs from 'node:fs';
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
const level = buildLevel(LEVELS.find((entry) => entry.id === process.argv[2]));
fs.writeFileSync(process.argv[3], level.lanes.map((lane) => JSON.stringify({ w: lane.width, s: lane.surface.id, n: lane.pts.length, a: lane.pts[0].map(Math.round), b: lane.pts.at(-1).map(Math.round), len: Math.round(lane.pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - lane.pts[i][0], p[1] - lane.pts[i][1]), 0)) })).join('\n'));
