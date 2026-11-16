// _hangshots.mjs - ?dmgmore2 item 4 (world/hanging.ts, render/hanging.ts): a car with its exhaust
// left HANGING (its end on the road behind the tail, sparks on tarmac) and a torn rear bumper's
// piece dragging (paint chips), driven straight on the Test Track's tarmac at ~10 m/s; photos at
// 844x390 and 390x844, zoomed in (ZOOM=0: at the game's own zoom).
// node tools/scratch/_hangshots.mjs <dir> [cars] [extra query]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [OUT = 'tools/scratch/hangshots', carsArg = 'hatch-fwd,saloon-rwd', query = 'dmgmore2=1']
  = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const carId of carsArg.split(','))
    for (const [width, height] of [[844, 390], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&${query}`);
      await page.mouse.click(width / 2, height / 2);
      await page.waitForTimeout(1200);
      const state = await page.evaluate(async ([id, zoom]) => {
        const game = window.__game, { damageInit } = await import('/src/damage.ts');
        const { partHangs } = await import('/src/world/torn.ts');
        game.launch('test-track', id, { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
        await new Promise((done) => setTimeout(done, 2500));
        const car = game.car;
        damageInit(car);
        // (a rear bumper corner whose torn piece hangs - world/torn.ts)
        const corner = [2, 3].find((one) => partHangs('bumper', one)) ?? 2;
        car.exhaustHang = 350;
        car.partLost = 'exhaust:2,bumper:' + corner;
        car.partsOff = 2;
        car.dmg[corner] = 0.3;
        if (zoom) game.renderer.debugZoom(zoom);
        return { corner };
      }, [carId, Number(process.env.ZOOM ?? 3)]);
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(1300);
      for (const shot of [0, 1]) {
        await page.screenshot({ path: `${OUT}/hang-${carId}-${width}x${height}-${shot}.png` });
        await page.waitForTimeout(150);
      }
      const after = await page.evaluate(() => {
        const car = window.__game.car;
        return { speed: +Math.hypot(car.vx, car.vy).toFixed(1), exhaustHang:
          Math.round(car.exhaustHang), exhaustDrag: car.exhaustDrag, bumperHang:
          (car.bumperHang || []).map(Math.round), bumperDrag: car.bumperDrag };
      });
      await page.keyboard.up('KeyW');
      console.log(carId, width, JSON.stringify(state), JSON.stringify(after),
        errors.length ? 'ERRORS ' + errors.join(' | ') : 'errors none');
      await page.close();
    }
} finally { await browser.close(); server.stop(); }
