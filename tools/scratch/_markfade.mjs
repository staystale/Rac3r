// _markfade.mjs - the tyre-mark fade measured in the real game: the whole marks layer painted
// solid, then the game's own fade run for 240 s of physics steps (120 a second); per minute, the
// mean alpha left (64 points, one per block) and the ms the fade calls took. Old vs ?markfade=1.
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const query of ['', '&markfade=1']) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
    const page = await context.newPage();
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0${query}`);
    await page.mouse.click(400, 200);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd', { ai: 0 }));
    await page.waitForTimeout(3000);
    const rows = await page.evaluate(async () => {
      const game = window.__game, marks = game.marks;
      // one real stamp so the layer counts as marked (a car sliding sideways)
      const car = game.car;
      for (let i = 0; i < 30; i++) {
        car.t.slipSpeedF = car.t.slipSpeedR = 8;
        car.x += 0.3;
        marks.stamp(marks.wheelsOf(car));
      }
      const ctx = marks.canvas.getContext('2d');
      ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, marks.size, marks.size); ctx.restore();
      const sample = () => {
        let sum = 0;
        const side = marks.size / 8;
        for (let i = 0; i < 64; i++) {
          sum += ctx.getImageData(Math.floor((i % 8 + 0.5) * side),
            Math.floor((Math.floor(i / 8) + 0.5) * side), 1, 1).data[3];
        }
        return (sum / 64).toFixed(0);
      };
      const out = [`start alpha ${sample()} (stamps ${marks.stamps})`];
      let ms = 0;
      for (let minute = 1; minute <= 4; minute++) {
        const t0 = performance.now();
        for (let step = 0; step < 120 * 60; step++) marks.fade(1 / 120);
        ctx.getImageData(0, 0, 1, 1);
        ms += performance.now() - t0;
        out.push(`${minute} min: alpha ${sample()}`);
      }
      out.push(`fade cost ${(ms / (4 * 60)).toFixed(2)} ms per second of play`);
      return out;
    });
    console.log(query || 'old fade', '|', rows.join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
