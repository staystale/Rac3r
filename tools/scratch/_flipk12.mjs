import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
const dropImport = (path, line) => edit(path, [[line + '\n', '']]);
edit('src/cars.ts', [["  ploughK?: number;   // x the ground's plough (?k12: a self-cleaning mud tread cuts through)",
  "  ploughK?: number;   // x the ground's plough (a self-cleaning mud tread cuts through)"]]);
edit('src/physics/tyres.ts', [
  ['  // ?k12: a mud tread ploughs less (cars.ts ploughK)', '  // a mud tread ploughs less (cars.ts ploughK; K12, passed 11-03)'],
  ['    * (FIX.k12 && carSpec.tyre && carSpec.tyre.ploughK ? carSpec.tyre.ploughK : 1);',
    '    * (carSpec.tyre && carSpec.tyre.ploughK ? carSpec.tyre.ploughK : 1);'],
]);
dropImport('src/physics/tyres.ts', "import { FIX } from '../core/fixes.ts';");
edit('src/world/dig.ts', [
  ["// ?k12 (MEASURED 11-03: in rain every worn dirt cell turned to mud", "// K12 (passed 11-03; MEASURED: in rain every worn dirt cell turned to mud"],
  ['  const share = Math.max(0, Math.min(1, wetShare)) * (FIX.k12 ? DIRT_WET_MUD_K : 1);',
    '  const share = Math.max(0, Math.min(1, wetShare)) * DIRT_WET_MUD_K;'],
]);
dropImport('src/world/dig.ts', "import { FIX } from '../core/fixes.ts';");
let l = fs.readFileSync('src/world/levels/lab-extension.ts', 'utf8');
l = l.replace('  // ?k12 MUD HILLS (owner 11-03: 4x4 vs 2WD in mud)', '  // MUD HILLS (K12, passed 11-03: 4x4 vs 2WD in mud)');
const a = l.indexOf('  ...(FIX.k12 ? [\n');
const b = l.indexOf('  ] : []),\n', a);
if (a < 0 || b < 0) throw new Error('hills');
l = l.slice(0, a) + l.slice(a + '  ...(FIX.k12 ? [\n'.length, b).split('\n').map((x) => x.replace(/^    /, '  ')).join('\n') + l.slice(b + '  ] : []),\n'.length);
l = l.replace("import { FIX } from '../../core/fixes.ts';\n", '');
fs.writeFileSync('src/world/levels/lab-extension.ts', l);
edit('src/world/surfaces.ts', [
  ['// ?k12: what mud and thick mud plough (tools/scratch/_mudpull: 4x4 vs 2WD targets)', '// what mud and thick mud plough (K12, passed 11-03; tools/scratch/_mudpull: 4x4 vs 2WD targets)'],
  ['  // ?k12: ploughs MUD_PLOUGH (was 1.60:', '  // ploughs MUD_PLOUGH (K12; was 1.60:'],
  ['    plough: FIX.k12 ? MUD_PLOUGH : 1.60,', '    plough: MUD_PLOUGH,'],
  ['    plough: FIX.k12 ? THICK_MUD_PLOUGH : 1.90,', '    plough: THICK_MUD_PLOUGH,'],
  ['import { FIX } from "../core/fixes.ts";\n', ''],
]);
let f = fs.readFileSync('src/core/fixes.ts', 'utf8');
const re = /  \/\/ \?k12=1:[^\n]*\n[^\n]*\n[^\n]*\n  k12: atLoad\('k12'\),\n/;
if (!re.test(f)) throw new Error('fixes');
f = f.replace(re, '').replace('// menustyle, testgarage, ai10 passed 11-03.)', '// menustyle, testgarage, ai10, k12 passed 11-03.)');
fs.writeFileSync('src/core/fixes.ts', f);
let t = fs.readFileSync('src/testlist.ts', 'utf8');
const i = t.indexOf("    id: 'k12',");
const st = t.lastIndexOf('  {\n', i), en = t.indexOf('  },\n', i) + 5;
t = t.slice(0, st) + t.slice(en);
t = t.replace('menustyle, testgarage, ai10 passed 2026-11-03;', 'menustyle, testgarage, ai10, k12 passed\n  // 2026-11-03;');
fs.writeFileSync('src/testlist.ts', t);
console.log('ok');
