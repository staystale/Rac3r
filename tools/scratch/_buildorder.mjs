// _buildorder.mjs - DOES A LEVEL BUILD THE SAME WHATEVER CAME BEFORE (scratch, ?forestseed=1):
// every level built on first use (Level._build) is built (1) in the standard world - the floor
// 260, no rectangle, as when it is the first level built - and (2) right after each of the given
// levels, put back to its stub between (as core/memorybudget.ts drops it), Math.random seeded the
// same before each build (as worldhash). One line a level: SAME, or DIFF with each build's hash
// and counts; KEYS=1 also names the level fields that differ.
// [FORESTSEED=1] [KEYS=1] node tools/scratch/_buildorder.mjs <before,before...> [level,level...]
import { createHash } from 'node:crypto';
import * as L from '../../src/lab.ts';
import { addStageLevels } from '../../src/stagegen.ts';
import { setFloor, setRect, BASE_FLOOR } from '../../src/world/bounds.ts';

addStageLevels();
const [beforeArg = 'spa,lab,naffcar', onlyArg] = process.argv.slice(2);
const befores = beforeArg.split(',');
const ids = onlyArg ? onlyArg.split(',')
  : L.LEVELS.filter((level) => level._build && !level.endless).map((level) => level.id);

/**
 * A seeded Math.random (worldhash's).
 * @param {number} seed start state
 * @returns {() => number} numbers in [0, 1)
 */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mix = Math.imul(state ^ (state >>> 15), 1 | state);
    mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}
const round = (value) => Math.round(value * 1000) / 1000;
const ser = (value) => JSON.stringify(value, (key, item) => (typeof item === 'number' ? round(item)
  : typeof item === 'function' ? 'fn' : item));

/**
 * Each field of a built level hashed.
 * @param {object} level the level
 * @returns {Record<string, string>} field -> hash
 */
function fieldHashes(level) {
  return Object.fromEntries(Object.keys(level).filter((key) => !key.startsWith('_')).sort()
    .map((key) => {
      let text;
      try {
        text = ser(level[key]) ?? 'u';
      } catch {
        text = 'cycle';
      }
      return [key, createHash('sha256').update(text).digest('hex').slice(0, 12)];
    }));
}
const stubs = new Map(ids.map((id) => [id, { ...L.LEVELS.find((level) => level.id === id) }]));

/**
 * Builds a level again from its stub.
 * @param {string} id the level
 * @returns {{fields: Record<string, string>, line: string}} its field hashes and a summary
 */
function buildAgain(id) {
  const level = L.LEVELS.find((item) => item.id === id);
  for (const key of Object.keys(level)) delete level[key];
  Object.assign(level, stubs.get(id));
  Math.random = seededRandom(0x5eed);
  L.buildLevel(level);
  const fields = fieldHashes(level);
  const all = createHash('sha256').update(JSON.stringify(fields)).digest('hex').slice(0, 12);
  return { fields, line: `${all} props=${(level.props || []).length} `
    + `cones=${(level.cones || []).length}` };
}

for (const before of befores) L.setLevel(before);
let differing = 0;
for (const id of ids) {
  if (befores.includes(id)) continue;
  L.setLevel('lab');
  setFloor(BASE_FLOOR);
  setRect(undefined);
  const builds = [buildAgain(id)];
  for (const before of befores) {
    L.setLevel(before);
    builds.push(buildAgain(id));
  }
  const same = builds.every((build) => build.line === builds[0].line);
  if (!same) differing++;
  console.log(`${same ? 'SAME' : 'DIFF'} ${id.padEnd(32)} ${builds.map((b) => b.line).join(' | ')}`);
  if (!same && process.env.KEYS) builds.slice(1).forEach((build, i) => console.log(`   after `
    + `${befores[i]}: ${Object.keys(build.fields).filter((key) => build.fields[key]
      !== builds[0].fields[key]).join(', ')}`));
}
console.log(`levels differing: ${differing} of ${ids.length - befores.filter((id) => ids.includes(id)).length}`);
