// _rainlap.mjs - A6 (owner: "rain makes everything too slippy"): one lap of a circuit by the
// scripted driver (ai/autodrive.ts, the lap bench's driver: it plans its speed from the grip it
// reads) in ONE condition per process (the damp surfaces are cached once built): dry, soaked
// (wetness 1, damp everywhere, no puddles) as today, or soaked with ?raingrip=1. Each car on a
// fitted tyre (cars.ts applyTyre); also the grip felt on damp tarmac (surface mu x tyre factor).
// node tools/scratch/_rainlap.mjs <dry|soaked|raingrip> [level] [car:tyre,...]
import * as L from '../../src/lab.js';
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { applyTyre } from '../../src/cars.ts';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { setWetness } from '../../src/world/weather.ts';
import { setRainGrip } from '../../src/world/wet.ts';
import { tyreGripOn } from '../../src/physics/tyres.ts';

const mode = process.argv[2] || 'dry';
const levelId = process.argv[3] || 'castle-cum';
const pairs = (process.argv[4] || 'hatch-rwd:all-season,track-rwd:p-soft,track-rwd:p-wet')
  .split(',').map((pair) => pair.split(':'));
setRainGrip(mode === 'raingrip');
setWetness(mode === 'dry' ? 0 : 1);

const rows = [];
for (const [carId, tyreId] of pairs) {
  L.setLevel(levelId);
  const sub = L.LEVEL.subtrack, car = makeCar(carId), driver = createAutoDriver(sub);
  applyTyre(car.spec, tyreId);
  const start = L.onTrack(sub, sub.totalDist - 40, 0, {});
  reset(car, start.x, start.y, start.rot);
  let time = 0, lapTime = null, grip = 0;
  for (; time < 240; time += DT) {
    L.applyGround(car, DT);
    step(car, driver.drive(car), DT);
    if (!grip && car.surface.hard && car.spec.tyre) {
      grip = car.surface.mu * tyreGripOn(car.spec.tyre, car.surface);
    }
    if (driver.state.travelled > sub.totalDist + 40) {
      lapTime = time;
      break;
    }
  }
  rows.push(`${carId}/${car.spec.tyre ? car.spec.tyre.id : 'stock'} ${lapTime ? lapTime
    .toFixed(1) + ' s' : 'DNF'} (grip ${grip.toFixed(2)})`);
}
console.log(`${levelId} ${mode.padEnd(8)}: ${rows.join(' | ')}`);
