// _lineaudit.mjs - K3 (owner 11-02: "check racing line / subtrack for sharp awkward turns as well
// as objects making them weave"). Per circuit, no browser:
//  KINKS   centreline and racing-line points whose curvature spikes against its +-10 m (a kink,
//          not a corner): |k| > 1/40 and > 3x the local median.
//  DIPS    the target-speed profile's local minima > 3 m/s deep: the radius there, how long the
//          tight bit lasts (short = a kink the car brakes for), and grip (mu) vs the lap's.
//  OBJECTS loose objects (cones.js) the AI would dodge from the racing line: within r + 1.1 m of
//          the line and inside hw + 0.5 (ai/driverTraffic.ts obstacleStep), plus near misses.
// node tools/scratch/_lineaudit.mjs [levels,comma] [car]
import * as L from '../../src/lab.js';
import { racingLine, profileOf } from '../../src/ai/line.ts';
import { makeCar } from '../../src/vehicle.ts';
import { createCones } from '../../src/cones.js';
const want = process.argv[2] ? process.argv[2].split(',') : null, carId = process.argv[3] || 'hatch-rwd';
const ids = want || L.LEVELS.filter((lv) => lv.subtrack && !lv.endless).map((lv) => lv.id);
const curv = (pts, i, n, gap) => {
  const a = pts[(i - gap + n) % n], b = pts[i], c = pts[(i + gap) % n];
  let d = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x);
  while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  return d / (Math.hypot(b.x - a.x, b.y - a.y) / 2 + Math.hypot(c.x - b.x, c.y - b.y) / 2);
};
const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[s.length >> 1]; };
function kinks(pts, closed, sp) {
  const n = pts.length, gap = Math.max(1, Math.round(1 / sp)), win = Math.round(10 / sp), out = [];
  const k = pts.map((_, i) => (closed || (i >= gap && i < n - gap) ? curv(pts, i, n, gap) : 0));
  for (let i = 0; i < n; i++) {
    const near = [];
    for (let j = -win; j <= win; j++) if (Math.abs(j) > gap * 2) near.push(Math.abs(k[(i + j + n) % n]));
    const med = median(near);
    if (Math.abs(k[i]) > 1 / 40 && Math.abs(k[i]) > 3 * Math.max(med, 1 / 400)) {
      if (out.length && i - out[out.length - 1].i < win) { if (Math.abs(k[i]) > out[out.length - 1].k) Object.assign(out[out.length - 1], { i, k: Math.abs(k[i]), med }); continue; }
      out.push({ i, k: Math.abs(k[i]), med });
    }
  }
  return out;
}
for (const id of ids) {
  try { L.setLevel(id); } catch (e) { console.log(id, 'setLevel failed', e.message); continue; }
  L.clearWear();
  const sub = L.LEVEL.subtrack, line = racingLine(L.LEVEL), lp = line.pts, n = line.n, sp = line.sp;
  const spec = makeCar(carId).spec, prof = profileOf(line, spec);
  const csp = sub.totalDist / sub.pts.length;
  console.log(`\n== ${id}: ${sub.totalDist.toFixed(0)} m, line ${n} pts @ ${sp.toFixed(2)} m, hw ${line.hw.toFixed(1)}`);
  const ck = kinks(sub.pts, true, csp), lk = kinks(lp, line.closed, sp);
  for (const kk of ck) console.log(`  KINK centre @${sub.pts[kk.i].dist.toFixed(0)} m: R ${(1 / kk.k).toFixed(1)} vs local R ${(1 / kk.med).toFixed(0)}`);
  for (const kk of lk) console.log(`  KINK line   @${lp[kk.i].dist.toFixed(0)} m: R ${(1 / kk.k).toFixed(1)} vs local R ${(1 / kk.med).toFixed(0)}, off ${lp[kk.i].off.toFixed(2)}`);
  // dips
  const win = Math.round(40 / sp), muMed = median(lp.map((p) => p.mu));
  for (let i = 0; i < n; i++) {
    let isMin = true, before = 0, after = 0;
    for (let j = 1; j <= win && isMin; j++) {
      const a = prof[(i - j + n) % n], b = prof[(i + j) % n];
      if (a < prof[i] || b < prof[i] || (j <= 2 && (a === prof[i] && j === 1 && false))) isMin = false;
      before = Math.max(before, a); after = Math.max(after, b);
    }
    if (!isMin || (i > 0 && prof[i - 1] === prof[i])) continue;
    const depth = Math.min(before, after) - prof[i];
    if (depth < 3) continue;
    // length of the tight bit: R within 1.5x the min
    const Rmin = lp[i].R; let span = 0;
    for (let j = -win; j <= win; j++) if (lp[(i + j + n) % n].R < Rmin * 1.5) span += sp;
    const tag = span < 12 ? ' <<< SHORT' : '', muTag = lp[i].mu < muMed * 0.92 ? ` mu ${lp[i].mu.toFixed(2)} (lap ${muMed.toFixed(2)}) <<< GRIP` : '';
    console.log(`  DIP  @${lp[i].dist.toFixed(0)} m: ${prof[i].toFixed(1)} m/s, ${depth.toFixed(1)} deep, R ${Rmin.toFixed(0)}, tight ${span.toFixed(0)} m${tag}${muTag}`);
  }
  // objects
  let cones; try { cones = createCones(); cones.reset(); } catch (e) { console.log('  cones failed', e.message); continue; }
  const hits = {}, near = {};
  for (const obj of cones.list) {
    if (obj.kind === 'banger' || obj.kind === 'caravan') continue;
    let best = 0, bd = Infinity;
    for (let i = 0; i < n; i++) { const d = (lp[i].x - obj.x) ** 2 + (lp[i].y - obj.y) ** 2; if (d < bd) { bd = d; best = i; } }
    const p = lp[best], lat = (obj.x - p.x) * -Math.sin(p.h) + (obj.y - p.y) * Math.cos(p.h);
    if (Math.abs(p.off + lat) > line.hw + 0.5) continue;
    const gap = Math.abs(lat) - obj.r;
    const key = `${obj.kind} @${p.dist.toFixed(0)}`;
    if (gap < 1.1) (hits[key] = hits[key] || []).push(gap.toFixed(1));
    else if (gap < 2.6) (near[key] = near[key] || []).push(gap.toFixed(1));
  }
  const fmt = (h) => Object.entries(h).map(([k, v]) => `${k}m x${v.length} (gap ${v.slice(0, 3).join('/')})`).join('; ');
  console.log(`  OBJECTS on the line (dodged): ${fmt(hits) || 'none'}`);
  console.log(`  OBJECTS near the line (<2.6 m, dodged when off line): ${fmt(near) || 'none'}`);
}
