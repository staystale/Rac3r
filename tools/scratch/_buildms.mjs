// _buildms.mjs - how long a level takes to build in node (ms, after a warm-up build of another)
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
for (const id of process.argv.slice(2)) {
  const start = performance.now();
  buildLevel(LEVELS.find((entry) => entry.id === id));
  console.log(id, Math.round(performance.now() - start), 'ms');
}
