// _ccpts.mjs - points along the Castle Cum venue's real lap (real m, the venue data's frame):
// node tools/scratch/_ccpts.mjs <dist> [offset] ... - from the start line, offset + = left
import { CASTLE_CUM_VENUE as DATA } from '../../src/world/levels/venues/castle-cum.ts';

const START = [184, 470];
const line = [];
for (const [name, way] of DATA.layouts.circuit) {
  const piece = DATA.pieces.find((entry) => entry.name === name);
  const pts = way > 0 ? piece.pts : piece.pts.slice().reverse();
  line.push(...(line.length ? pts.slice(1) : pts));
}
line.pop();
let best = 0, bestSq = Infinity;
line.forEach(([x, y], i) => {
  const sq = (x - START[0]) ** 2 + (y - START[1]) ** 2;
  if (sq < bestSq) { bestSq = sq; best = i; }
});
const loop = [...line.slice(best), ...line.slice(0, best), line[best]];
const cum = [0];
for (let i = 1; i < loop.length; i++)
  cum.push(cum[i - 1] + Math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]));
console.log('lap', cum.at(-1).toFixed(0), 'real m');
const args = process.argv.slice(2).map(Number);
for (let k = 0; k < args.length; k += 2) {
  const dist = args[k], off = args[k + 1] || 0;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < dist) i++;
  const frac = (dist - cum[i - 1]) / (cum[i] - cum[i - 1]);
  const [ax, ay] = loop[i - 1], [bx, by] = loop[i];
  const len = Math.hypot(bx - ax, by - ay);
  const dx = (bx - ax) / len, dy = (by - ay) / len;
  // left normal in a y-down frame: (dy, -dx)
  const x = ax + (bx - ax) * frac + dy * off, y = ay + (by - ay) * frac - dx * off;
  console.log(dist, off, '->', x.toFixed(1), y.toFixed(1));
}
