// _hwdiag.mjs - why the player car stands still on the endless road in the scratch tools (scratch).
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 440, height: 738 } })).newPage();
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&night=0.94&nightfly=1`);
  await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd', { ai: 3 }));
  await page.waitForTimeout(12000);
  const before = await page.evaluate(() => [window.__game.car.x, window.__game.car.y]);
  await page.evaluate(async () => {
    const game = window.__game, auto = await import('/src/ai/autodrive.ts');
    const driver = auto.createAutoDriver(game.level.subtrack);
    game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false,
      shiftDown: false });
  });
  await page.waitForTimeout(15000);
  console.log(await page.evaluate((from) => {
    const game = window.__game;
    return JSON.stringify({ moved: Math.hypot(game.car.x - from[0], game.car.y - from[1]),
      speed: Math.hypot(game.car.vx, game.car.vy), start: game.start, keys: Object.keys(game)
        .slice(0, 40), props: game.level.props.length,
      walks: game.renderer.flyStats.canopyCut });
  }, before));
} finally {
  await browser.close();
  server.stop();
}
