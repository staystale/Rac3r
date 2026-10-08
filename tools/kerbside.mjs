// kerbside.mjs — for every curved kerb on a level: is it on the INSIDE (apex) or OUTSIDE of its corner, and where is the road
// tighter than half its width (the ribbon folds)? node tools/kerbside.mjs <level>. Built 2026-10-03 (Thruston kerbs "look broken").
// for each curved kerb: is it on the INSIDE (apex) or the OUTSIDE of its corner? And where does the ribbon fold (R < half width)?
import * as L from '../src/lab.js';
const lv = process.argv[2] || 'thruston';
L.setLevel(lv);
const st = L.LEVEL.subtrack, pts = st.pts, n = pts.length, hw = st.width / 2;
const turnAt = (d) => { let i = 0; for (let k = 0; k < n; k++) if (pts[k].dist <= d) i = k; const a0 = pts[(i - 3 + n) % n], a1 = pts[(i + 3) % n]; let dh = a1.heading - a0.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); const R = Math.max(1, ((a1.dist - a0.dist) + st.totalDist) % st.totalDist) / Math.max(1e-4, Math.abs(dh)); return { dh, R }; };
for (const k of st.curvedKerbs || []) {
  const { dh, R } = turnAt((k.startDist + k.endDist) / 2);
  const inside = dh > 0 ? 'left' : 'right';     // y-down: heading increasing = right turn = +normal ('left') is the inside
  console.log(`kerb ${k.startDist}-${k.endDist} side ${k.side.padEnd(5)}: ${R > 150 ? 'STRAIGHT' : (dh > 0 ? 'right' : 'left') + '-hander R' + R.toFixed(0)} -> ${R > 150 ? '-' : (k.side === inside ? 'INSIDE (apex)' : 'OUTSIDE')}`);
}
const folds = []; for (let i = 0; i < n; i++) { const { R } = turnAt(pts[i].dist); if (R < hw + 2) folds.push(pts[i].dist.toFixed(0) + ':R' + R.toFixed(0)); }
console.log('ribbon too tight (R < half width + 2):', folds.join(' ') || 'none');
// KERB FANS (2026-10-04): an inside kerb on a corner so tight its inner edge nears the corner's centre draws as wedges (Thruston's
// Campbell / Club, photographed). Inner/outer radius of the kerb strip below 0.6 = FAN.
let fans = [];
for (const k of st.curvedKerbs || []) {
  let minR = Infinity; for (let d = k.startDist; d <= k.endDist; d += 1) minR = Math.min(minR, turnAt(d).R);
  const ratio = (minR - hw - k.width) / Math.max(0.1, minR - hw);
  if (ratio < 0.6) fans.push(k.startDist.toFixed(0) + ':R' + minR.toFixed(0) + ' w' + k.width.toFixed(1) + ' ratio ' + ratio.toFixed(2));
}
console.log('kerb fans (inner/outer < 0.6):', fans.join('  ') || 'none');
export const KERBSIDE_FANS = fans.length;
