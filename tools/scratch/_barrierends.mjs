// _barrierends.mjs - A STADIUM'S BARRIERS, HOW CLEAN (scratch; owner 11-12 "slightly messy Armco /
// fences"): every barrier end that meets nothing (no other barrier's line, no portal corner within
// MEET_M) with the nearest barrier and the race road's distance there; every kink (a run's heading
// turning more than KINK_DEG between its neighbours a metre or two either side) and every jog (a
// point standing more than JOG_M off the line through its neighbours JOG_SPAN points either side).
// node tools/scratch/_barrierends.mjs <level> [level...]
import * as L from '../../src/lab.ts';
import { portalCorners } from '../../src/world/venuecross.ts';

// m: an end this near another barrier or a portal's corner meets it
const MEET_M = 0.5;
// a kink: the heading turns this much (deg) over KINK_SPAN points either side; a jog: a point this
// far (m) off the chord through its neighbours JOG_SPAN points either side
const KINK_DEG = 25, KINK_SPAN = 2, JOG_M = 0.35, JOG_SPAN = 3;
const segDist = (pts, x, y) => {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay;
    const share = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * share, y - ay - dy * share));
  }
  return best;
};
for (const levelId of process.argv.slice(2)) {
  L.setLevel(levelId);
  const bars = L.LEVEL.barriers.filter((bar) => bar.kind !== 'line'), sub = L.LEVEL.subtrack;
  const corners = L.LEVEL.props.filter((prop) => prop.kind === 'tunnel' && prop.track)
    .flatMap(portalCorners);
  let free = 0, kinks = 0, jogs = 0;
  bars.forEach((bar, index) => {
    for (const [x, y] of [bar.pts[0], bar.pts[bar.pts.length - 1]]) {
      const onCorner = corners.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < MEET_M);
      let nearest = Infinity, nearestIndex = -1;
      bars.forEach((other, otherIndex) => {
        if (otherIndex === index) return;
        const gap = segDist(other.pts, x, y);
        if (gap < nearest) [nearest, nearestIndex] = [gap, otherIndex];
      });
      if (onCorner || nearest < MEET_M) continue;
      free++;
      console.log(`${levelId} FREE END ${bar.kind} ${index} at ${x.toFixed(1)},${y.toFixed(1)}:`
        + ` nearest barrier ${nearestIndex} ${nearest.toFixed(1)} m, road centre`
        + ` ${L.querySubtrack(sub, x, y).dist.toFixed(1)} m`);
    }
    const pts = bar.pts;
    for (let i = Math.max(KINK_SPAN, JOG_SPAN); i + Math.max(KINK_SPAN, JOG_SPAN) < pts.length; i++) {
      const [ax, ay] = pts[i - KINK_SPAN], [bx, by] = pts[i], [cx, cy] = pts[i + KINK_SPAN];
      const turn = Math.abs(Math.atan2((bx - ax) * (cy - by) - (by - ay) * (cx - bx),
        (bx - ax) * (cx - bx) + (by - ay) * (cy - by))) * 180 / Math.PI;
      const [px, py] = pts[i - JOG_SPAN], [qx, qy] = pts[i + JOG_SPAN];
      const chord = Math.hypot(qx - px, qy - py) || 1;
      const off = Math.abs((qx - px) * (py - by) - (px - bx) * (qy - py)) / chord;
      // (a real bend's sagitta over the chord is allowed: a 10 m radius over a 6 m chord, 0.45 m)
      const bend = chord * chord / (8 * 10);
      if (turn > KINK_DEG) kinks++;
      else if (off > Math.max(JOG_M, bend)) jogs++;
    }
  });
  console.log(`${levelId}: ${bars.length} barriers, ${free} free ends, ${kinks} kink points,`
    + ` ${jogs} jog points`);
}
