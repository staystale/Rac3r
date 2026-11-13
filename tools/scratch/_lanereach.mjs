// throwaway: onLaneGrid vs the walk, on every level's lanes, random and edge points
import * as L from '../../src/lab.ts';
import { addStageLevels } from '../../src/stagegen.ts';
import { addHighwayLevel } from '../../src/highway.ts';
import { LEVEL } from '../../src/world/state.ts';
import { onLaneGrid } from '../../src/game/lanereach.ts';
addStageLevels();
addHighwayLevel();
const walk = (lanes, x, y) => {
  for (const lane of lanes) {
    const pts = lane.pts, reach2 = (lane.width / 2 + 1) ** 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const [startX, startY] = pts[i], [endX, endY] = pts[i + 1], vx = endX - startX,
        vy = endY - startY, len2 = vx * vx + vy * vy || 1;
      const frac = Math.max(0, Math.min(1, ((x - startX) * vx + (y - startY) * vy) / len2)),
        missX = startX + vx * frac - x, missY = startY + vy * frac - y;
      if (missX * missX + missY * missY < reach2) return true;
    }
  }
  return false;
};
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const BREAK = process.env.BREAK === '1';
let levels = 0, asked = 0, bad = 0, hits = 0;
for (const lv of L.LEVELS) {
  try { L.setLevel(lv.id); } catch (err) { console.log(lv.id, String(err)); continue; }
  const lanes = LEVEL.lanes || [];
  if (!lanes.length) continue;
  levels++;
  const work = BREAK ? lanes.map((lane) => ({ ...lane, width: lane.width - 2 })) : lanes;
  for (const lane of lanes) for (let i = 0; i < lane.pts.length - 1; i++) {
    const [ax, ay] = lane.pts[i], [bx, by] = lane.pts[i + 1], reach = lane.width / 2 + 1;
    for (let k = 0; k < 6; k++) {
      const t = rnd(), len = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / len, ny = (bx - ax) / len;
      const off = reach + (rnd() - 0.5) * (k < 3 ? 1e-6 : 6);
      const x = ax + (bx - ax) * t + nx * off, y = ay + (by - ay) * t + ny * off;
      const want = walk(lanes, x, y), got = onLaneGrid(work, x, y);
      asked++; if (want) hits++; if (want !== got) bad++;
    }
  }
}
console.log(`levels ${levels} | points ${asked} | on a lane ${hits} | answers differing ${bad}`);
