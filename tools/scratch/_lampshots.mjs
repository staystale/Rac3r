// _lampshots.mjs - THE OWNER'S 11-21 BUG 5 (scratch, diagnosis): cars parked at night with their
// headlights on, zoomed in - where the beam (render/light.ts drawBeams: BEAM_START_M ahead of the
// centre for every car) starts against each car's own nose. node tools/scratch/_lampshots.mjs <dir>
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [OUT = 'tools/scratch/lampshots', carsArg = 'hatch-fwd,routemonster,seven-420r,transfit-van']
  = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const carId of carsArg.split(',')) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&night=0.95`);
    await page.mouse.click(400, 200);
    await page.waitForTimeout(1200);
    const info = await page.evaluate(async (id) => {
      const game = window.__game;
      game.launch('test-track', id, { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
      await new Promise((done) => setTimeout(done, 2500));
      game.car.lightsOn = true;
      game.renderer.debugZoom(4);
      return { len: game.car.spec.len, wid: game.car.spec.wid };
    }, carId);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/lamp-${carId}.png` });
    console.log(carId, JSON.stringify(info));
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
