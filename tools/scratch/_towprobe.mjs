// two identical cars flat out in line, 10 m apart from 150 km/h: the gap after 8 s, old tow vs wake;
// and a single-seater 10 m behind another at 220 km/h: front axle load, alone vs in the wake.
import { makeCar, step, reset, neutralInput, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { SURFACES } from '../../src/world/surfaces.ts';
import { slipstream } from '../../src/contact.js';
import { wakeStep } from '../../src/physics/wake.ts';
const mk = (id, x, v) => { const c = makeCar(id); reset(c, x, 0, 0); c.surface = SURFACES.tarmac; c.vx = v; c.gear = 5; c.rpm = 6000; return c; };
for (const id of ['hatch-fwd', 'naffcar', 'track-rwd']) for (const [name, fn] of [['none', null], ['tow', slipstream], ['wake', wakeStep]]) {
  const lead = mk(id, 10, 150 / 3.6), back = mk(id, 0, 150 / 3.6);
  let t = 0, minGap = 99, fzF = 0, n = 0;
  while (t < 8) { if (fn) fn([lead, back]); else { lead.dragMul = 1; back.dragMul = 1; }
    step(lead, { ...neutralInput(), throttle: 1 }, DT); step(back, { ...neutralInput(), throttle: 1 }, DT); t += DT;
    const gap = lead.x - back.x; minGap = Math.min(minGap, gap);
    if (t > 7) { fzF += back.t.FzF ?? 0; n++; } }
  console.log(`${id.padEnd(10)} ${name.padEnd(5)} gap after 8 s ${(lead.x - back.x).toFixed(1)} m (min ${minGap.toFixed(1)}) speeds ${(Math.hypot(lead.vx, lead.vy) * 3.6).toFixed(0)}/${(Math.hypot(back.vx, back.vy) * 3.6).toFixed(0)} drag x${(back.dragMul ?? 1).toFixed(2)} lead x${(lead.dragMul ?? 1).toFixed(2)} down x${(back.wakeDown ?? 1).toFixed(2)} FzF ${n ? (fzF / n).toFixed(0) : '-'}`);
}
