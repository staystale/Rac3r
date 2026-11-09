// _fenceroom.mjs - HOW MUCH ROOM BEHIND THE CATCH FENCES (the start crash review): along every
// catch fence, every 4 m, how far behind it - along the road's normal - the first solid stands
// (a grandstand, a building), m; and the fence's own distance past the road's edge.
// [SILLYSTONE=1] node tools/scratch/_fenceroom.mjs [level]
import * as L from '../../src/lab.ts';
const lv = process.argv[2] || 'sillystone';
L.setLevel(lv);
const sub = L.LEVEL.subtrack, half = sub.width / 2;
const inSolid = (x, y) => (L.LEVEL.solids || []).find((s) => {
  if (!s.w || !s.h || /gantry|footbridge|bridge|marshal|tree/.test(s.kind || '')) return false;
  const c = Math.cos(-(s.rot || 0)), sn = Math.sin(-(s.rot || 0)), dx = x - s.x, dy = y - s.y;
  return Math.abs(dx * c - dy * sn) < s.w / 2 && Math.abs(dx * sn + dy * c) < s.h / 2;
});
const rows = [];
for (const b of L.LEVEL.barriers || []) {
  if (b.kind !== 'catchfence') continue;
  for (let i = 0; i < b.pts.length; i += 2) {
    const [x, y] = b.pts[i], q = L.querySubtrack(sub, x, y);
    if (q.dist > half + 30) continue;
    const c = L.onTrack(sub, q.trackDist, 0, {}), ux = (x - c.x) / (q.dist || 1), uy = (y - c.y) / (q.dist || 1);
    let room = 0;
    while (room < 40 && !inSolid(x + ux * room, y + uy * room)) room += 0.5;
    rows.push({ past: q.dist - half, room, kind: room < 40 ? (inSolid(x + ux * room, y + uy * room).kind) : '-' });
  }
}
const hist = {};
for (const r of rows) { const k = r.room >= 40 ? '40+' : String(Math.floor(r.room / 5) * 5); hist[k] = (hist[k] || 0) + 1; }
console.log(lv, 'catch fence points', rows.length, '(about', rows.length * 4, 'm )');
console.log('fence past the edge, m: min', Math.min(...rows.map((r) => r.past)).toFixed(1), 'median',
  rows.map((r) => r.past).sort((a, b) => a - b)[rows.length >> 1].toFixed(1));
console.log('room behind it to the first solid (5 m bins):', JSON.stringify(hist));
const kinds = {};
for (const r of rows) if (r.room < 40) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
console.log('first solid behind:', JSON.stringify(kinds));
