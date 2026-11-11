// _mohills.mjs - Moanaco's hills: cos^2 humps (world/terrain.ts) fitted to EU-DEM 25 m heights round
// the lap (tools/scratch/_moheights.json; the tunnel's stretch left out - the model reads the roofs over
// it - and the off-lap grid at a tenth of the weight, its towers left out) by non-negative least
// squares on a grid of centres; prints the spec's hills and the rms on the lap (scratch)
import fs from 'node:fs';
const heights = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const lap = heights.slice(0, 83).map((p, i) => ({ x: p[0], y: p[1], h: p[2] ?? 0, w: (i * 40 > 1600 && i * 40 < 2080) || p[2] === null ? 0 : 1 }));
const grid = heights.slice(83).filter((p) => p[2] !== null && p[2] < 80).map((p) => ({ x: p[0], y: p[1], h: p[2], w: 0.1 }));
// the harbour's water at sea level (its ring, every 40 m)
const { MOANACO_VENUE: data } = await import('../../src/world/levels/venues/moanaco.ts');
const ring = data.water.find((lake) => lake.name === 'Port Hercule').pts;
const inRing = (x, y) => { let hit = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit; } return hit; };
const sea = [];
for (let x = -300; x <= 520; x += 40) for (let y = -120; y <= 420; y += 40) if (inRing(x, y)) sea.push({ x, y, h: 0, w: 0.5 });
const pts = [...lap, ...grid, ...sea];
const cands = [];
for (const r of [250, 450]) for (let x = -450; x <= 500; x += r / 2) for (let y = -650; y <= 550; y += r / 2) cands.push({ x, y, r, h: 0 });
const shape = (c, p) => { const d = Math.hypot(p.x - c.x, p.y - c.y) / c.r; return d >= 1 ? 0 : Math.cos(Math.PI / 2 * d) ** 2; };
const A = pts.map((p) => cands.map((c) => shape(c, p)));
const res = pts.map((p) => -p.h);
for (let iter = 0; iter < 400; iter++) {
  for (let j = 0; j < cands.length; j++) {
    let g = 0, n = 0;
    for (let i = 0; i < pts.length; i++) { g += pts[i].w * res[i] * A[i][j]; n += pts[i].w * A[i][j] ** 2; }
    if (n <= 0) continue;
    const next = Math.min(120, Math.max(0, cands[j].h - g / n)), step = next - cands[j].h;
    cands[j].h = next;
    for (let i = 0; i < pts.length; i++) res[i] += step * A[i][j];
  }
}
const kept = cands.filter((c) => c.h > 0.8);
const model = (p) => kept.reduce((s, c) => s + c.h * shape(c, p), 0);
const rms = Math.sqrt(lap.filter((p) => p.w).reduce((s, p) => s + (model(p) - p.h) ** 2, 0) / lap.filter((p) => p.w).length);
const worst = Math.max(...lap.filter((p) => p.w).map((p) => Math.abs(model(p) - p.h)));
for (const c of kept) console.log(`    { kind: 'hump', x: ${c.x}, y: ${c.y}, r: ${c.r}, h: ${c.h.toFixed(1)} },`);
console.error(kept.length, 'hills, rms', rms.toFixed(1), 'worst', worst.toFixed(1), 'on the lap; casino', model({ x: 150, y: -310 }).toFixed(1), 'harbour', model({ x: 100, y: 200 }).toFixed(1), model({ x: -150, y: 300 }).toFixed(1), 'tunnel ends', model({ x: 388, y: -430 }).toFixed(1), model({ x: 204, y: -145 }).toFixed(1));
