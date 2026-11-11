// _decknight.mjs - A CAR'S LIGHTS AT NIGHT ON AND UNDER A DRIVABLE BRIDGE (render/light.ts
// paintUnderDecks): on a venue level (LEVEL, default Brands) the player car is set still with its
// lights on (?night=0.9), once on the middle of the first bridge's deck and once on the ground
// beneath it, facing along the deck and across it; a photo of each.
// [LEVEL=brands-snatch] [VIEW=390x844] [Q=] node tools/scratch/_decknight.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const LEVEL_ID = process.env.LEVEL || 'brands-snatch';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&night=0.9`
    + (process.env.Q || ''));
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd', { ai: 0 }), LEVEL_ID);
  await page.waitForTimeout(2500);
  for (const [name, onDeck, turn] of [['deck-along', true, 0], ['deck-across', true, 1],
    ['under-along', false, 0], ['under-across', false, 1]]) {
    const placed = await page.evaluate(([isOnDeck, quarter]) => {
      const game = window.__game, level = game.level;
      const index = (level.crossings || []).findIndex((way) => way.kind === 'bridge'
        && way.length > 0);
      if (index < 0) return null;
      const way = level.crossings[index], mid = (way.minAcross + way.maxAcross) / 2;
      const car = game.car, along = way.length / 2;
      car.x = way.ax + way.dirX * along - way.dirY * (isOnDeck ? mid : mid + 12);
      car.y = way.ay + way.dirY * along + way.dirX * (isOnDeck ? mid : mid + 12);
      car.heading = Math.atan2(way.dirY, way.dirX) + quarter * Math.PI / 2;
      car.vx = car.vy = car.yawRate = 0;
      car.lightsOn = true;
      car.crossing = isOnDeck ? index : -1;
      car.crossX = car.x;
      car.crossY = car.y;
      // (the beneath spot: under the deck's middle, beside the way's line)
      if (!isOnDeck) {
        car.x += way.dirY * 12;
        car.y -= way.dirX * 12;
        car.crossX = car.x;
        car.crossY = car.y;
      }
      return { index, crossing: car.crossing };
    }, [onDeck, turn]);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `tools/scratch/_decknight-${process.env.TAG || ""}${LEVEL_ID}-${name}-${width}x${height}.png` });
    console.log(name, JSON.stringify(placed));
  }
  console.log('errors', errors.length ? errors.join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}
