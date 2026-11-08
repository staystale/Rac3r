import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
sub('src/core/fixes.ts', `export const FIX = {
};`, `export const FIX = {
  // ?towplus=1: the wake - dirty air, the push, a wake sized by speed and car, the air streaks
  // (physics/wake.ts)
  towPlus: atLoad('towplus'),
};`);
const S = 'src/game/sim.js';
let s = fs.readFileSync(S, 'utf8');
s = s.replace(/(\nimport [^\n]*\n)(?!import)/, `$1import { FIX } from '../core/fixes.ts';\nimport { wakeStep } from '../physics/wake.ts';\n`);
fs.writeFileSync(S, s);
sub(S, `    if (game.ai.length) slipstream(racers);`, `    if (game.ai.length) (FIX.towPlus ? wakeStep : slipstream)(racers);`);
sub('src/physics/loads.ts', `  const FdownF = 0.5 * AIR_DENSITY * (carSpec.downforceF || 0) * vSqPlanar * (TUNE.aeroMul || 1);
  const FdownR = 0.5 * AIR_DENSITY * (carSpec.downforceR || 0) * vSqPlanar * (TUNE.aeroMul || 1);`,
`  // wakeDown: the dirty air behind another car (physics/wake.ts, ?towplus), 1 in clean air
  const aero = 0.5 * AIR_DENSITY * vSqPlanar * (TUNE.aeroMul || 1) * (car.wakeDown ?? 1);
  const FdownF = aero * (carSpec.downforceF || 0);
  const FdownR = aero * (carSpec.downforceR || 0);`);
sub('src/vehicle.ts', `  dragMul?: number; hbAfter?: number;`, `  dragMul?: number; hbAfter?: number;
  wakeDown?: number;   // physics/wake.ts: the downforce kept in another car's dirty air`);
console.log('ok');
