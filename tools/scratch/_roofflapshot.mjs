// _roofflapshot.mjs - the Naffcar's roof flaps in the game (?roofflaps=1) on the Stock Car oval,
// photographed close standing (tools/scratch/_roofflaps-up.png)
// and driving forwards (-down.png), with page errors.
// node tools/scratch/_roofflapshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 600 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&roofflaps=1`);
  await page.mouse.click(200, 300);
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const game = window.__game;
    game.launch('stock-car', 'naffcar', { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
    await new Promise((done) => setTimeout(done, 1800));
    game.renderer.debugZoom(2.6);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tools/scratch/_roofflaps-down.png' });
  const flaps = await page.evaluate(async () => {
    // (the camera leads a fast car off the screen: the flaps set standing on the car at rest, shot
    // within a frame or two, before they fall)
    const car = window.__game.car;
    car.flaps = 1;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    return car.flaps;
  });
  await page.screenshot({ path: 'tools/scratch/_roofflaps-up.png' });
  console.log('flaps', flaps, errors.length ? 'ERRORS ' + errors.join(' | ') : 'errors none');
} finally { await browser.close(); server.stop(); }
