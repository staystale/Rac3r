// _grassshots.mjs - G1 photos: short grass (a pale striped lawn) and grass (fine blades), each
// level with an optional extra query, at 844x390, the car parked at the start; plus where the car
// can stand on each grass, the surface the tyres read (mu).
// node tools/scratch/_grassshots.mjs [dir] [extra query]
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const folder = process.argv[2] || tmpdir();
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [tag, query] of [['now', process.argv[3] ? '&' + process.argv[3] : '']]) {
    for (const level of ['naffcar', 'grass-track', 'castle-cum']) {
      const context = await browser.newContext({ viewport: { width: 844, height: 390 },
        deviceScaleFactor: 2 });
      const page = await context.newPage();
      page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
      await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${query}`);
      await page.mouse.click(422, 195);
      await page.waitForTimeout(500);
      await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd',
        { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }), level);
      await page.waitForTimeout(5000);
      const grip = await page.evaluate(async () => {
        const { SURFACES } = await import('/src/world/surfaces.ts');
        const lab = await import('/src/lab.js'), { shared } = await import('/src/game/state.js');
        const game = window.__game, sub = lab.LEVEL.subtrack;
        // park 8 m off the track's edge, on the grass, the sim paused
        for (const side of [1, -1]) {
          const spot = lab.onTrack(sub, 200, side * (sub.width / 2 + 8), {});
          game.car.x = spot.x;
          game.car.y = spot.y;
          if (/grass/i.test(lab.groundAt(spot.x, spot.y).surface.id)) break;
        }
        game.car.vx = game.car.vy = 0;
        shared.paused = true;
        const row = SURFACES.grassShort, here = lab.groundAt(game.car.x, game.car.y).surface.id;
        return `on ${here}; short grass mu ${row.mu} peakK ${row.peakK} rough ${row.rough}`;
      });
      await page.waitForTimeout(1500);
      const name = `g1-${level}-${tag}.png`;
      await page.screenshot({ path: join(folder, name) });
      console.log(name, grip);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}
