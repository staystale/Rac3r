import { parkMiller } from "../../core/random.ts";
import { alongTrack, smoothOnTrack } from "../barriers.js";
import { FLOOR } from "../bounds.js";
import { onTrack, querySubtrack } from "../tyrewall.js";
export const ss01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// TRACK KIT (2026-10-04, written for Castle Cum after doing Thruston by hand): decorate a traced circuit by DISTANCE + OFFSET
// (+ = right of travel; on a clockwise lap that is the INSIDE). Everything generated is filtered off the road, off the given
// lanes and inside the floor — the Thruston lesson: an outside offset on the inside of a left-hander lands on the track.
export function trackKit(sub, seed, lanes = []) {
  const rnd = parkMiller(seed);
  const at = (d, off) => smoothOnTrack(sub, d, off);
  const rot = (d) => onTrack(sub, ((d % sub.totalDist) + sub.totalDist) % sub.totalDist, 0, {}).rot;
  const prop = (d, off, o) => ({ ...o, ...at(d, off), rot: rot(d) + (o.rot || 0) });
  const onLane = (x, y, pad) => lanes.some((ln) => ln.pts.some(([ax, ay], i) => { const q = ln.pts[i + 1]; if (!q) return false;
    const dx = q[0] - ax, dy = q[1] - ay, l2 = dx * dx + dy * dy || 1e-6; let t = ((x - ax) * dx + (y - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(x - ax - dx * t, y - ay - dy * t) <= ln.width / 2 + pad; }));
  const clear = (x, y, reach) => querySubtrack(sub, x, y).dist >= sub.width / 2 + reach && Math.abs(x) < FLOOR - 6 - reach && Math.abs(y) < FLOOR - 6 - reach && !onLane(x, y, reach);
  const span = (d0, d1) => ((d1 - d0) + sub.totalDist) % sub.totalDist;
  // earth bank = humps every 4 m (at 10 m they photographed as separate blobs)
  const bank = (d0, d1, off, r, h) => { const out = []; for (let t = 0; t <= span(d0, d1); t += 4) { const p = at(d0 + t, off); if (clear(p.x, p.y, r + 2)) out.push({ kind: 'hump', x: p.x, y: p.y, r, h }); } return out; };
  const along = (d0, d1, off, step) => alongTrack(sub, d0, d1, off, step);
  return { rnd, at, rot, prop, clear, span, bank, along, onLane };
}
