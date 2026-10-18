// _nightshots.mjs - photographs ?night= (the night layer): Castle Cum with 3 AI (their headlights
// follow the dark) and Stock Car (floodlight pylons), at 844x390 and 390x844, the player's lights
// on. Also reads the frame's draw time with and without the night (laptop, A/B only). Temp folder.
// node tools/scratch/_nightshots.mjs [darkness]
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const darkness = process.argv[2] || '0.8';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [level, ai] of [['castle-cum', 3], ['stock-car', 3]]) {
    for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true,
        hasTouch: true });
      const page = await context.newPage();
      page.on('pageerror', (error) => console.log('ERROR ' + error));
      await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&night=${darkness}`);
      await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
      await page.waitForTimeout(400);
      await page.evaluate(([id, count]) => window.__game.launch(id, 'hatch-rwd',
        { ai: count, weather: { mode: 'dry', season: 2, seed: 4 } }), [level, ai]);
      await page.waitForTimeout(9000);
      await page.evaluate(() => { window.__game.car.lightsOn = true; });
      await page.waitForTimeout(600);
      const name = `night-${level}-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: join(tmpdir(), name) });
      const lights = await page.evaluate(() => window.__game.ai.map((entry) => entry.car.lightsOn));
      console.log(name, 'AI lights', lights.join(','));
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}
