// _rollshots.mjs - photos of a rolled car in the game (Test Lab, the camera zoomed in), held on its
// side, at 844x390 and 390x844, with ?rollside=1 off and on: the muscle car at 90 degrees and the
// hatch in a light blue paint at 60 degrees. node tools/scratch/_rollshots.mjs [outDir]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const OUT = process.argv[2] || 'tools/scratch';
const CARS = [['muscle-rwd', Math.PI / 2, ''], ['hatch-fwd', Math.PI / 3, '#8fc8f0']];
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of [[844, 390], [390, 844]]) {
    for (const switchOn of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await gotoGame(page, `${server.url}/?guide=0&menu=0&rules=0&noaudio=1${
        switchOn ? '&rollside=1' : ''}`);
      await page.mouse.click(width / 2, height / 2);
      await page.waitForTimeout(1500);
      for (const [carId, phi, paint] of CARS) {
        await page.evaluate(async ([id, colour]) => {
          const game = window.__game;
          game.launch('lab', id, { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
          await new Promise((done) => setTimeout(done, 1500));
          if (colour) game.car.spec.paint = colour;
          game.renderer.debugZoom(3);
        }, [carId, paint]);
        await page.mouse.click(width / 2, height / 2);
        await page.waitForTimeout(400);
        await page.evaluate((angle) => {
          const car = window.__game.car;
          car.vx = 0; car.vy = 0;
          car.roll = { phase: 'side', phi: angle, w: 0, still: 0 };
        }, phi);
        await page.waitForTimeout(600);
        const name = `${OUT}/_rollshot-${carId}-${width}x${height}-${switchOn ? 'on' : 'off'}.png`;
        await page.screenshot({ path: name });
        const probe = await page.evaluate(async () => {
          const { FIX } = await import('/src/core/fixes.ts');
          const car = window.__game.car;
          return { rollside: FIX.rollside, phi: car.roll && car.roll.phi,
            phase: car.roll && car.roll.phase, paint: car.spec.paint };
        });
        console.log(JSON.stringify(probe));
        console.log(name, errors.length ? `ERRORS ${errors.join(' | ')}` : 'errors none');
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}
