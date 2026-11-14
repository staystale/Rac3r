// _nightflyshots.mjs - THE FLY-IN AT NIGHT AS PHOTOS, ?nightfly=1 OFF AND ON (scratch): as
// _flyshots.mjs (renderhash's way: the determinism script, the CPU raster, the GPU ground canvas
// under the screen canvas; the page's own level launched, the fly-in's frames FRAMES in written as
// PNGs to <out>/off and <out>/on, each frame's px a metre), at night (&night=NIGHT) with
// ?smoothfly=1 both ways. Compare: node tools/shotdiff.mjs <out>/off <out>/on. DPR=3 by default.
// [VIEW=844x390] [DPR=3] [NIGHT=0.94] [FRAMES=3,20,35,45,55,70] node tools/scratch/_nightflyshots.mjs
//   <out> [level ...]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
import { installDeterminism, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const [out, ...levelArgs] = process.argv.slice(2);
const LEVELS = levelArgs.length ? levelArgs : ['spa'];
const FRAMES = (process.env.FRAMES || '3,20,35,45,55,70').split(',').map(Number);
const [viewW, viewH] = (process.env.VIEW || '844x390').split('x').map(Number);
const SEED = 0x5eed;
const DPR = Number(process.env.DPR || 3), NIGHT = process.env.NIGHT || '0.94';
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
  const canvas = document.createElement('canvas');
  canvas.width = screen.width;
  canvas.height = screen.height;
  const gfx = canvas.getContext('2d');
  gfx.drawImage(ground, 0, 0);
  gfx.drawImage(screen, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * One level, the switch off or on: its fly-in's frames written.
 * @param {import('playwright').Browser} browser the browser
 * @param {string} base the server
 * @param {string} level the level
 * @param {boolean} isOn ?nightfly=1
 * @returns {Promise<string[]>} each frame's px a metre (CSS px)
 */
async function runOne(browser, base, level, isOn) {
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH },
    deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.addInitScript(installDeterminism);
  await gotoGame(page, `${base}/?touch=1&guide=0&menu=0&rules=0&level=${level}`
    + `&smoothfly=1&night=${NIGHT}` + (isOn ? '&nightfly=1' : ''), 'window.__rt');
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((seed) => window.__rt.seed(seed), SEED);
  await page.evaluate(launchLevel, [level, {}]);
  await page.waitForTimeout(SETTLE_MS);
  const dir = join(out, isOn ? 'on' : 'off');
  mkdirSync(dir, { recursive: true });
  const zooms = [];
  let done = 0;
  for (const frame of FRAMES) {
    await page.evaluate((count) => window.__rt.step(count), frame - done);
    done = frame;
    const url = await page.evaluate(grabCanvas);
    writeFileSync(join(dir, `${level}-${viewW}x${viewH}-f${String(frame).padStart(3, '0')}.png`),
      Buffer.from(url.split(',')[1], 'base64'));
    zooms.push(await page.evaluate(() => window.__game.renderer.PPM));
  }
  const stats = await page.evaluate(() => window.__game.renderer.flyStats);
  await context.close();
  if (errors.length) throw new Error(`${level} ${isOn ? 'on' : 'off'}: ${errors[0]}`);
  console.log(`  ${level} ${isOn ? 'on' : 'off'} flyStats ${JSON.stringify(stats)}`);
  return zooms.map((ppm) => ppm.toFixed(2));
}

const server = await startServer();
const browser = await launchBrowser({ args: CPU_RASTER_ARGS });
try {
  for (const level of LEVELS) {
    const offZooms = await runOne(browser, server.url, level, false);
    const onZooms = await runOne(browser, server.url, level, true);
    console.log(`${level} ${viewW}x${viewH}: frames ${FRAMES.join(' ')}; px a metre off`
      + ` ${offZooms.join(' ')}, on ${onZooms.join(' ')}`);
  }
} finally {
  await browser.close();
  server.stop();
}
