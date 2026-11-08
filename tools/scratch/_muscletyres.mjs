import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
// each car's real rim, inches
const RIMS = { 'hatch-fwd': 18, 'hatch-rwd': 18, 'saloon-rwd': 17, 'wrz-awd': 17, 'estate-4x4': 18,
  'muscle-rwd': 14, 'rally-4x4': 15, 'track-rwd': 18, naffcar: 18, tractor: 30, 'mini-fwd': 10,
  'lambo-awd': 20, 'mikra-r1': 15, 'kit-2l': 15, 'rx-super': 17, 'banger-f2': 13,
  'grass-special': 13, 'drift-s13': 17, 'f2-rwd': 18 };
let s = fs.readFileSync('src/cars.ts', 'utf8');
for (const [id, rim] of Object.entries(RIMS)) {
  const at = s.indexOf(`    id: '${id}',`);
  if (at < 0) throw new Error(id);
  const end = s.indexOf('\n', at) + 1;
  const extra = id === 'muscle-rwd'
    ? `    rimIn: ${rim}, stockTyre: 'polyglass',   // ?muscletyres: its rim; its factory set\n`
    : `    rimIn: ${rim},   // its real rim, inches (?muscletyres: what fits)\n`;
  s = s.slice(0, end) + extra + s.slice(end);
}
fs.writeFileSync('src/cars.ts', s);

// existing tyres: the rims each is made in
const TYRE_RIMS = { 'pre-spun': [10, 30], 'all-season': [10, 19], 'mud-plugger': [13, 17],
  'road-sport': [15, 20], 'semi-slick': [13, 19], drift: [15, 18], 'kum-wet': [10, 18],
  gravel: [15, 16], 'soft-gravel': [15, 16], 'tarmac-rally': [15, 18], studded: [13, 17],
  'all-terrain': [15, 18], 'p-soft': [13, 18], 'p-medium': [13, 18], 'p-wet': [13, 18] };
s = fs.readFileSync('src/cars.ts', 'utf8');
for (const [id, [lo, hi]] of Object.entries(TYRE_RIMS)) {
  const at = s.indexOf(`  makeTyre('${id}',`);
  if (at < 0) throw new Error(id);
  // the extra {...} of this makeTyre: the first '{ ' after its grip array, else add one
  const close = s.indexOf(']),', at), nextTyre = s.indexOf('  makeTyre(', at + 5);
  const extraAt = s.indexOf('{', s.indexOf(']', s.indexOf('[', s.indexOf(',', s.indexOf("',", at) + 2) + 1) + 1));
  if (close > 0 && (nextTyre < 0 || close < nextTyre) && (extraAt < 0 || extraAt > close)) {
    s = s.slice(0, close + 1) + `,
    { rims: [${lo}, ${hi}] }` + s.slice(close + 1);
  } else {
    s = s.slice(0, extraAt + 1) + ` rims: [${lo}, ${hi}],
   ` + s.slice(extraAt + 1);
  }
}
fs.writeFileSync('src/cars.ts', s);

edit('src/cars.ts', [
  ["import type { Mark, Spray } from './world/types.ts';",
    "import type { Mark, Spray } from './world/types.ts';\nimport { FIX } from './core/fixes.ts';"],
  ['  opt?: [number, number]; peak?: number; cold?: number; slide?: number; heatHard?: number;\n  note?: string;\n}',
    '  opt?: [number, number]; peak?: number; cold?: number; slide?: number; heatHard?: number;\n'
    + '  note?: string;\n'
    + '  rims?: [number, number];   // the rim sizes it is made in, inches (?muscletyres)\n}'],
  ['  tyreOpt?: [number, number]; tyrePeak?: number; tyreColdGrip?: number;\n}',
    '  tyreOpt?: [number, number]; tyrePeak?: number; tyreColdGrip?: number;\n'
    + '  rimIn?: number; stockTyre?: string;   // ?muscletyres: its rim; its factory set\n}'],
  ["  { id: 'pirrelly', name: 'PIRRELLY', col: '#f2c21b', blurb: 'race' },\n];",
    "  { id: 'pirrelly', name: 'PIRRELLY', col: '#f2c21b', blurb: 'race' },\n"
    + "  // ?muscletyres: period and drag tyres (NOTES register: Goodyear = GOOD YEAH, Mickey Thompson\n"
    + "  // = MICKY TOMSON, BFGoodrich = BF GOODWRENCH)\n"
    + "  ...(FIX.muscleTyres ? [\n"
    + "    { id: 'goodyeah', name: 'GOOD YEAH', col: '#7aa8ff', blurb: 'classic' },\n"
    + "    { id: 'tomson', name: 'MICKY TOMSON', col: '#d8453c', blurb: 'drag' },\n"
    + "    { id: 'goodwrench', name: 'BF GOODWRENCH', col: '#e8e8ee', blurb: 'street' },\n"
    + "  ] : []),\n];"],
]);
// the new tyres, after the last Pirrelly
s = fs.readFileSync('src/cars.ts', 'utf8');
const lastAt = s.indexOf("  makeTyre('p-wet',");
const lastEnd = s.indexOf('\n];', lastAt);
s = s.slice(0, lastEnd) + `
  // ?muscletyres (owner 11-03: "suitable tyres for the muscle car / some that don't fit"):
  // BIAS-BELTED Polyglass GT, the 1970 Chevelle SS's own F70-14 - far less grip than a modern
  // radial, so the car launches like the real one; a DRAG RADIAL (launches, scared of rain); a
  // 1970s street RADIAL. 13-15 / 14-17 inch rims: the old cars only.
  ...(FIX.muscleTyres ? [
    makeTyre('polyglass', 'goodyeah', 'Polyglass GT', 180, ['road', 'stock', 'drift'],
      [0.8, 0.78, 0.92, 0.92, 0.9, 0.88, 0.9, 0.85, 0.85], { rims: [13, 15], slide: 0.95,
      note: 'bias-belted 1970: the muscle car\\'s factory set' }),
    makeTyre('radial-ta', 'goodwrench', 'Radial T/A', 340, ['road', 'stock', 'drift'],
      [0.92, 0.9, 0.98, 0.98, 0.95, 0.92, 0.95, 0.9, 0.9], { rims: [13, 17],
      note: 'the first street radial: more grip, same look' }),
    makeTyre('et-street', 'tomson', 'ET Streat', 560, ['road', 'stock', 'drift'],
      [1.06, 0.7, 0.85, 0.85, 0.82, 0.75, 0.8, 0.6, 0.6], { rims: [14, 17], opt: [60, 110],
      peak: 85, cold: 0.85, heatHard: 1.3, note: 'drag radial: hooks off the line, hates rain' }),
  ] : []),` + s.slice(lastEnd);
fs.writeFileSync('src/cars.ts', s);

edit('src/cars.ts', [
  ["// fit a tyre to a spec (null / unknown / 'pre-spun' = stock: no tyre object, the roster's own heat\n// window — physics exactly as before)\nexport function applyTyre(carSpec: Spec, tyreId: string): Spec {\n"
    + "  const row = ROSTER.find((rosterRow) => rosterRow.id === String(carSpec.id).split('#')[0])\n"
    + "    || ({} as RosterRow),\n    tyre = tyreOf(tyreId);\n  const fits = tyre.fits.includes(row.cls);\n",
  "/**\n * Whether a tyre fits a car: its class, and (?muscletyres) its rim size; a car with its own\n"
    + " * factory set (stockTyre) does not take the generic Pre-Spun.\n * @param tyre the tyre\n"
    + " * @param row the car's roster row\n * @returns true when it fits\n */\n"
    + "export function tyreFits(tyre: Tyre, row: RosterRow): boolean {\n"
    + "  if (!tyre.fits.includes(row.cls)) return false;\n"
    + "  if (!FIX.muscleTyres) return true;\n"
    + "  if (row.stockTyre && tyre.id === 'pre-spun') return false;\n"
    + "  return !tyre.rims || !row.rimIn || (row.rimIn >= tyre.rims[0] && row.rimIn <= tyre.rims[1]);\n"
    + "}\n"
    + "// fit a tyre to a spec (null / unknown / 'pre-spun' = stock: no tyre object, the roster's own heat\n// window — physics exactly as before; ?muscletyres: a car's own factory set when it has one)\nexport function applyTyre(carSpec: Spec, tyreId: string): Spec {\n"
    + "  const row = ROSTER.find((rosterRow) => rosterRow.id === String(carSpec.id).split('#')[0])\n"
    + "    || ({} as RosterRow);\n"
    + "  const stock = !tyreId || tyreId === 'pre-spun' || !TYRES.some((x) => x.id === tyreId);\n"
    + "  const tyre = tyreOf(stock && FIX.muscleTyres && row.stockTyre ? row.stockTyre : tyreId);\n"
    + "  const fits = tyreFits(tyre, row);\n"],
  ['  const out = { ...SHARED, ...row } as Spec;   // L and Izz are filled in just below\n  out.L = out.lf + out.lr;\n  out.Izz = ((out.mass * (out.len * out.len + out.wid * out.wid)) / 12) * out.izzK;\n  return out;',
    '  const out = { ...SHARED, ...row } as Spec;   // L and Izz are filled in just below\n  out.L = out.lf + out.lr;\n  out.Izz = ((out.mass * (out.len * out.len + out.wid * out.wid)) / 12) * out.izzK;\n'
    + '  // ?muscletyres: a car with its own factory set leaves the garage on it\n'
    + '  if (FIX.muscleTyres && row.stockTyre) applyTyre(out, row.stockTyre);\n  return out;'],
]);
edit('src/menu/garage.ts', [
  ['      const fits = tyre.fits.includes(car.cls);', '      const fits = tyreFits(tyre, car);'],
]);
let g = fs.readFileSync('src/menu/garage.ts', 'utf8');
g = g.replace(/import \{([^}]*)\} from '\.\.\/cars\.ts';/, (m, names) => {
  const list = names.split(',').map((x) => x.trim()).filter(Boolean);
  if (!list.includes('tyreFits')) list.push('tyreFits');
  return `import { ${list.join(', ')} } from '../cars.ts';`;
});
fs.writeFileSync('src/menu/garage.ts', g);
console.log('ok');
