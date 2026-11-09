// _lapbuild.mjs - THE MENU'S LAP LENGTHS (owner 11-09: "Can tracks show their length when
// selecting them / Especially between version of themselves"): every level's lap (or stage) length
// as the menu reads it (menu/tracks.ts lapOf) and how long reading it takes - a venue's layout
// traces its roads (world/venue.ts venueBuild), not its scenery.
// [SILLYSTONE=1] node tools/scratch/_lapbuild.mjs
import { LEVELS } from '../../src/world/levels/index.ts';
import { lapOf } from '../../src/world/levels/category.ts';

let total = 0;
for (const level of LEVELS) {
  const from = performance.now(), lap = lapOf(level), took = performance.now() - from;
  total += took;
  console.log(level.id.padEnd(22), (level._build ? 'lazy' : '').padEnd(5),
    lap ? `${(lap / 1000).toFixed(2)} km` : '-', `${took.toFixed(0)} ms`);
}
console.log(`all: ${total.toFixed(0)} ms`);
