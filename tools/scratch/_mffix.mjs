import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/game/menuflow.ts', [
  ['Math.min(5, opts.ai | 0)', 'Math.min(5, (opts.ai ?? 0) | 0)'],
  ['Math.min(10, opts.laps | 0)', 'Math.min(10, (opts.laps ?? 0) | 0)'],
  ['applyLivery(game.car.spec, opts.livery);', 'applyLivery(game.car.spec, opts.livery ?? null);'],
  ['applyTyre(game.car.spec, opts.tyre);', "applyTyre(game.car.spec, opts.tyre ?? '');   // (none: the stock set)"],
  ['shared.menu.results(flow as ResultsFlow,', 'shared.menu.results(flow as unknown as ResultsFlow,   // (done: its results are in)'],
]);
edit('src/menu/thumbcache.ts', [
  ['  localStorage.setItem(SAVED_KEY, build);', '  localStorage.setItem(SAVED_KEY, String(build));'],
]);
const c = 'src/game/controls.ts';
let s = fs.readFileSync(c, 'utf8');
if (!s.includes('import type { GameCar }')) {
  s = s.replace(/(import \{[^}]*\} from '\.\/state\.ts';\n)/, "$1import type { GameCar } from './state.ts';\n");
  if (!s.includes('import type { GameCar }')) throw new Error('controls import');
  fs.writeFileSync(c, s);
}
console.log('ok');
