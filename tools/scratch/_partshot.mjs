// _partshot.mjs - ?carlooks: what a car sheds in a crash (world/debris.ts partLook): its front and
// rear part and a side panel, and a wheel; zoomed shots of an F1 and a hatch -
// tools/scratch/_partshot-<car>.png. node tools/scratch/_partshot.mjs [query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [query = 'carpaint=1&carlooks=1'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const carId of ['track-rwd', 'hatch-rwd']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&${query}`);
    await page.mouse.click(200, 300);
    await page.waitForTimeout(2000);
    const res = await page.evaluate(async (id) => {
      const g = window.__game;
      g.launch('test-track', id, {});
      await new Promise((done) => setTimeout(done, 1500));
      g.car.partSpawn = [{ corner: 0, kind: 'bumper' }, { corner: 2, kind: 'bumper' },
        { corner: 1, kind: 'panel' }];
      g.car.wheelOff[3] = true; g.car.wheelSpawn = [3];
      g.renderer.debugZoom(2.4);
      await new Promise((done) => setTimeout(done, 700));
      return g.cones.list.filter((obj) => obj.part || obj.rimCol).map((obj) => (obj.shape || obj.kind)
        + (obj.partW ? ' ' + obj.partW.toFixed(2) + ' m' : '') + (obj.tyreW ? ' tyre ' + obj.tyreW : ''));
    }, carId);
    await page.screenshot({ path: `tools/scratch/_partshot-${carId}.png` });
    console.log(carId, JSON.stringify(res), errors.length ? 'ERRORS ' + errors.join(' | ') : 'errors none');
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
