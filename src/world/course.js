// ---------------------------------------------------------------------------------------------
// THE COURSE. A lap you can actually drive, marked out in cones on the big floor — data, so moving a
// corner is a number in this file and not a refactor (CLAUDE.md §6).
//
// Laid as a centreline of corner apexes; the gates are generated from it, so the shape can be edited
// as a path rather than by placing 80 cones by hand. Clockwise from the start box.
export const COURSE = [
  [   0,  -30], [  95,  -55], [ 170, -120], [ 190, -200],   // long right-hand sweep up the east side
  [ 140, -235], [  60, -225], [  10, -175],                 // tight hairpin at the top
  [ -60, -190], [-130, -215], [-195, -180],                 // esses heading west
  [-215, -100], [-185,  -30], [-205,   50],                 // fast left down the west side
  [-160,  120], [ -80,  145], [   0,  125],                 // wide bottom sweep
  [  70,  150], [ 140,  120], [ 165,   50],                 // second hairpin, south-east
  [ 120,   10], [  55,    5],                               // short chicane back onto the straight
];
export const GATE = 11;         // m between the two cones of a gate — wide enough to take at speed
export const GATE_SPACING = 13; // m along the path between gates. 26 m left the course reading as scattered
                         // cones rather than a track (user: "needs more cones or it is confusing"), so
                         // the gates are twice as dense. The path is resampled, so this is one number.
// Catmull-Rom through the apexes, so the course is a smooth closed loop rather than a polygon, then
// resampled at a fixed spacing. Editing the shape means moving an apex in COURSE — nothing else.
export function smoothPath(pts, perSeg = 24) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * ((2*p1[0]) + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
        0.5 * ((2*p1[1]) + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3),
      ]);
    }
  }
  return out;
}
