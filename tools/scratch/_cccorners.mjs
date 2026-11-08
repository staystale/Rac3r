// _cccorners.mjs - the lap metre of each named corner of Castle Cum (OSM's locality nodes, real m
// in the venue's frame, placed at game scale)
import { venueBuild } from '../../src/world/venue.ts';
import { CASTLE_CUM_SPEC } from '../../src/world/levels/castle-cum-venue.ts';
import { querySubtrack } from '../../src/world/tyrewall.ts';
const CORNERS = { Folly: [-47, 467], 'Avon Rise': [-285, 344], Quarry: [-570, 160],
  'Farm Straight': [-423, -28], 'The Esses': [-272, -124], 'Old Paddock': [-151, -284],
  'Hammer Down': [126, -286], Tower: [378, -325], Bobbies: [392, -84], Westway: [440, 110],
  'Dean Straight': [405, 231], Camp: [314, 458] };
const build = venueBuild(CASTLE_CUM_SPEC), sub = build.loops.circuit;
for (const [name, [x, y]] of Object.entries(CORNERS)) {
  const hit = querySubtrack(sub, x * build.scale, y * build.scale);
  console.log(`${name.padEnd(14)} lap m ${hit.trackDist.toFixed(0).padStart(5)}  ${hit.dist.toFixed(0)} m off (${hit.side})`);
}
