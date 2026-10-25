// _hedges.mjs - the highway's hedgerows (highway/hedges.ts): drive N km with the
// autodriver; at each rebuild count the hedge bushes loaded, check the ground lookup finds each
// new one as 'bush' (the patch grid is up to date), the nearest one to the road's edge, and time
// each road slide (stepHighway).
// node tools/scratch/_hedges.mjs [km] [preset]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.js';
import { stepHighway, addHighwayLevel, setHighwayPreset, resetHighway } from '../../src/highway.js';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { groundSurfaceAt } from '../../src/world/wear.ts';
const KM = +(process.argv[2] || 6);
const PRESET = process.argv[3] || 'motorway';
addHighwayLevel();
L.setLevel('highway'); const lv = L.LEVEL;
setHighwayPreset(lv, PRESET); resetHighway(lv);
const car = makeCar('saloon-rwd'); reset(car, lv.spawn.x, lv.spawn.y, lv.spawn.heading);
let sub = lv.subtrack, drv = createAutoDriver(sub), t = 0, rebuilds = 0, slideMs = 0, maxLoaded = 0;
let missed = 0, checked = 0, nearest = Infinity;
const seen = new Set(), halfRoad = lv._hw.geo.hw;
function survey() {
  const list = lv._bushes || [];
  maxLoaded = Math.max(maxLoaded, list.length);
  for (const bush of list) {
    if (seen.has(bush)) continue;
    seen.add(bush);
    checked++;
    if (groundSurfaceAt(bush.x, bush.y).id !== 'bush') missed++;
    const q = L.querySubtrack(sub, bush.x, bush.y);
    if (q && Number.isFinite(q.dist)) nearest = Math.min(nearest, q.dist - halfRoad - bush.w / 2);
  }
}
survey();
while ((lv._hw.driven || 0) < KM * 1000 && t < KM * 200) {
  if (lv.subtrack !== sub) { sub = lv.subtrack; drv = createAutoDriver(sub); }
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, drv.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS); t += PHYSICS_STEP_SECONDS;
  const q = L.querySubtrack(sub, car.x, car.y);
  const start = performance.now();
  if (stepHighway(lv, car, q.trackDist)) {
    slideMs += performance.now() - start;
    rebuilds++;
    survey();
  }
}
console.log(`hedges ${PRESET} ${(lv._hw.driven / 1000).toFixed(1)} km, ${rebuilds} slides`
  + ` ${(slideMs / Math.max(1, rebuilds)).toFixed(2)} ms each; hedge bushes laid ${seen.size},`
  + ` loaded max ${maxLoaded}; lookup missed ${missed}/${checked}; nearest to the road edge`
  + ` ${nearest.toFixed(1)} m; fields ${lv._hw.fieldId}`);
