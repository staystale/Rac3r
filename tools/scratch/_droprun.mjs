// throwaway: the memory budget in play (PERFPASS=1): every lazy level played in turn (the budget
// drops the least recently played as the count passes it), then each played again; worldhash's
// fingerprint (tape ids blanked: a counter across builds) of every visit compared with its first
// node tools/scratch/_droprun.mjs
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as L from '../../src/lab.ts';
import { addStageLevels } from '../../src/stagegen.ts';
import { addHighwayLevel } from '../../src/highway.ts';
addStageLevels();
addHighwayLevel();
const source = readFileSync(new URL('../worldhash.mjs', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('function ser('), source.indexOf('/**\n * Sha256'));
const ser = new Function('SKIP_KEYS', code + '\nreturn ser;')(new Set());
const seeded = (seed) => { let state = seed >>> 0; return () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let mix = Math.imul(state ^ (state >>> 15), 1 | state);
  mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
  return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296; }; };
const visit = (id) => {
  const level = L.LEVELS.find((lv) => lv.id === id), wasBuilt = !level._build;
  Math.random = seeded(0x5eed);
  const t0 = performance.now();
  L.setLevel(id);
  const ms = performance.now() - t0;
  const text = ser([L.LEVEL, L.PAINT, L.BOARDS, L.CONES, L.SPAWN, L.ZONES, L.BUMPS, L.PROPS]);
  return { hash: createHash('sha256').update(text.replace(/tape:[0-9]+/g, 'tape:#')).digest('hex'),
    wasBuilt, ms };
};
const lazy = L.LEVELS.filter((lv) => lv._build).map((lv) => lv.id), first = {};
for (const id of lazy) first[id] = visit(id).hash;
let rebuilt = 0, same = 0, rebuildMs = 0;
for (const id of lazy) {
  const again = visit(id);
  if (!again.wasBuilt) { rebuilt++; rebuildMs += again.ms; }
  if (again.hash === first[id]) same++;
  else console.log(`${id}: DIFFERENT (${again.wasBuilt ? 'kept' : 'rebuilt'})`);
}
console.log(`switch ${process.env.PERFPASS || 0}: ${lazy.length} levels played twice, ${rebuilt} `
  + `dropped and rebuilt (mean ${(rebuildMs / Math.max(1, rebuilt)).toFixed(0)} ms), ${same} SAME`);
