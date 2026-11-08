// _cclaneat.mjs - world/zones.ts laneAt against the plain walk of every lane's every segment (its
// answer before the segment grid): random points over each level's lanes, every level.
// node tools/scratch/_cclaneat.mjs [points a level]   (CASTLECUMVENUE=1 for the venue)
import * as L from '../../src/lab.ts';
import { addStageLevels } from '../../src/stagegen.ts';
import { laneAt } from '../../src/world/zones.ts';
addStageLevels();
const COUNT = +(process.argv[2] || 50000);
let seed = 7;
const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/** the first lane a point lies on, walking every segment (the old laneAt) */
function plainLaneAt(lanes, x, y) {
  for (const lane of lanes) {
    const half = lane.width / 2;
    for (let i = 0; i + 1 < lane.pts.length; i++) {
      const [ax, ay] = lane.pts[i], [bx, by] = lane.pts[i + 1], dx = bx - ax, dy = by - ay;
      const l2 = dx * dx + dy * dy || 1e-6;
      let frac = ((x - ax) * dx + (y - ay) * dy) / l2;
      frac = frac < 0 ? 0 : frac > 1 ? 1 : frac;
      const px = x - ax - dx * frac, py = y - ay - dy * frac;
      if (px * px + py * py <= half * half) return lane.surface;
    }
  }
  return null;
}
let total = 0, wrong = 0, onLane = 0;
for (const level of L.LEVELS) {
  L.setLevel(level.id);
  const lanes = L.LEVEL.lanes || [];
  if (!lanes.length) continue;
  let bad = 0;
  for (let i = 0; i < COUNT; i++) {
    // half the points near a lane's line (its edges are where a grid could go wrong)
    const lane = lanes[Math.floor(random() * lanes.length)];
    const at = lane.pts[Math.floor(random() * lane.pts.length)];
    const reach = lane.width * (0.3 + random());
    const x = at[0] + (random() * 2 - 1) * reach, y = at[1] + (random() * 2 - 1) * reach;
    const want = plainLaneAt(lanes, x, y), got = laneAt(x, y);
    if (want) onLane++;
    if (want !== got) bad++;
    total++;
  }
  wrong += bad;
  console.log(level.id.padEnd(30), lanes.length, 'lanes', bad ? `${bad} DIFFERENT` : 'same');
}
console.log(`laneAt: ${total} points (${onLane} on a lane), ${wrong} different`);
if (wrong) process.exitCode = 1;
