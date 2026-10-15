// worldhash.mjs - WORLD FINGERPRINT: a hash of everything each level holds after setLevel(), so a
// refactor of the level-building code can be PROVED to leave the level data identical.
// node tools/worldhash.mjs        one line per level + "worldhash: <all>";
//                                 SAME/DIFFERENT vs the saved reference
// node tools/worldhash.mjs --highway <km>  also drive the endless road <km> km, hash "highway-km"
// node tools/worldhash.mjs save   also writes tools/.worldhash (gitignored) as the reference
// Levels: every entry of LEVELS after addStageLevels() + addHighwayLevel() (the highway is
// only the start window of the endless road, built as the game builds it at load).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as L from '../src/lab.js';
import { addStageLevels } from '../src/stagegen.js';
import { addHighwayLevel, resetHighway, stepHighway, roadPose } from '../src/highway.js';

addStageLevels();
addHighwayLevel();

const SAVE_FILE = fileURLToPath(new URL('./.worldhash', import.meta.url));
// fields skipped: lazy draw-time caches, never part of the built data (none found at load:
// the names below are skipped only if a level happens to carry them)
const SKIP_KEYS = new Set([]);

/**
 * Serialise any value to a stable string (sorted keys, rounded numbers, cycle-safe).
 * @param {unknown} val value to serialise
 * @param {Set<object>} path objects on the current path (cycle guard)
 * @returns {string} stable text
 */
function ser(val, path = new Set()) {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(Math.round(val * 1e6) / 1e6) : String(val);
  }
  if (typeof val === 'function') return 'fn';
  if (val === null || typeof val !== 'object') return JSON.stringify(val) ?? String(val);
  if (path.has(val)) return '<cycle>';
  path.add(val);
  const text = serObject(val, path);
  path.delete(val);
  return text;
}

/**
 * Serialise an object-like value (array, typed array, Map, Set or plain object).
 * @param {object} val the object
 * @param {Set<object>} path cycle guard
 * @returns {string} stable text
 */
function serObject(val, path) {
  if (ArrayBuffer.isView(val)) return '[' + Array.from(val, (num) => ser(num)).join(',') + ']';
  if (Array.isArray(val)) return '[' + val.map((item) => ser(item, path)).join(',') + ']';
  if (val instanceof Map) {
    const rows = [...val].map(([key, item]) => ser(key, path) + '=>' + ser(item, path));
    return 'Map{' + rows.sort().join(',') + '}';
  }
  if (val instanceof Set) {
    const rows = [...val].map((item) => ser(item, path));
    return 'Set{' + rows.sort().join(',') + '}';
  }
  const keys = Object.keys(val).filter((key) => !SKIP_KEYS.has(key)).sort();
  return '{' + keys.map((key) => key + ':' + ser(val[key], path)).join(',') + '}';
}

/**
 * Sha256 of a string as hex.
 * @param {string} text input
 * @returns {string} hex digest
 */
function sha(text) {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Count the main collections a level holds.
 * @param {object} lv the level
 * @returns {string} "name=count ..." text
 */
function counts(lv) {
  const names = ['barriers', 'solids', 'props', 'zones', 'cones', 'bumps', 'boards', 'paint'];
  const have = names.filter((key) => Array.isArray(lv[key]));
  return have.map((key) => key + '=' + lv[key].length).join(' ');
}

/**
 * Small seeded generator (mulberry32). Levels that re-randomise on load (grass-track, via
 * Math.random) would otherwise differ every run, so each level loads with a fixed sequence.
 * @param {number} seed start state
 * @returns {() => number} generator giving numbers in [0, 1)
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

/**
 * Load a level and fingerprint it plus the active-level state aliases.
 * @param {string} id level id
 * @returns {{id: string, hash: string, info: string}} the fingerprint
 */
function fingerprint(id) {
  Math.random = seededRandom(0x5eed);
  L.setLevel(id);
  const active = [L.LEVEL, L.PAINT, L.BOARDS, L.CONES, L.SPAWN, L.ZONES, L.BUMPS, L.PROPS];
  const hash = sha(ser(active));
  return { id, hash, info: counts(L.LEVEL) };
}

/**
 * Fold the highway level's current data into a running hash.
 * @param {import('node:crypto').Hash} hash running hash
 * @param {object} lv the highway level
 * @returns {void}
 */
function foldHighway(hash, lv) {
  const own = ['lanes', 'covers', 'cuts', 'props', 'solids', 'zones', 'cones'];
  const more = ['bumps', 'barriers', 'paint', 'boards', 'spawn'];
  const parts = [lv._hw, ...own.map((key) => lv[key]), ...more.map((key) => lv[key])];
  hash.update(ser(parts));
}

/**
 * Do main.js's loose-object bookkeeping with a plain list: take the new objects (folding all
 * their fields into the hash) and drop the ones behind looseCut.
 * @param {import('node:crypto').Hash} hash running hash
 * @param {object} hw the highway data (_hw)
 * @param {object[]} loose the plain list of loose objects
 * @returns {void}
 */
function takeLoose(hash, hw, loose) {
  if (hw.looseNew.length) {
    hash.update(ser(hw.looseNew));
    loose.push(...hw.looseNew);
    hw.looseNew.length = 0;
  }
  if (hw.looseCut != null) {
    const cutAt = hw.looseCut;
    const keep = loose.filter((cone) => cone._s == null || cone._s >= cutAt);
    loose.length = 0;
    loose.push(...keep);
    hw.looseCut = null;
  }
}

/**
 * Drive a stand-in car along the endless road the way the game does (stepHighway every step,
 * a few metres at a time, in the left lane) and fold the level data in every ~200 m.
 * @param {number} km distance to drive in km (0 = off)
 * @returns {{hash: string, info: string}|null} the highway hash and counts, or null when off
 */
function driveHighway(km) {
  if (!(km > 0)) return null;
  Math.random = seededRandom(0x5eed);
  const lv = L.LEVELS.find((level) => level.id === 'highway');
  L.setLevel('highway');
  resetHighway(lv);
  const hash = createHash('sha256');
  const lane = lv._hw.geo.centres[0];
  const car = { x: lv.spawn.x, y: lv.spawn.y };
  const start = 300, end = start + km * 1000;
  const loose = []; // the loose objects the game would hold (main.js: cones.spawn / cull)
  let folds = 0, shifts = 0;
  for (let dist = start, next = start + 200; dist <= end; dist += 4) {
    const pose = roadPose(lv, dist, lane);
    car.x = pose.x;
    car.y = pose.y;
    if (stepHighway(lv, car)) shifts++;
    takeLoose(hash, lv._hw, loose);
    if (dist >= next) {
      foldHighway(hash, lv);
      folds++;
      next += 200;
    }
  }
  foldHighway(hash, lv);
  const info = `folds=${folds} shifts=${shifts} ${counts(lv)} pts=${lv._hw.pts.length}`;
  return { hash: hash.digest('hex'), info };
}

/**
 * Print the report and compare with the saved reference.
 * @returns {void}
 */
function main() {
  const hwArg = process.argv.indexOf('--highway');
  const hwKm = hwArg > 0 ? Number(process.argv[hwArg + 1]) : 0;
  const rows = L.LEVELS.map((lv) => fingerprint(lv.id));
  const all = sha(rows.map((row) => row.id + ' ' + row.hash).join('\n'));
  for (const row of rows) console.log(`${row.id}  ${row.hash.slice(0, 16)}  ${row.info}`);
  const hw = driveHighway(hwKm);
  if (hw) console.log(`highway ${hwKm} km  ${hw.hash.slice(0, 16)}  ${hw.info}`);
  const saved = existsSync(SAVE_FILE) ? JSON.parse(readFileSync(SAVE_FILE, 'utf8')) : null;
  console.log('worldhash: ' + all);
  if (saved) {
    const bad = rows.filter((row) => saved.levels[row.id] !== row.hash).map((row) => row.id);
    const gone = Object.keys(saved.levels).filter((id) => !rows.some((row) => row.id === id));
    bad.push(...gone);
    if (hw && saved.highway && saved.highway[hwKm] !== hw.hash) bad.push('highway-km');
    console.log(bad.length ? `worldhash: DIFFERENT (${bad.join(', ')})` : 'worldhash: SAME');
    if (bad.length) process.exitCode = 1;
  }
  if (process.argv.includes('save')) {
    const levels = Object.fromEntries(rows.map((row) => [row.id, row.hash]));
    const highway = Object.assign({}, saved && saved.highway, hw ? { [hwKm]: hw.hash } : {});
    writeFileSync(SAVE_FILE, JSON.stringify({ all, levels, highway }, null, 1) + '\n');
  }
}

main();
