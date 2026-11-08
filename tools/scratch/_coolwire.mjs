import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
sub('src/core/fixes.ts', `export const FIX = {
};`, `export const FIX = {
  // ?aicool=1: skilled AI drivers sometimes ease off / find water or grass to cool hot tyres
  // (ai/driverCool.ts)
  aiCool: atLoad('aicool'),
};`);
sub('src/ai/types.ts', `  towT?: number;   // drive: the time of the last tow-pass check`, `  towT?: number;   // drive: the time of the last tow-pass check
  coolNext?: number;   // driverCool.ts: when it next weighs up cooling hot tyres
  coolUntil?: number;   // driverCool.ts: cooling until then
  coolLat?: number;   // driverCool.ts: the offset from the line onto cooling ground
  cools?: number;   // driverCool.ts: how many times it has cooled its tyres`);
const D = 'src/ai/driverDrive.ts';
let s = fs.readFileSync(D, 'utf8');
s = s.replace(/(\nimport [^\n]*\n)(?!import)/, `$1import { coolStep, COOL_LOOK } from './driverCool.ts';\n`);
fs.writeFileSync(D, s);
sub(D, `  const lane = laneStep(drv, car, path, nearIdx, speed, mistakes.latT);
  let latT = lane.latT;
  const lineOff = lane.lineOff, startK = lane.startK;`, `  const lane = laneStep(drv, car, path, nearIdx, speed, mistakes.latT);
  let latT = lane.latT;
  const lineOff = lane.lineOff, startK = lane.startK;
  // ---- hot tyres: a skilled driver may ease off / find water or grass (ai/driverCool.ts)
  const cool = coolStep(drv, car, path, idx(nearIdx + Math.round(COOL_LOOK / path.sp)),
    path === main ? drv.line.hw - 1 : 1);
  vMul *= cool.vMul;
  latT += cool.lat;`);
console.log('ok');
