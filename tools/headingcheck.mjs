// headingcheck.mjs — HIGHWAY (src/highway.js): which way does the road LEAN? User, 2026-10-05: "it always aims diagonally left, it
// should go left and right and vary". Grows N km of road per seed + preset (no driving) and reports the share of distance leaning
// LEFT / RIGHT of straight up, the mean lean, the longest run on one side, and how many times it swaps side.
// node tools/headingcheck.mjs [km] [file]
import * as L from '../src/lab.js';
const KM = +(process.argv[2] || 30), H = await import(process.argv[3] || '../src/highway.js');
const car = { x: 0, y: 0, vx: 0, vy: 0 };
for (const preset of Object.keys(H.HW_PRESETS)) for (const seed of [4242, 7, 99, 12345]) {
  const lv = H.createHighway(seed, preset); let left = 0, right = 0, sum = 0, n = 0, run = 0, runMax = 0, side = 0, swaps = 0, absMax = 0, lastS = 0, prof = [];
  // walk a virtual car up the road so the window advances exactly as in play; then read EVERY 4 m point not yet counted
  while (lv._hw.driven < KM * 1000) {
    const P = lv._hw.pts, i = Math.min(P.length - 1, lv._hw.ci + 25); car.x = P[i].x; car.y = P[i].y; H.stepHighway(lv, car);
    const Q = lv._hw.pts, upTo = Q[lv._hw.ci].s;
    for (let j = 1; j < Q.length; j++) { if (Q[j].s <= lastS || Q[j].s > upTo) continue; lastS = Q[j].s;
    const h = Math.atan2(Q[j].y - Q[j - 1].y, Q[j].x - Q[j - 1].x), off = Math.atan2(Math.sin(h + Math.PI / 2), Math.cos(h + Math.PI / 2)) * 180 / Math.PI;
    if (seed === 4242 && preset === 'motorway' && Q[j].s % 250 < 4 && Q[j].s <= 6000) prof.push(`${(Q[j].s / 1000).toFixed(2)}:${off.toFixed(0)}`);
    // + off = leaning RIGHT on screen (heading turned from -y toward +x)
    const step = Q[j].s - (Q[j - 1].s); sum += off * step; n += step; absMax = Math.max(absMax, Math.abs(off));
    if (off < -3) left += step; else if (off > 3) right += step;
    const sd = off < -3 ? -1 : off > 3 ? 1 : 0;
    if (sd && sd === side) { run += step; runMax = Math.max(runMax, run); } else if (sd) { if (side) swaps++; side = sd; run = step; }
  } }
  if (prof.length) console.log('LIVE ROAD (motorway 4242), lean deg every 250 m (km:deg, - = LEFT):\n  ' + prof.join('  '));
  console.log(`${preset.padEnd(10)} seed ${String(seed).padEnd(6)} ${KM} km: LEFT ${(left / n * 100).toFixed(0)} % / RIGHT ${(right / n * 100).toFixed(0)} % | mean lean ${(sum / n).toFixed(1)} deg (+ = right) | max ${absMax.toFixed(0)} | longest one-side run ${(runMax / 1000).toFixed(1)} km | side swaps ${swaps}`);
}
