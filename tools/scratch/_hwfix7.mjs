import fs from 'node:fs';
function sub(path, a, b, all) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(a)) throw new Error(path + ': ' + a);
  s = all ? s.split(a).join(b) : s.replace(a, b);
  fs.writeFileSync(path, s);
}
const T = 'src/highway/hwtypes.ts';
sub(T, '  fieldId: number; fieldNext: number | null;',
  '  fieldId: number;\n  fieldNext: Record<number, number> | null;   // the next field\'s road distance, by side (-1 / 1)\n  goneFields?: Set<number>;   // fields cleared (their animals leave: main.js game.cones.cull)');
sub(T, '  looseCut?: number | null; looseNew?: unknown[];   // the loose objects dropped / added',
  '  looseCut?: number | null; looseNew?: LevelObj[];   // the loose objects dropped / added');
const F = 'src/highway/fields.ts';
let s = fs.readFileSync(F, 'utf8');
s = s.replace(/\(level: HwLevel, plot\)/g, '(level: HwLevel, plot: Plot)')
  .replace(/\(level: HwLevel, plot, rand\)/g, '(level: HwLevel, plot: Plot, rand: () => number)')
  .replace(/\(plot, rand, loose: LevelObj\[\]\)/g, '(plot: Plot, rand: () => number, loose: LevelObj[])')
  .replace(/\(plot, rand: \(\) => number, loose: LevelObj\[\]\)/g, '(plot: Plot, rand: () => number, loose: LevelObj[])')
  .replace(/function (\w+)\(plot, /g, 'function $1(plot: Plot, ')
  .replace(/function (\w+)\(plot\)/g, 'function $1(plot: Plot)')
  .replace(/function (\w+)\(plot: Plot, rand\)/g, 'function $1(plot: Plot, rand: () => number)')
  .replace('function layFieldRows(level: HwLevel, strip, ', 'function layFieldRows(level: HwLevel, strip: FieldStrip, ');
s = s.replace(/\(level: HwLevel, plot: Plot, rand\b(?!:)/g, '(level: HwLevel, plot: Plot, rand: () => number');
s = s.replace('  const survives = (item) =>', '  const survives = (item: { field?: number }) =>');
s = s.replace('      .map((other) => other.field)\n  );', '      .map((other) => other.field!)\n  );');
s = s.replace('const pickW = (rand, table) => {\n  let roll = rand() * table.reduce((sum, entry) => sum + entry[1], 0);',
  'const pickW = (rand: () => number, table: [string, number][]) => {\n  let roll = rand() * table.reduce((sum, entry) => sum + entry[1], 0);');
s = s.replace('  if (dist >= state.villageNext) village(', '  if (dist >= state.villageNext!) village(');
const lines = s.split('\n');
let at = lines.findIndex((l) => l.startsWith('const FIELD_T'));
lines.splice(at, 0, `/** A field as it is laid: where, how big, its axes, its id and crop. */
type Plot = FieldPlot & { heading: number; type: string };
/** A strip of fields beside the road: its side, road index / distance and size. */
interface FieldStrip { side: number; i: number; dist: number; fieldLen: number; count: number }
`);
s = lines.join('\n');
fs.writeFileSync(F, s);
console.log('ok');
