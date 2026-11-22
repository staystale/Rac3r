// _ghostcheck.mjs - ?ghost's tape (game/ghostcar.ts), headless: an AI drives a lap of a level (from
// its first crossing of the line to the next), recorded GHOST_HZ a second on the lap's clock; then
// played back at every sim step (120 a second) against where the car really was - the pose error
// (m, and the heading's deg) - straight from the tape and after its text round trip (as saved);
// and the size of the saved lap. node tools/scratch/_ghostcheck.mjs [level] [car]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const { newTape, recordTape, poseAt, encodeTape, decodeTape, GHOST_HZ } =
  await import('../../src/game/ghostcar.ts');

const [level = 'brands-snatch', carId = 'hatch-rwd'] = process.argv.slice(2);
L.setLevel(level); L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist, spawn = L.LEVEL.spawn;
const car = makeCar(carId);
reset(car, spawn.x, spawn.y, spawn.heading);
const drv = createAIDriver(L.LEVEL, aiTraits(2, 0, 1, 1));
const tape = newTape(carId), truth = [];
let lastD = null, laps = 0, clock = 0;
for (let t = 0; t < 400 && laps < 2; t += DT) {
  L.applyGround(car, DT);
  step(car, drv.drive(car, DT, { cars: [], lap: 1, laps: 9 }), DT);
  L.barrierClamp(car); L.solidClamp(car);
  const dist = L.querySubtrack(sub, car.x, car.y).trackDist;
  if (lastD !== null && lastD > total * 0.8 && dist < total * 0.2) {
    laps++;
    if (laps === 2) tape.time = clock;
    clock = 0;
  }
  lastD = dist;
  if (laps === 1) {
    recordTape(tape, clock, { x: car.x, y: car.y, h: car.heading });
    truth.push({ clock, x: car.x, y: car.y, h: car.heading });
    clock += DT;
  }
}
const text = encodeTape(tape), back = decodeTape(text);
function errors(played) {
  let worst = 0, sum = 0, worstHead = 0;
  // (past the tape's last sample - under 1 / GHOST_HZ s at the line - the ghost holds it, and the
  // next lap's begins: not counted)
  for (const real of truth.filter((step) => step.clock <= (played.xs.length - 1) / GHOST_HZ)) {
    const pose = poseAt(played, real.clock);
    const miss = Math.hypot(pose.x - real.x, pose.y - real.y);
    let turn = pose.h - real.h; turn = Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn)));
    worst = Math.max(worst, miss); sum += miss; worstHead = Math.max(worstHead, turn);
  }
  return `pose error mean ${(sum / truth.length * 100).toFixed(1)} cm, worst `
    + `${(worst * 100).toFixed(1)} cm, heading worst ${(worstHead * 180 / Math.PI).toFixed(2)} deg`;
}
console.log(`${level} ${carId}: a lap of ${tape.time.toFixed(2)} s, ${tape.xs.length} samples `
  + `(${GHOST_HZ} Hz); played at ${truth.length} sim steps`);
console.log(`  from the tape:        ${errors(tape)}`);
console.log(`  after save and load:  ${errors(back)}`);
console.log(`  saved size: ${text.length} characters (${(text.length / 1024).toFixed(1)} KB), `
  + `${(text.length / tape.time).toFixed(0)} a second`);
