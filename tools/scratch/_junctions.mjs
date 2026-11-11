// _junctions.mjs - THE MOTORWAY JUNCTIONS (?junctions=1, highway/junctions.ts): each road type in
// each scenery driven KM headless; the junctions laid (road distance), and for each: how near its
// rings and slips come to the motorway's lanes (they must not overlap it, but where a slip leaves
// and joins), and any prop or loose object standing on a slip or ring.
// [ROADS=a,b] [SCENERIES=countryside,canyon] [SEED=4242] JUNCTIONS=1 node tools/scratch/_junctions.mjs [km]
const { makeCar, reset, step, PHYSICS_STEP_SECONDS } = await import('../../src/vehicle.ts');
const L = await import('../../src/lab.ts');
const hw = await import('../../src/highway.ts');
const { createAutoDriver } = await import('../../src/ai/autodrive.ts');
const { solidClamp } = await import('../../src/world/barriers.ts');
const { RING_OUTER_M } = await import('../../src/highway/ringgeo.ts');
const KM = +(process.argv[2] || 12);
const roads = (process.env.ROADS || 'motorway,interstate,dual,walled,twisty').split(',');
const sceneries = (process.env.SCENERIES || 'countryside,canyon').split(',');
hw.addHighwayLevel();
L.setLevel('highway');
const level = L.LEVEL;
const SOLID_KINDS = new Set(['tree', 'rock', 'block', 'house', 'barn', 'board', 'slipcount',
  'butte', 'hoodoo', 'arch', 'gasstation', 'canopy', 'shack', 'wreck']);
for (const scenery of sceneries) for (const road of roads) {
  level.seed = +(process.env.SEED || 4242);
  level.roadType = null;
  hw.setHighwayPreset(level, road, scenery);
  hw.resetHighway(level);
  const junctions = [], seenLanes = new Set(), problems = [];
  const survey = () => {
    for (const prop of level.props)
      if (prop.rings && !junctions.includes(prop)) junctions.push(prop);
    const pts = level._hw.pts, half = level._hw.geo.hw;
    for (const lane of level.lanes) {
      if (seenLanes.has(lane) || !junctions.some((bridge) => Math.abs(bridge._s - lane._s) < 400))
        continue;
      seenLanes.add(lane);
      // a ring: none of its lane over the motorway
      const isRing = lane.pts.length === 33;
      if (isRing) {
        const [cx, cy] = [lane.pts.reduce((sum, p) => sum + p[0], 0) / 33,
          lane.pts.reduce((sum, p) => sum + p[1], 0) / 33];
        const gap = Math.min(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy))) - half;
        if (gap < RING_OUTER_M + 1) problems.push(`ring ${gap.toFixed(1)} m from the edge`);
      }
      for (const prop of level.props) {
        if (!SOLID_KINDS.has(prop.kind)) continue;
        for (const [x, y] of lane.pts)
          if (Math.hypot(prop.x - x, prop.y - y) < lane.width / 2 + 0.5) {
            problems.push(`${prop.kind} on a ${isRing ? 'ring' : 'lane'} @${Math.round(lane._s)}`);
            break;
          }
      }
    }
  };
  const car = makeCar('hatch-rwd');
  reset(car, level.spawn.x, level.spawn.y, level.spawn.heading);
  let sub = level.subtrack, driver = createAutoDriver(sub), time = 0;
  survey();
  while ((level._hw.driven || 0) < KM * 1000 && time < KM * 200) {
    if (level.subtrack !== sub) { sub = level.subtrack; driver = createAutoDriver(sub); }
    L.applyGround(car, PHYSICS_STEP_SECONDS);
    step(car, driver.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS);
    time += PHYSICS_STEP_SECONDS;
    solidClamp(car);
    if (hw.stepHighway(level, car, L.querySubtrack(sub, car.x, car.y).trackDist)) survey();
  }
  survey();
  console.log(`${scenery.padEnd(11)} ${road.padEnd(10)} ${((level._hw.driven || 0) / 1000)
    .toFixed(1)} km: junctions ${junctions.length} at ${junctions.map((bridge) =>
    (bridge._s / 1000).toFixed(1)).join(', ') || '-'}; problems ${problems.length}`
    + (problems.length ? ': ' + [...new Set(problems)].slice(0, 6).join('; ') : ''));
}
