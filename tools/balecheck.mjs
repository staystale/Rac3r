// balecheck.mjs — HAY BALES (user, 2026-10-04: "like tyres but heavier — you can hit them and they move; they explode with dust and slow
// you down a lot"). Node only. A hatch drives straight at one bale on flat ground: a NUDGE (8 km/h) pushes it without bursting it; a HIT
// (60 km/h) bursts it to straw, throws dust, and costs far more speed than hitting a tyre stack does. node tools/balecheck.mjs
import { makeCar, step, reset, DT } from '../src/vehicle.js';
import * as L from '../src/lab.js';
import { createCones } from '../src/cones.js';
L.setLevel('lab');
const fails = [];
const run = (kind, kmh) => {
  const cones = createCones(); cones.list.length = 0;
  cones.list.push({ kind, mode: kind === 'tyrestack' ? 'stack' : kind, x: 30, y: 0, hx: 30, hy: 0, vx: 0, vy: 0, ang: 0, spin: 0, down: 0, moved: false,
    mass: kind === 'bale' ? 250 : 38, r: kind === 'bale' ? 0.8 : 0.48, hitCount: 0, rollDist: 0, flipPhase: 0, flipSpeed: 0, wobblePhase: 0, wobbleAmp: 0 });
  cones.rebuildGrid();
  const x0 = kmh < 20 ? 26.6 : 22;   // a slow nudge starts 0.3 m short of contact (from 22 m it never arrived in 2 s)
  const car = makeCar('hatch-rwd'); reset(car, x0, 0, 0); car.vx = kmh / 3.6;
  const v0 = car.vx; let dust = 0, t = 0;
  // coast into it (no throttle, no brake) and measure the speed just after contact
  while (t < 2.0 && car.x < 31.5) { L.applyGround(car, DT); step(car, { steer: 0, throttle: 0, brake: 0, handbrake: 0, reverse: 0 }, DT); cones.step(car, DT); dust += cones.drainHits().filter((h) => h.kind === 'bale').length; t += DT; }
  const k = cones.list[0];
  // same coast with no object, to separate the hit from rolling resistance
  const free = makeCar('hatch-rwd'); reset(free, x0, 0, 0); free.vx = v0; let tf = 0;
  while (tf < t) { L.applyGround(free, DT); step(free, { steer: 0, throttle: 0, brake: 0, handbrake: 0, reverse: 0 }, DT); tf += DT; }
  return { kind: k.kind, moved: Math.hypot(k.x - 30, k.y).toFixed(1), lost: ((free.vx - car.vx) * 3.6).toFixed(1), dust };
};
const nudge = run('bale', 8), hit = run('bale', 60), stack = run('tyrestack', 60);
console.log('bale nudge 8 km/h :', JSON.stringify(nudge)); if (nudge.kind !== 'bale' || +nudge.moved < 0.3) fails.push('nudge');
console.log('bale hit 60 km/h  :', JSON.stringify(hit)); if (hit.kind !== 'straw' || hit.dust < 3) fails.push('hit');
console.log('stack hit 60 km/h :', JSON.stringify(stack)); if (+hit.lost < 2 * +stack.lost) fails.push('bale should cost far more than a stack');
console.log(fails.length ? 'FAILED: ' + fails.join(' | ') : 'bales: all OK');
