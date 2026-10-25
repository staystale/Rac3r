// _wheeloffheat.mjs - a lost wheel's tyre reads 0 (owner): the autopilot drives Castle Cum, a
// wheel is knocked off (damage corner 1, front +y = tyre 0), the four tyre temps read after 3 s;
// then a repair and 3 s more.
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`);
  await page.mouse.click(422, 195);
  const res = await page.evaluate(async () => {
    const game = window.__game, damage = await import('/src/damage.ts');
    game.launch('castle-cum', 'hatch-rwd', { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    await wait(8000);
    const car = game.car, before = car.tyreT.map(Math.round);
    damage.repair(car);
    car.wheelOff[1] = true;
    await wait(3000);
    const off = car.tyreT.map(Math.round);
    damage.repair(car);
    await wait(3000);
    return { before, off, mended: car.tyreT.map(Math.round) };
  });
  console.log('tyre temps (tyre 0 = the lost wheel) ' + JSON.stringify(res));
} finally { await browser.close(); server.stop(); }
