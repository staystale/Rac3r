import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
// setup: keep the choices across a garage visit; no car picker, one GARAGE button
edit('src/menu/setup.ts', [
  [' * @param level the chosen level\n */\nexport function showSetup(menu: Menu, level: Level) {',
    ' * @param level the chosen level\n * @param kept the choices to start from (?testgarage: as they were before a garage visit)\n */\n'
    + 'export function showSetup(menu: Menu, level: Level, kept: Partial<SetupState> = {}) {'],
  ['    ui: {},   // the opponent / difficulty widgets paintSetupOpponents updates\n    paint: () => {},   // repaints the setup rows (wrapped by the laps row)\n  };',
    '    ...kept,\n    ui: {},   // the opponent / difficulty widgets paintSetupOpponents updates\n    paint: () => {},   // repaints the setup rows (wrapped by the laps row)\n  };'],
  ["  showCarPicker(menu, panel);\n  // ?testgarage: the garage from here, and back to this setup (owner 11-03)\n  if (FIX.testGarage) {\n    addButton(menu, panel, 'GARAGE ›', () => showGarage(menu, () => showSetup(menu, level)));\n  }",
    "  if (FIX.testGarage) {\n"
    + "    // ?testgarage (owner 11-03): no car picker here - the GARAGE (your car on it) picks it, and\n"
    + "    // comes back to this setup with every choice as it was (AI, laps, RX, the hour)\n"
    + "    const car = ROSTER.find((row) => row.id === menu.profile.active)!;\n"
    + "    addButton(menu, panel, `GARAGE · ${car.name} ›`, () => {\n"
    + "      const { road, traffic, litter, opponents, aiN, diff, aiCars, rxRace, laps, time } = state;\n"
    + "      const choices = { road, traffic, litter, opponents, aiN, diff, aiCars, rxRace, laps, time };\n"
    + "      showGarage(menu, () => showSetup(menu, level, choices));\n"
    + "    });\n"
    + "  } else showCarPicker(menu, panel);"],
  // the RX row and the hour start from the state (kept), not fixed defaults
  ["    const practiceBtn = addButton(menu, rxRow, 'PRACTICE', () => {\n      state.rxRace = false;\n      practiceBtn.classList.add('on');\n      rxBtn.classList.remove('on');\n    }, 'on');",
    "    const practiceBtn = addButton(menu, rxRow, 'PRACTICE', () => {\n      state.rxRace = false;\n      practiceBtn.classList.add('on');\n      rxBtn.classList.remove('on');\n    }, state.rxRace ? '' : 'on');"],
  ["      rxBtn.classList.add('on');\n      practiceBtn.classList.remove('on');\n    });",
    "      rxBtn.classList.add('on');\n      practiceBtn.classList.remove('on');\n    }, state.rxRace ? 'on' : '');"],
  ['function addTimeRows(menu: Menu, panel: HTMLElement, state: SetupState) {\n  state.time = null;',
    'function addTimeRows(menu: Menu, panel: HTMLElement, state: SetupState) {\n  state.time = state.time ?? null;'],
  ["  addSetupSlider(menu, panel, 'START HOUR', 0, 23, 1, 12,", "  addSetupSlider(menu, panel, 'START HOUR', 0, 23, 1, state.time ?? 12,"],
]);
let s = fs.readFileSync('src/menu/setup.ts', 'utf8');
if (!/import \{[^}]*\bROSTER\b[^}]*\} from '\.\.\/cars\.ts'/.test(s)) {
  s = s.replace("import { MENU_COL } from './palette.ts';", "import { MENU_COL } from './palette.ts';\nimport { ROSTER } from '../cars.ts';");
}
fs.writeFileSync('src/menu/setup.ts', s);
// the shops: TRY, and BUY greyed until story mode has money
edit('src/menu/garage.ts', [
  ["  fitButton.innerHTML = !fitted ? 'FIT ✓' : worn > 0.02 ? 'NEW SET ✓' : 'FITTED ✓';",
    "  fitButton.innerHTML = !fitted ? (FIX.testGarage ? 'TRY ✓' : 'FIT ✓') : worn > 0.02 ? 'NEW SET ✓'\n"
    + "    : (FIX.testGarage ? 'ON THE CAR ✓' : 'FITTED ✓');"],
  ["  }, 'go');\n  addButton(menu, panel, '◀ BACK', () => showGarage(menu));\n  const showTyre = () => {",
    "  }, 'go');\n"
    + "  // ?testgarage: BUY (keeps it for story) comes with story mode's money - shown, greyed\n"
    + "  if (FIX.testGarage) addButton(menu, fitR, 'BUY', () => {}, '', true, 'STORY');\n"
    + "  addButton(menu, panel, '◀ BACK', () => showGarage(menu));\n  const showTyre = () => {"],
]);
let g = fs.readFileSync('src/menu/garage.ts', 'utf8');
const tryAt = g.indexOf("  addButton(menu, buttonRow, FIX.testGarage ? 'TRY ✓' : 'APPLY ✓', () => {");
const endAt = g.indexOf("  }, 'go');\n", tryAt) + "  }, 'go');\n".length;
if (tryAt < 0 || endAt < tryAt) throw new Error('paint TRY');
g = g.slice(0, endAt) + "  if (FIX.testGarage) addButton(menu, buttonRow, 'BUY', () => {}, '', true, 'STORY');\n" + g.slice(endAt);
fs.writeFileSync('src/menu/garage.ts', g);
// the main menu: STORY on top
edit('src/menu/tracks.ts', [
  ["  addButton(menu, buttons, 'TEST MODE', () => showTrackSelect(menu), 'go');",
    "  // ?testgarage: STORY on top, locked for now (owner 11-03)\n"
    + "  if (FIX.testGarage) addButton(menu, buttons, 'STORY', () => {}, '', true, 'LOCKED');\n"
    + "  addButton(menu, buttons, 'TEST MODE', () => showTrackSelect(menu), 'go');"],
  ["  addButton(menu, buttons, 'STORY', () => {}, '', true, 'LOCKED');\n}",
    "  if (!FIX.testGarage) addButton(menu, buttons, 'STORY', () => {}, '', true, 'LOCKED');\n}"],
]);
console.log('ok');
