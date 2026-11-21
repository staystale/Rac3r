// _labstart.mjs - ?labstart: what stands round the Lab's start spot (lamps, cones, bumps, boards,
// painted marks, props, solids, barriers) within a reach, nearest first, as metres ahead (+) /
// behind and left / right of the spot facing its heading - to choose an open spot with room to
// pull away. LABSTART=1 reads the switched spot. node tools/scratch/_labstart.mjs [reach m]
import * as L from '../../src/lab.ts';
import { activeLamps } from '../../src/world/lamps.ts';

const REACH = +(process.argv[2] || 40);
L.setLevel('lab');
const spawn = L.LEVEL.spawn, cos = Math.cos(spawn.heading), sin = Math.sin(spawn.heading);
const rows = [];
/**
 * Notes a thing if it is within the reach.
 * @param kind what it is
 * @param x world x, m
 * @param y world y, m
 */
function note(kind, x, y) {
  const dx = x - spawn.x, dy = y - spawn.y;
  if (Math.hypot(dx, dy) > REACH) return;
  rows.push({ kind, ahead: dx * cos + dy * sin, right: -(-dx * sin + dy * cos),
    dist: Math.hypot(dx, dy) });
}
for (const lamp of activeLamps()) note('lamp', lamp.x, lamp.y);
for (const cone of L.LEVEL.cones || []) note('cone ' + (cone.kind || ''), cone.x, cone.y);
for (const bump of L.LEVEL.bumps || []) note('bump', bump.x, bump.y);
for (const board of L.LEVEL.boards || []) note('board', board.x, board.y);
for (const mark of L.LEVEL.paint || []) note('paint ' + mark.kind, mark.x, mark.y);
for (const prop of L.LEVEL.props || []) note('prop ' + prop.kind, prop.x, prop.y);
for (const solid of L.LEVEL.solids || []) note('solid', solid.x ?? solid.cx, solid.y ?? solid.cy);
for (const barrier of L.LEVEL.barriers || []) for (const pt of barrier.pts || []) {
  note('barrier ' + barrier.kind, pt[0], pt[1]);
}
rows.sort((one, two) => one.dist - two.dist);
console.log(`the Lab's start ${JSON.stringify(spawn)}; within ${REACH} m:`);
for (const row of rows.slice(0, 40)) {
  console.log(`${row.kind.padEnd(16)} ${row.ahead.toFixed(1).padStart(6)} ahead `
    + `${row.right.toFixed(1).padStart(6)} right  (${row.dist.toFixed(1)} m)`);
}
