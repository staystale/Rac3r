import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
// cars.ts: the tyres by rim, the period tyres and the factory set are the game
let c = fs.readFileSync('src/cars.ts', 'utf8');
c = c.replace(/   \/\/ its real rim, inches \(\?muscletyres: what fits\)/g, '   // its real rim, inches (what tyres fit)');
fs.writeFileSync('src/cars.ts', c);
edit('src/cars.ts', [
  ['  rims?: [number, number];   // the rim sizes it is made in, inches (?muscletyres)',
    '  rims?: [number, number];   // the rim sizes it is made in, inches'],
  ['  rimIn?: number; stockTyre?: string;   // ?muscletyres: its rim; its factory set',
    '  rimIn?: number; stockTyre?: string;   // its rim, inches; its own factory set'],
  ["  // ?muscletyres: period and drag tyres (NOTES register: Goodyear = GOOD YEAH, Mickey Thompson\n"
    + "  // = MICKY TOMSON, BFGoodrich = BF GOODWRENCH)\n  ...(FIX.muscleTyres ? [\n",
  "  // period and drag tyres (muscletyres, passed 11-03; NOTES register: Goodyear = GOOD YEAH,\n"
    + "  // Mickey Thompson = MICKY TOMSON, BFGoodrich = BF GOODWRENCH)\n"],
  ["    { id: 'goodyeah', name: 'GOOD YEAH', col: '#7aa8ff', blurb: 'classic' },\n    { id: 'tomson', name: 'MICKY TOMSON', col: '#d8453c', blurb: 'drag' },\n    { id: 'goodwrench', name: 'BF GOODWRENCH', col: '#e8e8ee', blurb: 'street' },\n  ] : []),\n];",
    "  { id: 'goodyeah', name: 'GOOD YEAH', col: '#7aa8ff', blurb: 'classic' },\n  { id: 'tomson', name: 'MICKY TOMSON', col: '#d8453c', blurb: 'drag' },\n  { id: 'goodwrench', name: 'BF GOODWRENCH', col: '#e8e8ee', blurb: 'street' },\n];"],
  ['  // ?muscletyres (owner 11-03: "suitable tyres for the muscle car / some that don\'t fit"):',
    '  // MUSCLE TYRES (passed 11-03; owner: "suitable tyres for the muscle car / some that don\'t\n  // fit"):'],
  [' * Whether a tyre fits a car: its class, and (?muscletyres) its rim size; a car with its own',
    ' * Whether a tyre fits a car: its class and its rim size; a car with its own'],
  ['  if (!FIX.muscleTyres) return true;\n', ''],
  [' * own factory set when it has one (?muscletyres), else Pre-Spun.', ' * own factory set when it has one, else Pre-Spun.'],
  ['  return stock && FIX.muscleTyres && row.stockTyre ? row.stockTyre : tyreId;',
    '  return stock && row.stockTyre ? row.stockTyre : tyreId;'],
  [' * was bought, ?muscletyres).', ' * was bought).'],
  ['// window — physics exactly as before; ?muscletyres: a car\'s own factory set when it has one)',
    '// window — physics exactly as before; a car\'s own factory set when it has one)'],
  ['  // ?muscletyres: a car with its own factory set leaves the garage on it\n  if (FIX.muscleTyres && row.stockTyre) applyTyre(out, row.stockTyre);',
    '  // a car with its own factory set leaves the garage on it\n  if (row.stockTyre) applyTyre(out, row.stockTyre);'],
  ["    rimIn: 14, stockTyre: 'polyglass',   // ?muscletyres: its rim; its factory set",
    "    rimIn: 14, stockTyre: 'polyglass',   // its rim; its own factory set"],
  ["import { FIX } from './core/fixes.ts';\n", ''],
]);
// the new tyres' '...(FIX.muscleTyres ? [ ... ] : []),' -> plain entries, one indent step out
c = fs.readFileSync('src/cars.ts', 'utf8');
const open = c.indexOf('  ...(FIX.muscleTyres ? [\n');
if (open < 0) throw new Error('tyres open');
const close = c.indexOf('  ] : []),\n', open);
const body = c.slice(open + '  ...(FIX.muscleTyres ? [\n'.length, close)
  .split('\n').map((line) => line.replace(/^    /, '  ')).join('\n');
c = c.slice(0, open) + body + c.slice(close + '  ] : []),\n'.length);
fs.writeFileSync('src/cars.ts', c);
// stats: the switch's table (best launch) is the table
fs.renameSync('src/carstatstest.ts', 'src/carstats.ts');
edit('src/carstats.ts', [['TEST_CAR_STATS', 'CAR_STATS'], [' (MUSCLETYRES=1)', '']]);
fs.unlinkSync('src/carstatsof.ts');
edit('src/ai/line.ts', [['import { STATS } from "../carstatsof.ts";', 'import { CAR_STATS } from "../carstats.ts";'], ['STATS[carId]', 'CAR_STATS[carId]']]);
edit('src/menu/garage.ts', [["import { STATS } from '../carstatsof.ts';", "import { CAR_STATS } from '../carstats.ts';"], ['= STATS[', '= CAR_STATS[']]);
edit('tools/carstats.mjs', [
  ["// MUSCLETYRES=1 (?muscletyres, under test): the switch's own table, src/carstatstest.ts, and its\n// 0-100 is the BEST LAUNCH",
    '// 0-100 is the BEST LAUNCH (passed 11-03 with the muscle tyres; owner: players manage starts)'],
  ["const out = {}, test = process.env.MUSCLETYRES === '1';", 'const out = {};'],
  ['  if (test) for (const cap of', '  for (const cap of'],
  ["const file = test ? 'carstatstest.ts' : 'carstats.ts', name = test ? 'TEST_CAR_STATS' : 'CAR_STATS';",
    "const file = 'carstats.ts', name = 'CAR_STATS';"],
  ["${test ? ' (MUSCLETYRES=1)' : ''}", ''],
]);
edit('src/world/levels/castle-cum.ts', [
  ["  // DUNLOP footbridge after Old Paddock (?namefix: DUNFLOP, the one Dunlop parody - NOTES)\n  CC_KIT.prop(712, 0, { kind: 'footbridge', wid: 27, label: FIX.nameFix ? 'DUNFLOP' : 'DUMLOP',\n    rot: Math.PI / 2 }),",
    "  // DUNLOP footbridge after Old Paddock (DUNFLOP, the one Dunlop parody - NOTES)\n  CC_KIT.prop(712, 0, { kind: 'footbridge', wid: 27, label: 'DUNFLOP', rot: Math.PI / 2 }),"],
  ['import { FIX } from "../../core/fixes.ts";\n', ''],
]);
edit('src/world/levels/brands-snatch.ts', [
  ['// ?bhbridges=1 (owner 11-03: "doesn\'t brands hatch', '// BRIDGES (passed 11-03; owner: "doesn\'t brands hatch'],
  [" * Brands Snatch's bridges over this layout's road (?bhbridges) and the road bridges' approaches.",
    " * Brands Snatch's bridges over this layout's road and the road bridges' approaches."],
  ['  if (!FIX.bhBridges) return { props, lanes };\n', ''],
  ['import { FIX } from "../../core/fixes.ts";\n', ''],
]);
let f = fs.readFileSync('src/core/fixes.ts', 'utf8');
for (const re of [/  \/\/ \?namefix=1:[^\n]*\n  nameFix: atLoad\('namefix'\),\n/,
  /  \/\/ \?muscletyres=1:[^\n]*\n[^\n]*\n  muscleTyres: atLoad\('muscletyres'\),\n/,
  /  \/\/ \?bhbridges=1:[^\n]*\n[^\n]*\n  bhBridges: atLoad\('bhbridges'\),\n/]) {
  if (!re.test(f)) throw new Error('fixes ' + re);
  f = f.replace(re, '');
}
f = f.replace('realcars, jokerhint, puffpool, pitsolid\n// passed 11-03.)', 'realcars, jokerhint, puffpool, pitsolid,\n// muscletyres, namefix, bhbridges passed 11-03.)');
fs.writeFileSync('src/core/fixes.ts', f);
let t = fs.readFileSync('src/testlist.ts', 'utf8');
for (const id of ['muscletyres', 'namefix', 'bhbridges']) {
  const i = t.indexOf(`    id: '${id}',`);
  if (i < 0) throw new Error(id);
  const start = t.lastIndexOf('  {\n', i), end = t.indexOf('  },\n', i) + 5;
  t = t.slice(0, start) + t.slice(end);
}
t = t.replace('puffpool, tyrehealth, pitsolid passed 2026-11-03;', 'puffpool, tyrehealth, pitsolid, muscletyres,\n  // namefix, bhbridges passed 2026-11-03;');
fs.writeFileSync('src/testlist.ts', t);
console.log('ok');
