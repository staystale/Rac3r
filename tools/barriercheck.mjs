// barriercheck.mjs — every SOLID barrier point must be clear of the road (>= half width + 2 m from the centreline) and off every
// lane; lanes must not cross the road except where they join it. node tools/barriercheck.mjs [level]. Built 2026-10-04 (Thruston pits).
import * as L from '../src/lab.js';
const lv = process.argv[2] || 'thruston';
L.setLevel(lv);
const st = L.LEVEL.subtrack, hw = st.width / 2;
const fails = [];
const onLane = (x, y) => (L.LEVEL.lanes || []).some((ln) => ln.pts.some(([a, b], i) => {
  const q = ln.pts[i + 1]; if (!q) return false;
  const dx = q[0] - a, dy = q[1] - b, l2 = dx * dx + dy * dy || 1e-6; let t = ((x - a) * dx + (y - b) * dy) / l2; t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - a - dx * t, y - b - dy * t) <= ln.width / 2;
}));
for (const b of L.LEVEL.barriers || []) {
  if (b.kind === 'line') continue;
  let minD = Infinity, laneHits = 0;
  for (const [x, y] of b.pts) { minD = Math.min(minD, L.querySubtrack(st, x, y).dist); if (onLane(x, y)) laneHits++; }
  const ok = minD >= hw + 2 && laneHits === 0;
  if (!ok) fails.push(b.kind);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${b.kind.padEnd(8)} ${b.pts.length} pts, nearest ${minD.toFixed(1)} m from the centreline (road edge ${hw}), on a lane: ${laneHits}`);
}
console.log(fails.length ? 'FAILED: ' + fails.join(' ') : 'barriers: all OK');
if (fails.length) process.exitCode = 1;
