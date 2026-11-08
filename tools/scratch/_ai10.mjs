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
  // ?ai10=1: up to 10 AI cars (was 5; 20 measured too costly: sim 17 ms a frame on the laptop),
  // picked with a - / + ticker in test setup (menu/setup.ts), ten liveries (game/grid.ts)
  ai10: atLoad('ai10'),
};

/** The most AI cars a race takes (?ai10: 10, else 5). */
export const MAX_AI = FIX.ai10 ? 10 : 5;`]]);
edit('src/game/menuflow.ts', [['  shared.aiCount = Math.max(0, Math.min(5, (opts.ai ?? 0) | 0));', '  shared.aiCount = Math.max(0, Math.min(MAX_AI, (opts.ai ?? 0) | 0));']]);
edit('src/main.ts', [['  shared.aiCount = Math.max(0, Math.min(5, count | 0));', '  shared.aiCount = Math.max(0, Math.min(MAX_AI, count | 0));']]);
edit('src/core/settings.ts', [["    aiCount: Math.max(0, Math.min(5, +(params.get('ai') || 0))),", "    aiCount: Math.max(0, Math.min(MAX_AI, +(params.get('ai') || 0))),"]]);
for (const [path, from] of [['src/game/menuflow.ts', '../core/fixes.ts'], ['src/main.ts', './core/fixes.ts'], ['src/core/settings.ts', './fixes.ts']]) {
  let s = fs.readFileSync(path, 'utf8');
  const re = new RegExp(`import \\{([^}]*)\\} from ['"]${from.replace(/\./g, '\\.').replace(/\//g, '\\/')}['"];`);
  if (re.test(s)) s = s.replace(re, (m, names) => `import { ${[...names.split(',').map((x) => x.trim()).filter(Boolean), 'MAX_AI'].join(', ')} } from '${from}';`);
  else {
    const lines = s.split('\n');
    let last = -1; lines.forEach((line, i) => { if (/^import /.test(line)) last = i; });
    let i = last; while (i >= 0 && !/;\s*$/.test(lines[i])) i++;
    lines.splice(i + 1, 0, `import { MAX_AI } from '${from}';`);
    s = lines.join('\n');
  }
  fs.writeFileSync(path, s);
}
// ten liveries: the first five as they were
edit('src/game/grid.ts', [["  ['#2f7d4f', '#174a2c'], ['#7a3fa0', '#43205a']];",
  "  ['#2f7d4f', '#174a2c'], ['#7a3fa0', '#43205a'],\n"
  + "  // ?ai10: five more, so ten cars all differ (cars.ts PALETTE)\n"
  + "  ['#e86fa8', '#8a2f5e'], ['#3fb6c9', '#1d6a76'], ['#f0f0ea', '#5a5f69'], ['#e0603a', '#8a3414'],\n"
  + "  ['#9bc53d', '#4a6a14']];"]]);
// setup: a - / + ticker under ?ai10
edit('src/menu/menutypes.ts', [['  nRow?: HTMLElement; nBtns?: HTMLButtonElement[];', '  nRow?: HTMLElement; nBtns?: HTMLButtonElement[]; nLbl?: HTMLElement;   // (?ai10: the ticker)']]);
edit('src/menu/setup.ts', [
  ["  state.ui.nRow = addElement(panel, 'div', '', 'row');\n  state.ui.nBtns = [1, 2, 3, 4, 5].map((count) => addButton(menu, state.ui.nRow!, String(count),",
    "  state.ui.nRow = addElement(panel, 'div', '', 'row');\n"
    + "  if (FIX.ai10) {\n"
    + "    // ?ai10 (owner 11-03): a ticker, 1 .. MAX_AI, instead of a button per count\n"
    + "    const nudge = (delta: number) => {\n"
    + "      state.aiN = Math.max(1, Math.min(MAX_AI, state.aiN + delta));\n"
    + "      state.opponents = state.aiN;\n"
    + "      state.paint();\n"
    + "    };\n"
    + "    addButton(menu, state.ui.nRow, '−', () => nudge(-1));\n"
    + "    state.ui.nLbl = addElement(state.ui.nRow, 'div', '', 'val');\n"
    + "    state.ui.nLbl.style.cssText = 'flex:1;text-align:center;align-self:center';\n"
    + "    addButton(menu, state.ui.nRow, '+', () => nudge(1));\n"
    + "    state.ui.nBtns = [];\n"
    + "    return;\n"
    + "  }\n"
    + "  state.ui.nBtns = [1, 2, 3, 4, 5].map((count) => addButton(menu, state.ui.nRow!, String(count),"],
  ["  wid.nBtns.forEach((button, i) => button.classList.toggle('on', i + 1 === state.aiN));",
    "  wid.nBtns.forEach((button, i) => button.classList.toggle('on', i + 1 === state.aiN));\n"
    + "  if (wid.nLbl) wid.nLbl.textContent = state.aiN + (state.aiN === 1 ? ' AI CAR' : ' AI CARS');"],
]);
let s = fs.readFileSync('src/menu/setup.ts', 'utf8');
s = s.replace("import { MENU_COL } from './palette.ts';", "import { MENU_COL } from './palette.ts';\nimport { FIX, MAX_AI } from '../core/fixes.ts';");
fs.writeFileSync('src/menu/setup.ts', s);
console.log('ok');
