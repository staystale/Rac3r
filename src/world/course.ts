// ---------------------------------------------------------------------------------------------
// THE COURSE. A lap you can actually drive, marked out in cones on the big floor — data, so moving
// a corner is a number in this file and not a refactor (CLAUDE.md §6).
//
// Laid as a centreline of corner apexes; the gates are generated from it, so the shape can be
// edited as a path rather than by placing 80 cones by hand. Clockwise from the start box.
import type { Point } from "./types.ts";

export const COURSE: Point[] = [
  // long right-hand sweep up the east side
  [   0,  -30], [  95,  -55], [ 170, -120], [ 190, -200],
  [ 140, -235], [  60, -225], [  10, -175],                 // tight hairpin at the top
  [ -60, -190], [-130, -215], [-195, -180],                 // esses heading west
  [-215, -100], [-185,  -30], [-205,   50],                 // fast left down the west side
  [-160,  120], [ -80,  145], [   0,  125],                 // wide bottom sweep
  [  70,  150], [ 140,  120], [ 165,   50],                 // second hairpin, south-east
  [ 120,   10], [  55,    5],                               // short chicane back onto the straight
];
export const GATE = 11;         // m between the two cones of a gate — wide enough to take at speed
// m along the path between gates. 26 m left the course reading as scattered cones rather than a
// track (requirement: needs more cones or it is confusing), so the gates are twice as dense. The
// path is resampled, so this is one number.
export const GATE_SPACING = 13;
// Catmull-Rom through the apexes, so the course is a smooth closed loop rather than a polygon,
// then resampled at a fixed spacing. Editing the shape means moving an apex in COURSE — nothing
// else.
export function smoothPath(pts: Point[], perSeg = 24): Point[] {
  const out: Point[] = [];
  const pointCount = pts.length;
  for (let i = 0; i < pointCount; i++) {
    const before = pts[(i - 1 + pointCount) % pointCount];
    const start = pts[i];
    const end = pts[(i + 1) % pointCount];
    const after = pts[(i + 2) % pointCount];
    for (let j = 0; j < perSeg; j++) {
      const along = j / perSeg;
      const alongSq = along * along;
      const alongCube = alongSq * along;
      out.push([
        0.5 * ((2*start[0]) + (-before[0]+end[0])*along
          + (2*before[0]-5*start[0]+4*end[0]-after[0])*alongSq
          + (-before[0]+3*start[0]-3*end[0]+after[0])*alongCube),
        0.5 * ((2*start[1]) + (-before[1]+end[1])*along
          + (2*before[1]-5*start[1]+4*end[1]-after[1])*alongSq
          + (-before[1]+3*start[1]-3*end[1]+after[1])*alongCube),
      ]);
    }
  }
  return out;
}
