// aitrace.mjs — one racing-AI run traced (debugging aidriver.js): every 0.5 s the lap distance, speed vs target, line radius / offset,
// distance from the line and from the centreline. node tools/aitrace.mjs <level> <car> <diff 0-4> [seconds]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../src/vehicle.ts';
import * as L from '../src/lab.js';
import { createAIDriver } from '../src/ai/circuit.ts';
import { aiTraits } from '../src/ai/traits.ts';
const [lv = 'naffcar', carId = 'hatch-rwd', d = '4', secs = '60'] = process.argv.slice(2);
L.setLevel(lv); const st = L.LEVEL.subtrack, hw = st.width / 2;
const car = makeCar(carId); const p = L.onTrack(st, st.totalDist - 30, 0, {}); reset(car, p.x, p.y, p.rot);
const drv = createAIDriver(L.LEVEL, aiTraits(+d, 0, 1)), line = L.LEVEL._line;
console.log(`width ${st.width} total ${st.totalDist.toFixed(0)} n ${st.pts.length} traits`, JSON.stringify(drv.traits));
let t = 0, next = 0;
while (t < +secs) {
  L.applyGround(car, PHYSICS_STEP_SECONDS); const out = drv.drive(car, PHYSICS_STEP_SECONDS); step(car, out, PHYSICS_STEP_SECONDS); t += PHYSICS_STEP_SECONDS;
  if (t >= next) {
    next += +(process.env.STEP || 0.5); const q = L.querySubtrack(st, car.x, car.y), lp = line.pts[drv.state.i];
    console.log(`t ${t.toFixed(1)} d ${q.trackDist.toFixed(0)} v ${Math.hypot(car.vx, car.vy).toFixed(1)} vT ${drv.state.vT.toFixed(1)} R ${lp.R.toFixed(0)} off ${lp.off.toFixed(1)} fromLine ${drv.state.lastDist.toFixed(1)} fromC ${q.dist.toFixed(1)}/${hw} st ${out.steer.toFixed(2)} th ${out.throttle.toFixed(2)} br ${out.brake.toFixed(2)} mu ${car.surface.mu} sF ${(car.t.slipF || 0).toFixed(2)} sR ${(car.t.slipR || 0).toFixed(2)} cap ${(drv.state.cap || 0).toFixed(2)}`);
  }
}
