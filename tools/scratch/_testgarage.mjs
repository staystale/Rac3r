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
  // ?testgarage=1: the garage lives in test mode (setup's GARAGE button, back to that setup);
  // browsing a car no longer changes yours - SELECT locks it in; the shops TRY (free in test)
  testGarage: atLoad('testgarage'),
};`]]);
edit('src/menu.ts', [
  ['  openedAt: number;   // when the current screen opened (ghost-click guard)\n}',
    '  openedAt: number;   // when the current screen opened (ghost-click guard)\n'
    + '  // ?testgarage: the car the garage is showing, and where its BACK / SELECT go\n'
    + '  garage?: { viewing: string; back: () => void } | null;\n}'],
]);
// the picker: an optional get / set for "the car" (default: your car, as before)
edit('src/menu/garage.ts', [
  ['export function showCarPicker(menu: Menu, panel: HTMLElement,\n  onPick: (car: RosterRow) => void = () => {}) {',
    'export function showCarPicker(menu: Menu, panel: HTMLElement,\n  onPick: (car: RosterRow) => void = () => {}, '
    + 'pickCar: CarSlot = yourCar(menu)) {'],
  ['  const cur = () => ROSTER.find((car) => car.id === menu.profile.active)!;',
    '  const cur = () => ROSTER.find((car) => car.id === pickCar.get())!;'],
  ['  if (!list.some((car) => car.id === menu.profile.active)) menu.profile.active = list[0].id;\n  saveProfile(menu.profile);',
    '  if (!list.some((car) => car.id === pickCar.get())) pickCar.set(list[0].id);'],
  ['    menu.profile.active = step(cars().map((car) => car.id), menu.profile.active, -1);\n  saveProfile(menu.profile);',
    '    pickCar.set(step(cars().map((car) => car.id), pickCar.get(), -1));'],
  ['      menu.profile.active = step(cars().map((car) => car.id), menu.profile.active, 1);\n    saveProfile(menu.profile);',
    '      pickCar.set(step(cars().map((car) => car.id), pickCar.get(), 1));'],
  ['/**\n * GARAGE (spec §3;', `/** Which car a picker moves: get the id, set a new one. */
interface CarSlot { get: () => string; set: (carId: string) => void }
/**
 * Your car: the profile's active car, saved as it changes.
 * @param menu the menu context
 * @returns the slot
 */
const yourCar = (menu: Menu): CarSlot => ({ get: () => menu.profile.active,
  set: (carId) => { menu.profile.active = carId; saveProfile(menu.profile); } });
/**
 * The car the garage shows (?testgarage: the one being looked at, not yet yours), else yours.
 * @param menu the menu context
 * @returns the car id
 */
const garageCarId = (menu: Menu) => (FIX.testGarage && menu.garage ? menu.garage.viewing
  : menu.profile.active);

/**
 * GARAGE (spec §3;`],
  ['export function showGarage(menu: Menu) {\n  const panel = addPane(menu, true);\n  addElement(panel, \'h2\', \'GARAGE\');',
    "export function showGarage(menu: Menu, back?: () => void) {\n"
    + "  // ?testgarage: opened from test setup it looks at your car, and goes back there\n"
    + "  if (FIX.testGarage && back) menu.garage = { viewing: menu.profile.active, back };\n"
    + "  const session = FIX.testGarage ? menu.garage : null;\n"
    + "  const panel = addPane(menu, true);\n  addElement(panel, 'h2', 'GARAGE');\n"
    + "  if (session) addElement(panel, 'div', 'TEST GARAGE · free to try', 'sub');"],
  ['    const car = ROSTER.find((x) => x.id === menu.profile.active)!,\n      spec: Partial<CarStat> = CAR_STATS[car.id] || {};',
    '    const car = ROSTER.find((x) => x.id === garageCarId(menu))!,\n      spec: Partial<CarStat> = CAR_STATS[car.id] || {};'],
  ["  addButton(menu, panel, '◀ BACK', () => showMainMenu(menu));\n  showCarPicker(menu, pick, showStats);\n}",
    "  if (session) {\n"
    + "    // SELECT locks the car in as yours (owner 11-03); browsing alone changes nothing\n"
    + "    const row = addElement(panel, 'div', '', 'row');\n"
    + "    const select = addButton(menu, row, 'SELECT ✓', () => {\n"
    + "      if (session.viewing === menu.profile.active) return;\n"
    + "      menu.profile.active = session.viewing;\n"
    + "      saveProfile(menu.profile);\n"
    + "      session.back();\n"
    + "    });\n"
    + "    addButton(menu, row, '◀ BACK', () => session.back());\n"
    + "    const showSelect = () => {\n"
    + "      const yours = session.viewing === menu.profile.active;\n"
    + "      select.textContent = yours ? 'SELECTED ✓' : 'SELECT ✓';\n"
    + "      select.className = yours ? 'on' : 'go';\n"
    + "    };\n"
    + "    showCarPicker(menu, pick, (car) => { showStats(); showSelect(); return car; }, {\n"
    + "      get: () => session.viewing, set: (carId) => { session.viewing = carId; } });\n"
    + "    return;\n"
    + "  }\n"
    + "  addButton(menu, panel, '◀ BACK', () => showMainMenu(menu));\n  showCarPicker(menu, pick, showStats);\n}"],
  // the shops: the car the garage shows; TRY in test
  ['  const panel = addPane(menu, true), carId = menu.profile.active,\n    car = ROSTER.find((x) => x.id === carId)!;\n  const cur: Livery',
    '  const panel = addPane(menu, true), carId = garageCarId(menu),\n    car = ROSTER.find((x) => x.id === carId)!;\n  const cur: Livery'],
  ["  addButton(menu, buttonRow, 'APPLY ✓', () => {", "  addButton(menu, buttonRow, FIX.testGarage ? 'TRY ✓' : 'APPLY ✓', () => {"],
  ["  const fitB = addButton(menu, fitR, 'FIT ✓', () => {", "  const fitB = addButton(menu, fitR, FIX.testGarage ? 'TRY ✓' : 'FIT ✓', () => {"],
  ["import { MENU_COL } from './palette.ts';", "import { MENU_COL } from './palette.ts';\nimport { FIX } from '../core/fixes.ts';"],
]);
// the tyre shop's car
let g = fs.readFileSync('src/menu/garage.ts', 'utf8');
const shop = g.indexOf('function showTyreShop(menu: Menu) {');
const line = g.indexOf('carId = menu.profile.active,', shop);
if (shop < 0 || line < 0 || line - shop > 200) throw new Error('tyre shop carId');
g = g.slice(0, line) + 'carId = garageCarId(menu),' + g.slice(line + 'carId = menu.profile.active,'.length);
fs.writeFileSync('src/menu/garage.ts', g);
// setup: a GARAGE button beside the car picker; the main menu loses its own
edit('src/menu/setup.ts', [
  ['  showCarPicker(menu, panel);\n  addLaunchButtons(menu, panel, level, state);',
    "  showCarPicker(menu, panel);\n"
    + "  // ?testgarage: the garage from here, and back to this setup (owner 11-03)\n"
    + "  if (FIX.testGarage) addButton(menu, panel, 'GARAGE ›', () => showGarage(menu, () => showSetup(menu, level)));\n"
    + "  addLaunchButtons(menu, panel, level, state);"],
  ["import { showCarPicker } from './garage.ts';", "import { showCarPicker, showGarage } from './garage.ts';\nimport { FIX } from '../core/fixes.ts';"],
]);
edit('src/menu/tracks.ts', [
  ["  addButton(menu, buttons, 'GARAGE', () => showGarage(menu));",
    "  // ?testgarage: the garage lives in test (and story) - not here (owner 11-03)\n"
    + "  if (!FIX.testGarage) addButton(menu, buttons, 'GARAGE', () => showGarage(menu));"],
  ["import { showGarage } from './garage.ts';", "import { showGarage } from './garage.ts';\nimport { FIX } from '../core/fixes.ts';"],
]);
console.log('ok');
