// _puddlecovers.mjs - per level, how many of its own covers the weather now replaces (puddles.ts
// staticCovers: 'wet' covers that are not scenery water, on levels with a racing line). The
// levels with any are the ones worldhash should differ on after the one-system clean-up (it ran
// with the module default, the weather's puddles off). node tools/scratch/_puddlecovers.mjs
import * as L from '../../src/lab.js';
import { addStageLevels } from '../../src/stagegen.js';
import { addHighwayLevel } from '../../src/highway.js';
import { LEVEL } from '../../src/world/state.ts';
import { LEVELS } from '../../src/world/levels/index.ts';

addStageLevels();
addHighwayLevel();
const replaced = [];
for (const id of Object.keys(LEVELS)) {
  L.setLevel(id);
  const all = [...(LEVEL._coversBase || []), ...((LEVEL._incl && LEVEL._incl.covers) || [])];
  const gone = all.length - (LEVEL._staticCovers || []).length;
  if (gone > 0) replaced.push(`${id} (${gone})`);
}
console.log('levels whose puddles the weather replaces:', replaced.join(', ') || 'none');
