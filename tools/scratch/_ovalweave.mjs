// _ovalweave.mjs - owner 11-02: on the ovals the AI "do weird weaves before the start finish".
// A field (N AI, node, contact, race order by progress) or one car; per 20 m of track from -200 to
// +60 m round the line: speed vs target, side offset from the racing line (mean |off|, its spread),
// steering reversals per pass, and what the driver was doing (attack / cover / follow / dodge).
// node tools/scratch/_ovalweave.mjs [level] [n] [diff] [seconds]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.js';
import { carContact } from '../../src/contact.js';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';
import { racingLine } from '../../src/ai/line.ts';
const [lv = 'naffcar', nStr = '1', d = '3', secs = '240'] = process.argv.slice(2), N = +nStr;
L.setLevel(lv); L.clearWear();
const st = L.LEVEL.subtrack, ln = racingLine(L.LEVEL);
const cars = [], drvs = [];
for (let k = 0; k < N; k++) {
  const p = L.onTrack(st, st.totalDist / 2 - 12 * k, (k % 2 ? 2.5 : -2.5), {});
  const car = makeCar('hatch-rwd'); reset(car, p.x, p.y, p.rot); cars.push(car);
  drvs.push(createAIDriver(L.LEVEL, aiTraits(+d, k, N, 3 + k)));
}
const bins = {}; const prog = cars.map(() => 0), last = cars.map(() => null), lastSteer = cars.map(() => 0);
let t = 0;
while (t < +secs) {
  for (let k = 0; k < N; k++) {
    const car = cars[k];
    L.barrierClamp(car); L.solidClamp(car); L.applyGround(car, DT);
    const u = drvs[k].drive(car, DT, { cars: cars.filter((c) => c !== car), lap: 2, laps: 99 });
    step(car, u, DT);
    const q = L.querySubtrack(st, car.x, car.y);
    if (last[k] !== null) { let dd = q.trackDist - last[k]; if (dd < -st.totalDist / 2) dd += st.totalDist; prog[k] += dd; }
    last[k] = q.trackDist; car._prog = prog[k];
    if (t < 15) continue;
    let dist = q.trackDist; if (dist > st.totalDist / 2) dist -= st.totalDist;
    if (!process.env.FULL && (dist < -200 || dist > 60)) continue;
    const s = drvs[k].state, pt = ln.pts[s.i];
    const off = (car.x - pt.x) * -Math.sin(pt.h) + (car.y - pt.y) * Math.cos(pt.h);
    const key = Math.floor(dist / 20) * 20, b = bins[key] || (bins[key] = { n: 0, v: 0, vT: 0, off: 0, off2: 0, rev: 0, atk: 0, cov: 0, fol: 0, obst: 0 });
    b.n++; b.v += Math.hypot(car.vx, car.vy); b.vT += Math.min(95, s.vT); b.off += off; b.off2 += off * off;
    if (Math.sign(u.steer) !== Math.sign(lastSteer[k]) && Math.abs(u.steer) > 0.03) b.rev++;
    if (Math.abs(u.steer) > 0.03) lastSteer[k] = u.steer;
    if (s.atk) b.atk++; if (s.cover) b.cov++; if (s.follow) b.fol++;
  }
  for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) carContact(cars[a], cars[b]);
  t += DT;
}
console.log(`${lv} ${N} AI diff ${d} ${secs} s`);
for (const key of Object.keys(bins).map(Number).sort((a, b) => a - b)) {
  const b = bins[key], mean = b.off / b.n, sd = Math.sqrt(Math.max(0, b.off2 / b.n - mean * mean));
  const pct = (x) => Math.round(100 * x / b.n);
  console.log(`  ${String(key).padStart(4)}..${key + 20}: v ${(b.v / b.n).toFixed(1)} tgt ${(b.vT / b.n).toFixed(1)} | off ${mean.toFixed(2)} sd ${sd.toFixed(2)} | steer reversals ${(b.rev / b.n * 120).toFixed(2)}/s | atk ${pct(b.atk)}% cov ${pct(b.cov)}% fol ${pct(b.fol)}%`);
}
