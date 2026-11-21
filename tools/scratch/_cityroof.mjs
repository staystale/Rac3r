// _cityroof.mjs - GETAWAY STOCKHOLM's tunnels DRY and its water SANDY, its yachts SOLID (?stockholm;
// highway/citywater.ts), in node: the road built as the game builds it (stepHighway, as
// tools/worldhash.mjs) to the middle of each of the first tunnel and water stretches, in a downpour
// (WEATHER.wetness 1): the surface a wheel touches (world/wear.ts groundAt) every 4 m down the
// tunnel's middle lane - its id and grip, dry or damp - against the same lane on the open road
// before it; on the water 30 m out: its id; how many yachts stand in the window and how many are
// solids. 3 seeds.
// STOCKHOLM=1 node tools/scratch/_cityroof.mjs [road motorway]
import * as L from '../../src/lab.ts';
import { createHighway, resetHighway, stepHighway, roadPose, setHighwayPreset }
  from '../../src/highway.ts';
import { cityStretchAt } from '../../src/highway/cityplan.ts';
import { groundAt } from '../../src/world/wear.ts';
import { WEATHER } from '../../src/world/weather.ts';

const ROAD = process.argv[2] || 'motorway';

/**
 * The first stretch of a kind past 300 m: its start and end, m.
 * @param kind the kind
 * @param seed the road's seed
 * @returns [from, to]
 */
function firstOf(kind, seed) {
  for (let dist = 300; dist < 40000; dist += 10) {
    const stretch = cityStretchAt(dist, seed);
    if (stretch.kind === kind) return [dist - stretch.along, dist - stretch.along + stretch.len];
  }
  return null;
}

for (const seed of [4242, 7, 99]) {
  const level = createHighway(seed, ROAD);
  setHighwayPreset(level, ROAD, 'stockholm');
  L.LEVELS.push(level);
  L.setLevel('highway');
  resetHighway(level);
  const lane = level._hw.geo.centres[1] ?? level._hw.geo.centres[0], car = { x: 0, y: 0 };
  const driveTo = (target) => {
    for (let dist = 300; dist <= target; dist += 4) {
      const pose = roadPose(level, dist, lane);
      car.x = pose.x;
      car.y = pose.y;
      stepHighway(level, car);
    }
  };
  WEATHER.wetness = 1;
  WEATHER.rain = 1;
  const tunnel = firstOf('tunnel', seed), water = firstOf('water', seed);
  const out = [];
  if (tunnel) {
    driveTo(tunnel[0] - 300);
    const tally = (from, to) => {
      const seen = {};
      for (let dist = from; dist < to; dist += 4) {
        const pose = roadPose(level, dist, lane), surface = groundAt(pose.x, pose.y).surface;
        const key = `${surface.id}@${surface.mu.toFixed(2)}`;
        seen[key] = (seen[key] || 0) + 1;
      }
      return JSON.stringify(seen);
    };
    out.push(`tunnel ${Math.round(tunnel[0])}-${Math.round(tunnel[1])} m: in it (60 m in from each`
      + ` end) ${tally(tunnel[0] + 60, tunnel[1] - 60)}; the open road before it`
      + ` ${tally(tunnel[0] - 200, tunnel[0] - 40)}; roofs ${level._roofs?.length ?? 0}`);
  }
  if (water) {
    driveTo(water[0] - 300);
    const mid = (water[0] + water[1]) / 2, seen = {};
    for (const side of [-1, 1]) for (let along = -100; along <= 100; along += 20) {
      const pose = roadPose(level, mid + along, side * (level._hw.geo.hw + 30));
      const surface = groundAt(pose.x, pose.y).surface, key = `${surface.id}`;
      seen[key] = (seen[key] || 0) + 1;
    }
    const yachts = level.props.filter((prop) => prop.kind === 'yacht');
    const solid = yachts.filter((prop) => level.solids.some((box) => Math.hypot(box.x - prop.x,
      box.y - prop.y) < 0.5));
    out.push(`water ${Math.round(water[0])}-${Math.round(water[1])} m, 30 m out: ${JSON
      .stringify(seen)}; yachts ${yachts.length}, solid ${solid.length}`);
  }
  console.log(`seed ${seed}: ${out.join(' | ')}`);
  L.LEVELS.pop();
}
