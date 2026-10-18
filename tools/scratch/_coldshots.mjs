// _mudshots.mjs - photographs ?mudfreeze=1 on the GPU ground: Grass Track, the car parked by a mud
// patch, the frost off then full, at 844x390 and 390x844, into the temp folder; prints page errors,
// console warnings (a shader that fails to compile) and the frame times with the frost showing.
// node tools/scratch/_mudshots.mjs [level]
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const level = 'lab';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of [[390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3,
      isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const notes = [];
    page.on('pageerror', (error) => notes.push('ERROR ' + error));
    page.on('console', (message) => {
      if (message.type() !== 'log') notes.push(message.type() + ' ' + message.text());
    });
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&level=${level}`
      + '&coldsurface=1');
    await page.touchscreen.tap(width / 2, height / 2);
    await page.waitForTimeout(500);
    await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd', { ai: 0 }), level);
    await page.waitForTimeout(4000);
    const spot = { x: -195, y: 74 };
    for (const frost of [0, 1]) {
      const ms = await page.evaluate(async ([where, level]) => {
        const field = await import('/src/world/coverfield.ts');
        const weather = await import('/src/world/weather.ts');
        const game = window.__game;
        weather.WEATHER.trackC = -3;
        Object.assign(field.FIELD, { water: 0, snow: level * 0.6, ice: 0, packed: 0 });
        game.car.x = where.x; game.car.y = where.y; game.car.vx = game.car.vy = 0;
        game.renderer.snap(game.car);
        const times = [];
        let last = performance.now();
        await new Promise((done) => {
          const tick = (now) => {
            times.push(now - last); last = now;
            if (times.length < 90) requestAnimationFrame(tick); else done();
          };
          requestAnimationFrame(tick);
        });
        times.sort((first, second) => first - second);
        return times[Math.floor(times.length / 2)].toFixed(1) + ' / '
          + times[times.length - 1].toFixed(1);
      }, [spot, frost]);
      const file = join(tmpdir(), `coldsurface-${width}x${height}-frost${frost}.png`);
      await page.screenshot({ path: file });
      console.log(`${width}x${height} frost ${frost}: frame ms median / max ${ms}  ${file}`);
    }
    console.log(notes.length ? notes.slice(0, 6).join('\n') : '  no page errors or warnings');
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
