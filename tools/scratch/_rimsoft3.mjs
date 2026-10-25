// _rimsoft3.mjs - how much ground did the old rim-spark lookup (the worn cell, else the level's
// zone) read as HARD where the wheels feel SOFT ground (wear.ts groundAt)? Points every 0.75 m in a
// 300 m square round the start, by kind. The fix reads groundAt itself.
// node tools/scratch/_rimsoft3.mjs [level] [weather mode]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const level = process.argv[2] || 'castle-cum';
const mode = process.argv[3] || 'dry';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1`);
  await page.evaluate(([id, wx]) => window.__game.launch(id, 'hatch-rwd',
    { ai: 0, weather: { mode: wx, season: 0, seed: 4 } }), [level, mode]);
  await page.waitForTimeout(3000);
  const res = await page.evaluate(async () => {
    const car = window.__game.car, wear = await import('/src/world/wear.ts');
    const wrong = {};
    let soft = 0, oldHardOnSoft = 0;
    for (let x = car.x - 150; x < car.x + 150; x += 0.75) {
      for (let y = car.y - 150; y < car.y + 150; y += 0.75) {
        const feel = wear.groundAt(x, y).surface;
        if (feel.hard) continue;
        soft++;
        const old = wear.getWornSurface(x, y) || wear.groundSurfaceAt(x, y);
        if (!old.hard) continue;
        oldHardOnSoft++;
        const key = feel.id + ' read as ' + old.id;
        wrong[key] = (wrong[key] || 0) + 1;
      }
    }
    return { soft, oldHardOnSoft, wrong };
  });
  console.log(`${level} ${mode}: soft points ${res.soft}, old lookup said hard on ${res.oldHardOnSoft}`
    + ` ${JSON.stringify(res.wrong)}`);
} finally {
  await browser.close();
  server.stop();
}
