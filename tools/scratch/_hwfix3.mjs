import fs from 'node:fs';
function sub(path, a, b, all) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(a)) throw new Error(path + ': ' + a);
  s = all ? s.split(a).join(b) : s.replace(a, b);
  fs.writeFileSync(path, s);
}
sub('src/highway/hwtypes.ts', `/** The dressing context`, `/** Stamps a prop / area with the road distance it is dropped behind with, and returns it. */
export type Stamp = <T extends { _s?: number }>(obj: T) => T;

/** The dressing context`);
sub('src/world/types.ts', `  appL?: number[];   // highway.ts bridges: the approach lengths [0 | 1]`,
  `  appL?: number[];   // highway.ts bridges: the approach lengths [0 | 1]
  appW?: number;   // highway.ts bridges: the approaches' width
  ww?: number;   // highway.ts river bridges: the river's width`);
sub('src/world/types.ts', `  out?: number;   // gravel traps only (see Trap)`, `  out?: number;   // gravel traps only (see Trap)`);
for (const f of ['src/highway.ts', 'src/highway/cuts.ts', 'src/highway/dress.ts', 'src/highway/extras.ts',
  'src/highway/fields.ts', 'src/highway/litter.ts']) {
  let s = fs.readFileSync(f, 'utf8');
  s = s.split('mark: (rect: KeepRect) => void').join('mark: Stamp');
  s = s.replace(/(function \w+\([^)]*?)\bbridge\b(?!:)/g, '$1bridge: Prop');
  s = s.replace(/(function \w+\([^)]*?)\bslip\b(?!:)/g, '$1slip: Prop');
  s = s.replace('      mark = (obj) => {', '      mark: Stamp = (obj) => {');
  fs.writeFileSync(f, s);
}
console.log('ok');
