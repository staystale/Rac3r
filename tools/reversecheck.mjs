// reversecheck.mjs — the regression test for reverse.
//
// Added 2026-09-27 after "braking causes you to go backwards" shipped and survived every other harness: they all
// measured body slip only while speed > 3 m/s, so none of them could see a car that had STOPPED and then driven
// off backwards. REWRITTEN 2026-10-03 for HOLD R TO REVERSE (user: the guide card is right, the game was wrong).
//   1. brake from speed and KEEP HOLDING  -> must stop and STAY stopped (BRAKE can never reverse you)
//   2. hold R from a standstill           -> must drive backwards
//   3. hold R from 30 m/s                 -> must brake to a stop first, then reverse — never speed up forwards
//   4. reversing, release R, then brake   -> must come to rest in a FORWARD gear, without driving off
//      (released alone it only coasts: there is NO rolling resistance / engine braking yet — TODO step 2;
//       MEASURED 2026-10-03: 5.5 -> 5.4 m/s in 1 s, both directions)
//   5. reversing, press GAS               -> must stop, then drive forwards
import { makeCar, step, reset, neutralInput, DT } from '../src/vehicle.js';
import { CAR_IDS } from '../src/cars.js';

const ramp = (held) => Math.min(1, 0.26 + 0.74 * (held / 0.50));
function sim(id, v0, phases) {
  const car = makeCar(id); reset(car, 0, 0, 0);
  if (v0) { car.vx = v0; car.gear = Math.min(4, car.spec.gears.length); car.rpm = 5000; }
  const log = [];
  for (const [secs, inputs] of phases) {
    const held = {};
    for (let t = 0; t < secs; t += DT) {
      const inp = { ...neutralInput() };
      for (const k of inputs) { held[k] = (held[k] || 0) + DT; inp[k] = ramp(held[k]); }
      step(car, inp, DT);
      log.push({ v: car.t.vLong, gear: car.gear });
    }
  }
  return { car, log };
}
const min = (a) => Math.min(...a), max = (a) => Math.max(...a);
const fails = [];
const row = (n, id, ok, txt) => { if (!ok) fails.push(`${n}. ${id}: ${txt}`); console.log(`  ${id.padEnd(13)} ${txt}   ${ok ? 'ok' : 'FAIL'}`); };

console.log('1. BRAKE FROM SPEED AND KEEP HOLDING — must stop and stay stopped');
for (const id of CAR_IDS) {
  const { car, log } = sim(id, 30, [[10, ['brake']]]);
  const back = min(log.map((l) => l.v));
  row(1, id, car.gear > 0 && back > -0.4, `gear ${car.gear}, backwards ${Math.abs(back).toFixed(1)} m/s`);
}
console.log('\n2. HOLD R FROM A STANDSTILL — must reverse');
for (const id of CAR_IDS) {
  const { car } = sim(id, 0, [[4, ['reverse']]]);
  row(2, id, car.gear < 0 && car.t.vLong < -1, `gear ${car.gear}, ${car.t.vLong.toFixed(1)} m/s`);
}
console.log('\n3. HOLD R FROM 30 m/s — brake to a stop first, then reverse');
for (const id of CAR_IDS) {
  const { car, log } = sim(id, 30, [[14, ['reverse']]]);
  const fwd = max(log.map((l) => l.v));
  row(3, id, fwd <= 30.05 && car.gear < 0 && car.t.vLong < -1, `peak fwd ${fwd.toFixed(1)}, ends gear ${car.gear} at ${car.t.vLong.toFixed(1)} m/s`);
}
console.log('\n4. REVERSING, RELEASE R, BRAKE — comes to rest in a forward gear, does not drive off');
for (const id of CAR_IDS) {
  const { car, log } = sim(id, 0, [[4, ['reverse']], [1, []], [6, ['brake']], [2, []]]);
  const fwd = max(log.slice(Math.round(4 / DT)).map((l) => l.v));
  row(4, id, car.gear > 0 && Math.abs(car.t.vLong) < 0.5 && fwd < 0.5, `gear ${car.gear}, ${car.t.vLong.toFixed(2)} m/s, worst forward ${fwd.toFixed(2)}`);
}
console.log('\n5. REVERSING, PRESS GAS — stops, then drives forwards');
for (const id of CAR_IDS) {
  const { car } = sim(id, 0, [[4, ['reverse']], [8, ['throttle']]]);
  row(5, id, car.gear > 0 && car.t.vLong > 3, `gear ${car.gear}, ${car.t.vLong.toFixed(1)} m/s`);
}
console.log(fails.length ? '\nFAIL:\n  ' + fails.join('\n  ') : '\nreverse behaviour: OK');
process.exitCode = fails.length ? 1 : 0;
