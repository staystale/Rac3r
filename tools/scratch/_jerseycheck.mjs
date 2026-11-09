// _jerseycheck.mjs - THE JERSEY BARRIER THROWS A CAR HIT FAST (world/jersey.ts; owner 11-09: "a
// jersey barrier that flips cars at higher speed"; ?jerseyover=1: "hitting it over 100mph should
// flip you and have a high chance to allow you over it into on coming traffic"): a hatch driven
// straight at a long straight barrier - held at its speed until it touches - at each speed and
// angle TRIALS times (the dice differ),
// stepped as the game steps a car (the clamps, the damage's side kick, the tyres or the tumble);
// how many of them rolled, and how many ended on the barrier's far side (and how far past it) - a Jersey barrier against
// Armco and a wall.
// [JERSEYOVER=1] node tools/scratch/_jerseycheck.mjs [trials]
import * as L from '../../src/lab.ts';
import { makeCar, reset, step, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { rolling, tripCheck, stepRoll } from '../../src/roll.ts';
import { hit } from '../../src/damage.ts';

const TRIALS = +(process.argv[2] || 20);
L.setLevel('lab');
const MPH = [50, 70, 90, 100, 120], ANGLES = [5, 12, 25, 60], LINE_Y = 600;
let dice = 12345;
Math.random = () => { dice = (Math.imul(dice, 1664525) + 1013904223) >>> 0; return dice / 4294967296; };
const pct = (count) => String(Math.round(100 * count / TRIALS)).padStart(3);
for (const kind of ['jersey', 'armco', 'wall']) {
  // a barrier along y = LINE_Y from x -400 to 400, far from the lab's own things
  const level = { barriers: [{ kind, pts: [[-400, LINE_Y], [400, LINE_Y]] }] };
  L.prepBarriers(level);
  const rows = [], past = [];
  for (const mph of MPH) {
    const row = [];
    for (const deg of ANGLES) {
      let rolled = 0, over = 0;
      for (let trial = 0; trial < TRIALS; trial++) {
        const car = makeCar('hatch-fwd'), head = deg * Math.PI / 180, v = mph / 2.23694;
        // aimed to meet the barrier 1.5 s on
        reset(car, -300 + trial, LINE_Y - Math.sin(head) * v * 1.5, head);
        car.vx = Math.cos(head) * v; car.vy = Math.sin(head) * v;
        let rolls = false, touched = false;
        for (let t = 0; t < 5.5; t += DT) {
          // (held at its speed until it touches: a car set going with still wheels slows)
          if (!touched) Object.assign(car, { vx: Math.cos(head) * v, vy: Math.sin(head) * v,
            heading: head, yawRate: 0 });
          const vx0 = car.vx, vy0 = car.vy;
          L.clampToBarriers(car, level.barriers);
          touched ||= car.vx !== vx0 || car.vy !== vy0;
          hit(car, vx0, vy0);
          L.applyGround(car, DT);
          if (rolling(car)) stepRoll(car, DT, () => {});
          else { step(car, { steer: 0, throttle: 0.3, brake: 0, handbrake: 0 }, DT); tripCheck(car, DT); }
          rolls ||= rolling(car);
        }
        if (rolls) rolled++;
        if (car.y > LINE_Y) { over++; past.push(car.y - LINE_Y); }
      }
      row.push(`${pct(rolled)}/${pct(over)}`);
    }
    rows.push(`  ${String(mph).padStart(3)} mph: ${row.join('   ')}`);
  }
  console.log(`${kind} - % rolled / % over it, by angle ${ANGLES.join(' / ')} deg:`);
  for (const row of rows) console.log(row);
  past.sort((a, b) => a - b);
  const at = (share) => (past[Math.floor(share * (past.length - 1))] ?? 0).toFixed(1);
  if (past.length) console.log(`  over it, m past its line: least ${at(0)}, a tenth ${at(0.1)},`
    + ` half ${at(0.5)}, most ${at(1)}`);
}
