// _hwplough.mjs - how much ploughed (mud) field the highway keeps loaded: drive N km, at each
// rebuild sum the mud zones' area and the wear cells it would need (1.5 m squares), and how
// many wear cells exist anyway. node tools/scratch/_hwplough.mjs [km]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.js';
import { stepHighway, addHighwayLevel } from '../../src/highway.js';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { wearMap } from '../../src/world/wear.ts';
addHighwayLevel();
const KM = +(process.argv[2] || 8);
L.setLevel('highway'); const lv = L.LEVEL;
const car = makeCar('saloon-rwd'); reset(car, lv.spawn.x, lv.spawn.y, lv.spawn.heading);
let sub = lv.subtrack, drv = createAutoDriver(sub), t = 0;
let maxArea = 0, maxFields = 0, maxCells = 0, sumArea = 0, samples = 0;
while ((lv._hw.driven || 0) < KM * 1000 && t < KM * 200) {
  if (lv.subtrack !== sub) { sub = lv.subtrack; drv = createAutoDriver(sub); }
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, drv.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS); t += PHYSICS_STEP_SECONDS;
  const q = L.querySubtrack(sub, car.x, car.y);
  if (stepHighway(lv, car, q.trackDist)) {
    const muds = lv.zones.filter((zone) => zone.surface.id === 'mud' || zone.surface.id === 'thickMud');
    const area = muds.reduce((sum, zone) => sum + zone.w * zone.h, 0);
    maxArea = Math.max(maxArea, area); maxFields = Math.max(maxFields, muds.length);
    maxCells = Math.max(maxCells, wearMap.size); sumArea += area; samples++;
  }
}
console.log(`${KM} km: mud fields loaded max ${maxFields}, area max ${(maxArea / 1e4).toFixed(2)} ha`
  + ` (avg ${(sumArea / samples / 1e4).toFixed(2)}) -> up to ${Math.round(maxArea / 2.25)} cells;`
  + ` wear cells today max ${maxCells}`);
