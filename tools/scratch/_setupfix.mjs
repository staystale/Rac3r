import fs from 'node:fs';
function sub(path, a, b, all) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(a)) throw new Error(path + ': ' + a);
  s = all ? s.split(a).join(b) : s.replace(a, b);
  fs.writeFileSync(path, s);
}
const T = 'src/world/types.ts';
sub(T, '  gen?: unknown;   // stagegen.js: a generated stage\'s recipe (world/levels/category.ts)',
  '  gen?: StageRecipe;   // stagegen.js: a generated stage\'s recipe (world/levels/category.ts)\n'
  + '  roadTypes?: Record<string, string>;   // highway.js: the road types setup offers, key -> name');
let s = fs.readFileSync(T, 'utf8');
s = s.replace(/(\n\/\/ One entry of LEVEL\.barriers)/, `
/** A generated rally stage's recipe (stagegen.js genStage); km once built. */
export interface StageRecipe {
  seed: number; theme: string; len: string; style: string; attempt?: number; km?: number;
}
$1`);
fs.writeFileSync(T, s);
const S = 'src/menu/setup.ts';
sub(S, 'function addSetupSlider(menu: Menu, panel: HTMLElement, label: string, min: number, max: number, stepV: number, val: number, fmt, set) {',
  'function addSetupSlider(menu: Menu, panel: HTMLElement, label: string, min: number, max: number,\n'
  + '  stepV: number, val: number, fmt: (value: number) => string, set: (value: number) => void) {');
sub(S, '  input.min = min;\n  input.max = max;\n  input.step = stepV;\n  input.value = val;',
  '  input.min = String(min);\n  input.max = String(max);\n  input.step = String(stepV);\n  input.value = String(val);');
sub(S, '${THEMES[level.gen.theme].name} · ${level.gen.km.toFixed(2)} KM',
  '${THEME_NAMES[level.gen!.theme].name} · ${level.gen!.km!.toFixed(2)} KM');
sub(S, "import { THEMES } from '../stagegen.js';",
  "import { THEMES } from '../stagegen.js';\n\n// the stage themes by key (stagegen.js is JavaScript)\n"
  + 'const THEME_NAMES = THEMES as Record<string, { name: string }>;');
sub(S, '(value) => value\n      ? Math.round(value * 100)', '(value: number) => value\n      ? Math.round(value * 100)');
sub(S, "? Math.round(value * 100) + '%' : 'OFF', (value) => {", "? Math.round(value * 100) + '%' : 'OFF', (value: number) => {");
sub(S, "state.litter, (value) => value\n      ? value.toFixed(1) + 'x' : 'OFF', (value) => {",
  "state.litter, (value: number) => value\n      ? value.toFixed(1) + 'x' : 'OFF', (value: number) => {");
sub(S, 'addButton(menu, state.ui.nRow, String(count)', 'addButton(menu, state.ui.nRow!, String(count)');
sub(S, 'addButton(menu, state.ui.dRow, name, () => {', 'addButton(menu, state.ui.dRow!, name, () => {');
sub(S, '  const wid = state.ui;', '  const wid = state.ui as Required<SetupUi>;');
sub(S, "  const saved = menu.profile.weather || {};",
  "  const saved = (menu.profile.weather || {}) as { mode?: string; season?: number };");
sub(S, "  state.weather = { mode: saved.mode || 'season',", "  const weather = { mode: saved.mode || 'season',");
s = fs.readFileSync(S, 'utf8');
s = s.replace("    season: saved.season ?? SEASON_OF_MONTH[new Date().getMonth()] };",
  "    season: saved.season ?? SEASON_OF_MONTH[new Date().getMonth()] };\n  state.weather = weather;");
fs.writeFileSync(S, s);
console.log('ok');
