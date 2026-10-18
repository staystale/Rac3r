// _lampplan.mjs - the lamp plan (world/lampplan.ts) per level: how many street lights and
// floodlights each level gets, and the time it takes (it runs once, when the level is lit).
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
import { planLamps } from '../../src/world/lampplan.ts';
import { catOf } from '../../src/world/levels/category.ts';

for (const level of LEVELS) {
  try { buildLevel(level); } catch (error) { console.log(level.id, 'build failed', error.message); continue; }
  const start = performance.now();
  const lamps = planLamps(level);
  const ms = performance.now() - start;
  const street = lamps.filter((lamp) => lamp.kind === 'streetlight').length;
  console.log(`${level.id.padEnd(28)} ${catOf(level).padEnd(9)} street ${String(street).padStart(3)}`
    + `  flood ${String(lamps.length - street).padStart(3)}  ${ms.toFixed(1)} ms`);
}
