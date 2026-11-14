// _griddump.mjs - EVERY LEVEL'S GRID, slot by slot (scratch): game/grid.ts gridPos for slots 0-20
// on every level (the highway left out: its grid is the traffic's, highwayrace.ts), printed as
// x, y, heading to 6 places, so two versions of the grid code can be compared line by line.
// [HOLYJEEZ=1] node tools/scratch/_griddump.mjs > out.txt
import * as L from '../../src/lab.ts';
import { gridPos } from '../../src/game/grid.ts';

const SLOTS = 21;
for (const level of L.LEVELS) {
  L.setLevel(level.id);
  if (L.LEVEL.endless || !L.LEVEL.subtrack) continue;
  for (let slot = 0; slot < SLOTS; slot++) {
    const spot = gridPos(slot);
    console.log(`${level.id} ${slot} ${spot.x.toFixed(6)} ${spot.y.toFixed(6)} ${spot.h.toFixed(6)}`);
  }
}
