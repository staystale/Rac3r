// _rollunder.mjs - ?underskin: a ROLLED car's underside as it really is (render/carprofile.ts
// underCorner, render/rollbody.ts): in the Lab, whole, then with its front-left wheel torn off by a
// big hit (world/debris.ts wheelBits size 0.8: strut, wishbone, a driven wheel's shaft, the track
// rod) and its rear-right by a small one (0.4: the strut); held on its roof (the underside up), on
// a side, and upright (the snapped corners, the track rod's stub), at 844x390 and 390x844.
// node tools/scratch/_rollunder.mjs <dir> [cars] [extra query]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [OUT = 'tools/scratch/rollunder', carsArg = 'hatch-fwd,saloon-rwd', query = 'underskin=1']
  = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const carId of carsArg.split(','))
    for (const [width, height] of [[844, 390], [390, 844]])
      for (const torn of [false, true]) {
        const page = await browser.newPage({ viewport: { width, height } });
        const errors = [];
        page.on('pageerror', (err) => errors.push(err.message));
        await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&${query}`);
        await page.mouse.click(width / 2, height / 2);
        await page.waitForTimeout(1200);
        const state = await page.evaluate(async ([id, isTorn]) => {
          const game = window.__game, { wheelBits } = await import('/src/world/debris.ts');
          const { damageInit } = await import('/src/damage.ts');
          game.launch('lab', id, { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
          await new Promise((done) => setTimeout(done, 1800));
          const car = game.car;
          damageInit(car);
          car.dmg = [0.05, 0.01, 0.01, 0.05];
          if (isTorn) {
            car.wheelOff = [true, false, false, true];
            wheelBits(car, 0, Math.random, 0.8);
            wheelBits(car, 3, Math.random, 0.4);
            car.partSpawn = [];
          }
          game.renderer.debugZoom(4);
          return { wheelOff: car.wheelOff, suspOff: car.suspOff };
        }, [carId, torn]);
        for (const [name, phi] of [['roof', Math.PI], ['side', Math.PI / 2], ['upright', null]]) {
          await page.evaluate((angle) => {
            const car = window.__game.car;
            car.vx = 0; car.vy = 0; car.heading = 0;
            car.roll = angle === null ? null : { phase: 'side', phi: angle, w: 0, still: 0 };
          }, phi);
          await page.waitForTimeout(400);
          await page.screenshot({ path: `${OUT}/${carId}-${torn ? 'torn' : 'whole'}-${name}-${
            width}x${height}.png` });
        }
        console.log(carId, width, torn ? 'torn' : 'whole', JSON.stringify(state),
          errors.length ? 'ERRORS ' + errors.join(' | ') : 'errors none');
        await page.close();
      }
} finally { await browser.close(); server.stop(); }
