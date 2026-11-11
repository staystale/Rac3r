// _desertmix.mjs - DEAF VALLEY'S ROADSIDE MIX BY GROUND: drive KM of the canyon road headless with
// ?desertmore=1, and count every loose object laid (once each) by kind and by the stretch it stands
// on (canyon / desert / dunes / high), and how many stand on a rock wall's band (behind its face).
// [ROAD=twisty] [SEED=1] node tools/scratch/_desertmix.mjs [km]
import { FIX } from '../../src/core/fixes.ts';
FIX.desertmore = true;
const { makeCar, reset } = await import('../../src/vehicle.ts');
const L = await import('../../src/lab.ts');
const hw = await import('../../src/highway.ts');
const { createAutoDriver } = await import('../../src/ai/autodrive.ts');
const { stretchAt } = await import('../../src/highway/desertplan.ts');
const { insidePolygon } = await import('../../src/world/zones.ts');
const KM = +(process.argv[2] || 6), ROAD = process.env.ROAD || 'twisty';
hw.addHighwayLevel();
L.setLevel('highway');
const lv = L.LEVEL;
hw.setHighwayPreset(lv, ROAD, 'canyon');
hw.resetHighway(lv);
const seen = new Set(), counts = {}, onRock = {};
const kinds = ['barrel', 'skull', 'tyre', 'tyrestack', 'cactus', 'barrelcactus', 'tumbleweed'];
function survey() {
  const rocks = lv.barriers.filter((bar) => bar.kind === 'rock' && bar.band);
  const all = [...(lv._hw.looseNew || []), ...(lv.cones || [])];
  for (const obj of all) {
    if (seen.has(obj) || !kinds.includes(obj.kind)) continue;
    seen.add(obj);
    const kind = stretchAt(obj._s ?? 0, lv._hw.seed ?? 1).kind;
    counts[kind] ??= {};
    counts[kind][obj.kind] = (counts[kind][obj.kind] || 0) + 1;
    if (rocks.some((bar) => Math.abs((bar._s ?? 0) - (obj._s ?? 0)) < 120
      && insidePolygon(bar.band, obj.x, obj.y))) onRock[obj.kind] = (onRock[obj.kind] || 0) + 1;
  }
}
const { step, PHYSICS_STEP_SECONDS } = await import('../../src/vehicle.ts');
const { solidClamp } = await import('../../src/world/barriers.ts');
const car = makeCar('hatch-rwd');
reset(car, lv.spawn.x, lv.spawn.y, lv.spawn.heading);
let sub = lv.subtrack, drv = createAutoDriver(sub), t = 0;
survey();
while ((lv._hw.driven || 0) < KM * 1000 && t < KM * 200) {
  if (lv.subtrack !== sub) { sub = lv.subtrack; drv = createAutoDriver(sub); }
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, drv.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS);
  t += PHYSICS_STEP_SECONDS;
  solidClamp(car);
  const q = L.querySubtrack(sub, car.x, car.y);
  if (hw.stepHighway(lv, car, q.trackDist)) survey();
}
survey();
console.log('driven', Math.round(lv._hw.driven || 0), 'm');
for (const [kind, row] of Object.entries(counts)) console.log(kind.padEnd(7), JSON.stringify(row));
console.log('on a rock band', JSON.stringify(onRock));
