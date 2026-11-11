// _hwextras.mjs - EVERY ENDLESS ROAD'S BRIDGES, EXITS AND STATIONS (owner 11-11: "Check all highway
// levels work as asked"): each road type in each scenery, on each seed, driven KM headless; for
// each, the first bridge / exit / services / roadside station and how many of each, and the
// longest stretch with no bridge, km.
// [ROADS=a,b] [SCENERIES=countryside,canyon] [SEEDS=4242,7] node tools/scratch/_hwextras.mjs [km]
const { makeCar, reset, step, PHYSICS_STEP_SECONDS } = await import('../../src/vehicle.ts');
const L = await import('../../src/lab.ts');
const hw = await import('../../src/highway.ts');
const { createAutoDriver } = await import('../../src/ai/autodrive.ts');
const { solidClamp } = await import('../../src/world/barriers.ts');
const { HW_PRESETS } = await import('../../src/highway/presets.ts');
const KM = +(process.argv[2] || 10);
const roads = (process.env.ROADS || Object.keys(HW_PRESETS).join(',')).split(',');
const sceneries = (process.env.SCENERIES || 'countryside,canyon').split(',');
const seeds = (process.env.SEEDS || '4242,7').split(',').map(Number);
hw.addHighwayLevel();
L.setLevel('highway');
const level = L.LEVEL;
const kindOf = (prop) => (prop.kind === 'bridge' || prop.kind === 'river' ? 'bridge'
  : prop.kind === 'slip' && prop.label ? 'exit' : prop.kind === 'services' ? 'services'
    : prop.kind === 'gasstation' ? 'station' : null);
for (const scenery of sceneries) for (const road of roads) for (const seed of seeds) {
  level.seed = seed;
  level.roadType = null;
  hw.setHighwayPreset(level, road, scenery);
  hw.resetHighway(level);
  const seen = new Set(), found = { bridge: [], exit: [], services: [], station: [] };
  const survey = () => {
    for (const prop of level.props) {
      const kind = kindOf(prop);
      if (!kind || seen.has(prop)) continue;
      seen.add(prop);
      found[kind].push(prop._s);
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
  const driven = (level._hw.driven || 0) / 1000;
  const firstOf = (list) => (list.length ? (Math.min(...list) / 1000).toFixed(1) : '-');
  const bridges = [0, ...found.bridge.map((at) => at / 1000).sort((a, b) => a - b), driven];
  let gap = 0;
  for (let i = 1; i < bridges.length; i++) gap = Math.max(gap, bridges[i] - bridges[i - 1]);
  console.log(`${scenery.padEnd(11)} ${road.padEnd(10)} seed ${String(seed).padEnd(5)}`
    + ` ${driven.toFixed(1)} km: bridges ${found.bridge.length} (first ${firstOf(found.bridge)},`
    + ` longest gap ${gap.toFixed(1)} km), exits ${found.exit.length} (${firstOf(found.exit)}),`
    + ` services ${found.services.length} (${firstOf(found.services)}), stations`
    + ` ${found.station.length} (${firstOf(found.station)})`);
}
