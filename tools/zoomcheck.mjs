// zoomcheck.mjs - does a patch of ground look the same at every zoom, only bigger or smaller?
// Per level it renders the ground around the start (cars, props and the hud skipped) at zoom
// steps and at zooms between the steps, cuts out the SAME world square from each frame, scales
// it to one common size, and prints how much each capture differs from the one before it
// (% of pixels whose colour moved by more than TOL, summed over r, g, b).
// node tools/zoomcheck.mjs --only brands-snatch      one level (keeps each run short)
//   --out <dir>   write the common-size captures as PNGs (default: zoomcheck in the temp folder)
//   --skip <list> extra ?skip= layers   --query <q> extra page query, e.g. "tilepx=128"
//   --at <x,y>    look at this world point (m) instead of the start, e.g. the lab's surface lanes
//   --zooms <list> the zooms, e.g. "0.9,0.8,0.7" (default ZOOMS)
// It rasterises on the CPU like renderhash, and shares its page-side determinism.
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser } from './lib/browser.mjs';
import { openPage, launchLevel, onlyList } from './lib/determinism.mjs';

const LEVELS = ['brands-snatch', 'grass-track', 'naffcar'];
const SIZE = 320;               // common capture size, px
const TOL = 24;                 // a pixel counts as changed above this summed channel difference
const SETTLE_FRAMES = 30;       // frames stepped after a zoom, so the tiles are painted
const ZOOMS = [1, 0.84, 0.71, 0.6, 0.5, 0.42, 0.35, 0.3, 0.25];
const CPU_RASTER_ARGS = [
  '--disable-gpu', '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization',
];

/**
 * The value of a command line option.
 * @param {string} name option name such as "--out"
 * @param {string} fallback value when the option is absent
 * @returns {string} the value
 */
function option(name, fallback) {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : fallback;
}

/**
 * Page side: cut the world square that is visible at the largest zoom out of the canvas, scale it
 * to size x size and return it as RGBA bytes plus a PNG data URL.
 * @param {{zoom: number, top: number, size: number}} args zoom now, largest zoom, common size
 * @returns {{rgba: number[], url: string}} the capture
 */
function cut({ zoom, top, size }) {
  // the finished frame: the GPU ground canvas (when used) with the screen canvas over it
  const screen = document.getElementById('c'), ground = document.getElementById('glground');
  const canvas = document.createElement('canvas');
  canvas.width = screen.width;
  canvas.height = screen.height;
  if (ground) canvas.getContext('2d').drawImage(ground, 0, 0);
  canvas.getContext('2d').drawImage(screen, 0, 0);
  const side = Math.min(canvas.width, canvas.height) * 0.8 * zoom / top;
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const gfx = out.getContext('2d', { willReadFrequently: true });
  gfx.imageSmoothingEnabled = true;
  gfx.imageSmoothingQuality = 'high';
  gfx.drawImage(canvas, (canvas.width - side) / 2, (canvas.height - side) / 2, side, side,
    0, 0, size, size);
  const rgba = Array.from(gfx.getImageData(0, 0, size, size).data);
  return { rgba, url: out.toDataURL('image/png') };
}

/**
 * Percent of pixels that differ by more than TOL between two captures.
 * @param {number[]} first RGBA bytes
 * @param {number[]} second RGBA bytes
 * @returns {number} the percentage
 */
function changed(first, second) {
  let count = 0;
  for (let at = 0; at < first.length; at += 4) {
    const gap = Math.abs(first[at] - second[at]) + Math.abs(first[at + 1] - second[at + 1])
      + Math.abs(first[at + 2] - second[at + 2]);
    if (gap > TOL) count++;
  }
  return 100 * count / (first.length / 4);
}

/**
 * Capture one level at every zoom of ZOOMS.
 * @param {import('playwright').Browser} browser the browser
 * @param {string} base server url
 * @param {string} id level id
 * @param {string} outDir where the PNGs go
 * @returns {Promise<void>} resolves when printed
 */
async function runLevel(browser, base, id, outDir) {
  const zooms = option('--zooms', '') ? option('--zooms', '').split(',').map(Number) : ZOOMS;
  const errors = [];
  const extra = '&skip=' + ['world', 'car', 'hud', option('--skip', '')].filter(Boolean).join(',')
    + (option('--query', '') ? '&' + option('--query', '') : '');
  const page = await openPage(browser, base, id, errors, extra);
  await page.evaluate(launchLevel, [id, { ai: 0 }]);
  await page.evaluate((frames) => window.__rt.step(frames), 180);
  const shots = [];
  const at = option('--at', '') ? option('--at', '').split(',').map(Number) : null;
  for (const zoom of zooms) {
    await page.evaluate(([z, point]) => {
      const game = window.__game;
      if (point) {
        game.car.x = point[0];
        game.car.y = point[1];
        game.car.vx = 0;
        game.car.vy = 0;
      }
      game.renderer.debugZoom(z);
      game.renderer.snap(game.car);
    }, [zoom, at]);
    await page.evaluate((frames) => window.__rt.step(frames), SETTLE_FRAMES);
    const shot = await page.evaluate(cut, { zoom, top: zooms[0], size: SIZE });
    shots.push({ zoom, rgba: shot.rgba });
    const png = Buffer.from(shot.url.split(',')[1], 'base64');
    writeFileSync(join(outDir, `${id}-z${zoom.toFixed(3)}.png`), png);
  }
  await page.context().close();
  if (errors.length) throw new Error(`${id}: page error: ${errors[0]}`);
  const diffs = shots.slice(1).map((shot, at) => changed(shots[at].rgba, shot.rgba));
  const rows = diffs.map((diff, index) =>
    `${zooms[index]}->${zooms[index + 1]} ${diff.toFixed(1)}%`);
  console.log(`${id}: changed vs previous zoom`);
  for (const row of rows) console.log('  ' + row);
  const mean = diffs.reduce((sum, diff) => sum + diff, 0) / diffs.length;
  console.log(`  mean ${mean.toFixed(1)}%  max ${Math.max(...diffs).toFixed(1)}%`);
}

/**
 * Run the levels asked for (--only), default all of LEVELS.
 * @returns {Promise<void>} resolves when done
 */
async function main() {
  const outDir = option('--out', join(tmpdir(), 'zoomcheck'));
  mkdirSync(outDir, { recursive: true });
  const only = onlyList();
  const ids = only || LEVELS;
  const server = await startServer();
  let browser;
  try {
    browser = await launchBrowser({ args: CPU_RASTER_ARGS });
    for (const id of ids) await runLevel(browser, server.url, id, outDir);
  } finally {
    await browser?.close();
    server.stop();
  }
  console.log(`zoomcheck: PNGs in ${outDir}`);
}

await main();
