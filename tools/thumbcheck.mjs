// thumbcheck.mjs - EVERY LEVEL HAS A SHIPPED THUMBNAIL (src/menu/thumbfiles.ts): each level in the
// menu listed in assets/thumbs/index.json with its PNG and its WebP there (?thumbfill=1 reads the
// WebP; a level without one is painted by the
// menu when its list opens - the freeze the shipped ones are for). Fails naming them: run
// node tools/thumbs.mjs <id,id...>. node tools/thumbcheck.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../src/world/levels/index.ts';

const DIR = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'assets',
  'thumbs');
let listed = [];
try {
  listed = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8')).ids;
} catch (err) {
  console.log('thumbcheck: no assets/thumbs/index.json -', err.message);
}
const missing = LEVELS.map((level) => level.id).filter((levelId) => !listed.includes(levelId)
  || !fs.existsSync(path.join(DIR, levelId + '.png'))
  || !fs.existsSync(path.join(DIR, levelId + '.webp')));
console.log(missing.length ? `thumbcheck FAILED: no shipped thumbnail for ${missing.join(', ')} - `
  + `run node tools/thumbs.mjs ${missing.join(',')}` : `thumbcheck: all ${LEVELS.length} levels`
  + ' have one');
if (missing.length) process.exitCode = 1;
