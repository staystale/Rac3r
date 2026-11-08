import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/menu/garage.ts', [
  // the picker always moves a slot it is given (the garage's)
  ['  onPick: (car: RosterRow) => void = () => {}, pickCar: CarSlot = yourCar(menu)) {',
    '  onPick: (car: RosterRow) => void, pickCar: CarSlot) {'],
  ["/**\n * Your car: the profile's active car, saved as it changes.\n * @param menu the menu context\n * @returns the slot\n */\nconst yourCar = (menu: Menu): CarSlot => ({ get: () => menu.profile.active,\n  set: (carId) => { menu.profile.active = carId; saveProfile(menu.profile); } });\n", ''],
  [" * The car the garage shows (?testgarage: the one being looked at, not yet yours), else yours.",
    " * The car the garage shows: the one being looked at (not yours until SELECT)."],
  ['const garageCarId = (menu: Menu) => (FIX.testGarage && menu.garage ? menu.garage.viewing\n  : menu.profile.active);',
    'const garageCarId = (menu: Menu) => (menu.garage ? menu.garage.viewing : menu.profile.active);'],
  ["  // ?testgarage: opened from test setup it looks at your car, and goes back there\n  if (FIX.testGarage && back) menu.garage = { viewing: menu.profile.active, back };\n  const session = FIX.testGarage ? menu.garage : null;",
    "  // THE TEST GARAGE (passed 11-03): opened from test setup it shows your car, and goes back there\n"
    + "  if (back || !menu.garage) {\n"
    + "    menu.garage = { viewing: menu.profile.active, back: back || (() => showMainMenu(menu)) };\n"
    + "  }\n  const session = menu.garage;"],
  ["  if (session) addElement(panel, 'div', 'TEST GARAGE · free to try', 'sub');", "  addElement(panel, 'div', 'TEST GARAGE · free to try', 'sub');"],
  ["        if (FIX.testGarage && spec.gripG != null && tarmacGrip !== 1) {\n          // ?testgarage (owner 11-03): the stock figure,",
    "        if (spec.gripG != null && tarmacGrip !== 1) {\n          // (owner 11-03) the stock figure,"],
  ["        return spec.gripG == null ? '—' : tarmacGrip === 1 ? spec.gripG + ' G'\n          : (spec.gripG * tarmacGrip).toFixed(2) + ' G <span style=\"color:' + MENU_COL.dim\n            + ';font-size:'\n            + MENU_COL.small + '\">STOCK ' + spec.gripG + '</span>';",
    "        return spec.gripG == null ? '—' : spec.gripG + ' G';"],
  ["  if (session) {\n    // SELECT locks the car in as yours", "  {\n    // SELECT locks the car in as yours"],
  ["      get: () => session.viewing, set: (carId) => { session.viewing = carId; } });\n    return;\n  }\n  addButton(menu, panel, '◀ BACK', () => showMainMenu(menu));\n  showCarPicker(menu, pick, showStats);\n}",
    "      get: () => session.viewing, set: (carId) => { session.viewing = carId; } });\n  }\n}"],
  ["  addButton(menu, buttonRow, FIX.testGarage ? 'TRY ✓' : 'APPLY ✓', () => {", "  addButton(menu, buttonRow, 'TRY ✓', () => {"],
  ["  if (FIX.testGarage) addButton(menu, buttonRow, 'BUY', () => {}, '', true, 'STORY');",
    "  // BUY (keeps it for story) comes with story mode's money - shown, greyed\n  addButton(menu, buttonRow, 'BUY', () => {}, '', true, 'STORY');"],
  ["  fitButton.innerHTML = !fitted ? (FIX.testGarage ? 'TRY ✓' : 'FIT ✓') : worn > 0.02 ? 'NEW SET ✓'\n    : (FIX.testGarage ? 'ON THE CAR ✓' : 'FITTED ✓');",
    "  fitButton.innerHTML = !fitted ? 'TRY ✓' : worn > 0.02 ? 'NEW SET ✓' : 'ON THE CAR ✓';"],
  [" * One surface's grip bar in the tyre shop: the white line is the stock set; ?testgarage: the car's\n * own stock set, the difference in ember.",
    " * One surface's grip bar in the tyre shop: the white line is the car's own stock set, the\n * difference in ember."],
  [' * @param stockSet the car\'s stock set (?testgarage), else null (Pre-Spun = 1)', ' * @param stockSet the car\'s stock set'],
  ['function tyreBar(lbl: string, surf: string, tyre: Tyre, stockSet: Tyre | null): string {\n  const grip = tyre.grip[surf] / (stockSet ? stockSet.grip[surf] : 1),',
    'function tyreBar(lbl: string, surf: string, tyre: Tyre, stockSet: Tyre): string {\n  const grip = tyre.grip[surf] / stockSet.grip[surf],'],
  ['color:${stockSet && percent !== 0 ? MENU_COL.accent : tone}">', 'color:${percent !== 0 ? MENU_COL.accent : tone}">'],
  ["  const fitB = addButton(menu, fitR, FIX.testGarage ? 'TRY ✓' : 'FIT ✓', () => {", "  const fitB = addButton(menu, fitR, 'TRY ✓', () => {"],
  ["  // ?testgarage: BUY (keeps it for story) comes with story mode's money - shown, greyed\n  if (FIX.testGarage) addButton(menu, fitR, 'BUY', () => {}, '', true, 'STORY');",
    "  // BUY (keeps it for story) comes with story mode's money - shown, greyed\n  addButton(menu, fitR, 'BUY', () => {}, '', true, 'STORY');"],
  ["    // ?testgarage: against the car's own stock set (the Chevvy's Polyglass, not Pre-Spun)\n    const stockSet = FIX.testGarage ? fittedTyre(car) : null;",
    "    // against the car's own stock set (the Chevvy's Polyglass, not Pre-Spun)\n    const stockSet = fittedTyre(car);"],
  ["(stockSet ? stockSet.name : 'PRE-SPUN').toUpperCase()", 'stockSet.name.toUpperCase()'],
  ["import { FIX } from '../core/fixes.ts';\n", ''],
]);
edit('src/menu/setup.ts', [
  [' * @param kept the choices to start from (?testgarage: as they were before a garage visit)', ' * @param kept the choices to start from (as they were before a garage visit)'],
  ["  if (FIX.testGarage) {\n    // ?testgarage (owner 11-03): no car picker here", "  {\n    // (owner 11-03) no car picker here"],
  ['      showGarage(menu, () => showSetup(menu, level, choices));\n    });\n  } else showCarPicker(menu, panel);',
    '      showGarage(menu, () => showSetup(menu, level, choices));\n    });\n  }'],
  ["import { showCarPicker, showGarage } from './garage.ts';\nimport { FIX } from '../core/fixes.ts';", "import { showGarage } from './garage.ts';"],
]);
edit('src/menu/tracks.ts', [
  ["  // ?testgarage: STORY on top, locked for now (owner 11-03)\n  if (FIX.testGarage) addButton(menu, buttons, 'STORY', () => {}, '', true, 'LOCKED');",
    "  // STORY on top, locked for now; the garage lives in test (and story), not here (owner 11-03)\n  addButton(menu, buttons, 'STORY', () => {}, '', true, 'LOCKED');"],
  ["  // ?testgarage: the garage lives in test (and story) - not here (owner 11-03)\n  if (!FIX.testGarage) addButton(menu, buttons, 'GARAGE', () => showGarage(menu));\n", ''],
  ["  if (!FIX.testGarage) addButton(menu, buttons, 'STORY', () => {}, '', true, 'LOCKED');\n", ''],
  ["import { showGarage } from './garage.ts';\nimport { FIX } from '../core/fixes.ts';\n", ''],
]);
edit('src/menu.ts', [['  // ?testgarage: the car the garage is showing, and where its BACK / SELECT go', '  // the car the garage is showing, and where its BACK / SELECT go']]);
let f = fs.readFileSync('src/core/fixes.ts', 'utf8');
const re = /  \/\/ \?testgarage=1:[^\n]*\n[^\n]*\n  testGarage: atLoad\('testgarage'\),\n/;
if (!re.test(f)) throw new Error('fixes');
f = f.replace(re, '').replace('// menustyle passed 11-03.)', '// menustyle, testgarage passed 11-03.)');
fs.writeFileSync('src/core/fixes.ts', f);
let l = fs.readFileSync('src/testlist.ts', 'utf8');
const i = l.indexOf("    id: 'testgarage',");
const start = l.lastIndexOf('  {\n', i), end = l.indexOf('  },\n', i) + 5;
l = l.slice(0, start) + l.slice(end);
l = l.replace('// namefix, bhbridges, menustyle passed 2026-11-03;', '// namefix, bhbridges, menustyle, testgarage passed 2026-11-03;');
fs.writeFileSync('src/testlist.ts', l);
console.log('ok');
