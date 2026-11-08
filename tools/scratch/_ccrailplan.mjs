// _ccrailplan.mjs - the real rails (OSM) placed as the venue places its map, as a venueplan
// EXTRA file: node tools/scratch/_ccrailplan.mjs <out.json>
import fs from 'node:fs';
import { CASTLE_CUM_SPEC } from '../../src/world/levels/castle-cum-venue.ts';
import { venueBuild } from '../../src/world/venue.ts';
import { makePlacer, VENUE_ROAD_M } from '../../src/world/venuegeo.ts';
const build = venueBuild(CASTLE_CUM_SPEC);
const loops = Object.values(build.loops);
const place = makePlacer(build.scale, loops, (VENUE_ROAD_M - CASTLE_CUM_SPEC.realRoadM * build.scale) / 2);
const out = (build.spec.data.rails || []).map((rail) => ({ pts: rail.pts.map(place),
  col: rail.kind === 'jersey_barrier' ? '#a50' : '#0c0' }));
fs.writeFileSync(process.argv[2], JSON.stringify(out));
console.log(out.length, 'rails');
