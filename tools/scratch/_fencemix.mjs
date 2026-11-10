// _fencemix.mjs - THE WORLD CIRCUITS' EDGE BY KIND (?fences=1: world/venuefences.ts): each level
// built in node, its barriers' m by kind (armco, catchfence, woodfence ...), and the share of the
// lap's two sides with nothing within 30 m (open run-off). (The mix passed 11-10: always on now.)
// [FENCES=1] node tools/scratch/_fencemix.mjs [level,level...]
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
const ids = (process.argv[2] || 'spa,monza,nordschlep,lemans,suzuka').split(',');
const len = (pts) => pts.slice(1).reduce((sum, pt, i) => sum + Math.hypot(pt[0] - pts[i][0],
  pt[1] - pts[i][1]), 0);
for (const id of ids) {
  const entry = LEVELS.find((level) => level.id === id);
  if (!entry) { console.log(id, 'not listed (its switch?)'); continue; }
  const level = buildLevel(entry);
  const by = {};
  for (const barrier of level.barriers || []) {
    const pts = barrier.pts.map((pt) => (Array.isArray(pt) ? pt : [pt.x, pt.y]));
    by[barrier.kind] = (by[barrier.kind] || 0) + len(pts);
  }
  const edge = ['armco', 'catchfence', 'woodfence'].reduce((sum, kind) => sum + (by[kind] || 0), 0);
  // open: lap samples every 10 m each side with no armco / fence within 30 m out
  const sub = level.subtrack, fences = (level.barriers || []).filter((b) => ['armco', 'catchfence',
    'woodfence', 'wall', 'jersey', 'pitwall'].includes(b.kind)).map((b) => b.pts.map((pt) =>
    (Array.isArray(pt) ? pt : [pt.x, pt.y])));
  let open = 0, all = 0;
  for (let dist = 0; dist < sub.totalDist; dist += 10) {
    const i = sub.pts.findIndex((pt) => pt.dist >= dist);
    const pt = sub.pts[Math.max(0, i)], next = sub.pts[Math.min(sub.pts.length - 1, i + 1)];
    const hx = next.x - pt.x, hy = next.y - pt.y, hl = Math.hypot(hx, hy) || 1;
    for (const side of [1, -1]) {
      all++;
      const nx = -hy / hl * side, ny = hx / hl * side;
      let hit = false;
      for (let out = 6; out <= 36 && !hit; out += 1.5) {
        const x = pt.x + nx * out, y = pt.y + ny * out;
        hit = fences.some((line) => line.some((p, k) => k > 0 && segDist(x, y, line[k - 1], p) < 1));
      }
      if (!hit) { open++; if (process.env.OPENAT) (globalThis.at ||= []).push((side > 0 ? 'L' : 'R') + dist); }
    }
  }
  console.log(`${id}: ` + ['armco', 'catchfence', 'woodfence'].map((kind) => `${kind} ${Math.round(by[kind]
    || 0)} m (${Math.round((by[kind] || 0) / edge * 100)}%)`).join(', ') + ` | open run-off ${(open
    / all * 100).toFixed(1)}% of the sides`);
  if (process.env.OPENAT) { console.log('  open at', (globalThis.at || []).join(' ')); globalThis.at = []; }
}
function segDist(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}
