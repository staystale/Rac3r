import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/game/sim.ts', [
  ['  if (hwData.looseNew.length) {\n    game.cones.spawn(hwData.looseNew);\n    hwData.looseNew.length = 0;',
    '  const looseNew = hwData.looseNew!;   // (the highway keeps the list)\n'
    + '  if (looseNew.length) {\n    game.cones.spawn(looseNew);\n    looseNew.length = 0;'],
  ['const corner = racer.wheelSpawn.shift(),', 'const corner = racer.wheelSpawn.shift()!,'],
]);
edit('src/marks.ts', [
  ["type MarkSurface = Pick<Surface, 'id' | 'spray'> & { mark?: Mark | null };",
    'type MarkSurface = WheelGround & { id?: string };'],
  ['  const dry = (SURFACES as Record<string, Surface>)[surface.id];',
    '  const dry = (SURFACES as Record<string, Surface>)[surface.id!];'],
  ["import type { Mark, Spray, Surface } from './world/types.ts';",
    "import type { Mark, Spray, Surface, WheelGround } from './world/types.ts';"],
]);
console.log('ok');
