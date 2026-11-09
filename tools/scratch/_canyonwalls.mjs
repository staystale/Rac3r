// _canyonwalls.mjs - where DEAF VALLEY's walls and cliff faces were laid (highway/canyon.ts,
// gorge.ts): for each road distance in steps of STEP m, the rock wall face's offset each side
// (- left, + right of the centre line; '-' none within 80 m), and whether a cliff face / Armco runs
// there - so a missing wall shows as a number, not a guess. node tools/scratch/_canyonwalls.mjs
import { createHighway } from '../../src/highway.ts';
import { setActiveLevel } from '../../src/world/state.ts';
import { stateOf } from '../../src/highway/road.ts';
import { stretchAt } from '../../src/highway/desertplan.ts';
const level = createHighway(4242, 'canyon');
setActiveLevel(level);
const road = stateOf(level).pts, STEP = Number(process.env.STEP || 50);
const sideOf = (i, x, y) => {
  const before = road[Math.max(0, i - 1)], after = road[Math.min(road.length - 1, i + 1)];
  const hdg = Math.atan2(after.y - before.y, after.x - before.x);
  return (x - road[i].x) * -Math.sin(hdg) + (y - road[i].y) * Math.cos(hdg);
};
for (let dist = road[0].s + STEP; dist < road[road.length - 1].s; dist += STEP) {
  const i = road.findIndex((pt) => pt.s >= dist), row = { left: '-', right: '-' };
  const kinds = new Set();
  for (const bar of level.barriers) for (const [x, y] of bar.pts) {
    if (Math.hypot(x - road[i].x, y - road[i].y) > 80) continue;
    const near = road.reduce((best, pt, j) => (Math.hypot(pt.x - x, pt.y - y)
      < Math.hypot(road[best].x - x, road[best].y - y) ? j : best), 0);
    if (Math.abs(near - i) > 1) continue;
    const off = sideOf(i, x, y);
    if (bar.kind === 'rock') row[off < 0 ? 'left' : 'right'] = off.toFixed(1);
    else kinds.add(bar.kind + (off < 0 ? 'L' : 'R'));
  }
  console.log(String(Math.round(dist)).padStart(5), stretchAt(dist).kind.padEnd(7),
    String(row.left).padStart(7), String(row.right).padStart(7), [...kinds].join(' '));
}
