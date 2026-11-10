// _renderhashat.mjs - tools/renderhash.mjs from places on the lap: the same deterministic page
// (seeded random, fake clock, CPU raster), the car set down at each lap distance in turn and the
// frame hashed 1 s and 4 s later - for scenery renderhash's 20 s from the grid never reaches (Spa's
// forest). Run it in two worktrees and compare the lines.
// node tools/scratch/_renderhashat.mjs <level> "<lap m>,<lap m>,..."   (RAC3R_QUERY, CHECK_PORT)
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import {
  openPage, launchLevel, installDriver, sha, SETTLE_MS,
} from '../lib/determinism.mjs';

const [level = 'spa', spotList = '0'] = process.argv.slice(2);
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

const server = await startServer();
let browser;
try {
  browser = await launchBrowser({ args: CPU_RASTER_ARGS });
  const errors = [];
  const page = await openPage(browser, server.url, level, errors, extraQuery());
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((seed) => window.__rt.seed(seed), 0x5eed);
  await page.evaluate(launchLevel, [level, {}]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(installDriver);
  await page.evaluate(() => window.__rt.step(120));
  const rows = [];
  for (const spot of spotList.split(',').map(Number)) {
    await page.evaluate((at) => {
      const game = window.__game, sub = game.level.subtrack;
      let best = sub.pts[0];
      for (const point of sub.pts) if (point.dist <= at) best = point;
      Object.assign(game.car, { x: best.x, y: best.y, heading: best.heading, vx: 0, vy: 0 });
    }, spot);
    for (const [name, frames] of [['1s', 60], ['4s', 180]]) {
      await page.evaluate((count) => window.__rt.step(count), frames);
      const url = await page.evaluate(grabCanvas);
      const row = `${level} at ${spot} m ${name} ${sha(Buffer.from(url.split(',')[1], 'base64'))}`;
      rows.push(row);
      console.log(row);
    }
  }
  if (errors.length) throw new Error(`page error: ${errors[0]}`);
  console.log(`renderhashat: ${sha(rows.join('\n'))}`);
} finally {
  await browser?.close();
  server.stop();
}
