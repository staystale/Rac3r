import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/main.ts', [
  ["shared.canvas = document.getElementById('c');", "shared.canvas = document.getElementById('c') as HTMLCanvasElement;   // index.html"],
  ["shared.boot = document.getElementById('boot');", "shared.boot = document.getElementById('boot')!;"],
  ["  shared.boot.querySelector('h1').textContent = 'THE LAB';", "  shared.boot.querySelector('h1')!.textContent = 'THE LAB';"],
  ["  shared.boot.querySelector('p').textContent = 'tap to drive';", "  shared.boot.querySelector('p')!.textContent = 'tap to drive';"],
  ['window.__game = game;', 'window.__game = game as unknown as Record<string, unknown>;   // (the tools add to it)'],
  ['window.__game.setAI = (count) => {', 'window.__game.setAI = (count: number) => {'],
  ['window.__game.launch = (levelId, car, opts) => launch(levelId, car, opts);',
    'window.__game.launch = (levelId: string, car: string, opts?: LaunchOpts) =>\n  launch(levelId, car, opts);'],
  ['window.__game.crossedJoker = (prevX, prevY, x, y) => (LEVEL.joker',
    'window.__game.crossedJoker = (prevX: number, prevY: number, x: number, y: number) => (LEVEL.joker'],
  ['window.__game.setTyreHud = (enabled) => shared.hud.setTyreHud(enabled);',
    'window.__game.setTyreHud = (enabled: boolean) => shared.hud.setTyreHud(enabled);'],
  ['      carSprite: (x, livery, wheels) => (typeof x === \'string\'\n'
    + '        ? shared.renderer.pixelCarWithWheels(applyLivery(makeCar(x).spec, livery)) : wheels\n'
    + '          ? shared.renderer.pixelCarWithWheels(x) : shared.renderer.pixelCar(x)) }) : null;',
  '      carSprite: (x, livery, wheels) => (typeof x === \'string\'\n'
    + '        ? shared.renderer.pixelCarWithWheels(applyLivery(makeCar(x).spec, livery ?? null)) : wheels\n'
    + '          ? shared.renderer.pixelCarWithWheels(x) : shared.renderer.pixelCar(x))! }) : null;'],
  ['  enterMenu();\n  shared.menu.show();', '  enterMenu();\n  shared.menu!.show();'],
  ["if (shared.reporter) {\n  addEventListener('pagehide', () => shared.reporter.flush());\n"
    + "  document.addEventListener('visibilitychange', () => {\n    if (document.hidden) shared.reporter.flush();",
  "const reporter = shared.reporter;\nif (reporter) {\n  addEventListener('pagehide', () => reporter.flush());\n"
    + "  document.addEventListener('visibilitychange', () => {\n    if (document.hidden) reporter.flush();"],
]);
let s = fs.readFileSync('src/main.ts', 'utf8');
if (!s.includes('LaunchOpts }')) {
  s = s.replace(/(import \{[^}]*\} from '\.\/game\/state\.ts';\n)/, "$1import type { LaunchOpts } from './game/state.ts';\n");
  if (!s.includes('LaunchOpts }')) throw new Error('main import');
}
fs.writeFileSync('src/main.ts', s);
console.log('ok');
