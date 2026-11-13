// _aigapcheck.mjs - THE RACING AI OVER L.A. LIVELY's GAP JUMP (scratch; the AI as it drives every
// level - nothing changed for the jump): an AI field spread round the lap, each on its last lap
// (so it takes the joker, unless it forgets), stepped as the crossover check steps a car
// (world/crossings.ts clampWorld, contact.ts carContacts); for every pass over the joker's
// straight: its speed at the kicker's foot, where it touched down (m past the lip: the deck starts
// 16 m past it), cleared or short, its airtime, the hardest landing load, its time from the
// joker's first corner to the merge, and any car stuck on the joker (under 1 m/s for 3 s).
// SEED=1 node tools/scratch/_aigapcheck.mjs [ai n] [car] (env SECONDS)
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { carContacts } from '../../src/contact.ts';
import { clampWorld } from '../../src/world/crossings.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';
import { LALIVELY_JUMP } from '../../src/world/levels/venues/lalively.ts';

const [countArg = '20', carId = 'rally-4x4'] = process.argv.slice(2);
const COUNT = +countArg, SECONDS = +(process.env.SECONDS || 120), DT = PHYSICS_STEP_SECONDS;
let dice = +(process.env.SEED || 1);
Math.random = () => { dice = (Math.imul(dice, 1664525) + 1013904223) >>> 0; return dice / 4294967296; };
L.setLevel('xgayms'); L.clearWear();
const level = L.LEVEL, sub = level.subtrack, total = sub.totalDist;
// the kicker's and the landing's middle pieces (each laid as pieces side by side across the road)
const middle = (kind) => { const all = LALIVELY_JUMP.filter((bump) => bump.kind === kind); return all[(all.length - 1) >> 1]; };
const kicker = middle('ramp'), landing = middle('table');
const lipX = kicker.x - kicker.len / 2, footX = kicker.x + kicker.len / 2;
const deckX = landing.x + landing.len / 2 - 0.3 * landing.len, lineY = kicker.y;
// the joker's straight (a car within 9 m of its line, east of the run-off past the landing)
const onStraight = (car) => Math.abs(car.y - lineY) < 9 && car.x < footX + 40 && car.x > 20;
const field = [];
for (let k = 0; k < COUNT; k++) {
  const car = makeCar(carId);
  car.spec = { ...car.spec, id: `${carId}#${k + 1}` };
  const spot = L.onTrack(sub, (total * k) / COUNT, 0, {});
  reset(car, spot.x, spot.y, spot.rot);
  const drv = createAIDriver(level, aiTraits(2, k, COUNT, 7));
  field.push({ car, drv, k, pass: null, passes: [], slow: 0, stuck: false });
}
for (let tick = 0; tick * DT < SECONDS; tick++) {
  for (const entry of field) {
    const car = entry.car;
    clampWorld(car, DT);
    L.applyGround(car, DT);
    const others = field.filter((other) => other !== entry).map((other) => other.car);
    const input = entry.drv.drive(car, DT, { cars: others, lap: 5, laps: 5 });
    step(car, input, DT);
    const speed = Math.hypot(car.vx, car.vy);
    if (onStraight(car)) {
      if (!entry.pass) entry.pass = { foot: null, lip: null, brake: 0, land: null, air: 0, load: 0, from: tick * DT };
      const pass = entry.pass;
      if (pass.foot == null && car.x <= footX) pass.foot = speed * 3.6;
      if (pass.lip == null && car.x <= lipX) pass.lip = speed * 3.6;
      // (braking on the approach and the kicker: the AI's pedal, 0..1, the most)
      if (pass.lip == null && car.x <= footX + 40) pass.brake = Math.max(pass.brake, input.brake || 0);
      pass.air = Math.max(pass.air, car.air);
      if (pass.air > 0.25 && pass.land == null && car.air === 0) pass.land = car.x;
      if (pass.land != null) pass.load = Math.max(pass.load, car.loadK);
      entry.slow = speed < 1 ? entry.slow + DT : 0;
      if (entry.slow > 3) entry.stuck = true;
    } else if (entry.pass) {
      entry.passes.push({ ...entry.pass, time: tick * DT - entry.pass.from });
      entry.pass = null;
    }
  }
  carContacts(field.map((entry) => entry.car));
}
let cleared = 0, short = 0, none = 0;
for (const entry of field) {
  for (const pass of entry.passes) {
    if (pass.foot == null) continue;
    const ok = pass.land != null && pass.land <= deckX;
    if (pass.land == null) none++; else if (ok) cleared++; else short++;
    console.log(`car ${String(entry.k + 1).padStart(2)}: foot ${pass.foot.toFixed(0)} km/h, lip ${(pass.lip ?? 0).toFixed(0)} km/h, brake ${pass.brake.toFixed(2)}, down`
      + ` ${pass.land == null ? '-' : (lipX - pass.land).toFixed(1)} m past the lip, air`
      + ` ${pass.air.toFixed(2)} s, landing load ${pass.load.toFixed(2)}, ${pass.land == null
        ? 'NO FLIGHT' : ok ? 'cleared' : 'SHORT'}, straight ${pass.time.toFixed(2)} s`);
  }
  if (entry.stuck) console.log(`car ${entry.k + 1}: STUCK on the joker`);
}
console.log(`passes: ${cleared} cleared, ${short} short, ${none} without a flight; stuck`
  + ` ${field.filter((entry) => entry.stuck).length}`);
