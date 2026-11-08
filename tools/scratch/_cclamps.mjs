// _cclamps.mjs - every level's planned lamps and corner tyre rings (world/lampplan.ts), as JSON
// lines, to compare a lamp-plan change: node tools/scratch/_cclamps.mjs > out.txt
import * as L from '../../src/lab.ts';
import { addStageLevels } from '../../src/stagegen.ts';
import { planLamps, cornerTyres } from '../../src/world/lampplan.ts';
addStageLevels();
for (const level of L.LEVELS) {
  L.setLevel(level.id);
  const round = (value) => Math.round(value * 100) / 100;
  const lamps = planLamps(L.LEVEL).map((lamp) => [lamp.kind, round(lamp.x), round(lamp.y)].join(':'));
  const rings = cornerTyres(L.LEVEL).map((tyre) => [round(tyre.x), round(tyre.y)].join(':'));
  console.log(level.id, lamps.length, rings.length, JSON.stringify([lamps, rings]).length, JSON.stringify([lamps, rings]).slice(0, 0));
  console.log('  ' + JSON.stringify([lamps, rings]));
}
