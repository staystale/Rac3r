// trackalong.ts - PATHS OFFSET FROM THE TRACK: a point and a polyline at an offset from the
// subtrack centreline (pit lanes, barriers, kerbs laid along it).
import type { Point, Subtrack } from "./types.ts";

// polyline offset from the subtrack centreline, startDist -> endDist (wrapping past the line),
// `step` metres apart; offset may be a function of the distance (pit-lane entry / exit ramps). + =
// the +normal side. INTERPOLATED point + SMOOTHED normal for paths offset from the track
// (photographed: the pit lane's edges wobbled). onTrack snaps to the sample before dist
// and uses that sample's own direction; at a 17 m offset the sample-to-sample jitter in direction
// became metres of sideways wobble. Here: position lerped between samples, normal averaged over +-4
// samples (~12 m).
export function smoothOnTrack(sub: Subtrack, dist: number, off: number): { x: number; y: number } {
  const pts = sub.pts, count = pts.length;
  dist = ((dist % sub.totalDist) + sub.totalDist) % sub.totalDist;
  let low = 0, high = count - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (pts[mid].dist <= dist) low = mid; else high = mid - 1;
  }
  const before = pts[low], after = pts[(low + 1) % count], seg = (after.dist > before.dist
      ? after.dist : sub.totalDist) - before.dist, frac = seg > 0 ? (dist - before.dist) / seg : 0;
  let nx = 0, ny = 0;
  for (let near = -4; near <= 4; near++) {
    const sample = pts[(low + near + count) % count];
    nx += sample.nx;
    ny += sample.ny;
  }
  const norm = Math.hypot(nx, ny) || 1;
  return { x: before.x + (after.x - before.x) * frac + (nx / norm) * off,
      y: before.y + (after.y - before.y) * frac + (ny / norm) * off };
}
export function alongTrack(
  sub: Subtrack, startDist: number, endDist: number,
  offset: number | ((t: number, len: number) => number), step = 4,
): Point[] {
  const total = sub.totalDist, pts: Point[] = [];
  let len = endDist - startDist;
  if (len < 0) len += total;
  for (let along = 0; along <= len + 1e-6; along += step) {
    const dist = (startDist + Math.min(along, len)) % total;
    const off = typeof offset === 'function' ? offset(along, len) : offset;
    const point = smoothOnTrack(sub, dist, off);
    pts.push([+point.x.toFixed(2), +point.y.toFixed(2)]);
  }
  return pts;
}
