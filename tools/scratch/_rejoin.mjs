// _rejoin.mjs - the AI REJOIN (R2, owner: "off the line the AI slows to get back on it; go fast,
// follow the line softly from wherever they are"). A lone AI laps once to settle, then at each
// of K points round lap 2 it is knocked SIDEWAYS by OFF m (speed and heading kept); logged for
// 3 s after: the speed lost vs an un-knocked lap at the same place, the time braking / lifting,
// the steer peak, and the swing (how far it overshoots the line the other way).
// node tools/scratch/_rejoin.mjs [level] [diff] [off m] [K]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
const { createAIDriver } = await import('../../src/ai/circuit.ts'), { aiTraits } = await import('../../src/ai/traits.ts');
const [lv = 'thruston', d = '2', offArg = '3', kArg = '6'] = process.argv.slice(2);
const OFF = +offArg, K = +kArg;
L.setLevel(lv); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist;
function run(knock) {
  const car = makeCar('hatch-rwd'), sp = L.LEVEL.spawn; reset(car, sp.x, sp.y, sp.heading);
  const drv = createAIDriver(L.LEVEL, aiTraits(+d, 0, 1, 7));
  const out = []; let t = 0, prog = 0, lastQ = L.querySubtrack(sub, car.x, car.y).trackDist, next = 0, rec = null;
  const lineLat = () => { const st = drv.state, p = st.path.pts[st.i]; return (car.x - p.x) * -Math.sin(p.h) + (car.y - p.y) * Math.cos(p.h); };
  while (t < 200 && prog < 2.2 * total) {
    L.applyGround(car, DT);
    const u = drv.drive(car, DT, { cars: [], lap: 1 + Math.floor(prog / total), laps: 9 });
    step(car, u, DT); L.barrierClamp(car);
    const q = L.querySubtrack(sub, car.x, car.y).trackDist; let dq = q - lastQ; if (dq < -total / 2) dq += total; if (dq > total / 2) dq -= total; prog += dq; lastQ = q;
    t += DT;
    const at = (prog - total) / total;   // share of lap 2
    if (at > 0 && next < K && at >= next / K + 0.05) {
      next++;
      if (knock) { const h = car.heading, s = next % 2 ? 1 : -1; car.x += -Math.sin(h) * OFF * s; car.y += Math.cos(h) * OFF * s; }
      rec = { k: next, t0: t, lat0: drv.state.i != null ? lineLat() : 0, rows: [], prog0: prog };
      out.push(rec);
    }
    if (rec && t - rec.t0 <= 3) rec.rows.push({ v: Math.hypot(car.vx, car.vy), brake: u.brake, thr: u.throttle, steer: u.steer, lat: lineLat(), prog });
  }
  return out;
}
const base = run(false), hit = run(true);
let sumLoss = 0;
for (let i = 0; i < hit.length; i++) {
  const a = base[i].rows, b = hit[i].rows, n = Math.min(a.length, b.length);
  const vA = a.slice(0, n).reduce((s, r) => s + r.v, 0) / n, vB = b.slice(0, n).reduce((s, r) => s + r.v, 0) / n;
  const minB = Math.min(...b.map((r) => r.v)), minA = Math.min(...a.map((r) => r.v));
  const brk = b.filter((r) => r.brake > 0.05).length * DT, lift = b.filter((r) => r.thr < 0.3 && r.brake <= 0.05).length * DT;
  const brkA = a.filter((r) => r.brake > 0.05).length * DT;
  const s0 = Math.sign(b[0].lat), swing = Math.max(0, ...b.map((r) => -s0 * r.lat));
  const steerPk = Math.max(...b.map((r) => Math.abs(r.steer)));
  const back = b.findIndex((r) => Math.abs(r.lat) < 0.5);
  sumLoss += b[b.length - 1].prog - b[0].prog - (a[a.length - 1].prog - a[0].prog);
  console.log(`knock ${i + 1} at lap ${(hit[i].prog0 / total).toFixed(2)}: mean v ${vA.toFixed(1)} -> ${vB.toFixed(1)} m/s, min ${minA.toFixed(1)} -> ${minB.toFixed(1)} | braking ${brkA.toFixed(2)} -> ${brk.toFixed(2)} s, lift ${lift.toFixed(2)} s | steer peak ${steerPk.toFixed(2)} | back within 0.5 m ${back < 0 ? 'never' : (back * DT).toFixed(2) + ' s'} | swing past the line ${swing.toFixed(2)} m`);
}
console.log(`${lv} diff ${d} knock ${OFF} m: distance lost over the 3 s windows ${(-sumLoss).toFixed(1)} m in ${hit.length} knocks`);
