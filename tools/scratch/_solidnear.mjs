// _solidnear.mjs - SOLIDS NEAR THE ROAD (the start crash review, owner 11-09: "check that for tight
// spot n silly crashes too"): every solid box (LEVEL.solids: trees' trunks, parked cars, marshal
// posts, buildings ...) and lamp post whose nearest corner or edge point stands within REACH m past
// the raced road's edge, by kind, with where along the lap from the start line and how far.
// [SWITCH=1] node tools/scratch/_solidnear.mjs [level] [reach m, 5]
import * as L from '../../src/lab.ts';
import { activeLamps } from '../../src/world/lamps.ts';

const [lv = 'oultonpork', reachArg = '5'] = process.argv.slice(2);
L.setLevel(lv);
const sub = L.LEVEL.subtrack, half = sub.width / 2, reach = +reachArg, total = sub.totalDist;
const spawnDist = L.querySubtrack(sub, L.LEVEL.spawn.x, L.LEVEL.spawn.y).trackDist;
const near = [];
const lampBoxes = activeLamps().map((lamp) => ({ ...lamp.solid, kind: 'lamp' }));
for (const solid of [...(L.LEVEL.solids || []), ...lampBoxes]) {
  if (solid.kind === 'gantry' || solid.kind === 'footbridge') continue;
  const cosR = Math.cos(solid.rot || 0), sinR = Math.sin(solid.rot || 0);
  let best = { gap: Infinity, along: 0 };
  // the box's edge sampled every 0.5 m
  for (const [u0, v0, u1, v1] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]])
    for (let t = 0; t <= 1.0001; t += 0.5 / Math.max(1, solid.w, solid.h)) {
      const u = (u0 + (u1 - u0) * t) * solid.w / 2, v = (v0 + (v1 - v0) * t) * solid.h / 2;
      const hit = L.querySubtrack(sub, solid.x + cosR * u - sinR * v, solid.y + sinR * u + cosR * v);
      if (hit.dist - half < best.gap) best = { gap: hit.dist - half, along: hit.trackDist };
    }
  if (best.gap < reach)
    near.push({ kind: solid.kind || 'solid', gap: best.gap,
      lap: ((best.along - spawnDist) % total + total) % total });
}
const kinds = {};
for (const item of near) kinds[item.kind] = (kinds[item.kind] || 0) + 1;
console.log(`${lv}: ${near.length} solids within ${reach} m of the road's edge ${JSON.stringify(kinds)}`);
for (const item of near.sort((a, b) => a.gap - b.gap).slice(0, 20))
  console.log(`  ${item.kind} ${item.gap.toFixed(1)} m past the edge at ${item.lap.toFixed(0)} m`);
