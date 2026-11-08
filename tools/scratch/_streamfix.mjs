import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/vehicle.ts', [
  ['export interface CarStreamer { born: number }',
    '/** A tape streamer stuck to the car (cones.ts sticks it; render/objects.ts draws it). */\n'
    + 'export interface Streamer { born: number; phase: number; len: number }'],
  ['streamers: CarStreamer[] | null;', 'streamers: Streamer[] | null;'],
]);
edit('src/cones/coneTypes.ts', [
  ['export interface Streamer { born: number; len: number; phase: number }',
    "export type { Streamer } from '../vehicle.ts';"],
]);
let c = fs.readFileSync('src/cones/coneTypes.ts', 'utf8');
if (/\bStreamer\[\]/.test(c) && !c.includes("import type { Streamer }")) {
  c = c.replace("export type { Streamer } from '../vehicle.ts';",
    "import type { Streamer } from '../vehicle.ts';\nexport type { Streamer };");
  fs.writeFileSync('src/cones/coneTypes.ts', c);
}
edit('src/render/types.ts', [
  ['// A tape streamer stuck to a car.\nexport interface Streamer {\n  born: number;\n  phase: number;\n  len: number;\n}',
    "// A tape streamer stuck to a car (vehicle.ts).\nimport type { Streamer } from '../vehicle.ts';\nexport type { Streamer };"],
]);
edit('src/damage.ts', [
  ['  streamers?: unknown[] | null;', '  streamers?: Streamer[] | null;'],
  ["import type { CarWreck } from './vehicle.ts';", "import type { CarWreck, Streamer } from './vehicle.ts';"],
]);
console.log('ok');
