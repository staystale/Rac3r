import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/core/fixes.ts', [["  belly: atLoad('belly'),\n};", `  belly: atLoad('belly'),
  // ?agtyre=1: the tractor leaves the factory on FIRESTONED Field Lugger tractor tyres (cars.ts):
  // mud, grass and dirt grip, half the mud's drag (was the road Pre-Spun - stuck on thick mud)
  agTyre: atLoad('agtyre'),
};`]]);
edit('src/cars.ts', [
  ["    rimIn: 30,   // its real rim, inches (what tyres fit)",
    "    rimIn: 30,   // its real rim, inches (what tyres fit)\n"
    + "    // ?agtyre: its own factory set, the lugged FIRESTONED Field Lugger\n"
    + "    ...(FIX.agTyre ? { stockTyre: 'ag-lug' } : {}),"],
  ["  { id: 'goodwrench', name: 'BF GOODWRENCH', col: '#e8e8ee', blurb: 'street' },\n];",
    "  { id: 'goodwrench', name: 'BF GOODWRENCH', col: '#e8e8ee', blurb: 'street' },\n"
    + "  // ?agtyre (NOTES register: Firestone = FIRESTONED)\n"
    + "  ...(FIX.agTyre ? [{ id: 'firestoned', name: 'FIRESTONED', col: '#d8b04a', blurb: 'farm' }] : []),\n];"],
  ["    peak: 85, cold: 0.85, heatHard: 1.3, note: 'drag radial: hooks off the line, hates rain' }),\n];",
    "    peak: 85, cold: 0.85, heatHard: 1.3, note: 'drag radial: hooks off the line, hates rain' }),\n"
    + "  // ?agtyre (MEASURED 11-03: the 11-tonne tractor on Pre-Spun road tyres stuck on the thick mud\n"
    + "  // hill): a deep-lugged tractor tyre - digs into mud, grass and dirt, cleans itself (half the\n"
    + "  // plough), slow and skittish on tarmac and ice; tractors only (24-42 inch rims)\n"
    + "  ...(FIX.agTyre ? [makeTyre('ag-lug', 'firestoned', 'Field Lugger', 900, ['offroad'],\n"
    + "    [0.9, 0.85, 1.15, 1.3, 1.4, 1.6, 1.2, 1.2, 0.8], { rims: [24, 42], ploughK: 0.5,\n"
    + "      note: 'lugged tractor tyre: walks through mud, slow on tarmac' })] : []),\n];"],
]);
let n = fs.readFileSync('NOTES.md', 'utf8');
n = n.replace('Goodyear = GOOD YEAH (owner 11-03).', 'Goodyear = GOOD YEAH (owner 11-03), Mickey Thompson =\n  MICKY TOMSON, BFGoodrich = BF GOODWRENCH, Firestone = FIRESTONED.');
fs.writeFileSync('NOTES.md', n);
console.log('ok');
