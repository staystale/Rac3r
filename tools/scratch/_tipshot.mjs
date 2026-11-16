// _tipshot.mjs - A CAR UP ON TWO WHEELS, in the game (the Lab, dry, daylight), at 844x390 and
// 390x844 and a close-up: its roll forced to the two-wheel state at a lean (physics/tip.ts; the
// lean held, as no ?tipping steps it) - what the rolled-body drawing shows of a lift. Nothing in
// the game is changed. node tools/scratch/_tipshot.mjs <cars> [lean deg, 12]  OUT=<folder>
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [carsArg = 'routemonster', leanArg = '12'] = process.argv.slice(2);
const OUT = process.env.OUT || 'tools/scratch';
const SHOTS = [{ name: '844x390', width: 844, height: 390, zoom: null },
  { name: '390x844', width: 390, height: 844, zoom: null },
  { name: 'close', width: 844, height: 390, zoom: 1.2 }];
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const id of carsArg.split(',')) {
    for (const shot of SHOTS) {
      const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height },
        deviceScaleFactor: 3 });
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1`
        + `${process.env.RAC3R_QUERY ? '&' + process.env.RAC3R_QUERY : ''}`);
      await page.mouse.click(shot.width / 2, shot.height / 2);
      await page.waitForTimeout(1200);
      await page.evaluate(async ([carId, lean, zoom]) => {
        const game = window.__game;
        game.launch('lab', carId, { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
        await new Promise((done) => setTimeout(done, 1500));
        const car = game.car;
        car.vx = 0; car.vy = 0; car.heading = 0;
        car.roll = { phase: 'tipping', phi: lean * Math.PI / 180, w: 0, still: 0 };
        if (zoom) game.renderer.debugZoom(zoom);
        await new Promise((done) => setTimeout(done, 600));
      }, [id, Number(leanArg), shot.zoom]);
      const file = `${OUT}/_tipshot-${id}-${leanArg}-${shot.name}.png`;
      await page.screenshot({ path: file });
      console.log(`${file}${errors.length ? ' PAGE ERRORS ' + errors.join(' | ') : ''}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}
