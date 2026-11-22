// _hillclimb.mjs - THE HILL CLIMB, step 2 (?hillclimb; highway/hillplan.ts, hillground.ts), in
// node, per seed: the E36 Peak driven up by its race driver from the start line (SPAWN_S) to the
// summit's finish (5 km on), the window moving with it as in the game; on the way, every 4 m:
// the road's grade read back from the ground (by stretch kind), the ground between two parts of the
// road (its steepest slope there, and how many points past 0.75 - a slope the game takes as a
// wall), and 7 m past each edge whether the ground falls away (a DROP: on a bend's outside, the
// inside, a straight, a switchback cluster); the run's time, its top and switchback speeds, the m
// it ran off the road. [SEEDS=4242,7,99] [CAR=bmv-e36peak] node tools/scratch/_hillclimb.mjs
process.env.HILLCLIMB = '1';
const { makeCar, reset, step, PHYSICS_STEP_SECONDS: DT } = await import('../../src/vehicle.ts');
const L = await import('../../src/lab.ts');
const hw = await import('../../src/highway.ts');
const { createAIDriver } = await import('../../src/ai/circuit.ts');
const { aiTraits } = await import('../../src/ai/traits.ts');
const { heightAt } = await import('../../src/world/terrain.ts');
const { SPAWN_S } = await import('../../src/highway/presets.ts');
const { HILL_LENGTH_M } = await import('../../src/highway/hillplan.ts');

const SEEDS = (process.env.SEEDS || '4242,7,99').split(',').map(Number);
const CAR = process.env.CAR || 'bmv-e36peak';
hw.addHighwayLevel();
L.setLevel('highway');
const level = L.LEVEL;

/**
 * The ground checks round the road as it stands (the window): grades, the slopes between legs,
 * the drops.
 * @param seed the road's seed
 * @param acc the tallies, added to
 * @param fromS road distance checked from, m
 */
function checkGround(seed, acc, fromS) {
  const pts = level._hw.pts, half = level._hw.geo.hw;
  for (let i = 2; i < pts.length - 6; i++) {
    const here = pts[i];
    if (here.s <= fromS || here.s > SPAWN_S + HILL_LENGTH_M) continue;
    acc.checkedS = Math.max(acc.checkedS, here.s);
    const kind = here.tag || 'straight', ahead = pts[i + 5];
    const grade = (heightAt(ahead.x, ahead.y) - heightAt(here.x, here.y)) / (ahead.s - here.s);
    (acc.grades[kind] ||= []).push(grade);
    const heading = Math.atan2(pts[i + 1].y - pts[i - 1].y, pts[i + 1].x - pts[i - 1].x);
    const before = Math.atan2(here.y - pts[i - 1].y, here.x - pts[i - 1].x);
    const after = Math.atan2(pts[i + 1].y - here.y, pts[i + 1].x - here.x);
    const curv = Math.atan2(Math.sin(after - before), Math.cos(after - before)) / 4;
    for (const side of [1, -1]) {
      const out = half + 7, px = here.x - Math.sin(heading) * side * out,
        py = here.y + Math.cos(heading) * side * out;
      const fall = heightAt(here.x, here.y) - heightAt(px, py);
      if (fall < 10) continue;
      const where = kind === 'switchbacks' ? 'switchbacks' : Math.abs(curv) < 1 / 300
        ? 'straight' : Math.sign(side) === Math.sign(curv) ? 'inside' : 'outside';
      acc.drops[where] = (acc.drops[where] || 0) + 1;
    }
    // the ground between two parts of the road: half way to any road point 15-70 m off and more
    // than 80 m along
    for (let j = i + 25; j < pts.length; j += 3) {
      const other = pts[j], gap = Math.hypot(other.x - here.x, other.y - here.y);
      if (gap < 15 || gap > 70 || other.s - here.s < 80) continue;
      const mx = (here.x + other.x) / 2, my = (here.y + other.y) / 2, step = 0.5;
      const slope = Math.hypot(heightAt(mx + step, my) - heightAt(mx - step, my),
        heightAt(mx, my + step) - heightAt(mx, my - step)) / (2 * step);
      acc.between.push(slope);
    }
  }
}

for (const seed of SEEDS) {
  hw.setHighwayPreset(level, 'twisty', 'peak');
  level.seed = seed;
  hw.resetHighway(level);
  const lane = level._hw.geo.centres[0], start = hw.roadPose(level, SPAWN_S, lane);
  const car = makeCar(CAR);
  reset(car, start.x, start.y, start.h);
  const driver = createAIDriver(level, aiTraits(4, 0, 1, 99));
  const acc = { grades: {}, drops: {}, between: [], checkedS: 0 };
  let time = 0, top = 0, offRoadM = 0, switchV = [], lastS = SPAWN_S, frame = null;
  checkGround(seed, acc, -1);
  while (time < 900) {
    const input = { ...driver.drive(car, DT, { cars: [], vMax: 120, lap: 1, laps: 99,
      road: { middleOff: null, hand: 1 } }) };
    L.applyGround(car, DT);
    step(car, input, DT);
    const moved = hw.stepHighway(level, car);
    if (moved || level._hw.pts[level._hw.pts.length - 1].s > acc.checkedS + 200)
      checkGround(seed, acc, acc.checkedS);
    time += DT;
    frame = hw.roadFrame(level, car.x, car.y, frame ? frame.s : null);
    if (!frame) continue;
    const kmh = Math.hypot(car.vx, car.vy) * 3.6;
    top = Math.max(top, kmh);
    if (Math.abs(frame.off) > level._hw.geo.hw) offRoadM += Math.max(0, frame.s - lastS);
    if (level._hw.pts.find((point) => point.s >= frame.s)?.tag === 'switchbacks') switchV.push(kmh);
    lastS = frame.s;
    if (frame.s >= SPAWN_S + HILL_LENGTH_M) break;
  }
  const grades = Object.entries(acc.grades).map(([kind, list]) =>
    `${kind} ${(100 * list.reduce((a, b) => a + b, 0) / list.length).toFixed(1)} %`).join(', ');
  const sorted = acc.between.sort((a, b) => a - b);
  console.log(`seed ${seed}: ${lastS >= SPAWN_S + HILL_LENGTH_M ? 'FINISHED' : 'not finished'}`
    + ` in ${time.toFixed(1)} s (${((lastS - SPAWN_S) / 1000).toFixed(2)} km), top ${top.toFixed(0)}`
    + ` km/h, the switchbacks ${(switchV.reduce((a, b) => a + b, 0) / Math.max(1, switchV.length))
      .toFixed(0)} km/h on average, off the road ${offRoadM.toFixed(0)} m`);
  console.log(`  grades read back: ${grades}`);
  console.log(`  ground between the road's parts: ${sorted.length} points, slope median `
    + `${(sorted[sorted.length >> 1] ?? 0).toFixed(2)}, 95 % ${(sorted[Math.floor(sorted.length
      * 0.95)] ?? 0).toFixed(2)}, worst ${(sorted[sorted.length - 1] ?? 0).toFixed(2)}; past 0.75`
    + ` (a wall) ${sorted.filter((slope) => slope > 0.75).length}`);
  console.log(`  drops 7 m past the edge (points): ${JSON.stringify(acc.drops)}`);
}
