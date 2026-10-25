// _stingerspot.mjs - where a stinger fits: each level's start, and the ground ahead of it
// node tools/scratch/_stingerspot.mjs lab,test-track
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const levels = (process.argv[2] || 'lab,test-track').split(',');
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1`);
  await page.mouse.click(422, 195);
  for (const id of levels) {
    const res = await page.evaluate(async (levelId) => {
      const game = window.__game, wear = await import('/src/world/wear.ts');
      game.launch(levelId, 'hatch-rwd', { ai: 0 });
      await new Promise((done) => setTimeout(done, 500));
      const car = game.car, cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
      const ahead = [];
      for (const metres of [30, 40, 50, 60, 80]) {
        const x = car.x + cosH * metres, y = car.y + sinH * metres;
        const across = [-4, -2, 0, 2, 4].map((side) => wear.groundSurfaceAt(x - sinH * side,
          y + cosH * side).id);
        ahead.push({ metres, x: +x.toFixed(1), y: +y.toFixed(1), across });
      }
      return { x: car.x, y: car.y, heading: car.heading, ahead };
    }, id);
    console.log(id, JSON.stringify(res));
  }
} finally {
  await browser.close();
  server.stop();
}
