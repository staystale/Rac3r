import fs from 'node:fs';
function edit(path, pairs) {
  let s = fs.readFileSync(path, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(path + ': ' + a);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(path, s);
}
edit('src/hud/laps.ts', [
  ["import { FIX } from '../core/fixes.ts';\n", ''],
  ['  if (FIX.jokerHint) {\n'
    + '    const turnDist = jokerTurnDist(), total = LEVEL.subtrack ? LEVEL.subtrack.totalDist : 0;\n'
    + '    return race.started && !race.joker && turnDist != null && trackDist != null && total > 0\n'
    + '      && (((turnDist - trackDist) % total) + total) % total < 140;\n'
    + '  }\n'
    + '  const jokerArrow = LEVEL.joker && LEVEL.joker.arrows\n'
    + '    && LEVEL.joker.arrows.find((x) => x && x.d != null);\n'
    + '  const near = race.started && !race.joker && jokerArrow && trackDist != null\n'
    + '    && (((jokerArrow.d! - trackDist) % LEVEL.subtrack!.totalDist)\n'
    + '    + LEVEL.subtrack!.totalDist) % LEVEL.subtrack!.totalDist < 140;\n'
    + '  return near;\n',
  '  const turnDist = jokerTurnDist(), total = LEVEL.subtrack ? LEVEL.subtrack.totalDist : 0;\n'
    + '  return race.started && !race.joker && turnDist != null && trackDist != null && total > 0\n'
    + '    && (((turnDist - trackDist) % total) + total) % total < 140;\n'],
  ['// ?jokerhint=1 (owner 11-03: "yes", fix it): the hint read', '// JOKER HINT (passed 11-03): the hint read'],
]);
edit('src/render/particles.ts', [
  ["import { FIX } from '../core/fixes.ts';\n", ''],
  ['  // the car throwing now is an AI car (its puffs are let go of first: ?puffpool)',
    '  // the car throwing now is an AI car (its puffs are let go of first: makeRoom)'],
  ['// 220 -> 320: room for the long dust trails (11-02); ?puffpool: 640 (the AI cars throw too)\n'
    + 'const MAX_PUFFS = FIX.puffPool ? 640 : 320;',
  '// 220 -> 320: room for the long dust trails (11-02); 640: the AI cars throw too (puffpool,\n'
    + '// passed 11-03)\nconst MAX_PUFFS = 640;'],
  ['// ?puffpool=1 (owner 11-03: "dust / smoke trails', '// PUFF POOL (passed 11-03; owner: "dust / smoke trails'],
  [' * Make room in a full pool (?puffpool: off screen first, then the AI\'s, then the oldest).',
    ' * Make room in a full pool: off screen first, then the AI\'s, then the oldest.'],
  ['  if (!FIX.puffPool) { dropOldest(puffs, rgb); return; }\n', ''],
  [' * @param byAi an AI car (its puffs marked: ?puffpool)', ' * @param byAi an AI car (its puffs marked: makeRoom)'],
]);
edit('src/render/types.ts', [
  ['  ai?: boolean;   // thrown by an AI car (?puffpool: let go of before yours)',
    '  ai?: boolean;   // thrown by an AI car (let go of before yours: render/particles.ts makeRoom)'],
]);
edit('src/core/fixes.ts', [
  ["  // ?jokerhint=1: the lap panel's joker \"approaching\" hint works out where the turn-off is\n"
    + "  // (hud/laps.ts)\n  jokerHint: atLoad('jokerhint'),\n", ''],
  ['  // ?puffpool=1: a full puff pool lets go of the puffs off screen, then the AI\'s farthest from\n'
    + '  // you, before yours; twice the room (render/particles.ts)\n'
    + "  puffPool: atLoad('puffpool'),\n", ''],
  ['aicool, smokeearly, airfx, smokelinger, aidust, realcars passed 11-03.)',
    'aicool, smokeearly, airfx, smokelinger, aidust, realcars, jokerhint, puffpool passed\n// 11-03.)'],
]);
let t = fs.readFileSync('src/testlist.ts', 'utf8');
for (const id of ['jokerhint', 'puffpool']) {
  const at = t.indexOf(`    id: '${id}',`);
  if (at < 0) throw new Error(id);
  const start = t.lastIndexOf('  {\n', at), end = t.indexOf('  },\n', at) + 5;
  t = t.slice(0, start) + t.slice(end);
}
t = t.replace('aicool, smokeearly, airfx, smokelinger, aidust, realcars passed\n  // 2026-11-03)',
  'aicool, smokeearly, airfx, smokelinger, aidust, realcars, jokerhint,\n  // puffpool passed 2026-11-03)');
fs.writeFileSync('src/testlist.ts', t);
console.log('ok');
