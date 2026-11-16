// _pbzshots.mjs - A PEMBREEZY LEVEL PHOTOGRAPHED (scratch): the whole-map overview (the menu
// thumbnail's painter) and your car set down still at lap metres along the lap (and the joker's
// middle on the rallycross), each at the phone's two sizes. Page errors read.
// PEMBREEZY=1 is not needed in the page: the link carries ?pembreezy=1 while it is under test.
// ZOOM=<0.3..1> pins the camera zoom (0.3: flat out, as the phone sees the fences at speed).
// SHOTS=<folder> node tools/scratch/_pbzshots.mjs <level id> <lap m,lap m,...> [joker]
import { mkdirSync, writeFileSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const [levelId = 'pembreezy', distsArg = '0', jokerArg = ''] = process.argv.slice(2);
const SHOTS = process.env.SHOTS || 'pbzshots';
const VIEWS = [[844, 390], [390, 844]];
// ms to let the ground tiles and props settle after the car is set down
const SETTLE_MS = 1500;

/**
 * In the page: your car set down still on the lap at a lap metre (or the joker's middle).
 * @param {[number, boolean]} args lap m, whether to stand on the joker instead
 */
function placeCar([dist, onJoker, zoom]) {
  const game = window.__game, sub = game.level.subtrack;
  let spot = sub.pts[0];
  for (const point of sub.pts) if (point.dist <= dist) spot = point;
  let { x, y, heading } = spot;
  if (onJoker && game.level.joker) ({ x, y } = game.level.joker.gate);
  game.input.update = () => ({ steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0,
    shiftUp: false, shiftDown: false });
  Object.assign(game.car, { x, y, heading, vx: 0, vy: 0, _p: null });
  if (zoom) game.renderer.debugZoom(zoom);
  game.renderer.snap(game.car);
}

mkdirSync(SHOTS, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  for (const [width, height] of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
      isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?touch=1&menu=0&guide=0&rules=0&noaudio=1&seed=1`
      + `&level=${levelId}${extraQuery()}`);
    await page.mouse.click(width / 2, height / 2);
    await page.waitForTimeout(3000);
    if (width > height) {
      const url = await page.evaluate(() => window.__game.renderer.thumbnail(960).toDataURL());
      writeFileSync(`${SHOTS}/${levelId}-overview.png`, Buffer.from(url.split(',')[1], 'base64'));
    }
    const spots = distsArg.split(',').map(Number).map((dist) => [dist, false]);
    if (jokerArg) spots.push([0, true]);
    for (const [dist, onJoker] of spots) {
      await page.evaluate(placeCar, [dist, onJoker, +(process.env.ZOOM || 0)]);
      await page.waitForTimeout(SETTLE_MS);
      const name = onJoker ? 'joker' : `m${dist}`;
      await page.screenshot({ path: `${SHOTS}/${levelId}-${name}-${width}x${height}.png` });
    }
    await ctx.close();
  }
  console.log('page errors:', errors.length ? errors.slice(0, 5).join(' / ') : 'none');
} finally {
  await browser.close();
  server.stop();
}
