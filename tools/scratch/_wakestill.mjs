// _wakestill.mjs - the wake on a STILL car (owner 11-09: "woosh marks next to the car when I'm
// parked still"): physics/wake.ts dragMul (the tow cue draws while it is under 0.95) for a parked
// car as the field drives off ahead, as a car goes past its door, and a moving tow for reference;
// the new wake.ts against the one at HEAD (tools/scratch/_wake-old.ts, made by `git show`).
import { wakeStep } from '../../src/physics/wake.ts';
let old = null;
try { old = (await import('./_wake-old.ts')).wakeStep; } catch { /* no old copy */ }
const car = (x, y, v, id = 'naffcar') => ({ x, y, vx: v, vy: 0, heading: 0,
  spec: { wid: 2, len: 5, id } });
const cases = {
  'parked, a car 8 m ahead driving off at 108 km/h': () => [car(0, 0, 0), car(8, 0, 30)],
  'parked, a car passing its door at 108 km/h': () => [car(0, 0, 0), car(4, 2.3, 30)],
  'both at 180 km/h, 8 m behind (the tow)': () => [car(0, 0, 50), car(8, 0, 50)],
  'both at 180 km/h, door to door (side draft)': () => [car(0, 0, 50), car(-4, 2.3, 50)],
};
for (const [name, make] of Object.entries(cases)) {
  const row = [];
  for (const [label, step] of [['old', old], ['new', wakeStep]]) {
    if (!step) continue;
    const cars = make();
    step(cars);
    row.push(`${label} ${cars.map((one) => (one.dragMul ?? 1).toFixed(3)).join(' / ')}`);
  }
  console.log(name.padEnd(48), row.join('   '));
}
