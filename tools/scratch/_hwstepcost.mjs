// _hwstepcost.mjs - what a window move costs on the endless road, in node: the road driven as the
// game drives it (stepHighway every 4 m, as tools/worldhash.mjs) over KM km; every step that moved
// the window timed (the dressing, the rebuild: subtrack, solids, covers), its worst and median ms,
// and the props / solids / covers / zones standing; by scenery.
// STOCKHOLM=1 node tools/scratch/_hwstepcost.mjs [sceneries countryside,stockholm] [km 6] [road]
import * as L from '../../src/lab.ts';
import { createHighway, resetHighway, stepHighway, roadPose, setHighwayPreset }
  from '../../src/highway.ts';
const sceneries = (process.argv[2] || 'countryside,stockholm').split(',');
const KM = +(process.argv[3] || 6), ROAD = process.argv[4] || 'motorway';
for (const scenery of sceneries) {
  const level = createHighway(4242, ROAD);
  setHighwayPreset(level, ROAD, scenery);
  L.LEVELS.push(level);
  L.setLevel('highway');
  resetHighway(level);
  const lane = level._hw.geo.centres[0], car = { x: 0, y: 0 }, moves = [];
  for (let dist = 300; dist <= 300 + KM * 1000; dist += 4) {
    const pose = roadPose(level, dist, lane);
    car.x = pose.x;
    car.y = pose.y;
    const t0 = performance.now(), moved = stepHighway(level, car), ms = performance.now() - t0;
    if (moved) moves.push(ms);
  }
  moves.sort((a, b) => a - b);
  console.log(`${scenery} ${ROAD} ${KM} km: ${moves.length} window moves, ms median `
    + `${moves[moves.length >> 1].toFixed(1)}, worst ${moves[moves.length - 1].toFixed(1)}; standing:`
    + ` props ${level.props.length}, solids ${level.solids.length}, covers ${level.covers.length},`
    + ` zones ${level.zones.length}, barriers ${level.barriers.length}`);
  L.LEVELS.pop();
}
