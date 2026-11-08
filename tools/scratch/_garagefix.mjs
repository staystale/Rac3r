import fs from 'node:fs';
const p = 'src/menu/garage.ts';
let s = fs.readFileSync(p, 'utf8');
const r = (a, b, all) => {
  if (!s.includes(a)) throw new Error(a);
  s = all ? s.split(a).join(b) : s.replace(a, b);
};
r('export function showCarPicker(menu: Menu, panel: HTMLElement, onPick = () => {}) {',
  'export function showCarPicker(menu: Menu, panel: HTMLElement,\n  onPick: (car: RosterRow) => void = () => {}) {');
r('  const cur = () => ROSTER.find((car) => car.id === menu.profile.active);',
  '  const cur = () => ROSTER.find((car) => car.id === menu.profile.active)!;');
r("    : ['ALL', ...classOf(filterClass).subs.filter(", "    : ['ALL', ...classOf(filterClass)!.subs.filter(");
r('  const step = (list, value, delta) =>', '  const step = (list: string[], value: string, delta: number) =>');
r('  const row = (tag, col, prev, next) => {',
  '  const row = (tag: string, col: string, prev: () => void, next: () => void) => {');
r("classOf(filterClass).name;", "classOf(filterClass)!.name;");
r('    const car = ROSTER.find((x) => x.id === menu.profile.active), spec = CAR_STATS[car.id] || {};',
  '    const car = ROSTER.find((x) => x.id === menu.profile.active)!,\n      spec: Partial<CarStat> = STATS[car.id] || {};');
r('<b>${classOf(car.cls).name} ·', '<b>${classOf(car.cls)!.name} ·');
r('          brand = TYRE_BRANDS.find((x) => x.id === tyre.brand);',
  '          brand = TYRE_BRANDS.find((x) => x.id === tyre.brand)!;');
r('    car = ROSTER.find((x) => x.id === carId);\n  const cur = {',
  '    car = ROSTER.find((x) => x.id === carId)!;\n  const cur: Livery & { paint: string; trim: string; num: number } = {');
r("    for (const [field, list] of [['paint', bodyB],\n      ['trim', trimB]]) for",
  "    for (const [field, list] of [['paint', bodyB],\n      ['trim', trimB]] as ['paint' | 'trim', HTMLButtonElement[]][]) for");
r('  const swatches = (label, field) => {', "  const swatches = (label: string, field: 'paint' | 'trim') => {");
r('  const pct = (share) =>', '  const pct = (share: number) =>');
r('    car = ROSTER.find((x) => x.id === carId),\n    spec = CAR_STATS[carId] || {};',
  '    car = ROSTER.find((x) => x.id === carId)!,\n    spec: Partial<CarStat> = STATS[carId] || {};');
r('    const tyre = tyreOf(sel), brand = TYRE_BRANDS.find((x) => x.id === tyre.brand),',
  '    const tyre = tyreOf(sel), brand = TYRE_BRANDS.find((x) => x.id === tyre.brand)!,');
r('    const bar = (lbl, surf) => {', '    const bar = (lbl: string, surf: string) => {');
fs.writeFileSync(p, s);
console.log('ok');
