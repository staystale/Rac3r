import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
let f = fs.readFileSync('src/core/fixes.ts', 'utf8');
const re = /  \/\/ \?ai10=1:[^\n]*\n[^\n]*\n  ai10: atLoad\('ai10'\),\n\};\n\n\/\*\* The most AI cars a race takes \(\?ai10: 10, else 5\)\. \*\/\nexport const MAX_AI = FIX\.ai10 \? 10 : 5;/;
if (!re.test(f)) throw new Error('fixes');
f = f.replace(re, '};').replace('// menustyle, testgarage passed 11-03.)', '// menustyle, testgarage, ai10 passed 11-03.)');
fs.writeFileSync('src/core/fixes.ts', f);
edit('src/core/settings.ts', [["import { MAX_AI } from './fixes.ts';\n", '']]);
let s = fs.readFileSync('src/core/settings.ts', 'utf8');
s = s.replace('export interface Settings {', '// the most AI cars a race takes (ai10, passed 11-03: was 5; 20 measured too costly - sim 17 ms\n'
  + '// a frame on the laptop, x3 the 15-car cost)\nexport const MAX_AI = 10;\n\nexport interface Settings {');
fs.writeFileSync('src/core/settings.ts', s);
edit('src/game/menuflow.ts', [["import { MAX_AI } from '../core/fixes.ts';", "import { MAX_AI } from '../core/settings.ts';"]]);
edit('src/main.ts', [["import { MAX_AI } from './core/fixes.ts';", "import { MAX_AI } from './core/settings.ts';"]]);
edit('src/game/grid.ts', [['  // ?ai10: five more, so ten cars all differ (cars.ts PALETTE)', '  // five more, so ten cars all differ (cars.ts PALETTE)']]);
edit('src/menu/menutypes.ts', [['  nRow?: HTMLElement; nBtns?: HTMLButtonElement[]; nLbl?: HTMLElement;   // (?ai10: the ticker)',
  '  nRow?: HTMLElement; nLbl?: HTMLElement;   // the AI count ticker']]);
edit('src/menu/setup.ts', [
  ["import { FIX, MAX_AI } from '../core/fixes.ts';", "import { MAX_AI } from '../core/settings.ts';"],
  ['  if (FIX.ai10) {\n    // ?ai10 (owner 11-03): a ticker, 1 .. MAX_AI, instead of a button per count\n',
    '  {\n    // the count is a ticker, 1 .. MAX_AI (owner 11-03; was a button per count)\n'],
  ["    state.ui.nBtns = [];\n    return;\n  }\n", '  }\n'],
  ["  wid.nBtns.forEach((button, i) => button.classList.toggle('on', i + 1 === state.aiN));\n  if (wid.nLbl)",
    '  if (wid.nLbl)'],
]);
// the old buttons (from 'state.ui.nBtns = [1, 2, 3, 4, 5]' to the end of that call)
s = fs.readFileSync('src/menu/setup.ts', 'utf8');
const a = s.indexOf('  state.ui.nBtns = [1, 2, 3, 4, 5].map(');
const b = s.indexOf('    }));\n', a) + '    }));\n'.length;
if (a < 0 || b < a) throw new Error('old buttons');
s = s.slice(0, a) + s.slice(b);
// the bare block -> flat
const o = s.indexOf('  {\n    // the count is a ticker');
const c = s.indexOf('\n  }\n', o);
s = s.slice(0, o) + s.slice(o + 4, c).split('\n').map((line) => line.replace(/^  /, '')).join('\n') + s.slice(c + 4);
s = s.replace(' * preview): 1-5 opponents in the same car, different colours.', ' * preview): 1-10 opponents (a ticker), different colours.');
fs.writeFileSync('src/menu/setup.ts', s);
let l = fs.readFileSync('src/testlist.ts', 'utf8');
const i = l.indexOf("    id: 'ai10',");
const st = l.lastIndexOf('  {\n', i), en = l.indexOf('  },\n', i) + 5;
l = l.slice(0, st) + l.slice(en);
l = l.replace('// namefix, bhbridges, menustyle, testgarage passed 2026-11-03;', '// namefix, bhbridges, menustyle, testgarage, ai10 passed 2026-11-03;');
fs.writeFileSync('src/testlist.ts', l);
console.log('ok');
