// _autopilotboot.mjs - does ?autopilot=1 drive the player car from a link (level + car in the
// query, no menu)? Prints the level, the mode, the car's speed over 6 s and any page errors.
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const query = process.argv[2] || 'level=brands-snatch&car=hatch-rwd&autopilot=1';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  await gotoGame(page, `${srv.url}/?touch=1&guide=0&menu=0&${query}`);
  await page.touchscreen.tap(400, 200);
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(1000);
    console.log(await page.evaluate(() => {
      const g = window.__game;
      return `${g.level && g.level.id} speed ${Math.hypot(g.car.vx, g.car.vy).toFixed(1)} m/s`;
    }));
  }
} finally {
  await browser.close();
  srv.stop();
}
