// _flypixels.mjs - THE FLY-IN LOOKS THE SAME WITH ITS PICTURE KEPT (scratch): renderhash's way (the
// determinism script, the CPU raster, the GPU ground canvas under the screen canvas) on the page's
// own level, launched (as renderhash launches it: no level switch, so only the kept picture differs)
// with 3 AI, the frames of its fly-in captured, then 5 s on, RESTART and the restart's fly-in
// captured (?onestart=1: the kept picture). Run with the switch off and on; the PNG hashes compared
// capture by capture. renderhash captures no fly-in frame (its first is at 2 s) and no restart.
// node tools/scratch/_flypixels.mjs [level ...]
import { createHash } from 'node:crypto';
import { startServer, launchBrowser } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const LEVELS = process.argv.slice(2).length ? process.argv.slice(2) : ['spa', 'grass-track'];
const SEED = 0x5eed;
// frames into a fly-in captured: the hold on the whole level, the move, near the hand-over
const FLY_FRAMES = [5, 45, 95];
// frames between the launch's fly-in and the restart (5 s)
const RACE_FRAMES = 300;
const CPU_RASTER_ARGS = [
  '--disable-gpu', '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization',
];

/**
 * Page side: the GPU ground canvas with the screen canvas over it, as a PNG data URL.
 * @returns {string} data URL
 */
function grabCanvas() {
  const screen = document.getElementById('c'), ground = document.getElementById('glground');
  if (!ground) return screen.toDataURL('image/png');
  const out = document.createElement('canvas');
  out.width = screen.width;
  out.height = screen.height;
  const gfx = out.getContext('2d');
  gfx.drawImage(ground, 0, 0);
  gfx.drawImage(screen, 0, 0);
  return out.toDataURL('image/png');
}

/**
 * Captures a fly-in's frames from its start.
 * @param {import('playwright').Page} page the page
 * @param {string} label launch or restart
 * @returns {Promise<Record<string, string>>} capture -> hash (and whether it was flying)
 */
async function captureFly(page, label) {
  const out = {};
  let done = 0;
  for (const frame of FLY_FRAMES) {
    await page.evaluate((count) => window.__rt.step(count), frame - done);
    done = frame;
    const url = await page.evaluate(grabCanvas);
    const flying = await page.evaluate(() => window.__game.renderer.flying);
    out[`${label}-f${frame}`] = createHash('sha256').update(url).digest('hex').slice(0, 16)
      + (flying ? ' flying' : ' landed');
  }
  return out;
}

/**
 * One run of a level, the switch off or on.
 * @param {import('playwright').Browser} browser the browser
 * @param {string} base the server
 * @param {string} level the level
 * @param {boolean} isOn ?onestart=1
 * @returns {Promise<Record<string, string>>} the captures
 */
async function runOne(browser, base, level, isOn) {
  const errors = [];
  const page = await openPage(browser, base, level, errors, isOn ? '&onestart=1' : '');
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((seed) => window.__rt.seed(seed), SEED);
  await page.evaluate(launchLevel, [level, {}]);
  await page.waitForTimeout(SETTLE_MS);
  const shots = await captureFly(page, 'launch');
  await page.evaluate((count) => window.__rt.step(count), RACE_FRAMES);
  await page.evaluate(() => window.__game.restart());
  await page.waitForTimeout(SETTLE_MS);
  Object.assign(shots, await captureFly(page, 'restart'));
  await page.context().close();
  if (errors.length) throw new Error(`${level} ${isOn ? 'on' : 'off'}: ${errors[0]}`);
  return shots;
}

const server = await startServer();
const browser = await launchBrowser({ args: CPU_RASTER_ARGS });
let bad = 0;
try {
  for (const level of LEVELS) {
    const off = await runOne(browser, server.url, level, false);
    const on = await runOne(browser, server.url, level, true);
    for (const key of Object.keys(off)) {
      const isSame = off[key] === on[key];
      if (!isSame) bad++;
      console.log(`${level} ${key.padEnd(16)} off ${off[key]}  on ${on[key]}  ${isSame ? 'SAME'
        : 'DIFFERENT'}`);
    }
  }
  console.log(bad ? `flypixels: DIFFERENT (${bad})` : 'flypixels: SAME');
  if (bad) process.exitCode = 1;
} finally {
  await browser.close();
  server.stop();
}
