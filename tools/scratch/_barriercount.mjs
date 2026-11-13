// throwaway: per car position, how many barriers are met and how many segments walked vs in box
import * as L from '../../src/lab.ts';
import { LEVEL } from '../../src/world/state.ts';
import { BARRIER_HALF, prepBarriersOf } from '../../src/world/barriers.ts';
const LEN = 4.5;
for (const id of (process.argv[2] || 'spa,sillystone,suzuka,lemans,brands-snatch,xgayms').split(',')) {
  L.setLevel(id);
  prepBarriersOf(LEVEL);
  const list = LEVEL.barriers || [], sub = LEVEL.subtrack;
  const boxes = list.map((b) => {
    let a = Infinity, c = Infinity, d = -Infinity, e = -Infinity;
    for (const s of b._segs || []) { a = Math.min(a, s.minX); c = Math.min(c, s.minY); d = Math.max(d, s.maxX); e = Math.max(e, s.maxY); }
    return [a, c, d, e];
  });
  let calls = 0, met = 0, walked = 0, inBox = 0;
  for (let i = 0; i < sub.pts.length; i += 2) {
    const p = sub.pts[i];
    for (const off of [-4, 0, 4]) {
      const x = p.x + p.nx * off, y = p.y + p.ny * off;
      calls++;
      list.forEach((b, k) => {
        if (!BARRIER_HALF[b.kind] || !b._segs) return;
        const bb = boxes[k];
        if (x < bb[0] - LEN || x > bb[2] + LEN || y < bb[1] - LEN || y > bb[3] + LEN) return;
        met++;
        for (const s of b._segs) {
          walked++;
          if (!(x < s.minX - LEN || x > s.maxX + LEN || y < s.minY - LEN || y > s.maxY + LEN)) inBox++;
        }
      });
    }
  }
  const segs = list.reduce((n, b) => n + (b._segs ? b._segs.length : 0), 0);
  console.log(`${id}: barriers ${list.length}, segs ${segs} | per call: met ${(met / calls).toFixed(1)}, segs walked ${(walked / calls).toFixed(0)}, in box ${(inBox / calls).toFixed(1)}`);
}
