// _cckerbgap.mjs - each closing row's least distance (2D) to the raced road and its kerb strips
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
import { distToLine, centreAt } from '../../src/world/venuegeo.ts';
import { querySubtrack } from '../../src/world/tyrewall.ts';
const level = buildLevel(LEVELS.find((entry) => entry.id === (process.argv[2] || 'castle-cum')));
const sub = level.subtrack, half = sub.width / 2;
const kerbPts = [];
for (const kerb of sub.curvedKerbs)
  for (let dist = kerb.startDist; dist <= kerb.endDist; dist += 0.5)
    for (let out = half; out <= half + kerb.width; out += 0.5) {
      const centre = centreAt(sub, dist % sub.totalDist), side = kerb.side === 'left' ? 1 : -1;
      kerbPts.push([centre.x + centre.nx * side * out, centre.y + centre.ny * side * out]);
    }
for (const lane of level.lanes.filter((entry) => entry.surface.id === 'racetarmac')) {
  const on = level.cones.filter((cone) => distToLine(lane.pts, cone.x, cone.y) < lane.width / 2 + 0.5);
  const toKerb = Math.min(...on.map((cone) => Math.min(...kerbPts.map(([x, y]) => Math.hypot(x - cone.x, y - cone.y)))));
  const toEdge = Math.min(...on.map((cone) => querySubtrack(sub, cone.x, cone.y).dist - half));
  console.log(`piece from ${lane.pts[0].map(Math.round)}: ${on.length} tyres, least to the road edge ${toEdge.toFixed(2)} m, to a kerb strip ${toKerb.toFixed(2)} m`);
}
