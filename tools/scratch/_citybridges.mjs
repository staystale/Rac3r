// _citybridges.mjs - bridges over GETAWAY STOCKHOLM's road per km (highway/extras.ts: bridges,
// underpasses, the motorway over a river) and its tunnels and water stretches, in node: the road
// built as the game builds it (stepHighway, as tools/worldhash.mjs) over KM km, 3 seeds.
// STOCKHOLM=1 node tools/scratch/_citybridges.mjs [km 20] [road motorway]
import * as L from '../../src/lab.ts';
import { createHighway, resetHighway, stepHighway, roadPose, setHighwayPreset }
  from '../../src/highway.ts';
import { cityStretchAt } from '../../src/highway/cityplan.ts';
const KM = +(process.argv[2] || 20), ROAD = process.argv[3] || 'motorway';
let bridges = 0, tunnels = 0, water = 0, km = 0;
for (const seed of [4242, 7, 99]) {
  const level = createHighway(seed, ROAD);
  setHighwayPreset(level, ROAD, 'stockholm');
  L.LEVELS.push(level);
  L.setLevel('highway');
  resetHighway(level);
  const lane = level._hw.geo.centres[0], car = { x: 0, y: 0 }, seen = new Set();
  for (let dist = 300; dist <= 300 + KM * 1000; dist += 4) {
    const pose = roadPose(level, dist, lane);
    car.x = pose.x;
    car.y = pose.y;
    stepHighway(level, car);
    for (const prop of level.props)
      if ((prop.kind === 'bridge' || prop.kind === 'river' || prop.kind === 'tunnel')
        && !seen.has(prop)) {
        seen.add(prop);
        if (prop.kind !== 'tunnel' || prop.pair % 2) bridges++;
      }
  }
  let last = null;
  for (let dist = 300; dist <= 300 + KM * 1000; dist += 20) {
    const kind = cityStretchAt(dist, seed).kind;
    if (kind !== last && kind === 'tunnel') tunnels++;
    if (kind !== last && kind === 'water') water++;
    last = kind;
  }
  km += KM;
  L.LEVELS.pop();
}
console.log(`${ROAD} ${km} km: ${(bridges / km).toFixed(2)} bridges or underpasses over the road a`
  + ` km, ${(tunnels / km).toFixed(2)} tunnels a km, ${(water / km).toFixed(2)} long bridges over`
  + ` water a km`);
