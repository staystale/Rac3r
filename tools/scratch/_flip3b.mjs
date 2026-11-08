import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
const noFix = (path, line) => { const s = fs.readFileSync(path, 'utf8'); if (!/FIX\./.test(s.replace(line, ''))) fs.writeFileSync(path, s.replace(line + '\n', '')); };
// resetin
edit('src/game/session.ts', [
  ['// ?resetin (owner 11-03: "place cars just', '// RESET IN (passed 11-03; owner: "place cars just'],
  [' * How far in from the road\'s edge a reset puts the car\'s centre (?resetin), else 0 (on it).', ' * How far in from the road\'s edge a reset puts the car\'s centre.'],
  ['  if (!FIX.resetIn) return 0;\n', ''],
]);
noFix('src/game/session.ts', "import { FIX } from '../core/fixes.ts';");
// belly
edit('src/world/wear.ts', [['  car.bellyDepth = FIX.belly && !(car.air > 0) ? bellyDepth(car, cosH, sinH) : 0;', '  car.bellyDepth = car.air > 0 ? 0 : bellyDepth(car, cosH, sinH);']]);
noFix('src/world/wear.ts', 'import { FIX } from "../core/fixes.ts";');
edit('src/world/belly.ts', [
  ["// world/belly.ts - GROUND CLEARANCE in soft ground (?belly):", "// world/belly.ts - GROUND CLEARANCE in soft ground (belly, passed 11-03):"],
  ['// ?belly (owner 11-03: "can suspension travel', '// (owner 11-03: "can suspension travel'],
  [' * How deep the car\'s underside is in the ground (?belly), m.', ' * How deep the car\'s underside is in the ground, m.'],
]);
edit('src/physics/tyres.ts', [
  ['    // ?belly: the underside in the ground ploughs too, by how deep (beached at BELLY_FULL_M)\n    + (FIX.belly ? BELLY_PLOUGH * Math.min(1, (car.bellyDepth || 0) / BELLY_FULL_M) : 0);',
    '    // the underside in the ground ploughs too, by how deep (beached at BELLY_FULL_M)\n    + BELLY_PLOUGH * Math.min(1, (car.bellyDepth || 0) / BELLY_FULL_M);'],
  ['// ?belly: the plough of an underside', '// BELLY (passed 11-03): the plough of an underside'],
]);
noFix('src/physics/tyres.ts', "import { FIX } from '../core/fixes.ts';");
edit('src/vehicle.ts', [['  bellyDepth?: number;   // ?belly: m of the underside in the ground (world/wear.ts)', '  bellyDepth?: number;   // m of the underside in the ground (world/belly.ts)']]);
edit('src/world/types.ts', [['  bellyDepth?: number;   // ?belly (world/wear.ts bellyDepth)', '  bellyDepth?: number;   // m of the underside in the ground (world/belly.ts)']]);
// agtyre
edit('src/cars.ts', [
  ["    // ?agtyre: its own factory set, the lugged FIRESTONED Field Lugger\n    ...(FIX.agTyre ? { stockTyre: 'ag-lug' } : {}),",
    "    stockTyre: 'ag-lug',   // its own factory set, the lugged FIRESTONED Field Lugger"],
  ["  // ?agtyre (NOTES register: Firestone = FIRESTONED)\n  ...(FIX.agTyre ? [{ id: 'firestoned', name: 'FIRESTONED', col: '#d8b04a', blurb: 'farm' }] : []),",
    "  // (NOTES register: Firestone = FIRESTONED)\n  { id: 'firestoned', name: 'FIRESTONED', col: '#d8b04a', blurb: 'farm' },"],
  ["  // ?agtyre (MEASURED 11-03:", "  // TRACTOR TYRES (passed 11-03; MEASURED:"],
  ["  ...(FIX.agTyre ? [makeTyre('ag-lug', 'firestoned', 'Field Lugger', 900, ['offroad'],\n    [0.9, 0.85, 1.15, 1.3, 1.4, 1.6, 1.2, 1.2, 0.8], { rims: [24, 42], ploughK: 0.5,\n      note: 'lugged tractor tyre: walks through mud, slow on tarmac' })] : []),",
    "  makeTyre('ag-lug', 'firestoned', 'Field Lugger', 900, ['offroad'],\n    [0.9, 0.85, 1.15, 1.3, 1.4, 1.6, 1.2, 1.2, 0.8], { rims: [24, 42], ploughK: 0.5,\n      note: 'lugged tractor tyre: walks through mud, slow on tarmac' }),"],
  ['    // ?agtyre: four-wheel drive, as the real Fastrac 8330 (equal wheels, all driven)\n    drive: FIX.agTyre ? 0.5 : 0.0,',
    '    // four-wheel drive, as the real Fastrac 8330 (equal wheels, all driven)\n    drive: 0.5,'],
]);
noFix('src/cars.ts', "import { FIX } from './core/fixes.ts';");
let f = fs.readFileSync('src/core/fixes.ts', 'utf8');
for (const re of [/  \/\/ \?resetin=1:[^\n]*\n[^\n]*\n  resetIn: atLoad\('resetin'\),\n/, /  \/\/ \?belly=1:[^\n]*\n[^\n]*\n  belly: atLoad\('belly'\),\n/, /  \/\/ \?agtyre=1:[^\n]*\n[^\n]*\n  agTyre: atLoad\('agtyre'\),\n/]) {
  if (!re.test(f)) throw new Error('fixes ' + re);
  f = f.replace(re, '');
}
f = f.replace('// menustyle, testgarage, ai10, k12 passed 11-03.)', '// menustyle, testgarage, ai10, k12, resetin, belly, agtyre passed 11-03.)');
fs.writeFileSync('src/core/fixes.ts', f);
let t = fs.readFileSync('src/testlist.ts', 'utf8');
for (const id of ['resetin', 'belly', 'agtyre']) {
  const i = t.indexOf(`    id: '${id}',`);
  if (i < 0) throw new Error(id);
  const st = t.lastIndexOf('  {\n', i), en = t.indexOf('  },\n', i) + 5;
  t = t.slice(0, st) + t.slice(en);
}
t = t.replace('menustyle, testgarage, ai10, k12 passed\n  // 2026-11-03;', 'menustyle, testgarage, ai10, k12 passed\n  // 2026-11-03; resetin, belly, agtyre passed 2026-11-03;');
fs.writeFileSync('src/testlist.ts', t);
console.log('ok');
