// _tripseeds.mjs - where the first ways off and on lie on a highway seed (for photos): the first
// short / long slip, junction off-slip, junction on-slip, side road end and roadside station.
// [ROAD=motorway] [SCENERY=countryside] [SEEDS=1-30] [KM=4] node tools/scratch/_tripseeds.mjs
const { makeCar, reset } = await import('../../src/vehicle.ts');
const L = await import('../../src/lab.ts');
const hw = await import('../../src/highway.ts');
const { waysOf, rampsOf } = await import('../../src/ai/trafficTrips.ts');
const { stationsOf } = await import('../../src/ai/trafficFuel.ts');
const ROAD = process.env.ROAD || 'motorway', SCENERY = process.env.SCENERY || 'countryside';
const [first, last] = (process.env.SEEDS || '1-30').split('-').map(Number);
const KM = +(process.env.KM || 4);
hw.addHighwayLevel();
L.setLevel('highway');
const level = L.LEVEL;
for (let seed = first; seed <= (last || first); seed++) {
  level.seed = seed;
  level.roadType = null;
  hw.setHighwayPreset(level, ROAD, SCENERY);
  hw.resetHighway(level);
  const you = makeCar('hatch-rwd');
  reset(you, level.spawn.x, level.spawn.y, level.spawn.heading);
  const seen = { exit: null, junction: null, ramp: null, side: null, station: null };
  for (let dist = 0; dist < KM * 1000; dist += 4) {
    const here = level._hw.q ? level._hw.q.s : 0;
    const pose = hw.roadPose(level, here + 4, level._hw.geo.own[0]);
    Object.assign(you, { x: pose.x, y: pose.y, heading: pose.h, vx: 0, vy: 0 });
    hw.stepHighway(level, you);
    const ways = waysOf(level);
    for (const exit of ways.exits) {
      const key = exit.stopShort ? 'exit' : 'junction';
      seen[key] ??= Math.round(exit.s);
    }
    for (const ramp of rampsOf(level)) {
      const key = ramp.startV > 10 ? 'side' : 'ramp';
      seen[key] ??= Math.round(ramp.endS);
    }
    for (const station of stationsOf({ level })) seen.station ??= Math.round(station.s);
  }
  console.log(`${ROAD}/${SCENERY} seed ${seed}: ${JSON.stringify(seen)}`);
}
