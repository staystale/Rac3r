// _stagelayout.mjs - A5: a stage's layout and dressing must not move with weather-only stages
// (the stage covers keep the old random draws; the snow road has its own stream). Per stage: a
// hash of the road line, props, cones and barriers, plus its road / base surfaces and covers.
// node tools/scratch/_stagelayout.mjs   (compare the hashes with a run on an older commit)
import { createHash } from 'node:crypto';
import * as L from '../../src/lab.js';
import { addStageLevels } from '../../src/stagegen.js';

addStageLevels();
const round = (value) => Math.round(value * 1000) / 1000;
for (const level of L.LEVELS.filter((entry) => entry.gen)) {
  L.setLevel(level.id);
  const lv = L.LEVEL, sub = lv.subtrack;
  const layout = JSON.stringify([sub.pts.map((p) => [round(p.x), round(p.y)]),
    lv.props.map((p) => [p.kind, round(p.x), round(p.y)]),
    (lv.cones || []).map((c) => [round(c.x), round(c.y)]),
    (lv.barriers || []).length]);
  const hash = createHash('sha256').update(layout).digest('hex').slice(0, 12);
  const road = sub.sectors ? sub.sectors[sub.sectors.length - 1].surface.id : '?';
  console.log(`${level.id.padEnd(34)} layout ${hash} road ${road} base ${lv.base.id}`
    + ` covers ${(lv._coversBase || lv.covers || []).length} snowy ${!!lv.snowy}`);
}
