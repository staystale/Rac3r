// _icecrackshots.mjs - ice crack photos: the Lab's ice sheet in a cold dry spell, one line
// across it driven N passes (wear.ts recordWearAt, as tyres do), photographed at 844x390 and
// 390x844 at the normal zoom and close up (the track held at -6 C). node tools/scratch/_icecrackshots.mjs <out> [passes]
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const out = process.argv[2] || '.', passes = +(process.argv[3] || 6);
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true,
      hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log('ERROR ' + error));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0`);
    await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__game.launch('lab', 'hatch-rwd',
      { ai: 0, weather: { mode: 'dry', season: 0, seed: 11 } }));
    await page.waitForTimeout(3000);
    const crack = await page.evaluate(async (count) => {
      const wear = await import('/src/world/wear.ts');
      const Wx = await import('/src/world/weather.ts');
      // held cold, so the cracked ice stays ice for the photo
      setInterval(() => { Wx.WEATHER.trackC = -6; Wx.WEATHER.tempC = -6; }, 20);
      const g = window.__game;
      g.car.x = -95; g.car.y = -180; g.car.vx = 0; g.car.vy = 0; g.car.heading = 0;
      let timeMs = 1e6;
      for (let pass = 0; pass < count; pass++) {
        for (let x = -115; x <= -75; x += 0.5) wear.recordWearAt(x, -185, null, timeMs, 18);
        timeMs += 1000;
        await new Promise((done) => setTimeout(done, 250));
      }
      let cracked = 0;
      for (const cell of wear.wearMap.values()) if (cell.cover === 'ice' && cell.crack > 0) cracked++;
      return cracked;
    }, passes);
    console.log(viewport.width, 'cracked cells', crack);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(out, `icecrack-${viewport.width}.png`) });
    await page.evaluate(() => window.__game.renderer.debugZoom(2.2));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(out, `icecrack-${viewport.width}-close.png`) });
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
