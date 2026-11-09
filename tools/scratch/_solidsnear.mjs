// _solidsnear.mjs - what solids and props stand near a spot given by lap m from the start line and
// m across the road (+ = the road's +normal side). [SILLYSTONE=1] node _solidsnear.mjs lv at side r
import * as L from '../../src/lab.ts';
const [lv, atArg, sideArg, rArg = '6'] = process.argv.slice(2);
L.setLevel(lv);
const sub = L.LEVEL.subtrack, total = sub.totalDist, spawn = L.LEVEL.spawn;
const spawnDist = L.querySubtrack(sub, spawn.x, spawn.y).trackDist;
const p = L.onTrack(sub, ((spawnDist + +atArg) % total + total) % total, +sideArg, {});
console.log('spot', p.x.toFixed(1), p.y.toFixed(1));
for (const s of L.LEVEL.solids || []) {
  const d = Math.hypot((s.x ?? 0) - p.x, (s.y ?? 0) - p.y);
  if (d < +rArg + Math.max(s.w || 0, s.h || 0, s.r || 0)) console.log('solid', JSON.stringify(s).slice(0, 160), d.toFixed(1));
}
for (const s of L.LEVEL.props || []) {
  const d = Math.hypot(s.x - p.x, s.y - p.y);
  if (d < +rArg + Math.max(s.w || 0, s.h || 0)) console.log('prop', s.kind, d.toFixed(1), s.w, s.h);
}
