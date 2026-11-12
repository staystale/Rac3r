// barriercheck.mjs — every SOLID barrier point must be clear of the road (>= half width + 2 m from the centreline) and off every
// lane; lanes must not cross the road except where they join it. node tools/barriercheck.mjs [level]. Built 2026-10-04 (Thruston pits).
import * as L from '../src/lab.ts';
import { onGroundQuery } from '../src/world/tyrewall.ts';
import { portalCorners } from '../src/world/venuecross.ts';
const lv = process.argv[2] || 'thruston';
L.setLevel(lv);
const st = L.LEVEL.subtrack, hw = st.width / 2;
const fails = [];
const EDGE_TOL = 0.1;
const onLane = (x, y) => (L.LEVEL.lanes || []).some((ln) => ln.pts.some(([a, b], i) => {
  const q = ln.pts[i + 1]; if (!q) return false;
  const dx = q[0] - a, dy = q[1] - b, l2 = dx * dx + dy * dy || 1e-6; let t = ((x - a) * dx + (y - b) * dy) / l2; t = Math.max(0, Math.min(1, t));
  // (EDGE_TOL m inside the edge: a wall that IS the lane's edge - the pit garages' front - is not on it)
  return Math.hypot(x - a - dx * t, y - b - dy * t) <= ln.width / 2 - EDGE_TOL;
}));
// (a barrier carried on to a crossover portal's wall corner meets the wall there: the wall stands
// 7.7 m off its road by design, so that one point is the wall's, not the barrier's)
const portalJoins = (L.LEVEL.props || []).filter((prop) => prop.kind === 'tunnel' && prop.track)
  .flatMap(portalCorners);
const isPortalJoin = (x, y) => portalJoins.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 0.05);
for (const b of L.LEVEL.barriers || []) {
  if (b.kind === 'line') continue;
  let minD = Infinity, laneHits = 0;
  // (a barrier stands on the ground: over a crossover it is on the bridge, not the road below)
  for (const [x, y] of b.pts) {
    if (!isPortalJoin(x, y)) minD = Math.min(minD, onGroundQuery(() => L.querySubtrack(st, x, y)).dist);
    if (onLane(x, y)) laneHits++;
  }
  const ok = minD >= hw + 2 && laneHits === 0;
  if (!ok) fails.push(b.kind);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${b.kind.padEnd(8)} ${b.pts.length} pts, nearest ${minD.toFixed(1)} m from the centreline (road edge ${hw}), on a lane: ${laneHits}`);
}
console.log(fails.length ? 'FAILED: ' + fails.join(' ') : 'barriers: all OK');
if (fails.length) process.exitCode = 1;
