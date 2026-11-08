import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/core/fixes.ts', [['export const FIX = {\n};', `export const FIX = {
  // ?k12=1: MUD (owner 11-03: "cars struggle too much in mud ... even Subarus"): rain leaves
  // packed dirt wet dirt (dig.ts), mud and thick mud plough far less (surfaces.ts), mud tyres
  // plough less again (cars.ts ploughK, physics/tyres.ts)
  k12: atLoad('k12'),
};`]]);
// 1 rain no longer turns every worn dirt cell to mud
edit('src/world/dig.ts', [
  ['const DIRT_TO_MUD_COOL = 0.25, DIRT_TO_MUD_HOT = 0.03, DIRT_COOL_C = 10, DIRT_HOT_C = 40;',
    'const DIRT_TO_MUD_COOL = 0.25, DIRT_TO_MUD_HOT = 0.03, DIRT_COOL_C = 10, DIRT_HOT_C = 40;\n'
    + '// ?k12 (MEASURED 11-03: in rain every worn dirt cell turned to mud - Knobhill\'s whole racing\n'
    + '// line on the first lap): packed dirt stays (wet) dirt; a soaked pass churns it with only this\n'
    + '// share of the old chance; puddles on it still churn to mud (wear.ts WATER_MIX)\n'
    + 'const DIRT_WET_MUD_K = 0.12;'],
  ['  const share = Math.max(0, Math.min(1, wetShare));\n  return dry + (1 - dry) * share;',
    '  const share = Math.max(0, Math.min(1, wetShare)) * (FIX.k12 ? DIRT_WET_MUD_K : 1);\n  return dry + (1 - dry) * share;'],
]);
let d = fs.readFileSync('src/world/dig.ts', 'utf8');
const firstNonComment = d.split('\n').findIndex((line) => !line.startsWith('//'));
const lines = d.split('\n'); lines.splice(firstNonComment, 0, "import { FIX } from '../core/fixes.ts';");
fs.writeFileSync('src/world/dig.ts', lines.join('\n'));
// 2 the mud drag
edit('src/world/surfaces.ts', [
  ["  mud:    { id: 'mud', label: 'MUD', mu: 0.45, peakK: 2.20, longK: 0.85, plough: 1.60, rough: 0.010,",
    "  // ?k12: ploughs MUD_PLOUGH (was 1.60: a 0.09-0.16 g brake that never let go - 2WD road cars\n"
    + "  // could not reach 50 km/h on the FLAT, the Chevvy stuck)\n"
    + "  mud:    { id: 'mud', label: 'MUD', mu: 0.45, peakK: 2.20, longK: 0.85, plough: FIX.k12 ? MUD_PLOUGH : 1.60,\n    rough: 0.010,"],
  ["  thickMud: { id: 'thickMud', label: 'THICK MUD', mu: 0.38, peakK: 2.40, longK: 0.70, plough: 1.90,",
    "  thickMud: { id: 'thickMud', label: 'THICK MUD', mu: 0.38, peakK: 2.40, longK: 0.70,\n    plough: FIX.k12 ? THICK_MUD_PLOUGH : 1.90,"],
  ['import type { Mark, Spray, Surface } from "./types.ts";',
    'import type { Mark, Spray, Surface } from "./types.ts";\nimport { FIX } from "../core/fixes.ts";\n\n'
    + '// ?k12: what mud and thick mud plough (tools/scratch/_mudpull: 4x4 vs 2WD targets)\n'
    + 'const MUD_PLOUGH = 0.5, THICK_MUD_PLOUGH = 1.0;'],
]);
// 3 mud tyres plough less
edit('src/cars.ts', [
  ['  note?: string;\n  rims?: [number, number];', '  note?: string;\n  ploughK?: number;   // x the ground\'s plough (?k12: a self-cleaning mud tread cuts through)\n  rims?: [number, number];'],
  ["    'offroad'], [0.92, 0.95, 1.1, 1.14, 1.22, 1.35, 1.12, 1.1, 0.95], { rims: [13, 17],",
    "    'offroad'], [0.92, 0.95, 1.1, 1.14, 1.22, 1.35, 1.12, 1.1, 0.95], { rims: [13, 17], ploughK: 0.7,"],
  ["    'offroad'], [0.98, 1, 1.12, 1.12, 1.15, 1.18, 1.15, 1.08, 1.02],\n    { rims: [15, 18],",
    "    'offroad'], [0.98, 1, 1.12, 1.12, 1.15, 1.18, 1.15, 1.08, 1.02],\n    { rims: [15, 18], ploughK: 0.85,"],
]);
edit('src/physics/tyres.ts', [
  ['  const plough = car.surface.plough || 0;',
    '  // ?k12: a mud tread ploughs less (cars.ts ploughK)\n'
    + '  const plough = (car.surface.plough || 0)\n'
    + '    * (FIX.k12 && carSpec.tyre && carSpec.tyre.ploughK ? carSpec.tyre.ploughK : 1);'],
  ["import { wornGrip } from './tyrewear.ts';", "import { wornGrip } from './tyrewear.ts';\nimport { FIX } from '../core/fixes.ts';"],
]);
console.log('ok');
