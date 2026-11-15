// _firmix.mjs - counts a level's trees by kind as render/trees.ts picks them (seed + the level's
// share of firs). node tools/scratch/_firmix.mjs [levelId ...]   (HJFIRS=1 for the switch)
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['holyjeez'];
for (const levelId of ids) {
  const level = buildLevel(LEVELS.find((each) => each.id === levelId));
  const share = level.firShare ?? 0.4;
  const counts = { fir: 0, leafy: 0, scrub: 0 };
  for (const prop of level.props || []) {
    if (prop.kind !== 'tree') continue;
    if (prop.pal === 'dry') { counts.scrub++; continue; }
    const value = Math.sin(((prop.seed || 0) + 1) * 12.9898) * 43758.5453;
    counts[value - Math.floor(value) < share ? 'fir' : 'leafy']++;
  }
  const total = counts.fir + counts.leafy + counts.scrub;
  console.log(levelId, 'share', share, counts, 'firs', (100 * counts.fir / total).toFixed(1) + ' %');
}
