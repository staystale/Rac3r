// determinism.mjs - shared by renderhash.mjs and simhash.mjs: makes a game page fully
// deterministic (seeded Math.random, a fake clock, a requestAnimationFrame queue that only runs
// when the tool steps a frame of 1000/60 ms fake time) and opens it on a level.
import { createHash } from 'node:crypto';
import { gotoGame } from './browser.mjs';

export const SETTLE_MS = 300;

/**
 * Page side, run before the game loads: seeded Math.random, a fake clock and a rAF queue the
 * tool steps by hand (window.__rt).
 * @returns {void}
 */
export function installDeterminism() {
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
 * Sha256 of bytes or text as hex.
 * @param {Buffer|string} data input
 * @returns {string} hex digest
 */
export function sha(data) {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * The ids named by --only, or null for all.
 * @returns {string[]|null} ids or null
 */
export function onlyList() {
  const at = process.argv.indexOf('--only');
  return at > 0 ? process.argv[at + 1].split(',') : null;
}

/**
 * Open a fresh phone page on a level with the determinism script installed.
 * @param {import('playwright').Browser} browser the browser
 * @param {string} base server url
 * @param {string} id level id
 * @param {string[]} errors collects page errors
 * @param {string} [extra] extra query string such as "&skip=world", default none
 * @returns {Promise<import('playwright').Page>} the page
 */
export async function openPage(browser, base, id, errors, extra = '') {
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.addInitScript(installDeterminism);
  await gotoGame(page, `${base}/?touch=1&guide=0&menu=0&rules=0&level=${id}${extra}`, 'window.__rt');
  await page.waitForTimeout(SETTLE_MS);
  return page;
}

/**
 * Page side: start a session on a level with 3 AI cars (opts may override), the game's own
 * launch path.
 * @param {[string, object]} args level id and extra launch options
 * @returns {void}
 */
export function launchLevel([id, opts]) {
  window.__game.launch(id, 'hatch-rwd', { ai: 3, ...opts });
}

/**
 * Page side: hand the player car to the demo driver, as framecheck does.
 * @returns {Promise<void>} resolves when the driver is installed
 */
export async function installDriver() {
  const game = window.__game;
  const auto = await import('/src/ai/autodrive.ts');
  const driver = auto.createAutoDriver(game.level.subtrack);
  game.input.update = () => ({
    ...driver.drive(game.car), reverse: 0, shiftUp: false, shiftDown: false,
  });
}
