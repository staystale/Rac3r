import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/game/ai.ts', [
  ['const nearest = findNearestSubtrackPoint(sub, car.x, car.y);',
    'const nearest = findNearestSubtrackPoint(sub, car.x, car.y)!;   // a circuit has points'],
  ['(entry.hurtT += dt)', '(entry.hurtT = (entry.hurtT ?? 0) + dt)'],
  ['  if (!(entry.obsT > 0)) {', '  if (!((entry.obsT ?? 0) > 0)) {'],
  ['  entry.obsT -= dt;', '  entry.obsT! -= dt;'],
  ['export function stepAIPhysics(entry: AiEntry, want, dt: number) {',
    'export function stepAIPhysics(entry: AiEntry, want: CarInput, dt: number) {'],
  ["import type { AiEntry } from './state.ts';",
    "import type { AiEntry } from './state.ts';\nimport type { CarInput } from '../vehicle.ts';\n"
    + "import type { RaceFlow } from '../raceflow.ts';"],
  ['crossedJoker(joker, car._p.x, car._p.y, car.x, car.y)',
    'crossedJoker(joker, car._p!.x, car._p!.y, car.x, car.y)'],
  ['      car._jokers++;', '      car._jokers = car._jokers! + 1;   // (grid.ts zeroes it)'],
  ['Math.abs(car._hwf.off) - LEVEL._hw.geo.hw', 'Math.abs(car._hwf.off) - hwLevel()._hw.geo.hw'],
  ['    car.x = car._p.x;\n    car.y = car._p.y;', '    car.x = car._p!.x;\n    car.y = car._p!.y;'],
  ['nearest = findNearestSubtrackPoint(sub, car._p.x, car._p.y);',
    'nearest = findNearestSubtrackPoint(sub, car._p!.x, car._p!.y)!;'],
  ['  if (LEVEL.stage && game.flow) game.ai = game.ai.filter((entry) => {\n'
    + '    const flowRow = game.flow.entries.find((x) => x.car === entry.car);\n'
    + '    return !(flowRow && flowRow.finish != null && game.flow.t - flowRow.finish > 3);',
  '  const flow = game.flow as RaceFlow | null;   // (a stage runs the race flow, not the highway\'s)\n'
    + '  if (LEVEL.stage && flow) game.ai = game.ai.filter((entry) => {\n'
    + '    const flowRow = flow.entries.find((x) => x.car === entry.car);\n'
    + '    return !(flowRow && flowRow.finish != null && flow.t - flowRow.finish > 3);'],
]);
edit('src/game/state.ts', [
  ["import type { DamageCar } from '../damage.ts';",
    "import type { DamageCar, DamageState } from '../damage.ts';\nimport type { LooseObstacle } from '../ai/types.ts';"],
  ['export type GameCar = Car & DamageCar & {', 'export type GameCar = Car & DamageCar & DamageState & {'],
  ['  obs?: unknown; obsT?: number;', '  obs?: LooseObstacle[]; obsT?: number;'],
]);
console.log('ok');
