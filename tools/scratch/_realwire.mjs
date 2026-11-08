import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/realcars.ts', [
  ['    upshiftRpm: 12000, downshiftRpm: 8000, gears: [3.10, 2.40, 1.95, 1.65, 1.42, 1.25, 1.12, 1.00], finalDrive: 4.80,',
    '    upshiftRpm: 12000, downshiftRpm: 8000,\n    gears: [3.10, 2.40, 1.95, 1.65, 1.42, 1.25, 1.12, 1.00], finalDrive: 4.80,'],
]);
edit('src/core/fixes.ts', [
  ["  jokerHint: atLoad('jokerhint'),\n",
    "  jokerHint: atLoad('jokerhint'),\n"
    + "  // ?realcars=1: every car on its real counterpart - weight, engine, gears, tyres, drag, and a\n"
    + "  // name close to the real one (realcars.ts)\n"
    + "  realCars: atLoad('realcars'),\n"],
]);
edit('src/cars.ts', [
  ['export function spec(carId: string): Spec {',
    '// ?realcars=1: each car on its real counterpart (realcars.ts)\n'
    + 'if (FIX.realCars) applyRealCars(ROSTER);\n\n'
    + 'export function spec(carId: string): Spec {'],
  ["import type { Mark, Spray } from './world/types.ts';",
    "import type { Mark, Spray } from './world/types.ts';\nimport { FIX } from './core/fixes.ts';\n"
    + "import { applyRealCars } from './realcars.ts';"],
]);
let t = fs.readFileSync('src/testlist.ts', 'utf8');
const at = t.indexOf("    id: 'jokerhint',");
const start = t.lastIndexOf('  {\n', at);
t = t.slice(0, start) + `  {
    id: 'realcars',
    added: '2026-11-03',
    name: 'REAL CARS: every car on its real counterpart (weight, engine, gears, tyres, drag) + names',
    where: 'Plain link + &realcars=1: the garage (names), then drive each car - Mini, saloon, Muscle',
    try: 'Top speed and pull in each gear: does each feel like the real car? The Mini tops ~156 km/h.',
    wrong: 'A car that will not pull its top gear, revs that sound wrong, or one that handles oddly.',
  },
` + t.slice(start);
fs.writeFileSync('src/testlist.ts', t);
console.log('ok');
