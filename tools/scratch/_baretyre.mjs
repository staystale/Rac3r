// _baretyre.mjs - Deaf Valley's BARE TYRE (?desertmore=1; owner 11-10: "tyres no wheel inside")
// beside the countryside's tyre and a stack of each, by the car at the start, a phone photo zoomed.
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer(); const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&desertmore=1`);
  await page.mouse.click(195, 422); await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd', { ai: 0, road: 'twisty',
    scenery: 'canyon', traffic: 0, litter: 0 }));
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const game = window.__game, car = game.car, cos = Math.cos(car.heading), sin = Math.sin(car.heading);
    const at = (ahead, side) => ({ x: car.x + cos * ahead - sin * side, y: car.y + sin * ahead + cos * side });
    game.cones.spawn([{ kind: 'tyre', ...at(8, -3), bare: true }, { kind: 'tyre', ...at(8, 3) },
      { kind: 'tyrestack', ...at(14, -3), bare: true }, { kind: 'tyrestack', ...at(14, 3) }]);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tools/scratch/_baretyre.png', clip: { x: 95, y: 380, width: 200, height: 260 } });
  console.log('shot');
} finally { await browser.close(); server.stop(); }
