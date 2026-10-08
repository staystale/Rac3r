// propcheck.mjs — no SOLID prop on any road, on EVERY level (user, 2026-10-04: a truck across Brands GP, a hut across the road at Druids).
// Samples each solid box (LEVEL.solids) on a 1 m grid; reports any sample inside the road (half width - 0.5). Gantries / footbridges
// span the road by design and are skipped. node tools/propcheck.mjs
import * as L from '../src/lab.js';
let bad = 0;
for (const lv of L.LEVELS) {
  L.setLevel(lv.id); const st = L.LEVEL.subtrack; if (!st) continue; const hw = st.width / 2, hits = [];
  for (const b of L.LEVEL.solids || []) {
    if (b.kind === 'gantry' || b.kind === 'footbridge') continue;
    const c = Math.cos(b.rot), s = Math.sin(b.rot); let hit = false;
    for (let u = -b.w / 2; u <= b.w / 2 + 1e-6 && !hit; u += Math.min(1, b.w / 2 || 1)) for (let v = -b.h / 2; v <= b.h / 2 + 1e-6 && !hit; v += Math.min(1, b.h / 2 || 1))
      if (L.querySubtrack(st, b.x + c * u - s * v, b.y + s * u + c * v).dist < hw - 0.5) hit = true;
    if (hit) hits.push(b.kind);
  }
  if (hits.length) bad += hits.length;
  console.log((hits.length ? 'FAIL ' : 'OK   ') + lv.id.padEnd(20), hits.length ? hits.join(' ') : '');
}
console.log(bad ? `FAILED: ${bad} solid props on a road` : 'props: all clear of the road');
