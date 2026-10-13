// scratch: ONE weaver on an EMPTY motorway (no traffic) - what limits its speed? Every 1 s: v, the speed target vT, the throttle and its
// caps (thrCap from the turn feathering, e = vT - v), the road's radius here. node tools/_freeroad.mjs [diff] [seconds] [seed]
import { makeCar, step, reset, DT } from '../src/vehicle.ts';
import * as L from '../src/lab.js';
import * as H from '../src/highway.js';
import { aiTraits } from '../src/ai/traits.ts';
import { createAIDriver } from '../src/ai/circuit.ts';
import { hwFrames } from '../src/highwayrace.ts';
// the levels importing these modules used to add (task 078 made it explicit)
H.addHighwayLevel();
const [DIFF = 2, T = 40, SEED = 4242] = process.argv.slice(2).map(Number);
const lv = H.createHighway(SEED, 'motorway'); lv.id = 'fr'; L.LEVELS.push(lv); L.setLevel(lv.id);
const c = makeCar('saloon-rwd'); c.absOn = c.tcsOn = true;
const p = H.roadPose(lv, H.roadFrame(lv, lv.spawn.x, lv.spawn.y, null).s, lv._hw.geo.centres[1]); reset(c, p.x, p.y, p.h);
const drv = createAIDriver(lv, aiTraits(DIFF, 1, 6, 9));
let sum = 0, n = 0, lim = { corner: 0, thrCap: 0, eGain: 0, full: 0 };
for (let t = 0; t < T; t += DT) {
  hwFrames(lv, [c]); H.stepHighway(lv, c);
  const w = drv.drive(c, DT, { cars: [] }); L.applyGround(c, DT); step(c, w, DT);
  const v = Math.hypot(c.vx, c.vy) * 3.6, d = drv.state.dbg; if (!d) continue;
  if (t > 8) { sum += v; n++;
    if (d.e <= 0.5) lim.corner++; else if (w.throttle >= d.thrCap * d.feel - 1e-6 && d.thrCap < 0.999) lim.thrCap++; else if (w.throttle < 0.999) lim.eGain++; else lim.full++; }
  if (Math.round(t / DT) % Math.round(1 / DT) === 0) { const P = lv._hw.pts, i = Math.round((c._hwf.s - P[0].s) / 4), R = 1 / Math.max(1e-5, Math.abs(P[Math.max(0, i)].curv || 0));
    console.log(`t ${t.toFixed(0).padStart(2)} v ${v.toFixed(0)} vT ${(d.vT * 3.6).toFixed(0)} thr ${w.throttle.toFixed(2)} thrCap ${d.thrCap.toFixed(2)} turn ${d.turn.toFixed(2)} brk ${w.brake.toFixed(2)} gear ${c.gear} R ${R > 9999 ? 'inf' : R.toFixed(0)}`); }
}
const N = Math.max(1, n), pc = (k) => (100 * lim[k] / N).toFixed(0) + '%';
console.log(`diff ${DIFF} seed ${SEED}: mean ${(sum / N).toFixed(0)} km/h after 8 s | time limited by: corner target ${pc('corner')}, turn feathering ${pc('thrCap')}, throttle gain (e*0.35) ${pc('eGain')}, full throttle ${pc('full')}`);
