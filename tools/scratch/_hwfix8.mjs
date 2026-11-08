import fs from 'node:fs';
function sub(path, a, b, all) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(a)) throw new Error(path + ': ' + a);
  s = all ? s.split(a).join(b) : s.replace(a, b);
  fs.writeFileSync(path, s);
}
const F = 'src/highway/fields.ts';
sub(F, 'const FIELD_SURF = {', 'const FIELD_SURF: Record<string, [string, string | null]> = {');
sub(F, 'const FIELD_T = [', 'const FIELD_T: [string, number][] = [');
let s = fs.readFileSync(F, 'utf8');
s = s.replace(/function (addField\w+)\(level: HwLevel, plot, rand: \(\) => number\)/g, 'function $1(level: HwLevel, plot: Plot, rand: () => number)');
s = s.replace(`  for (const list of [
    level.zones,
    level.barriers,
    level.props,
    level.lanes,
    level._hw.keep,
    level.cones,
    level._hw.looseNew || [],
  ]) {
    const kept = list.filter(survives);
    if (kept.length !== list.length) {
      list.length = 0;
      list.push(...kept);
    }
  }`, `  const prune = <T extends { field?: number }>(list: T[]) => {
    const kept = list.filter(survives);
    if (kept.length !== list.length) {
      list.length = 0;
      list.push(...kept);
    }
  };
  prune(level.zones); prune(level.barriers); prune(level.props); prune(level.lanes);
  prune(level._hw.keep); prune(level.cones || []); prune(level._hw.looseNew || []);`);
s = s.replace(/(\n  for \(let j = i; j <= i \+ count; j \+= 2\) \{\n    const pos = pointAt\(j, side \* mid\);)/, '$1');
fs.writeFileSync(F, s);
// world types: field tags on lanes, barriers and cones
const W = 'src/world/types.ts';
sub(W, `  _s?: number;   // highway.ts: the road distance it is dropped behind with
  _segs?:`, `  _s?: number;   // highway.ts: the road distance it is dropped behind with
  field?: number;   // highway/fields.ts: the field (village) it belongs to
  _segs?:`);
sub(W, `  tape?: string | number;   // load.ts tapePass numbers its tapes
  idx?: number;
}`, `  tape?: string | number;   // load.ts tapePass numbers its tapes
  idx?: number;
  field?: number;   // highway/fields.ts: a field's animals go when the field is cleared
}`);
console.log('ok');
