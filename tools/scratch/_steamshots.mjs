// _steamshots.mjs - (physics/leakplaces.ts, render/enginesmoke.ts): a cracked
// radiator's STEAM where the radiator is - the hatch's nose, the Sport quattro S1's tail, the
// Huracan's - its panel on, then off (exposed: denser), parked on the Lab; photos at 844x390 and
// 390x844, zoomed in. node tools/scratch/_steamshots.mjs <dir> [cars] [extra query]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [OUT = 'tools/scratch/steamshots', carsArg = 'hatch-fwd,rally-4x4,lambo-awd',
  query = 'x=1'] = process.argv.slice(2);
// the panel over each radiator (physics/leakplaces.ts isRadiatorExposed)
const OPEN = { 'hatch-fwd': 'bonnet:0', 'rally-4x4': 'boot:2', 'lambo-awd': 'bonnet:0' };
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const carId of carsArg.split(','))
    for (const [width, height] of [[844, 390], [390, 844]])
      for (const exposed of [false, true]) {
        const page = await browser.newPage({ viewport: { width, height } });
        const errors = [];
        page.on('pageerror', (err) => errors.push(err.message));
        await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&${query}`);
        await page.mouse.click(width / 2, height / 2);
        await page.waitForTimeout(1200);
        await page.evaluate(async ([id, lost]) => {
          const game = window.__game, { damageInit } = await import('/src/damage.ts');
          game.launch('lab', id, { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
          await new Promise((done) => setTimeout(done, 2000));
          const car = game.car;
          damageInit(car);
          car.engLeak = 1 / 40; car.engT = 95; car.engWater = 1;
          car.partLost = lost;
          game.renderer.debugZoom(3);
        }, [carId, exposed ? OPEN[carId] || '' : '']);
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${OUT}/steam-${carId}-${exposed ? 'open' : 'shut'}-${width}x${
          height}.png` });
        console.log(carId, width, exposed ? 'open' : 'shut',
          errors.length ? 'ERRORS ' + errors.join(' | ') : 'errors none');
        await page.close();
      }
} finally { await browser.close(); server.stop(); }
