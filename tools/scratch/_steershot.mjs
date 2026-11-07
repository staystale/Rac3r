// _steershot.mjs - an open-wheeler standing with its front wheels turned (the wishbones meet the
// hubs, the track rods turn with the wheels: render/cars.ts drawWishbones), zoomed:
// tools/scratch/_steershot-<car>.png. node tools/scratch/_steershot.mjs [cars] [steer rad]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [carsArg = 'track-rwd,f2-rwd', steerArg = '0.35'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const carId of carsArg.split(',')) {
    const page = await browser.newPage({ viewport: { width: 390, height: 500 } });
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1`);
    await page.mouse.click(200, 250);
    await page.waitForTimeout(1200);
    await page.evaluate(async ([id, steer]) => {
      const g = window.__game;
      g.launch('test-track', id, {});
      await new Promise((done) => setTimeout(done, 1500));
      g.renderer.debugZoom(2.6);
      const hold = () => { g.car.delta = steer; requestAnimationFrame(hold); };
      hold();
      await new Promise((done) => setTimeout(done, 600));
    }, [carId, +steerArg]);
    await page.screenshot({ path: `tools/scratch/_steershot-${carId}.png` });
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
