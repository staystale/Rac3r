// throwaway: does a lazy level dropped back to its stub (its own keys deleted, the stub's put back,
// _build with them) rebuild IDENTICALLY? worldhash's fingerprint (its serialiser, lifted from
// tools/worldhash.mjs), built fresh vs dropped and rebuilt. node tools/scratch/_droplevel.mjs [ids]
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
const sha = (text) => createHash('sha256').update(text).digest('hex');
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mix = Math.imul(state ^ (state >>> 15), 1 | state);
    mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}
const fingerprint = (id) => {
  Math.random = seededRandom(0x5eed);
  L.setLevel(id);
  const text = ser([L.LEVEL, L.PAINT, L.BOARDS, L.CONES, L.SPAWN, L.ZONES, L.BUMPS, L.PROPS]);
  // (TAPELESS=1: the tape ids blanked - a counter across every build, the known harmless difference)
  return sha(process.env.TAPELESS ? text.replace(/tape:[0-9]+/g, 'tape:#') : text);
};
const lazy = L.LEVELS.filter((lv) => lv._build).map((lv) => lv.id);
const ids = process.argv[2] ? process.argv[2].split(',') : lazy;
let same = 0;
for (const id of ids) {
  const level = L.LEVELS.find((lv) => lv.id === id);
  if (!level || !level._build) { console.log(id + ': not lazy'); continue; }
  const stub = { ...level };
  const t0 = performance.now();
  const fresh = fingerprint(id);
  const buildMs = performance.now() - t0;
  L.setLevel('lab');
  for (const key of Object.keys(level)) delete level[key];
  Object.assign(level, stub);
  const t1 = performance.now();
  const again = fingerprint(id);
  const rebuildMs = performance.now() - t1;
  L.setLevel('lab');
  if (fresh === again) same++;
  console.log(`${id}: ${fresh === again ? 'SAME' : 'DIFFERENT'} (build ${buildMs.toFixed(0)} ms,`
    + ` rebuild ${rebuildMs.toFixed(0)} ms)`);
}
console.log(`dropped and rebuilt: ${same} of ${ids.length} SAME`);
