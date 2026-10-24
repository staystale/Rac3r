// _labcovers.mjs - the Lab's own covers (its ice / snow / puddle samples) in the browser: at boot,
// after a launch with no weather, and after a launch with weather.
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
const covers = (page) => page.evaluate(async () => {
  const state = await import('/src/world/state.ts');
  const lv = state.LEVEL;
  return `${lv.id} covers ${(lv.covers || []).length} base ${(lv._coversBase || []).length}`
    + ` static ${(lv._staticCovers || []).length}`;
});
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0`);
  await page.touchscreen.tap(400, 200);
  await page.waitForTimeout(1500);
  console.log('boot:', await covers(page));
  await page.evaluate(() => window.__game.launch('lab', 'hatch-rwd', { ai: 0 }));
  await page.waitForTimeout(2500);
  console.log('launch, no weather:', await covers(page));
  await page.evaluate(() => window.__game.launch('lab', 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 0, seed: 11 } }));
  await page.waitForTimeout(2500);
  console.log('launch, weather:', await covers(page));
} finally {
  await browser.close();
  server.stop();
}
