// _hwblocks.mjs [--on] [km] - the highway's ploughed fields drying in blocks (?mudwater=1):
// drive N km on a hot dry track (40 C held); rebuild cost (worst / mean ms), fields and blocks
// loaded, blocks dried, and whether a dried block drives as dirt (groundAt at its centre).
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.js';
import { stepHighway, addHighwayLevel } from '../../src/highway.js';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { groundAt } from '../../src/world/wear.ts';
import { WEATHER, setWetness } from '../../src/world/weather.ts';
import { stepPuddles, resetPuddles } from '../../src/world/puddles.ts';
import { blockCentre } from '../../src/world/fieldblocks.ts';
const on = process.argv.includes('--on');
const KM = +(process.argv.find((arg) => /^\d+$/.test(arg)) || 8);
addHighwayLevel();
L.setLevel('highway'); const lv = L.LEVEL;
resetPuddles();
const car = makeCar('saloon-rwd'); reset(car, lv.spawn.x, lv.spawn.y, lv.spawn.heading);
let sub = lv.subtrack, drv = createAutoDriver(sub), t = 0, worst = 0, sum = 0, rebuilds = 0;
let maxBlocks = 0, dried = 0, feltDirt = 0, checked = 0;
while ((lv._hw.driven || 0) < KM * 1000 && t < KM * 200) {
  if (lv.subtrack !== sub) { sub = lv.subtrack; drv = createAutoDriver(sub); }
  WEATHER.trackC = 40; WEATHER.rain = 0; setWetness(0);
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, drv.drive(car, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS);
  stepPuddles(PHYSICS_STEP_SECONDS);
  t += PHYSICS_STEP_SECONDS;
  const q = L.querySubtrack(sub, car.x, car.y);
  const began = performance.now(), moved = stepHighway(lv, car, q.trackDist), ms = performance.now() - began;
  if (!moved) continue;
  rebuilds++; sum += ms; worst = Math.max(worst, ms);
  const fields = lv.zones.filter((zone) => zone.blocks);
  const blocks = fields.flatMap((zone) => zone.blocks.map((block) => [zone, block]));
  maxBlocks = Math.max(maxBlocks, blocks.length);
  for (const [zone, block] of blocks) {
    if (!block.art) continue;
    dried++;
    const centre = blockCentre(zone, block), ground = groundAt(centre.x, centre.y);
    checked++;
    if (((ground.surface && ground.surface.id) || ground.id) === 'dirt') feltDirt++;
  }
}
console.log(`${on ? 'ON ' : 'OFF'} ${KM} km in ${t.toFixed(0)} s: rebuilds ${rebuilds}, worst ${worst.toFixed(1)} ms,`
  + ` mean ${(sum / Math.max(1, rebuilds)).toFixed(2)} ms | blocks loaded max ${maxBlocks},`
  + ` dried-block samples ${dried}, drive as dirt ${feltDirt}/${checked}`);
