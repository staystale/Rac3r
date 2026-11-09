// _jerseycheck.mjs - THE JERSEY BARRIER THROWS A CAR HIT FAST (world/jersey.ts; owner 11-09: "a
// jersey barrier that flips cars at higher speed"): a hatch driven straight at a long straight
// barrier, at each speed and angle TRIALS times (the dice differ), stepped as the game steps a car
// (the clamps, the damage's side kick, the tyres or the tumble); how many of them rolled within
// 3 s - a Jersey barrier against Armco and a wall.
// node tools/scratch/_jerseycheck.mjs [trials]
import * as L from '../../src/lab.ts';
import { makeCar, reset, step, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { rolling, tripCheck, stepRoll } from '../../src/roll.ts';
import { hit } from '../../src/damage.ts';

const TRIALS = +(process.argv[2] || 20);
L.setLevel('lab');
const SPEEDS = [60, 90, 120, 160], ANGLES = [5, 12, 25, 60];
let dice = 12345;
Math.random = () => { dice = (Math.imul(dice, 1664525) + 1013904223) >>> 0; return dice / 4294967296; };
for (const kind of ['jersey', 'armco', 'wall']) {
  // a barrier along y = 0 from x -400 to 400, far from the lab's own things
  const level = { barriers: [{ kind, pts: [[-400, 600], [400, 600]] }] };
  L.prepBarriers(level);
  const rows = [];
  for (const kmh of SPEEDS) {
    const row = [];
    for (const deg of ANGLES) {
      let rolled = 0;
      for (let trial = 0; trial < TRIALS; trial++) {
        const car = makeCar('hatch-fwd'), head = deg * Math.PI / 180, v = kmh / 3.6;
        // aimed to meet the barrier 1.5 s on
        reset(car, -200 + trial, 600 - Math.sin(head) * v * 1.5, head);
        car.vx = Math.cos(head) * v; car.vy = Math.sin(head) * v;
        for (let t = 0; t < 3; t += DT) {
          const vx0 = car.vx, vy0 = car.vy;
          L.clampToBarriers(car, level.barriers);
          hit(car, vx0, vy0);
          L.applyGround(car, DT);
          if (rolling(car)) stepRoll(car, DT, () => {});
          else { step(car, { steer: 0, throttle: 0.3, brake: 0, handbrake: 0 }, DT); tripCheck(car, DT); }
          if (rolling(car)) { rolled++; break; }
        }
      }
      row.push(`${String(Math.round(100 * rolled / TRIALS)).padStart(3)} %`);
    }
    rows.push(`  ${String(kmh).padStart(3)} km/h: ${row.join('  ')}`);
  }
  console.log(`${kind} - rolled, by angle ${ANGLES.join(' / ')} deg:`);
  for (const row of rows) console.log(row);
}
