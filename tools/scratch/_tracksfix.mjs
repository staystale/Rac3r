import fs from 'node:fs';
function sub(path, a, b, all) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(a)) throw new Error(path + ': ' + a);
  s = all ? s.split(a).join(b) : s.replace(a, b);
  fs.writeFileSync(path, s);
}
const P = 'src/menu/tracks.ts';
sub(P, '  const points = level.subtrack.pts;', '  const points = level.subtrack!.pts;');
sub(P, "  const ctx = canvas.getContext('2d'), sub = level.subtrack, points = sub.pts, ghost = sub.ghost;",
  "  const ctx = canvas.getContext('2d')!, sub = level.subtrack!, points = sub.pts,\n    ghost = sub.ghost;");
sub(P, "  const ground = { forest: '#2c3b27', alpine: '#3a4434', snow: '#cfd8df',\n    desert: '#b89a68' }[level.gen.theme] || '#2c3b27';",
  "  const ground = ({ forest: '#2c3b27', alpine: '#3a4434', snow: '#cfd8df',\n    desert: '#b89a68' } as Record<string, string>)[level.gen!.theme] || '#2c3b27';");
sub(P, "  const roadCol = { forest: '#8a7a5c', alpine: '#4a4d55', snow: '#f4f7fa',\n    desert: '#d8bf8c' }[level.gen.theme] || '#888';",
  "  const roadCol = ({ forest: '#8a7a5c', alpine: '#4a4d55', snow: '#f4f7fa',\n    desert: '#d8bf8c' } as Record<string, string>)[level.gen!.theme] || '#888';");
sub(P, 'mapX = (x) =>', 'mapX = (x: number) =>');
sub(P, 'mapY = (y) =>', 'mapY = (y: number) =>');
sub(P, '  const isG = (i) =>', '  const isG = (i: number) =>');
sub(P, "    [Math.max(2.5, sub.width * scale), roadCol]]) {", "    [Math.max(2.5, sub.width * scale), roadCol]] as [number, string][]) {");
sub(P, '  const finish = findTrackPoint(level, level.stage.finish);', '  const finish = findTrackPoint(level, level.stage!.finish);');
sub(P, '  const thumb = menu.thumbs[level.id];', '  const thumb = menu.thumbs![level.id];');
sub(P, "    + THEMES[level.gen.theme].name.split(' ')[0]", "    + THEME_NAMES[level.gen!.theme].name.split(' ')[0]");
sub(P, "    if (cur && savedGen && ['seed', 'theme', 'len', 'style'].some((key) => savedGen[key]\n      !== cur.gen[key])) menu.api.genStage(savedGen);",
  "    if (cur && savedGen && (['seed', 'theme', 'len', 'style'] as const).some((key) => savedGen[key]\n      !== cur.gen![key])) menu.api.genStage(savedGen);");
sub(P, '  const gen = { ...level.gen };', '  const gen = { ...level.gen! };');
sub(P, '    `${THEMES[gen.theme].name} · ${level.gen.km.toFixed(2)} KM · SEED ${gen.seed}`, \'sub\');',
  '    `${THEME_NAMES[gen.theme].name} · ${level.gen!.km!.toFixed(2)} KM · SEED ${gen.seed}`, \'sub\');');
sub(P, '  const regen = (changes) => {', '  const regen = (changes: Partial<StageRecipe>) => {');
sub(P, '  const row = (opts, cur, key) => {', '  const row = (opts: [string, string][], cur: string, key: keyof StageRecipe) => {');
sub(P, "addButton(menu, rowEl, label, () => regen({ [key]: value }),",
  "addButton(menu, rowEl, label,\n    () => regen({ [key]: value } as Partial<StageRecipe>),");
sub(P, "  row(Object.entries(THEMES).map(([key, theme]) => [key, theme.name.split(' ')[0]]), gen.theme,",
  "  row(Object.entries(THEME_NAMES).map(([key, theme]) => [key, theme.name.split(' ')[0]]), gen.theme,");
sub(P, "  row(Object.keys(LENGTHS).map((key) => [key, key.toUpperCase()]), gen.len, 'len');",
  "  row(Object.keys(LENGTHS).map((key): [string, string] => [key, key.toUpperCase()]), gen.len,\n    'len');");
let s = fs.readFileSync(P, 'utf8');
s = s.replace("import { THEMES, LENGTHS } from '../stagegen.js';",
  "import { THEMES, LENGTHS } from '../stagegen.js';\n\n// the stage themes by key (stagegen.js is JavaScript)\nconst THEME_NAMES = THEMES as Record<string, { name: string }>;");
fs.writeFileSync(P, s);
sub('src/menu.ts', '  genStage: (options: Record<string, unknown>) => Level;', '  genStage: (options: Partial<StageRecipe>) => Level;');
sub('src/menu.ts', "import type { Level } from './world/types.ts';", "import type { Level, StageRecipe } from './world/types.ts';");
sub('src/menu.ts', '    pause: (act: object) => showPause(menu, act),\n    results: (flow: object, act: object) => showResults(menu, flow, act),',
  '    pause: (act: PauseActions) => showPause(menu, act),\n    results: (flow: ResultsFlow, act: ResultsActions) => showResults(menu, flow, act),');
s = fs.readFileSync('src/menu.ts', 'utf8');
s = s.replace("import type { Spec } from './cars.ts';", "import type { Spec } from './cars.ts';\nimport type { PauseActions, ResultsActions, ResultsFlow } from './menu/menutypes.ts';");
fs.writeFileSync('src/menu.ts', s);
console.log('ok');
