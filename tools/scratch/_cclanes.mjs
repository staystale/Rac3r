// _cclanes.mjs - lanes that overlap another away from their ends (the kart track over a road, a
// road over the skid pan): CASTLECUMVENUE=1 node tools/scratch/_cclanes.mjs [level]
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
import { distToLine, resample } from '../../src/world/venuegeo.ts';
import { insidePolygon } from '../../src/world/zones.ts';
const level = buildLevel(LEVELS.find((entry) => entry.id === (process.argv[2] || 'castle-cum')));
const lanes = level.lanes;
let found = 0;
for (const [i, lane] of lanes.entries()) {
  const pts = resample(lane.pts, 1);
  for (const [j, other] of lanes.entries()) {
    if (j === i) continue;
    const hits = pts.filter(([x, y], k) => k > 12 && k < pts.length - 12
      && distToLine(other.pts, x, y) < (lane.width + other.width) / 2 - 0.5);
    if (hits.length > 3 && (lane.width === 4 || other.width === 4)) {
      found++;
      console.log(`kart overlap: L${i} w${lane.width} x L${j} w${other.width} at ${hits[0].map(Math.round)}`);
    }
  }
  for (const zone of level.zones.filter((entry) => entry.surface.id === 'wet' && entry.poly)) {
    const on = pts.filter(([x, y]) => insidePolygon(zone.poly, x, y) || distToLine([...zone.poly, zone.poly[0]], x, y) < lane.width / 2);
    if (on.length) { found++; console.log(`lane L${i} w${lane.width} over the skid pan at ${on[0].map(Math.round)}`); }
  }
}
const pad = level.zones.find((entry) => entry.surface.id === 'wet');
const onPad = level.props.filter((prop) => pad && insidePolygon(pad.poly, prop.x, prop.y));
if (onPad.length) { found++; console.log('props on the skid pan:', onPad.map((prop) => prop.kind).join(' ')); }
console.log(found ? `${found} overlaps` : 'no kart / skid pan overlaps');
