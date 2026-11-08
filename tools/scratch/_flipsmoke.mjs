import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/core/fixes.ts', [
  ['// aicool, smokeearly, airfx passed 11-03.)', '// aicool, smokeearly, airfx, smokelinger, aidust passed 11-03.)'],
  ["  // ?aidust=1: AI cars near you throw tyre smoke, dust and spray too (render.ts, particles.ts)\n"
    + "  aiDust: atLoad('aidust'),\n"
    + "  // ?smokelinger=1: tyre smoke hangs ~2x longer and dust can no longer push it out of the pool\n"
    + "  // (render/particles.ts)\n"
    + "  smokeLinger: atLoad('smokelinger'),\n", ''],
]);
edit('src/render/particles.ts', [
  ['  // ?aidust: each car\'s own fractional remainders (several cars throw now)',
    '  // each car\'s own fractional remainders (AI cars near you throw too)'],
  ['// ?smokelinger=1 (owner 11-03: "tyre smoke vanishes', '// SMOKE LINGERS (owner 11-03: "tyre smoke vanishes'],
  ['fill it, so every new dust puff threw out the oldest smoke. Under the switch a full pool drops',
    'fill it, so every new dust puff threw out the oldest smoke. So a full pool drops'],
  [' * Make room in a full pool: the oldest puff of the new one\'s kind (?smokelinger), else the oldest.',
    ' * Make room in a full pool: the oldest puff of the new one\'s kind, else the oldest.'],
  ['  const same = FIX.smokeLinger ? puffs.findIndex((puff) => puff.rgb === rgb) : -1;',
    '  const same = puffs.findIndex((puff) => puff.rgb === rgb);'],
  ['      puff.life *= FIX.smokeLinger ? SMOKE_LIFE_K : 1;\n', '      puff.life *= SMOKE_LIFE_K;\n'],
  [' * Runs an emitter with this car\'s own spray / smoke remainders (?aidust: several cars throw, and\n'
    + ' * one shared remainder would hand one car\'s half-puff to the next); without the switch, as before.',
  ' * Runs an emitter with this car\'s own spray / smoke remainders (several cars throw, and one\n'
    + ' * shared remainder would hand one car\'s half-puff to the next).'],
  ['  if (!FIX.aiDust) { emit(); return; }\n', ''],
]);
edit('src/render.ts', [
  ['// m from the player\'s car: the AI cars that throw smoke and dust (?aidust; off screen beyond)',
    '// m from the player\'s car: the AI cars that throw smoke and dust (off screen beyond)'],
  ['  // ?aidust=1 (owner 11-03: "yes" - AI cars throw no smoke or dust): the AI cars near you too\n'
    + '  if (FIX.aiDust) {\n'
    + '    for (const rival of game.ai || []) {\n'
    + '      const car = rival.car;\n'
    + '      if (Math.abs(car.x - game.car.x) > AI_DUST_M\n'
    + '        || Math.abs(car.y - game.car.y) > AI_DUST_M) continue;\n'
    + '      ctx.addSpray(car, game.marks, wallDt);\n'
    + '      ctx.addSmoke(car, game.marks, wallDt);\n'
    + '    }\n'
    + '  }\n',
  '  // the AI cars near you too (owner 11-03: AI cars threw no smoke or dust)\n'
    + '  for (const rival of game.ai || []) {\n'
    + '    const car = rival.car;\n'
    + '    if (Math.abs(car.x - game.car.x) > AI_DUST_M\n'
    + '      || Math.abs(car.y - game.car.y) > AI_DUST_M) continue;\n'
    + '    ctx.addSpray(car, game.marks, wallDt);\n'
    + '    ctx.addSmoke(car, game.marks, wallDt);\n'
    + '  }\n'],
]);
// testlist: drop the two entries, note them passed
let t = fs.readFileSync('src/testlist.ts', 'utf8');
for (const id of ['smokelinger', 'aidust']) {
  const at = t.indexOf(`    id: '${id}',`);
  if (at < 0) throw new Error(id);
  const start = t.lastIndexOf('  {\n', at), end = t.indexOf('  },\n', at) + 5;
  t = t.slice(0, start) + t.slice(end);
}
fs.writeFileSync('src/testlist.ts', t);
console.log('ok');
