// _ccedge.mjs - what stands along each side of the lap, in metres: Armco, catch fence, pit wall,
// or nothing (open grass), read 2 m apart along the normal out to 30 m past the edge
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
import { centreAt } from '../../src/world/venuegeo.ts';
const level = buildLevel(LEVELS.find((entry) => entry.id === (process.argv[2] || 'castle-cum')));
const sub = level.subtrack, half = sub.width / 2;
const cells = new Map();
const key = (x, y) => `${Math.round(x)},${Math.round(y)}`;
for (const rail of level.barriers) for (let i = 0; i + 1 < rail.pts.length; i++) {
  const [ax, ay] = rail.pts[i], [bx, by] = rail.pts[i + 1], len = Math.hypot(bx - ax, by - ay);
  for (let t = 0; t <= len; t += 0.5) { const k = key(ax + (bx - ax) * t / len, ay + (by - ay) * t / len); if (!cells.has(k)) cells.set(k, rail.kind); }
}
const totals = {};
const runs = { 1: [], '-1': [] };
for (let dist = 0; dist < sub.totalDist; dist += 2) {
  const centre = centreAt(sub, dist);
  for (const side of [1, -1]) {
    let kind = 'open';
    for (let out = half; out <= half + 30 && kind === 'open'; out += 0.5) {
      for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const found = cells.get(key(centre.x + centre.nx * side * out + ox * 0.5, centre.y + centre.ny * side * out + oy * 0.5));
        if (found) { kind = found; break; }
      }
    }
    const name = `${side > 0 ? 'left' : 'right'} ${kind}`;
    totals[name] = (totals[name] || 0) + 2;
    const list = runs[side];
    if (list.length && list.at(-1).kind === kind) list.at(-1).to = dist + 2; else list.push({ kind, from: dist, to: dist + 2 });
  }
}
console.log(`${level.id}: lap ${sub.totalDist.toFixed(0)} m`);
for (const [name, metres] of Object.entries(totals).sort()) console.log(`  ${name.padEnd(18)} ${String(metres).padStart(5)} m`);
if (process.argv.includes('--runs')) for (const side of [1, -1]) console.log((side > 0 ? 'left ' : 'right ') + runs[side].map((run) => `${run.kind}:${run.from}-${run.to}`).join(' '));
