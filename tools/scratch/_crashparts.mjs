// _crashparts.mjs - a REAL crash in the game: the player's car (flat out at SPEED m/s) into an AI
// car parked across its way; what came off (parts, wheels) and a shot after -
// tools/scratch/_crashparts-<car>.png. node tools/scratch/_crashparts.mjs [cars] [speed]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [carsArg = 'hatch-fwd,track-rwd', speedArg = '22', query = ''] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const carId of carsArg.split(',')) {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1${query ? '&' + query : ''}`);
    await page.mouse.click(200, 300);
    await page.waitForTimeout(1500);
    const res = await page.evaluate(async ([id, speed]) => {
      const g = window.__game;
      g.launch('test-track', id, { ai: 1 });
      await new Promise((done) => setTimeout(done, 2500));
      const other = g.ai[0].car, car = g.car, ahead = 14;
      other.x = car.x + Math.cos(car.heading) * ahead; other.y = car.y + Math.sin(car.heading) * ahead;
      other.heading = car.heading + Math.PI / 2; other.vx = 0; other.vy = 0;
      g.ai[0].drv.state && (g.ai[0].hold = true);
      car.vx = Math.cos(car.heading) * speed; car.vy = Math.sin(car.heading) * speed;
      g.renderer.debugZoom(2.2);
      await new Promise((done) => setTimeout(done, 2500));
      const loose = g.cones.list.filter((obj) => obj.part || obj.rimCol);
      return { parts: loose.map((obj) => obj.cutKind || obj.kind), lost: car.partLost || '',
        otherLost: other.partLost || '', dmg: car.dmg?.map((d) => +d.toFixed(2)) };
    }, [carId, +speedArg]);
    await page.screenshot({ path: `tools/scratch/_crashparts-${carId}${query ? '-' + query.replace(/[=&]/g, '') : ''}.png` });
    console.log(carId, JSON.stringify(res), errors.length ? 'ERRORS ' + errors.join(' | ') : 'errors none');
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
