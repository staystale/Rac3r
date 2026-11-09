// _streetlamps.mjs - THE START STRAIGHT'S STREET LIGHTS (the start crash review, owner 11-09): each
// one's lap m from the start line, its side, how far past the road's edge it stands and the road's
// bend radius there. [RUNOFF=1] [SILLYSTONE=1] node tools/scratch/_streetlamps.mjs [level]
import * as L from '../../src/lab.ts';
import { activeLamps } from '../../src/world/lamps.ts';
const lv = process.argv[2] || 'sillystone';
L.setLevel(lv);
const sub = L.LEVEL.subtrack, total = sub.totalDist, half = sub.width / 2;
const rows = [];
for (const lamp of activeLamps()) {
  const x = lamp.x ?? lamp.solid?.x, y = lamp.y ?? lamp.solid?.y;
  if (x == null) continue;
  const q = L.querySubtrack(sub, x, y), at = q.trackDist > total / 2 ? q.trackDist - total : q.trackDist;
  if (Math.abs(at) > 200 || q.dist > half + 20) continue;
  rows.push(`${String(Math.round(at)).padStart(5)} m ${q.side.padEnd(5)} ${(q.dist - half).toFixed(1)} m past the edge ${lamp.kind || ''}`);
}
console.log(lv, rows.length, 'lamps by the start'); for (const row of rows.sort()) console.log(' ', row);
