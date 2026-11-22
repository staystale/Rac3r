// _hillgrade.mjs - THE HILL CLIMB'S GRADE, step 1 (?hillgrade; highway/hillgrade.ts), in node: the
// E36 Peak on the endless road (countryside motorway, its race driver steering, the pedals ours)
// with the ground rising GRADE along the road (Level.climb): 0-100 km/h from rest, its speed and
// distance after 10 s, and 100-0 km/h on the brakes - flat, up 7 % and 10 %, down 7 %; the grade
// the car's own height reads back (m risen over the run / m along it), its slope force.
// [CAR=bmv-e36peak] node tools/scratch/_hillgrade.mjs
const { makeCar, reset, step, PHYSICS_STEP_SECONDS: DT } = await import('../../src/vehicle.ts');
const L = await import('../../src/lab.ts');
const hw = await import('../../src/highway.ts');
const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const { heightAt } = await import('../../src/world/terrain.ts');

const CAR = process.env.CAR || 'bmv-e36peak';
hw.addHighwayLevel();
L.setLevel('highway');
const level = L.LEVEL;

/**
 * One run on a fresh road at a grade: from rest (or from 100 km/h on the brakes).
 * @param grade the rise per m along the road
 * @param braking true: from 100 km/h, full brakes
 * @returns its numbers
 */
function runAt(grade, braking) {
  hw.setHighwayPreset(level, 'motorway', 'countryside');
  hw.resetHighway(level);
  level.climb = grade ? (dist) => grade * dist : undefined;
  const lane = level._hw.geo.centres[1] ?? level._hw.geo.centres[0];
  const start = hw.roadPose(level, 400, lane);
  const car = makeCar(CAR);
  reset(car, start.x, start.y, start.h);
  for (let i = 0; i < 400 && level._hw.q?.s == null; i++) hw.stepHighway(level, car);
  const driver = createAIDriver(level, aiTraits(4, 0, 1, 99));
  if (braking) {
    car.vx = Math.cos(start.h) * 100 / 3.6;
    car.vy = Math.sin(start.h) * 100 / 3.6;
  }
  const z0 = heightAt(car.x, car.y), s0 = hw.roadFrame(level, car.x, car.y, null).s;
  let time = 0, to100 = null, stopAt = null, slope = 0, steps = 0, airS = 0;
  for (; time < 30; time += DT) {
    const input = { ...driver.drive(car, DT, { cars: [], vMax: 200, lap: 1, laps: 99,
      road: { middleOff: null, hand: 1 } }) };
    Object.assign(input, braking ? { throttle: 0, brake: 1 } : { throttle: 1, brake: 0 },
      { handbrake: 0 });
    L.applyGround(car, DT);
    step(car, input, DT);
    hw.stepHighway(level, car);
    slope += car.slopeLong || 0;
    steps++;
    if (car.air > 0) airS += DT;
    const kmh = Math.hypot(car.vx, car.vy) * 3.6;
    if (!braking && to100 === null && kmh >= 100) to100 = time;
    if (braking && kmh < 0.5) { stopAt = time; break; }
    if (!braking && time >= 10) break;
  }
  const frame = hw.roadFrame(level, car.x, car.y, null);
  const along = frame.s - s0, rise = heightAt(car.x, car.y) - z0;
  return { to100, kmh: Math.hypot(car.vx, car.vy) * 3.6, along, rise, stopAt,
    slope: slope / Math.max(1, steps), airS,
    massG: car.spec.mass * 9.81 };
}

for (const grade of [0, 0.07, 0.10, -0.07]) {
  const go = runAt(grade, false), stop = runAt(grade, true);
  console.log(`grade ${(grade * 100).toFixed(0).padStart(3)} %: 0-100 ${go.to100?.toFixed(2) ?? '-'} s,`
    + ` after 10 s ${go.kmh.toFixed(0)} km/h and ${go.along.toFixed(0)} m (risen ${go.rise.toFixed(1)}`
    + ` m: ${(100 * go.rise / Math.max(1, go.along)).toFixed(1)} %); 100-0 in ${stop.along.toFixed(1)} m`
    + ` (${stop.stopAt?.toFixed(2) ?? '-'} s, slope force ${(stop.slope / stop.massG).toFixed(3)} g, in the air ${stop.airS.toFixed(2)} s); its slope force on average ${(go.slope / go.massG)
      .toFixed(3)} g`);
}
