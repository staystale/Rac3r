// _mudshots.mjs - photographs ?mudfreeze=1 on the GPU ground: Grass Track, the car parked by a mud
// patch, the frost off then full, at 844x390 and 390x844, into the temp folder; prints page errors,
// console warnings (a shader that fails to compile) and the frame times with the frost showing.
// node tools/scratch/_mudshots.mjs [level]
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const level = process.argv[2] || 'grass-track';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of [[844, 390], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3,
      isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const notes = [];
    page.on('pageerror', (error) => notes.push('ERROR ' + error));
    page.on('console', (message) => {
      if (message.type() !== 'log') notes.push(message.type() + ' ' + message.text());
    });
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&level=${level}`
      + '&mudfreeze=1');
    await page.touchscreen.tap(width / 2, height / 2);
    await page.waitForTimeout(500);
    await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd', { ai: 0 }), level);
    await page.waitForTimeout(4000);
    const spot = await page.evaluate(async () => {
      const wear = await import('/src/world/wear.ts');
      const game = window.__game, sub = game.level.subtrack;
      // the first mud point beside the track
      for (const point of sub.pts) {
        for (const side of [1, -1]) {
          for (let off = sub.width / 2 + 2; off < sub.width / 2 + 30; off += 1) {
            const x = point.x + point.nx * off * side, y = point.y + point.ny * off * side;
            if (wear.groundSurfaceAt(x, y).id === 'mud') return { x, y };
          }
        }
      }
      return null;
    });
    if (!spot) throw new Error('no mud found');
    for (const frost of [0, 0.6, 1.15]) {
      const ms = await page.evaluate(async ([where, level]) => {
        const field = await import('/src/world/coverfield.ts');
        const weather = await import('/src/world/weather.ts');
        const game = window.__game;
        weather.WEATHER.trackC = level > 0 ? -6 : 10;
        field.FROST.mud = level;
        field.FROST.thickMud = level * 0.7;
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
      const file = join(tmpdir(), `mudfreeze-${width}x${height}-frost${frost}.png`);
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
