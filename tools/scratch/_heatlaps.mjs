// _heatlaps.mjs - tyre heat in NORMAL RACING: one racing AI (ai/circuit.ts, difficulty 4, alone)
// laps a circuit; per car, aids off then on: lap times, and over laps 2.. each axle's mean and
// peak temperature (the hottest tyre of the axle), the share of time each axle's hottest tyre
// spends below 65 C, in 65-110 C and above 110 C.
// node tools/scratch/_heatlaps.mjs <level> [laps] [cars,...]   JSON=path writes the numbers.
import { makeCar, step, reset, setAidsDefault, PHYSICS_STEP_SECONDS as DT }
  from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { CAR_IDS } from '../../src/cars.ts';
import { writeFileSync } from 'node:fs';

const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const { racingLine } = await import('../../src/ai/line.ts');
const [level = 'thruston', lapsArg = '4', carsArg = ''] = process.argv.slice(2);
const LAPS = Number(lapsArg), cars = carsArg ? carsArg.split(',') : CAR_IDS;

/** One car's laps: lap times and, from lap 2, the per-axle temperature statistics. */
function lapCar(id) {
  L.setLevel(level);
  L.clearWear();
  const line = racingLine(L.LEVEL), sub = L.LEVEL.subtrack, car = makeCar(id), start = line.pts[0];
  reset(car, start.x, start.y, start.h);
  const driver = createAIDriver(L.LEVEL, aiTraits(4, 0, 1, 3));
  const axles = [0, 1].map(() => ({ sum: 0, peak: 0, cold: 0, ok: 0, hot: 0 }));
  let clock = 0, laps = 0, lapStart = 0, prev = null, counted = 0, stuck = 0;
  const times = [];
  while (laps < LAPS && clock < 200 * LAPS && stuck < 20) {
    L.applyGround(car, DT);
    step(car, driver.drive(car, DT, { cars: [], lap: laps + 1, laps: LAPS }), DT);
    clock += DT;
    stuck = Math.hypot(car.vx, car.vy) < 1 ? stuck + DT : 0;
    const where = L.querySubtrack(sub, car.x, car.y);
    if (prev !== null && prev > sub.totalDist - 80 && where.trackDist < 80
      && clock - lapStart > 20) {
      laps++;
      times.push(clock - lapStart);
      lapStart = clock;
    }
    if (Number.isFinite(where.trackDist)) prev = where.trackDist;
    if (laps < 1) continue;
    counted++;
    axles.forEach((axle, index) => {
      const temp = Math.max(car.tyreT[2 * index], car.tyreT[2 * index + 1]);
      axle.sum += temp;
      axle.peak = Math.max(axle.peak, temp);
      if (temp < 65) axle.cold++;
      else if (temp <= 110) axle.ok++;
      else axle.hot++;
    });
  }
  const share = (count) => Math.round((100 * count) / Math.max(1, counted));
  return { id, times, stuck: stuck >= 20, axles: axles.map((axle) => ({
    mean: axle.sum / Math.max(1, counted), peak: axle.peak, cold: share(axle.cold),
    ok: share(axle.ok), hot: share(axle.hot) })) };
}

const rows = [];
for (const aids of [false, true]) {
  setAidsDefault(aids);
  console.log(`\n${level}, AIDS ${aids ? 'ON' : 'OFF'}: laps 2-${LAPS}, hottest tyre per axle: `
    + 'mean / peak C, % of time <65 | 65-110 | >110');
  for (const id of cars) {
    const row = lapCar(id);
    rows.push({ level, aids, ...row });
    const axleText = (axle) => `${axle.mean.toFixed(0).padStart(3)}/${axle.peak.toFixed(0)
      .padStart(3)} ${String(axle.cold).padStart(3)}|${String(axle.ok).padStart(3)}|${
      String(axle.hot).padStart(3)}`;
    console.log(`${id.padEnd(14)} F ${axleText(row.axles[0])}   R ${axleText(row.axles[1])}   laps ${
      row.times.map((time) => time.toFixed(1)).join(' ')}${row.stuck ? ' STUCK' : ''}`);
  }
}
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
