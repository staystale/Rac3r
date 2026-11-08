// _lanebench.mjs - laneAt over a level's whole ground on a 0.5 m grid (what painting its tiles
// asks): ms, and a checksum of the answers (the same answers before and after a change)
import * as L from '../../src/lab.ts';
import { laneAt } from '../../src/world/zones.ts';
const levelId = process.argv[2] || 'brands-snatch';
L.setLevel(levelId);
const box = L.LEVEL.bounds || { x0: -300, y0: -300, x1: 300, y1: 300 };
let sum = 0, hits = 0;
const t0 = performance.now();
for (let y = box.y0; y < box.y1; y += 0.5) for (let x = box.x0; x < box.x1; x += 0.5) {
  const surface = laneAt(x, y);
  if (surface) { hits++; sum = (sum * 31 + surface.id.length + Math.round(x * 7 + y * 13)) % 1e9; }
}
console.log(`${levelId}: ${(L.LEVEL.lanes || []).length} lanes, ${hits} hits, checksum ${sum},`
  + ` ${(performance.now() - t0).toFixed(0)} ms`);
