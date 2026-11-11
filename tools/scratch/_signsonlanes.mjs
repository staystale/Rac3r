// _signsonlanes.mjs - EXIT SIGNS IN THE WAY (owner 11-11: "signs on slip roads like blue ones on the
// exit slip road on countryside interstate blocking it"): every road type (ROADS) in SCENERY driven
// KM headless; each exit board / slip countdown post standing on a laid lane (a slip, a junction's
// roads, a side road) or in the motorway's own road: where, and whose.
// [ROADS=a,b] [SCENERY=countryside] [SEED=4242] node tools/scratch/_signsonlanes.mjs [km]
const { makeCar, reset, step, PHYSICS_STEP_SECONDS } = await import('../../src/vehicle.ts');
const L = await import('../../src/lab.ts');
const hw = await import('../../src/highway.ts');
const { createAutoDriver } = await import('../../src/ai/autodrive.ts');
const { solidClamp } = await import('../../src/world/barriers.ts');
const { laneAt } = await import('../../src/world/zones.ts');
const KM = +(process.argv[2] || 12);
const roads = (process.env.ROADS || 'motorway,interstate,dual,walled,twisty').split(',');
hw.addHighwayLevel();
L.setLevel('highway');
const level = L.LEVEL;
for (const road of roads) {
  level.seed = +(process.env.SEED || 4242);
  level.roadType = null;
  hw.setHighwayPreset(level, road, process.env.SCENERY || 'countryside');
  hw.resetHighway(level);
  const seen = new Set(), bad = [];
  const survey = () => {
    for (const prop of level.props) {
      if ((prop.kind !== 'board' && prop.kind !== 'slipcount') || seen.has(prop)) continue;
      seen.add(prop);
      // (a board's post and panel: ~1.5 m either side of its spot)
      for (const [dx, dy] of [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]])
        if (laneAt(prop.x + dx, prop.y + dy)) {
          const lane = level.lanes.find((item) => item.pts.some(([x, y]) => Math.hypot(x - prop.x, y - prop.y) < item.width / 2 + 1.5));
          const owner = lane ? `lane w ${lane.width} _s ${Math.round(lane._s)} pts ${lane.pts.length}${lane.pts.length === 33 ? ' (a ring)' : ''}` : '?';
          bad.push(`${prop.kind}${prop.label ? ' "' + prop.label + '"' : ''} @${Math.round(prop._s)} on ${owner}; junctions near: ${level.props.filter((p) => p.rings && Math.abs(p._s - prop._s) < 500).map((p) => Math.round(p._s)).join(',') || 'none'}`);
          break;
        }
    }
  };
  const car = makeCar('hatch-rwd');
  reset(car, level.spawn.x, level.spawn.y, level.spawn.heading);
  let sub = level.subtrack, driver = createAutoDriver(sub), time = 0;
  while ((level._hw.driven || 0) < KM * 1000 && time < KM * 200) {
    if (level.subtrack !== sub) { sub = level.subtrack; driver = createAutoDriver(sub); }
    L.applyGround(car, PHYSICS_STEP_SECONDS);
    step(car, driver.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS);
    time += PHYSICS_STEP_SECONDS;
    solidClamp(car);
    if (hw.stepHighway(level, car, L.querySubtrack(sub, car.x, car.y).trackDist)) survey();
  }
  survey();
  console.log(`${road.padEnd(10)} signs ${seen.size}, on a lane ${bad.length}`
    + (bad.length ? ': ' + bad.slice(0, 6).join('; ') : ''));
}
