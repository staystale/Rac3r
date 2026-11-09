// _gridroom.mjs - DOES THE GRID FIT ON THE START STRAIGHT (the start crash review, owner 11-09:
// "a lot of crashes on silver stone"; "maybe check that for tight spot n silly crashes too"): for
// every venue layout, how far back from the start line the road runs before it bends tighter than
// BEND_R (the grid's 20 cars need 19 slots x GRID_STEP behind pole), and the run to the first bend.
// [BEND_R=150] SILLYSTONE=1 node tools/scratch/_gridroom.mjs [ids,comma]
import * as L from '../../src/lab.ts';
const BEND_R = +(process.env.BEND_R || 150), SPAN = 10;
const only = process.argv[2] ? process.argv[2].split(',') : null;
const radiusAt = (sub, dist) => {
  const at = (d) => L.onTrack(sub, ((d % sub.totalDist) + sub.totalDist) % sub.totalDist, 0, {});
  const a = at(dist - SPAN), b = at(dist + SPAN);
  const turn = Math.atan2(Math.sin(b.rot - a.rot), Math.cos(b.rot - a.rot));
  return { r: Math.abs(turn) > 1e-4 ? 2 * SPAN / Math.abs(turn) : Infinity, sign: Math.sign(turn) };
};
for (const level of L.LEVELS) {
  if (only ? !only.includes(level.id) : !level.venue && !['thruston', 'test-track', 'knobhill'].includes(level.id)) continue;
  L.setLevel(level.id);
  const sub = L.LEVEL.subtrack, spawn = L.LEVEL.spawn;
  if (!sub || L.LEVEL.endless) continue;
  const start = L.querySubtrack(sub, spawn.x, spawn.y).trackDist;
  let back = 0, ahead = 0, tight = Infinity;
  while (back < 400 && radiusAt(sub, start - back).r > BEND_R) back++;
  while (ahead < 800 && radiusAt(sub, start + ahead).r > BEND_R) ahead++;
  for (let d = back; d < 140; d++) tight = Math.min(tight, radiusAt(sub, start - d).r);
  console.log(`${level.id.padEnd(24)} straight behind the line ${String(back).padStart(3)} m`
    + ` (grid of 20 needs 133)  ahead to the first bend ${String(ahead).padStart(3)} m`
    + (back < 133 ? `  tightest under the grid R${tight.toFixed(0)}` : ''));
}
