import fs from 'node:fs';
function sub(path, old, nu) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(old)) throw new Error(`MISSING in ${path}: ${old.slice(0, 70)}`);
  fs.writeFileSync(path, s.replace(old, () => nu));
}
const R = 'src/menu/race.js';
sub(R, `import { addPauseClock } from './pauseclock.ts';`, `import { addPauseClock } from './pauseclock.ts';
import { showSettings } from './settings.ts';`);
sub(R, `  addHudButton(menu, panel, act);
  addButton(menu, panel, 'RESTART SESSION'`, `  addHudButton(menu, panel, act);
  addButton(menu, panel, 'SETTINGS ›', () => showSettings(menu, () => showPause(menu, act), () => {
    hideMenu(menu);
    act.resume();
  }));
  addButton(menu, panel, 'RESTART SESSION'`);
const T = 'src/menu/tracks.js';
let s = fs.readFileSync(T, 'utf8');
s = s.replace(/(\nimport [^\n]*\n)(?!import)/, `$1import { showSettings } from './settings.ts';\n`);
fs.writeFileSync(T, s);
sub(T, `  addButton(menu, panel, 'GARAGE', () => showGarage(menu));
  addButton(menu, panel, 'STORY',`, `  addButton(menu, panel, 'GARAGE', () => showGarage(menu));
  addButton(menu, panel, 'SETTINGS', () => showSettings(menu, () => showMainMenu(menu)));
  addButton(menu, panel, 'STORY',`);
console.log('ok');
