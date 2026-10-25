// _propkinds.mjs - the prop kinds each level holds (what event lighting could hang on), and its
// lamp plan's street lights / pylons. node tools/scratch/_propkinds.mjs
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
import { planLamps } from '../../src/world/lampplan.ts';
import { catOf } from '../../src/world/levels/category.ts';
for (const level of LEVELS) {
  try { buildLevel(level); } catch (error) { continue; }
  const kinds = {};
  for (const prop of level.props || []) kinds[prop.kind] = (kinds[prop.kind] || 0) + 1;
  const lamps = planLamps(level), street = lamps.filter((lamp) => lamp.kind === 'streetlight').length;
  console.log(`${level.id.padEnd(26)} ${catOf(level).padEnd(9)} lamps ${street}+${lamps.length - street}  `
    + Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
}
