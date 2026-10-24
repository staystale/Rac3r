// _lineseam.mjs - A4 (owner: the AI wiggle near the start / finish on the oval and stock car):
// the racing line where the lap closes (index 0 / the last point) vs the rest of the lap - the
// centreline's spacing and normal, the line's offset, radius and heading change per point.
// node tools/scratch/_lineseam.mjs [levels,comma]
import * as L from '../../src/lab.js';
import { racingLine } from '../../src/ai/line.ts';
const ids = (process.argv[2] || 'naffcar,stock-car,thruston').split(',');
for (const id of ids) {
  L.setLevel(id);
  const sub = L.LEVEL.subtrack, centre = sub.pts, line = racingLine(L.LEVEL), pts = line.pts;
  const count = pts.length;
  const spacing = (i) => Math.hypot(centre[(i + 1) % count].x - centre[i].x,
    centre[(i + 1) % count].y - centre[i].y);
  const turn = (i) => {
    const a = pts[(i - 1 + count) % count], b = pts[i], c = pts[(i + 1) % count];
    let d = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  };
  const spacings = centre.map((_, i) => spacing(i)).sort((a, b) => a - b);
  console.log(`${id}: points ${count}, total ${sub.totalDist.toFixed(1)} m, centre spacing`
    + ` min ${spacings[0].toFixed(3)} median ${spacings[count >> 1].toFixed(3)}`
    + ` max ${spacings[count - 1].toFixed(3)}; first-last gap ${spacing(count - 1).toFixed(3)} m`);
  // heading change sign flips (a wiggle) round the lap: where the line turns left-right-left
  const flips = [];
  for (let i = 0; i < count; i++) {
    const t0 = turn(i), t1 = turn((i + 1) % count);
    if (Math.sign(t0) !== Math.sign(t1) && Math.abs(t0) > 0.002 && Math.abs(t1) > 0.002) flips.push(i);
  }
  console.log(`  turn-direction flips (|turn| > 0.002 rad): ${flips.length} at ${flips.slice(0, 20).join(',')}`);
  for (const i of [count - 3, count - 2, count - 1, 0, 1, 2]) {
    const c = centre[i], p = pts[i];
    console.log(`  i ${String(i).padStart(4)} dist ${c.dist.toFixed(1).padStart(7)} spacing ${spacing(i).toFixed(3)}`
      + ` n ${c.nx.toFixed(3)},${c.ny.toFixed(3)} off ${p.off.toFixed(3)} R ${p.R.toFixed(0)} turn ${(turn(i) * 1000).toFixed(2)} mrad`);
  }
}
