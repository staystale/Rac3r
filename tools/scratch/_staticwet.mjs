// _staticwet.mjs - which levels' hand-placed covers the load keeps (puddles.ts staticCovers):
// per level, the 'wet' covers in its data vs those left in LEVEL.covers after setLevel.
// node tools/scratch/_staticwet.mjs [on]   (on: ?sandboxwet=1)
import * as L from '../../src/lab.js';
import { setTestPuddles } from '../../src/world/puddles.ts';
setTestPuddles(process.argv[2] === 'on');
import { LEVELS } from '../../src/world/levels/index.ts';
for (const level of LEVELS) {
  const placed = (level.covers || []).filter((cover) => cover.cover === 'wet');
  if (!placed.length) continue;
  L.setLevel(level.id);
  const kept = (L.LEVEL.covers || []).filter((cover) => placed.includes(cover)).length;
  console.log(`${level.id.padEnd(16)} wet placed ${placed.length} (scenery water`
    + ` ${placed.filter((cover) => cover.water).length}), kept ${kept}`);
}
