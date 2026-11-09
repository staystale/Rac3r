// _khoff.mjs - where an AI car lapping Knobhill's rallycross is off both the lap's road and the
// joker lane: its spots (x, y, lap m, past the edge, joker lane spot). KNOBHILLVENUE=1
// node tools/scratch/_khoff.mjs [car] [diff]
import * as L from '../../src/lab.ts';
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import { jokerLane, laneSpot } from '../../src/world/joker.ts';
const { createAIDriver } = await import('../../src/ai/circuit.ts'), { aiTraits } = await import('../../src/ai/traits.ts');
const [carId = 'rally-4x4', diff = '4'] = process.argv.slice(2);
L.setLevel('knobhill'); L.clearWear();
const st = L.LEVEL.subtrack, hw = st.width / 2, joker = jokerLane(L.LEVEL);
const car = makeCar(carId), p = L.onTrack(st, st.totalDist - 30, 0, {}); reset(car, p.x, p.y, p.rot);
const drv = createAIDriver(L.LEVEL, aiTraits(+diff, 0, 1));
let t = 0, last = -9;
const spots = [];
while (t < 75) {
  L.applyGround(car, PHYSICS_STEP_SECONDS); step(car, drv.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS); t += PHYSICS_STEP_SECONDS;
  const q = L.querySubtrack(st, car.x, car.y), spot = laneSpot(joker, car.x, car.y);
  if (q.dist > hw && Math.abs(spot.off) > joker.width / 2 && t - last > 0.25) {
    last = t;
    spots.push(`t ${t.toFixed(1)} at ${car.x.toFixed(0)},${car.y.toFixed(0)} lap ${Number.isFinite(q.trackDist) ? q.trackDist.toFixed(0) : '-'} past ${(q.dist - hw).toFixed(1)} joker along ${spot.along.toFixed(0)} off ${spot.off.toFixed(1)}`);
  }
}
console.log(spots.join('\n'));
