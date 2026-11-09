// _gantryline.mjs - WHAT LIES ALONG A START GANTRY'S SPAN, each side of the road out to 40 m: the
// raced road's distance, the nearest lane's edge (pit lanes, service roads), the nearest barrier.
// [SWITCH=1] node tools/scratch/_gantryline.mjs [level]
import * as L from '../../src/lab.ts';
const lv = process.argv[2] || 'anglesleazy';
L.setLevel(lv);
const sub = L.LEVEL.subtrack, g = L.LEVEL.props.find((p) => p.kind === 'gantry');
const s = L.onTrack(sub, 2, 0, {}), ax = Math.cos(g.rot), ay = Math.sin(g.rot);
const seg = (pts, x, y) => { let b = Infinity; for (let i = 0; i < pts.length - 1; i++) { const [a1, a2] = pts[i], [b1, b2] = pts[i + 1], dx = b1 - a1, dy = b2 - a2, t = Math.max(0, Math.min(1, ((x - a1) * dx + (y - a2) * dy) / (dx * dx + dy * dy || 1))); b = Math.min(b, Math.hypot(x - a1 - dx * t, y - a2 - dy * t)); } return b; };
for (const side of [1, -1]) {
  const row = [];
  for (let out = 7; out <= 40; out += 3) {
    const x = s.x + ax * side * out, y = s.y + ay * side * out;
    const lane = Math.min(...(L.LEVEL.lanes || []).map((ln) => seg(ln.pts, x, y) - (ln.width || 6) / 2));
    const bar = Math.min(...(L.LEVEL.barriers || []).map((b) => seg(b.pts, x, y)));
    row.push(`${out}: road ${L.querySubtrack(sub, x, y).dist.toFixed(0)} lane ${lane.toFixed(1)} bar ${bar.toFixed(1)}`);
  }
  console.log('side', side, '\n  ' + row.join('\n  '));
}
