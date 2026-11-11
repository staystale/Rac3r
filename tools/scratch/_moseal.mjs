// _moseal.mjs - IS THE VENUE SEALED: a flood fill from the start over the ground (0.75 m cells),
// stopped by every barrier and every solid box, each grown by 0.9 m (half a car); a cell reached further than
// FAR m from the race road and off every lane is an escape - reported by 15 m block with the cell
// nearest the track (where the fill got out). node tools/scratch/_moseal.mjs <level> (scratch)
import { pathToFileURL } from 'node:url';
const root = process.cwd().split(String.fromCharCode(92)).join('/');
const L = await import(pathToFileURL(root + '/src/lab.ts').href);
const { onGroundQuery } = await import(pathToFileURL(root + '/src/world/tyrewall.ts').href);
L.setLevel(process.argv[2]);
const lv = L.LEVEL, sub = lv.subtrack, CELL = 0.75, FAR = +(process.env.FAR || 18);
const { x0, y0, x1, y1 } = lv.bounds;
const cols = Math.ceil((x1 - x0) / CELL), rows = Math.ceil((y1 - y0) / CELL);
const blocked = new Uint8Array(cols * rows);
const mark = (x, y) => { const c = Math.floor((x - x0) / CELL), r = Math.floor((y - y0) / CELL); if (c >= 0 && r >= 0 && c < cols && r < rows) blocked[r * cols + c] = 1; };
for (const bar of lv.barriers) {
  if (bar.kind === 'line') continue;
  for (let i = 0; i + 1 < bar.pts.length; i++) {
    const [ax, ay] = bar.pts[i], [bx, by] = bar.pts[i + 1], len = Math.hypot(bx - ax, by - ay);
    for (let t = 0; t <= len; t += 0.25) for (const ox of [-0.9, -0.45, 0, 0.45, 0.9]) for (const oy of [-0.9, -0.45, 0, 0.45, 0.9]) mark(ax + (bx - ax) * t / len + ox, ay + (by - ay) * t / len + oy);
  }
}
for (const solid of lv.solids || []) {
  const c = Math.cos(solid.rot || 0), s = Math.sin(solid.rot || 0);
  for (let u = -solid.w / 2 - 0.9; u <= solid.w / 2 + 0.9; u += 0.3) for (let v = -solid.h / 2 - 0.9; v <= solid.h / 2 + 0.9; v += 0.3) mark(solid.x + c * u - s * v, solid.y + s * u + c * v);
}
const onLane = (x, y) => (lv.lanes || []).some((lane) => lane.pts.some(([ax, ay], i) => { const q = lane.pts[i + 1]; if (!q) return false; const dx = q[0] - ax, dy = q[1] - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(ax + dx * t - x, ay + dy * t - y) < lane.width / 2 + 2; }));
const seen = new Uint8Array(cols * rows), parent = new Int32Array(cols * rows).fill(-1), queue = [];
const start = sub.pts[0];
const startCell = Math.floor((start.y - y0) / CELL) * cols + Math.floor((start.x - x0) / CELL);
queue.push(startCell); seen[startCell] = 1;
const escapes = new Map();
while (queue.length) {
  const cell = queue.pop(), c = cell % cols, r = (cell - c) / cols;
  const x = x0 + (c + 0.5) * CELL, y = y0 + (r + 0.5) * CELL;
  const hit = onGroundQuery(() => L.querySubtrack(sub, x, y));
  if (hit.dist > FAR && !onLane(x, y)) {
    const key = `${Math.round(x / 15) * 15},${Math.round(y / 15) * 15}`;
    const was = escapes.get(key);
    if (!was || hit.dist < was.d) escapes.set(key, { x, y, d: hit.dist, at: hit.trackDist, cell });
    continue;
  }
  for (const next of [cell - 1, cell + 1, cell - cols, cell + cols]) {
    if (next < 0 || next >= cols * rows || seen[next] || blocked[next]) continue;
    seen[next] = 1; parent[next] = cell; queue.push(next);
  }
}
const list = [...escapes.values()].sort((a, b) => a.at - b.at);
// where each got out: walking back to the start, the last cell within 9.5 m of the road
const gaps = new Map(), paths = [];
for (const e of list) {
  let cell = e.cell, out = null;
  const path = [];
  for (let guard = 0; cell >= 0 && guard < 1e6; guard++) {
    const c = cell % cols, r = (cell - c) / cols, x = x0 + (c + 0.5) * CELL, y = y0 + (r + 0.5) * CELL;
    path.push([x, y]);
    const hit = onGroundQuery(() => L.querySubtrack(sub, x, y));
    if (hit.dist < 9.5) { out = { x, y, at: hit.trackDist }; break; }
    cell = parent[cell];
  }
  paths.push({ pts: path, col: '#ff0000' });
  if (out) gaps.set(`${Math.round(out.x / 4) * 4},${Math.round(out.y / 4) * 4}`, out);
}
for (const g of gaps.values()) console.log(`gap near ${g.x.toFixed(1)},${g.y.toFixed(1)} lap m ${g.at.toFixed(0)}`);
for (const e of list.slice(0, 40)) console.log(`escape at ${e.x.toFixed(0)},${e.y.toFixed(0)} ${e.d.toFixed(0)} m off, lap m ${e.at.toFixed(0)}`);
console.log(`${process.argv[2]}: ${list.length} escape blocks`);

if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify(paths.slice(0, 3)));
