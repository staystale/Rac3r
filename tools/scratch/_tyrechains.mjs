// _tyrechains.mjs - a level's tyre stacks as chains (stacks within LINK m of each other): each chain's
// count, span, box and nearest metres past the raced road's edge, bales beside it - the lone tyres,
// stubs and walls far from the road at a glance (world/venuetyres.ts).
// node tools/scratch/_tyrechains.mjs <level> [linkM]
import { pathToFileURL } from 'node:url';
const imp = (p) => import(pathToFileURL(process.cwd() + p).href);
const id = process.argv[2], LINK = +(process.argv[3] || 1.6);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const { buildLevel } = await imp('/src/world/load.ts');
const level = buildLevel(LEVELS.find((e) => e.id === id));
const sub = level.subtrack, half = sub.width / 2;
const stacks = level.cones.filter((c) => c.kind === 'tyrestack');
const bales = level.cones.filter((c) => c.kind === 'bale');
const n = stacks.length, seen = new Int32Array(n).fill(-1);
// grid
const G = 4, grid = new Map(), key = (x, y) => Math.floor(x / G) + ',' + Math.floor(y / G);
stacks.forEach((s, i) => { const k = key(s.x, s.y); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
const near = (x, y, r) => { const out = []; for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) for (const j of grid.get((Math.floor(x / G) + gx) + ',' + (Math.floor(y / G) + gy)) || []) if (Math.hypot(stacks[j].x - x, stacks[j].y - y) <= r) out.push(j); return out; };
const chains = [];
for (let i = 0; i < n; i++) {
  if (seen[i] >= 0) continue;
  const c = chains.length, q = [i]; seen[i] = c; const members = [];
  while (q.length) { const a = q.pop(); members.push(a); for (const b of near(stacks[a].x, stacks[a].y, LINK)) if (seen[b] < 0) { seen[b] = c; q.push(b); } }
  chains.push(members);
}
const roadDist = (x, y) => { let best = Infinity; for (const p of sub.pts) { const d = Math.hypot(p.x - x, p.y - y); if (d < best) best = d; } return best - half; };
const rows = chains.map((m, i) => {
  const xs = m.map((j) => stacks[j].x), ys = m.map((j) => stacks[j].y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const span = Math.hypot(x1 - x0, y1 - y0);
  let dmin = Infinity; for (const j of m) dmin = Math.min(dmin, roadDist(stacks[j].x, stacks[j].y));
  const baleNear = m.filter((j) => bales.some((b) => Math.hypot(b.x - stacks[j].x, b.y - stacks[j].y) < 1.5)).length;
  return { i, count: m.length, span: +span.toFixed(1), box: [x0, y0, x1, y1].map(Math.round), road: +dmin.toFixed(1), baleNear };
});
rows.sort((a, b) => a.count - b.count);
console.log(id, 'stacks', n, 'chains', chains.length, 'bales', bales.length);
for (const r of rows) console.log(JSON.stringify(r));
