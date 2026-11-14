// _hjlane.mjs - HOLY JEEZ'S START LANE (scratch): the lane's points from the dead end, each one's
// distance off the straight line back from the pole along its heading, the room behind the pole,
// and the spawn. HOLYJEEZ=1 node tools/scratch/_hjlane.mjs
import * as L from '../../src/lab.ts';

L.setLevel('holyjeez');
const level = L.LEVEL, spawn = level.spawn;
const lane = level.lanes.find((one) => Math.hypot(one.pts.at(-1)[0] - level.subtrack.pts[0].x,
  one.pts.at(-1)[1] - level.subtrack.pts[0].y) < 20);
const cosH = Math.cos(spawn.heading), sinH = Math.sin(spawn.heading);
console.log(`spawn (${spawn.x.toFixed(1)},${spawn.y.toFixed(1)}) heading ${spawn.heading.toFixed(4)}`
  + `, lane ${lane.pts.length} points, width ${lane.width}`);
let along = 0;
lane.pts.forEach(([x, y], i) => {
  if (i) along += Math.hypot(x - lane.pts[i - 1][0], y - lane.pts[i - 1][1]);
  const back = -((x - spawn.x) * cosH + (y - spawn.y) * sinH);
  const side = -(x - spawn.x) * sinH + (y - spawn.y) * cosH;
  if (i % 5 === 0 || i === lane.pts.length - 1) console.log(`${String(i).padStart(3)} from dead end`
    + ` ${along.toFixed(1)} m: (${x.toFixed(1)},${y.toFixed(1)}) back of pole ${back.toFixed(1)}`
    + ` m, off the pole's line ${side.toFixed(2)} m`);
});
