// _moyachts.mjs - Moanaco's yachts (real m): moored stern-to along the harbour's quays where they
// face the circuit (the aerial photographs: superyachts along the Quai des Etats-Unis by Tabac and
// the quay by the swimming pool), every BERTH m, LEN m long by its beam, wholly in the water and
// clear of the next; printed as the spec's landmarks (scratch)
const { MOANACO_VENUE: data } = await import('../../src/world/levels/venues/moanaco.ts');
const ring = data.water.find((lake) => lake.name === 'Port Hercule').pts;
const race = data.pieces.flatMap((piece) => piece.pts.flatMap(([x, y], i) => { const next = piece.pts[i + 1]; if (!next) return [[x, y]]; const len = Math.hypot(next[0] - x, next[1] - y), out = []; for (let t = 0; t < len; t += 3) out.push([x + (next[0] - x) * t / len, y + (next[1] - y) * t / len]); return out; }));
const inside = (x, y) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
const nearTrack = (x, y, reach) => race.some(([px, py]) => Math.hypot(px - x, py - y) < reach);
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const out = [], boxes = [];
const BERTH = 10, REACH = 120, CLEAR = 22;
for (let i = 0; i + 1 < ring.length; i++) {
  const [ax, ay] = ring[i], [bx, by] = ring[i + 1], len = Math.hypot(bx - ax, by - ay);
  if (len < 25) continue;
  const dirX = (bx - ax) / len, dirY = (by - ay) / len;
  let nx = -dirY, ny = dirX;
  const midX = (ax + bx) / 2, midY = (ay + by) / 2;
  if (!inside(midX + nx * 3, midY + ny * 3)) { nx = -nx; ny = -ny; }
  for (let along = BERTH / 2; along < len - BERTH / 2; along += BERTH) {
    const yachtLen = 24 + Math.round(rand() * 26), beam = Math.round(yachtLen * 0.2);
    const qx = ax + dirX * along, qy = ay + dirY * along;
    if (!nearTrack(qx, qy, REACH)) continue;
    const cx = qx + nx * (yachtLen / 2 + 2), cy = qy + ny * (yachtLen / 2 + 2);
    const rot = Math.atan2(ny, nx);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [cx + Math.cos(rot) * u * yachtLen / 2 - Math.sin(rot) * v * beam / 2, cy + Math.sin(rot) * u * yachtLen / 2 + Math.cos(rot) * v * beam / 2]);
    if (!corners.every(([x, y]) => inside(x, y))) continue;
    // (none within CLEAR real m of the lap: the edge's barrier keeps off every building)
    if (corners.some(([x, y]) => nearTrack(x, y, CLEAR))) continue;
    // (nor on a mapped building over the water: a pier's)
    const onBuilding = ([x, y]) => data.buildings.some((box) => { const dx = x - box.x, dy = y - box.y; return Math.abs(dx * Math.cos(box.rot) + dy * Math.sin(box.rot)) < box.w / 2 + 3 && Math.abs(-dx * Math.sin(box.rot) + dy * Math.cos(box.rot)) < box.h / 2 + 3; });
    if ([...corners, [cx, cy]].some(onBuilding)) continue;
    // (no two overlapping, a metre apart: separating axes of the two boxes)
    const axes = (box) => [[Math.cos(box.rot), Math.sin(box.rot)], [-Math.sin(box.rot), Math.cos(box.rot)]];
    const span = (box, [ux, uy]) => { const proj = box.corners.map(([x, y]) => x * ux + y * uy); return [Math.min(...proj), Math.max(...proj)]; };
    const mine = { rot, corners };
    const overlaps = (other) => [...axes(mine), ...axes(other)].every((axis) => { const [a0, a1] = span(mine, axis), [b0, b1] = span(other, axis); return a1 + 1 > b0 && b1 + 1 > a0; });
    if (boxes.some(overlaps)) continue;
    boxes.push(mine);
    out.push(`    { at: [${Math.round(cx)}, ${Math.round(cy)}], kind: 'yacht', size: ${beam}, len: ${yachtLen}, rot: ${rot.toFixed(2)} },`);
  }
}
console.log(out.join('\n'));
console.error(out.length, 'yachts');
