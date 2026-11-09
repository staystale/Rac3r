// _leglanes.mjs - the start gantry's legs against the lanes (the pit lane, the service roads): how
// far each leg's box stands from the nearest lane's edge, m (negative: on it).
// [RUNOFF=1] [SILLYSTONE=1 OULTONPORK=1] node tools/scratch/_leglanes.mjs [levels,comma]
import * as L from '../../src/lab.ts';
const ids = (process.argv[2] || 'brands-snatch,snotterton,dongington,castle-cum,sillystone,oultonpork').split(',');
const seg = (pts, x, y) => {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
};
for (const id of ids) {
  L.setLevel(id);
  const g = (L.LEVEL.props || []).find((p) => p.kind === 'gantry');
  if (!g) { console.log(id, 'no gantry'); continue; }
  const c = Math.cos(g.rot), s = Math.sin(g.rot);
  const out = [-1, 1].map((side) => {
    const x = g.x + c * side * g.wid / 2, y = g.y + s * side * g.wid / 2;
    const lane = Math.min(...(L.LEVEL.lanes || []).map((ln) => seg(ln.pts, x, y) - (ln.width || 6) / 2));
    const wall = Math.min(...(L.LEVEL.barriers || []).map((b) => seg(b.pts, x, y)));
    return `leg ${side}: lane edge ${lane.toFixed(1)} m, barrier ${wall.toFixed(1)} m`;
  });
  console.log(id.padEnd(14), 'wid', g.wid.toFixed(1), 'podX', (g.podX || 0).toFixed(1), ' ', out.join('   '));
}
