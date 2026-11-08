// _reach.mjs - which crossing ends a car can drive to from the grid: a flood over 1 m cells of the
// level's ground, a cell shut when a car's half width (1 m) would touch a barrier or a solid box.
// Prints each crossing end reachable or not, and writes the reached cells' box.
// CROSSINGS=1 node tools/scratch/_reach.mjs <level>
import * as L from '../../src/lab.ts';
import { alongOf } from '../../src/world/crossinggeo.ts';

const levelId = process.argv[2] || 'brands-snatch';
L.setLevel(levelId);
const lv = L.LEVEL, CELL = 1, PAD = 1.0;
const box = lv.bounds;
const cols = Math.ceil((box.x1 - box.x0) / CELL), rows = Math.ceil((box.y1 - box.y0) / CELL);
const shut = new Uint8Array(cols * rows);
const mark = (x, y) => {
  const col = Math.floor((x - box.x0) / CELL), row = Math.floor((y - box.y0) / CELL);
  if (col >= 0 && row >= 0 && col < cols && row < rows) shut[row * cols + col] = 1;
};
// barriers: every cell within half thickness + PAD of a segment
for (const barrier of lv.barriers || []) {
  const half = (L.BARRIER_HALF?.[barrier.kind] ?? 0.3) + PAD;
  for (const seg of barrier._segs || []) {
    const len = Math.sqrt(seg.l2), steps = Math.ceil(len / 0.25);
    for (let i = 0; i <= steps; i++) {
      const px = seg.ax + seg.dx * i / steps, py = seg.ay + seg.dy * i / steps;
      for (let ox = -half; ox <= half; ox += 0.5) for (let oy = -half; oy <= half; oy += 0.5)
        if (ox * ox + oy * oy <= half * half) mark(px + ox, py + oy);
    }
  }
}
// solids: rotated boxes grown by PAD
for (const solid of lv.solids || []) {
  const cosR = Math.cos(solid.rot || 0), sinR = Math.sin(solid.rot || 0);
  const halfW = solid.w / 2 + PAD, halfH = solid.h / 2 + PAD;
  for (let along = -halfW; along <= halfW; along += 0.4)
    for (let across = -halfH; across <= halfH; across += 0.4)
      mark(solid.x + cosR * along - sinR * across, solid.y + sinR * along + cosR * across);
}
const seen = new Uint8Array(cols * rows), queue = [];
const start = lv.spawn, startCell = Math.floor((start.y - box.y0) / CELL) * cols
  + Math.floor((start.x - box.x0) / CELL);
seen[startCell] = 1;
queue.push(startCell);
while (queue.length) {
  const cell = queue.pop(), col = cell % cols, row = (cell - col) / cols;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nc = col + dc, nr = row + dr;
    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
    const next = nr * cols + nc;
    if (seen[next] || shut[next]) continue;
    seen[next] = 1;
    queue.push(next);
  }
}
let count = 0;
for (const value of seen) count += value;
console.log(`${levelId}: ${count} m2 reached of ${cols * rows}`);
const reached = (x, y) => {
  const col = Math.floor((x - box.x0) / CELL), row = Math.floor((y - box.y0) / CELL);
  return seen[row * cols + col] === 1;
};
(lv.crossings || []).forEach((way, index) => {
  for (const [name, along] of [['A', -3], ['B', way.length + 3]]) {
    const mid = (way.minAcross + way.maxAcross) / 2;
    const x = way.ax + way.dirX * along - way.dirY * mid, y = way.ay + way.dirY * along + way.dirX * mid;
    console.log(`${way.kind} ${index} end ${name} (${x.toFixed(0)}, ${y.toFixed(0)}):`
      + ` ${reached(x, y) ? 'reached' : 'NOT reached'}${shut[Math.floor((y - box.y0) / CELL) * cols
        + Math.floor((x - box.x0) / CELL)] ? ' (shut)' : ''}`);
  }
  void alongOf;
});
