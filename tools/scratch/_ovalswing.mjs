// _ovalswing.mjs - owner 11-02 (ovals: "weird weaves before the start finish"). A field in node
// (as _ovalweave.mjs); each AI's sideways shift off its line (drv.state.dodge) is watched: a SWING
// is the shift turning back after moving >= 0.8 m one way. Counted per 25 m of lap with what the
// driver was doing at the turn-back: corner attack, tow pass, cover, following, else car avoid.
// node tools/scratch/_ovalswing.mjs [level] [n] [diff] [seconds]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.js';
import { carContact, slipstream } from '../../src/contact.js';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';
import { racingLine } from '../../src/ai/line.ts';
const [lv = 'naffcar', nStr = '5', d = '3', secs = '300'] = process.argv.slice(2), N = +nStr;
L.setLevel(lv); L.clearWear();
const st = L.LEVEL.subtrack, ln = racingLine(L.LEVEL);
console.log(`${lv}: corners on the line ${ln.corners.length}`);
const cars = [], drvs = [];
for (let k = 0; k < N; k++) {
  const p = L.onTrack(st, st.totalDist / 2 - 12 * k, (k % 2 ? 2.5 : -2.5), {});
  const car = makeCar('hatch-rwd'); reset(car, p.x, p.y, p.rot); cars.push(car);
  drvs.push(createAIDriver(L.LEVEL, aiTraits(+d, k, N, 3 + k)));
}
const prog = cars.map(() => 0), last = cars.map(() => null);
const sw = cars.map(() => ({ dir: 0, ext: 0 })), bins = {}, why = {};
let t = 0, swings = 0;
while (t < +secs) {
  slipstream && slipstream(cars);
  for (let k = 0; k < N; k++) {
    const car = cars[k];
    L.barrierClamp(car); L.solidClamp(car); L.applyGround(car, DT);
    step(car, drvs[k].drive(car, DT, { cars: cars.filter((c) => c !== car), lap: 2, laps: 99 }), DT);
    const q = L.querySubtrack(st, car.x, car.y);
    if (last[k] !== null) { let dd = q.trackDist - last[k]; if (dd < -st.totalDist / 2) dd += st.totalDist; prog[k] += dd; }
    last[k] = q.trackDist; car._prog = prog[k];
    if (t < 15) continue;
    const s = drvs[k].state, w = sw[k], val = s.dodge;
    if (w.dir === 0) { w.dir = 1; w.ext = val; w.from = val; continue; }
    if ((val - w.ext) * w.dir > 0) { w.ext = val; continue; }
    if (Math.abs(val - w.ext) > 0.05) {
      if (Math.abs(w.ext - w.from) >= 0.8) {
        swings++;
        let dist = q.trackDist; if (dist > st.totalDist / 2) dist -= st.totalDist;
        const key = Math.floor(dist / 25) * 25;
        const cause = s.atk ? (s.atk.corner < 0 ? 'tow pass' : 'corner attack') : s.cover ? 'cover' : s.follow ? 'following' : 'car avoid';
        bins[key] = bins[key] || {}; bins[key][cause] = (bins[key][cause] || 0) + 1;
        why[cause] = (why[cause] || 0) + 1;
      }
      w.from = w.ext; w.dir = -w.dir; w.ext = val;
    }
  }
  for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) carContact(cars[a], cars[b]);
  t += DT;
}
const laps = prog.reduce((a, b) => a + b, 0) / st.totalDist;
console.log(`${N} AI diff ${d} ${secs} s: ${laps.toFixed(1)} car-laps, ${swings} swings (${(swings / laps).toFixed(1)} a lap) ${JSON.stringify(why)}`);
for (const key of Object.keys(bins).map(Number).sort((a, b) => a - b)) console.log(`  ${String(key).padStart(5)} m: ${JSON.stringify(bins[key])}`);
