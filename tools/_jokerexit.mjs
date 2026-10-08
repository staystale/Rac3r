// _jokerexit.mjs ??? the JOKER branch, dumped (user, 2026-10-07: "exit of jokers still seems slow n on rails a bit"). Per ~5 m of the
// branch path: radius R, ground mu, the PLAN speed (profile x pace), and what one AI actually did there (speed, throttle, brake, slip,
// m off the path) ??? then the same metres of the MAIN line for comparison. node tools/_jokerexit.mjs [level] [car] [diff] [seed]
import { makeCar, step, reset, DT } from '../src/vehicle.js';
import * as L from '../src/lab.js';
const { createAIDriver, aiTraits, aiPaths } = await import(process.env.AINEXT ? '../src/aidriver.next.js' : '../src/aidriver.js');
const [lv = 'knobhill', carId = 'hatch-rwd', d = '4', seed = '1'] = process.argv.slice(2);
L.setLevel(lv); L.clearWear();
const paths = aiPaths(L.LEVEL), J = paths.joker, M = paths.line; if (!J) { console.log('no joker on', lv); process.exit(0); }
const sp = L.LEVEL.spawn, car = makeCar(carId); reset(car, sp.x, sp.y, sp.heading);
const tr = aiTraits(+d, 0, 1, +seed), drv = createAIDriver(L.LEVEL, tr);
drv.state.jPlan = 1;   // joker on lap 1, so the dump comes quickly
const rec = new Map(); let t = 0, seen = false, left = false, lapGuess = 1;
while (t < 200) {
  L.applyGround(car, DT);
  const w = drv.drive(car, DT, { cars: [], lap: lapGuess, laps: 5 }); step(car, w, DT); t += DT;
  const st = drv.state;
  if (st.path === J) { seen = true; const i = st.i, k = Math.floor(i * J.sp / 5);
    if (!rec.has(k)) rec.set(k, { v: Math.hypot(car.vx, car.vy), thr: w.throttle, brk: w.brake, sR: Math.abs(car.t.slipR || 0), sF: Math.abs(car.t.slipF || 0), off: st.lastDist, vT: st.vT, mu: car.surface.mu }); }
  else if (seen) { left = true; break; }
}
if (!seen) { console.log('the AI never took the joker in 200 s'); process.exit(1); }
console.log(`${lv} ${carId} d${d} seed ${seed} (${tr.persona}, pace ${tr.pace.toFixed(3)}): joker branch ${J.n} pts, ${J.total.toFixed(0)} m; switch at main ${J.switchI}, rejoin at main ${J.rejoin}`);
console.log('   m  |  R m  | mu path | PLAN km/h | AI km/h  vT  | thr  brk | slipF slipR | off path');
for (let k = 0; k * 5 < J.total; k++) {
  const i = Math.min(J.n - 1, Math.round(k * 5 / J.sp)), p = J.pts[i], r = rec.get(k);
  const plan = (Object.values(J.prof)[0] || [])[i];
  console.log(`${String(k * 5).padStart(5)} | ${String(Math.min(9999, Math.round(p.R))).padStart(5)} | ${p.mu.toFixed(2).padStart(7)} | ${plan != null ? (plan * 3.6 * tr.pace).toFixed(0).padStart(9) : '        -'} | ` +
    (r ? `${(r.v * 3.6).toFixed(0).padStart(7)} ${(r.vT * 3.6).toFixed(0).padStart(4)} | ${r.thr.toFixed(2)} ${r.brk.toFixed(2)} | ${r.sF.toFixed(2).padStart(5)} ${r.sR.toFixed(2).padStart(5)} | ${r.off.toFixed(1)}` : '   (no sample)'));
}
// the MAIN line over the same stretch (switch -> rejoin): what the line would let it do there
const prof = Object.values(M.prof)[0], n = M.n; let maxM = 0, minM = 1e9;
for (let i = J.switchI; i !== J.rejoin; i = (i + 1) % n) { maxM = Math.max(maxM, prof[i]); minM = Math.min(minM, prof[i]); }
console.log(`main line over the same stretch: plan ${(minM * 3.6 * tr.pace).toFixed(0)}-${(maxM * 3.6 * tr.pace).toFixed(0)} km/h; rejoin point plan ${(prof[J.rejoin] * 3.6 * tr.pace).toFixed(0)} km/h`);
