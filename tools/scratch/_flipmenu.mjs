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
const re = /  \/\/ \?menustyle=1:[^\n]*\n[^\n]*\n  menuStyle: atLoad\('menustyle'\),\n/;
if (!re.test(f)) throw new Error('fixes');
f = f.replace(re, '').replace('muscletyres, namefix, bhbridges passed 11-03.)', 'muscletyres, namefix, bhbridges,\n// menustyle passed 11-03.)');
fs.writeFileSync('src/core/fixes.ts', f);
edit('src/menu.ts', [
  ["  styleEl.textContent = CSS + (FIX.menuStyle ? MENU_PIXEL_CSS : '');   // ?menustyle",
    '  styleEl.textContent = CSS + MENU_PIXEL_CSS;   // the base sheet + the pixel style over it'],
  ["import { FIX } from './core/fixes.ts';\n", ''],
]);
// palette: the logo's colours only
let p = fs.readFileSync('src/menu/palette.ts', 'utf8');
p = p.replace(/PIXEL \? ('[^']*'|\{[^}]*\}) : ('[^']*'|\{[^}]*\})/g, '$1')
  .replace(/  lift: PIXEL\n    \? (\{[^}]*\})\n    : \{[^}]*\},/, '  lift: $1,')
  .replace("import { FIX } from '../core/fixes.ts';\n\nconst PIXEL = FIX.menuStyle;\n\n", '')
  .replace("// lift, the pickers, the tyre bars). The old palette on the plain link; ?menustyle=1 the logo's\n// (menu/pixelstyle.ts): ember orange, electric blue for selected / better, burnt-brown edges.",
    "// lift, the pickers, the tyre bars): the logo's (menu/pixelstyle.ts) - ember orange, electric\n// blue for better, burnt-brown edges.");
if (/PIXEL|FIX/.test(p)) throw new Error('palette left: ' + p);
fs.writeFileSync('src/menu/palette.ts', p);
edit('src/menu/pixelstyle.ts', [
  ['// menu/pixelstyle.ts - THE PIXEL MENU STYLE (?menustyle=1, owner 11-03 after the mockup rounds:',
    '// menu/pixelstyle.ts - THE PIXEL MENU STYLE (passed 11-03, after the owner\'s mockup rounds:'],
]);
// the main menu: the logo layout only
let t = fs.readFileSync('src/menu/tracks.ts', 'utf8');
const a = t.indexOf('  let buttons: HTMLElement = panel;\n  if (FIX.menuStyle) {\n');
const b = t.indexOf("  } else {\n    addElement(panel, 'h1', 'RAC3R');", a);
const c = t.indexOf('  }\n', b + 10) + 4;
if (a < 0 || b < 0) throw new Error('tracks');
const inner = t.slice(a + '  let buttons: HTMLElement = panel;\n  if (FIX.menuStyle) {\n'.length, b)
  .split('\n').map((line) => line.replace(/^    /, '  ')).join('\n');
t = t.slice(0, a) + inner + t.slice(c);
t = t.replace('  // ?menustyle: the owner\'s logo up top, the buttons at the bottom, the demo race between',
  '  // the owner\'s logo up top, the buttons at the bottom, the demo race between')
  .replace("  buttons = addElement(panel, 'div', '', 'btns');", "  const buttons = addElement(panel, 'div', '', 'btns');")
  .replace("import { FIX } from '../core/fixes.ts';\n", '');
fs.writeFileSync('src/menu/tracks.ts', t);
edit('src/menu/widgets.ts', [
  ['// ?menustyle: how long a pressed button blinks before it acts (menu/pixelstyle.ts .hit)',
    '// how long a pressed button blinks before it acts (menu/pixelstyle.ts .hit)'],
  ['    if (!FIX.menuStyle) { act(); return; }\n    // ?menustyle: the press shows - electric blue, two blinks - then the button acts\n',
    '    // the press shows - electric blue, two blinks - then the button acts (owner 11-03)\n'],
  ["import { FIX } from '../core/fixes.ts';\n", ''],
]);
let l = fs.readFileSync('src/testlist.ts', 'utf8');
const i = l.indexOf("    id: 'menustyle',");
const start = l.lastIndexOf('  {\n', i), end = l.indexOf('  },\n', i) + 5;
l = l.slice(0, start) + l.slice(end);
l = l.replace('pitsolid, muscletyres,\n  // namefix, bhbridges passed 2026-11-03;', 'pitsolid, muscletyres,\n  // namefix, bhbridges, menustyle passed 2026-11-03;');
fs.writeFileSync('src/testlist.ts', l);
console.log('ok');
