// _canopyproof.mjs - THE CANOPY CUT UNDER MOVING HEADLIGHTS, PROVED ON PIXELS (scratch): renderhash's
// way (the determinism script, the CPU raster, 3 AI, the demo driver on the player car) at night,
// but once the fly-in is over the player car is put 14 m from the densest clump of trees, facing it,
// its headlights on and moving at 20 m/s, and the screen is captured at CAPTURES frames after. Prints each capture's hash and the canopy cut's counts (renderer.flyStats.canopyCut:
// canopies darkened / on the map). Run it with and without nightfly=1 (QUERY) and compare.
// [QUERY=nightfly=1] [NIGHT=0.94] [CAPTURES=20,60,100,140] node tools/scratch/_canopyproof.mjs [level]
import { createHash } from 'node:crypto';
import { startServer, launchBrowser } from '../lib/browser.mjs';
import { openPage, launchLevel, installDriver, SETTLE_MS } from '../lib/determinism.mjs';

const [levelId = 'spa'] = process.argv.slice(2);
const QUERY = process.env.QUERY ? '&' + process.env.QUERY : '';
const NIGHT = process.env.NIGHT ?? '0.94';
const CAPTURES = (process.env.CAPTURES || '20,60,100,140').split(',').map(Number);
const SEED = 0x5eed;
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
 * Page side: puts the player car 14 m from the densest clump of trees, facing it, lights on,
 * moving at 20 m/s (the demo driver then steers it back towards the track, its beams sweeping
 * across the trees).
 * @returns {Promise<object>} the clump's trees within 15 m
 */
async function placeInTrees() {
  const game = window.__game, { PROPS } = await import('/src/world/state.ts');
  const trees = PROPS.filter((prop) => prop.kind === 'tree');
  let best = trees[0], bestCount = -1;
  for (let index = 0; index < trees.length; index += 7) {
    const tree = trees[index];
    const count = trees.filter((other) => Math.hypot(other.x - tree.x, other.y - tree.y) < 15)
      .length;
    if (count > bestCount) {
      best = tree;
      bestCount = count;
    }
  }
  const heading = 0.6, car = game.car;
  Object.assign(car, { x: best.x - Math.cos(heading) * 14, y: best.y - Math.sin(heading) * 14,
    heading, vx: Math.cos(heading) * 20, vy: Math.sin(heading) * 20, lightsOn: true });
  return { index: Math.round(best.x) + ',' + Math.round(best.y), trees: bestCount };
}

const server = await startServer();
const browser = await launchBrowser({ args: CPU_RASTER_ARGS });
try {
  const errors = [];
  const page = await openPage(browser, server.url, levelId, errors, `&night=${NIGHT}${QUERY}`);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((seed) => window.__rt.seed(seed), SEED);
  await page.evaluate(launchLevel, [levelId, {}]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(installDriver);
  await page.evaluate(() => window.__rt.step(400));
  const placed = await page.evaluate(placeInTrees);
  console.log(`${levelId} night ${NIGHT}${QUERY}: by the clump at ${placed.index}, ${placed.trees}`
    + ' trees within 15 m');
  let done = 0;
  for (const frame of CAPTURES) {
    await page.evaluate((count) => window.__rt.step(count), frame - done);
    done = frame;
    const url = await page.evaluate(grabCanvas);
    const hash = createHash('sha256').update(Buffer.from(url.split(',')[1], 'base64'))
      .digest('hex').slice(0, 16);
    const cut = await page.evaluate(() => window.__game.renderer.flyStats.canopyCut);
    console.log(`  f${frame}: ${hash}  canopies darkened ${cut.traced} / on the map ${cut.onMap}`);
  }
  await page.context().close();
  console.log(errors.length ? `  page errors: ${errors.slice(0, 3).join(' | ')}` : '  no page errors');
} finally {
  await browser.close();
  server.stop();
}
