// _thrownorder.mjs - a wheel torn off with its suspension, on the ground: the car on the test
// track, its front-right wheel torn off with a wishbone, a strut and a drive shaft thrown with it
// (the game's own spawn: car.wheelSpawn, car.partSpawn), laid in one heap on the wheel beside the
// car and photographed close up - whether the thrown suspension lies UNDER the loose wheel (?underskin) or over it.
// node tools/scratch/_thrownorder.mjs [car] [query]   OUT=<file.png>
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [carId = 'saloon-rwd', query = ''] = process.argv.slice(2);
const OUT = process.env.OUT || 'tools/scratch/_thrownorder.png';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 600 }, deviceScaleFactor: 8 });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${query ? '&' + query : ''}`);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(1200);
  const at = await page.evaluate(async (id) => {
    const game = window.__game;
    game.launch('test-track', id, { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
    await new Promise((done) => setTimeout(done, 1500));
    const car = game.car;
    car.vx = 0; car.vy = 0;
    car.wheelSpawn = [1];
    car.partSpawn = [{ corner: 1, kind: 'wishbone' }, { corner: 1, kind: 'strut' },
      { corner: 1, kind: 'shaft' }];
    await new Promise((done) => setTimeout(done, 1500));
    const parts = game.cones.list.filter((cone) => cone.part || cone.rimCol);
    // (laid in one heap on the wheel, where they would overlap: which is drawn on top shows)
    const wheel = parts.find((cone) => cone.rimCol) || parts[0];
    parts.forEach((cone, i) => {
      if (cone === wheel) return;
      cone.x = wheel.x + 0.25 * Math.cos(i * 2.1); cone.y = wheel.y + 0.25 * Math.sin(i * 2.1);
      cone.vx = 0; cone.vy = 0; cone.spin = 0;
    });
    const x = parts.reduce((sum, cone) => sum + cone.x, 0) / Math.max(1, parts.length);
    const y = parts.reduce((sum, cone) => sum + cone.y, 0) / Math.max(1, parts.length);
    game.renderer.debugZoom(2);
    await new Promise((done) => setTimeout(done, 600));
    const renderer = game.renderer, toCss = innerWidth / renderer.W;
    return { n: parts.length, kinds: parts.map((cone) => cone.kind || 'wheel').join(','),
      x: renderer.toScreenX(x) * toCss, y: renderer.toScreenY(y) * toCss };
  }, carId);
  await page.screenshot({ path: OUT, clip: { x: Math.max(0, at.x - 60), y: Math.max(0, at.y - 40),
    width: 120, height: 80 } });
  console.log(`${OUT}: ${at.n} loose (${at.kinds})${errors.length ? ' PAGE ERRORS ' + errors.join(' | ') : ''}`);
} finally {
  await browser.close();
  server.stop();
}
