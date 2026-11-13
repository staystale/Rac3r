// throwaway: which keys of a level differ between a fresh build and a drop-and-rebuild
import * as L from '../../src/lab.ts';
import { readFileSync } from 'node:fs';
import { addStageLevels } from '../../src/stagegen.ts';
addStageLevels();
const source = readFileSync(new URL('../worldhash.mjs', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('function ser('), source.indexOf('/**\n * Sha256'));
const ser = new Function('SKIP_KEYS', code + '\nreturn ser;')(new Set());
let seed = 7;
const id = process.argv[2] || 'xgayms', level = L.LEVELS.find((lv) => lv.id === id), stub = { ...level };
const take = () => { seed = 7; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  L.setLevel(id); const out = {}; for (const key of Object.keys(L.LEVEL)) out[key] = ser(L.LEVEL[key]); return out; };
const fresh = take();
L.setLevel('lab');
for (const key of Object.keys(level)) delete level[key];
Object.assign(level, stub);
const again = take();
for (const key of new Set([...Object.keys(fresh), ...Object.keys(again)])) {
  if (fresh[key] === again[key]) continue;
  const a = fresh[key] || '', b = again[key] || '';
  let at = 0; while (at < a.length && a[at] === b[at]) at++;
  console.log(`${key}: lengths ${a.length} vs ${b.length}; first diff at ${at}: ${a.slice(Math.max(0, at - 80), at + 60)} | ${b.slice(Math.max(0, at - 80), at + 60)}`);
}
