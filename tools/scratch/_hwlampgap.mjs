// _hwlampgap.mjs - why a stretch of highway has no street lights: drive N km, and for the
// longest gap between lamps print what lies along it (side road, keep-out areas, props near the
// lamp spots). node tools/scratch/_hwlampgap.mjs [km] [preset]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.js';
import { stepHighway, addHighwayLevel, setHighwayPreset, resetHighway } from '../../src/highway.js';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { setRoadLamps } from '../../src/highway/roadlamps.ts';
const KM = +(process.argv[2] || 3), PRESET = process.argv[3] || 'interstate';
setRoadLamps(true);
addHighwayLevel();
L.setLevel('highway'); const lv = L.LEVEL;
setHighwayPreset(lv, PRESET); resetHighway(lv);
const car = makeCar('saloon-rwd'); reset(car, lv.spawn.x, lv.spawn.y, lv.spawn.heading);
let sub = lv.subtrack, drv = createAutoDriver(sub), t = 0, done = false;
function check() {
  const sorted = [...lv.lamps].sort((a, b) => a._s - b._s);
  for (let i = 1; i < sorted.length; i++) {
    const from = sorted[i - 1]._s, to = sorted[i]._s;
    if (to - from < 200) continue;
    const road = lv._hw.pts.filter((p) => p.s > from && p.s < to);
    const side = road.filter((p) => p.sideOff).length;
    const props = {};
    for (const prop of lv.props) if (prop._s > from - 40 && prop._s < to + 40) props[prop.kind] = (props[prop.kind] || 0) + 1;
    const keeps = lv._hw.keep.filter((k) => k._s == null || (k._s > from - 300 && k._s < to + 300));
    console.log(`gap ${from}..${to} m: road pts ${road.length}, sideOff ${side}; props near`, JSON.stringify(props));
    console.log('  keep areas near:', JSON.stringify(keeps.map((k) => ({ ...k, pts: undefined }))).slice(0, 600));
    const curv = road.map((p) => Math.abs(p.curv)); console.log('  max curvature', Math.max(...curv).toFixed(5));
    done = true;
  }
}
while (!done && (lv._hw.driven || 0) < KM * 1000 && t < KM * 200) {
  if (lv.subtrack !== sub) { sub = lv.subtrack; drv = createAutoDriver(sub); }
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, drv.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS); t += PHYSICS_STEP_SECONDS;
  const q = L.querySubtrack(sub, car.x, car.y);
  if (stepHighway(lv, car, q.trackDist)) check();
}
