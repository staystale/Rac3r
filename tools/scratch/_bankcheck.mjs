// _bankcheck.mjs <level> - an oval's banking as built: the outer and inner edge heights along the
// lap, each turn's highest outer edge, the steepest rise along the outer edge over 10 m and 30 m
// (a launch: the old Naffcar's 7 m over 30 m), and the back slope's steepest fall beyond it
import * as L from '../../src/lab.ts';
import { centreAt } from '../../src/world/venuegeo.ts';
const levelId = process.argv[2] || 'dieatona';
L.setLevel(levelId);
const sub = L.LEVEL.subtrack, half = sub.width / 2, total = sub.totalDist;
const height = (x, y) => L.heightAt(x, y);
const STEP = 2, rows = [];
for (let dist = 0; dist < total; dist += STEP) {
  const c = centreAt(sub, dist);
  const at = (off) => height(c.x + c.nx * off, c.y + c.ny * off);
  rows.push({ dist, plus: at(half), minus: at(-half), plusBack: at(half + 8), minusBack: at(-half - 8) });
}
const outerKey = rows.reduce((s, r) => s + r.plus - r.minus, 0) > 0 ? 'plus' : 'minus';
const outer = rows.map((r) => r[outerKey]), back = rows.map((r) => r[outerKey + 'Back']);
const inner = rows.map((r) => r[outerKey === 'plus' ? 'minus' : 'plus']);
const rise = (span) => {
  let worst = 0, at = 0; const n = span / STEP;
  for (let i = 0; i < rows.length; i++) {
    const d = Math.abs(outer[(i + n) % rows.length] - outer[i]);
    if (d > worst) { worst = d; at = rows[i].dist; }
  }
  return `${worst.toFixed(2)} m at ${at} m`;
};
console.log(`${levelId}: lap ${total.toFixed(0)} m, the outer edge on the ${outerKey} side`);
let line = '';
for (let i = 0; i < rows.length; i += 25) line += `${rows[i].dist}:${outer[i].toFixed(1)}/${inner[i].toFixed(1)} `;
console.log('outer/inner edge height every 50 m:', line);
// the turns: runs where the outer edge is over 5 m
let run = null;
for (let i = 0; i <= rows.length; i++) {
  const high = i < rows.length && outer[i] > 5;
  if (high && !run) run = { from: rows[i].dist, top: 0 };
  if (high) run.top = Math.max(run.top, outer[i]);
  if (!high && run) { console.log(`  banked run ${run.from}-${rows[i - 1].dist} m: highest outer edge ${run.top.toFixed(2)} m`); run = null; }
}
console.log(`steepest outer-edge change: over 10 m ${rise(10)}; over 30 m ${rise(30)}`);
let fall = 0; for (let i = 0; i < rows.length; i++) fall = Math.max(fall, outer[i] - back[i]);
console.log(`back slope: the outer edge drops up to ${fall.toFixed(2)} m over the 8 m beyond it`);
