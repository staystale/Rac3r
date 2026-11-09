// _legs.mjs - every gantry and footbridge solid: where along the lap from the start line and how
// far past the road's edge it stands. [SILLYSTONE=1] node tools/scratch/_legs.mjs [level]
import * as L from '../../src/lab.ts';
const lv = process.argv[2] || 'sillystone';
L.setLevel(lv);
const sub = L.LEVEL.subtrack, total = sub.totalDist, spawn = L.LEVEL.spawn, half = sub.width / 2;
const spawnDist = L.querySubtrack(sub, spawn.x, spawn.y).trackDist;
for (const s of L.LEVEL.solids || []) {
  if (!/gantry|footbridge|bridge/.test(s.kind || '')) continue;
  const q = L.querySubtrack(sub, s.x, s.y), at = ((q.trackDist - spawnDist) % total + total) % total;
  console.log(s.kind.padEnd(11), 'at', at.toFixed(0).padStart(5), 'm, side', q.side,
    'centre', q.dist.toFixed(1), 'm off, box edge', (q.dist - (s.r || 0) - half).toFixed(1), 'm past the road edge');
}
