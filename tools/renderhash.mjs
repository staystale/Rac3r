// renderhash.mjs - RENDER FINGERPRINT: hashes the game's canvas pixels at fixed moments of a
// fully deterministic run, so a refactor of the drawing code (src/render.ts, src/render/*,
// src/marks.js) can be PROVED to leave every drawn pixel identical. The drawing counterpart of
// worldhash.mjs. The game runs in the browser with a seeded Math.random, a fake clock
// (performance.now, Date.now) and a requestAnimationFrame queue that only runs when the tool
// steps a frame (1000/60 ms of fake time each). Per level the demo driver
// (src/ai/autodrive.ts) drives the player car among 3 AI cars for 20 s of fake time; the canvas
// is captured at 2, 8, 14 and 20 s, then once more with the player car damaged (src/damage.js
// hit / hitRoll, so src/render/cardamage.ts is drawn). Levels: every circuit level, two
// generated stages and the highway (traffic and litter on).
// node tools/renderhash.mjs               one line per level + "renderhash: <all>";
//                                         SAME/DIFFERENT vs the saved reference
// node tools/renderhash.mjs save          also writes tools/.renderhash (gitignored)
// node tools/renderhash.mjs --shots <dir> also writes every capture as <dir>/<level>-<capture>.png
//                                         (compare two folders with tools/shotdiff.mjs)
// node tools/renderhash.mjs --only a,b  run only those level ids (a partial save merges into the
//                                         reference; the verdict covers just those levels)
// Not covered: the menu screens, other screen sizes, the desktop (pc) input mode.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from '../src/lab.js';
import { addStageLevels } from '../src/stagegen.js';
import { addHighwayLevel } from '../src/highway.js';
import { startServer, launchBrowser } from './lib/browser.mjs';

addStageLevels();
addHighwayLevel();

const SAVE_FILE = fileURLToPath(new URL('./.renderhash', import.meta.url));
const SEED = 0x5eed;
const FRAMES = [['t02', 120], ['t08', 480], ['t14', 840], ['t20', 1200]];
const STAGE_IDS = ['gen-forest-medium-mixed-1001', 'stage-sahara-sandpants'];
const HIGHWAY_OPTS = { traffic: 1, litter: 1.5 };
const SETTLE_MS = 300;

/**
 * Page side, run before the game loads: seeded Math.random, a fake clock and a rAF queue the
 * tool steps by hand (window.__rt).
 * @returns {void}
 */
function installDeterminism() {
  const frameMs = 1000 / 60;
  let clock = 1000, seed = 0, nextId = 1, queue = [];
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  performance.now = () => clock;
  Date.now = () => 1.7e12 + clock;
  window.requestAnimationFrame = (callback) => {
    queue.push({ id: nextId, callback });
    return nextId++;
  };
  window.cancelAnimationFrame = (id) => {
    queue = queue.filter((entry) => entry.id !== id);
  };
  window.__rt = {
    seed: (value) => { seed = value | 0; },
    step: (count) => {
      for (let frame = 0; frame < count; frame++) {
        clock += frameMs;
        const run = queue;
        queue = [];
        for (const entry of run) entry.callback(clock);
      }
    },
  };
}

/**
 * Page side: start a session on a level with 3 AI cars, the game's own launch path.
 * @param {[string, object]} args level id and extra launch options
 * @returns {void}
 */
function launchLevel([id, opts]) {
  window.__game.launch(id, 'hatch-rwd', { ai: 3, ...opts });
}

/**
 * Page side: hand the player car to the demo driver, as framecheck does.
 * @returns {Promise<void>} resolves when the driver is installed
 */
async function installDriver() {
  const game = window.__game;
  const auto = await import('/src/ai/autodrive.ts');
  const driver = auto.createAutoDriver(game.level.subtrack);
  game.input.update = () => ({
    ...driver.drive(game.car), reverse: 0, shiftUp: false, shiftDown: false,
  });
}

/**
 * Page side: damage the player car the way the game's crash code does (damage.js hit from
 * several sides, then a rollover roof hit), with a fixed puncture roll.
 * @returns {Promise<void>} resolves when the car is damaged
 */
async function damageCar() {
  const dmg = await import('/src/damage.js');
  const car = window.__game.car;
  const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  const hits = [[1, -0.3, 14], [0.2, 1, 10], [-1, 0.4, 12], [1, 0.5, 16]];
  for (const [fore, lateral, mag] of hits) {
    const dvx = -mag * (fore * cos - lateral * sin), dvy = -mag * (fore * sin + lateral * cos);
    dmg.hit(car, car.vx - dvx, car.vy - dvy, 1 / 120, () => 0.1);
  }
  dmg.hitRoll(car, 'roof', 1, 3);
}

/**
 * Page side: the canvas as a PNG data URL.
 * @returns {string} data URL
 */
function grabCanvas() {
  return document.getElementById('c').toDataURL('image/png');
}

/**
 * Sha256 of bytes or text as hex.
 * @param {Buffer|string} data input
 * @returns {string} hex digest
 */
function sha(data) {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Grab the canvas of a page as PNG bytes.
 * @param {import('playwright').Page} page the page
 * @returns {Promise<Buffer>} PNG bytes
 */
async function grab(page) {
  const url = await page.evaluate(grabCanvas);
  return Buffer.from(url.split(',')[1], 'base64');
}

/**
 * Open a fresh phone page on a level with the determinism script installed.
 * @param {import('playwright').Browser} browser the browser
 * @param {string} base server url
 * @param {string} id level id
 * @param {string[]} errors collects page errors
 * @returns {Promise<import('playwright').Page>} the page
 */
async function openPage(browser, base, id, errors) {
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.addInitScript(installDeterminism);
  await page.goto(`${base}/?touch=1&guide=0&menu=0&rules=0&level=${id}`);
  await page.waitForFunction(() => window.__game && window.__rt);
  await page.waitForTimeout(SETTLE_MS);
  return page;
}

/**
 * Run one level: launch, drive for 20 s of fake time, capture, then capture it damaged.
 * @param {import('playwright').Browser} browser the browser
 * @param {string} base server url
 * @param {string} id level id
 * @param {boolean} endless true for the highway
 * @returns {Promise<{name: string, png: Buffer}[]>} the captures
 */
async function runLevel(browser, base, id, endless) {
  const errors = [];
  const page = await openPage(browser, base, id, errors);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((seed) => window.__rt.seed(seed), SEED);
  await page.evaluate(launchLevel, [id, endless ? HIGHWAY_OPTS : {}]);
  // the game's restart arms the start with a real setTimeout: let it fire before stepping
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(installDriver);
  const shots = [];
  let done = 0;
  for (const [name, frame] of FRAMES) {
    await page.evaluate((count) => window.__rt.step(count), frame - done);
    done = frame;
    shots.push({ name, png: await grab(page) });
  }
  await page.evaluate(damageCar);
  await page.evaluate(() => window.__rt.step(3));
  shots.push({ name: 'damaged', png: await grab(page) });
  await page.context().close();
  if (errors.length) throw new Error(`${id}: page error: ${errors[0]}`);
  return shots;
}

/**
 * The levels to run: every circuit level, two generated stages, the highway.
 * @returns {{id: string, endless: boolean}[]} the levels
 */
function levelList() {
  const only = onlyList();
  const circuits = L.LEVELS.filter((lv) => lv.subtrack && !lv.stage && !lv.endless);
  const stages = STAGE_IDS.filter((id) => L.LEVELS.some((lv) => lv.id === id));
  const ids = [...circuits.map((lv) => lv.id), ...stages];
  const all = [...ids.map((id) => ({ id, endless: false })), { id: 'highway', endless: true }];
  return only ? all.filter((lv) => only.includes(lv.id)) : all;
}

/**
 * The level ids named by --only, or null for all levels.
 * @returns {string[]|null} ids or null
 */
function onlyList() {
  const at = process.argv.indexOf('--only');
  return at > 0 ? process.argv[at + 1].split(',') : null;
}

/**
 * Write the reference file; a partial (--only) run is merged into the existing one.
 * @param {Record<string, string>} caps capture hashes
 * @param {Record<string, string>} levels level hashes
 * @returns {void}
 */
function saveReference(caps, levels) {
  const keep = onlyList() && existsSync(SAVE_FILE);
  const old = keep ? JSON.parse(readFileSync(SAVE_FILE, 'utf8')) : null;
  const merged = { levels: { ...old?.levels, ...levels }, captures: { ...old?.captures, ...caps } };
  const rows = Object.keys(merged.levels).map((id) => id + ' ' + merged.levels[id]);
  writeFileSync(SAVE_FILE, JSON.stringify({ all: sha(rows.join('\n')), ...merged }, null, 1) + '\n');
}

/**
 * Compare with the saved reference and print the verdict.
 * @param {string} all hash of everything
 * @param {Record<string, string>} caps capture hashes by "level-capture"
 * @returns {void}
 */
function report(all, caps) {
  console.log('renderhash: ' + all);
  if (!existsSync(SAVE_FILE)) return;
  const saved = JSON.parse(readFileSync(SAVE_FILE, 'utf8'));
  const keys = new Set(Object.keys(caps));
  if (!onlyList()) for (const key of Object.keys(saved.captures)) keys.add(key);
  // a partial run only judges levels the reference already holds
  else for (const key of [...keys]) if (!(key in saved.captures)) keys.delete(key);
  const bad = [...keys].filter((key) => caps[key] !== saved.captures[key]);
  console.log(bad.length ? `renderhash: DIFFERENT (${bad.join(', ')})` : 'renderhash: SAME');
}

/**
 * Run every level, print one line each, then the verdict; optionally save and write PNGs.
 * @returns {Promise<void>} resolves when done
 */
async function main() {
  const shotsAt = process.argv.indexOf('--shots');
  const shotsDir = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });
  const server = await startServer();
  let browser;
  const caps = {}, levels = {};
  try {
    browser = await launchBrowser();
    for (const { id, endless } of levelList()) {
      const began = Date.now();
      const shots = await runLevel(browser, server.url, id, endless);
      for (const shot of shots) {
        caps[`${id}-${shot.name}`] = sha(shot.png);
        if (shotsDir) writeFileSync(join(shotsDir, `${id}-${shot.name}.png`), shot.png);
      }
      levels[id] = sha(shots.map((shot) => caps[`${id}-${shot.name}`]).join('\n'));
      const secs = ((Date.now() - began) / 1000).toFixed(1);
      console.log(`${id}  ${levels[id].slice(0, 16)}  captures=${shots.length}  ${secs} s`);
    }
  } finally {
    await browser?.close();
    server.stop();
  }
  const all = sha(Object.keys(levels).map((id) => id + ' ' + levels[id]).join('\n'));
  report(all, caps);
  if (process.argv.includes('save')) saveReference(caps, levels);
}

await main();

