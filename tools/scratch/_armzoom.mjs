// _armzoom.mjs - (the arms at the GAME'S zoom) a real crash (the car into a parked one, as
// _realcrash.mjs) photographed at the phone's own view - 844x390, device px x3, the camera's own
// zoom, no close-up - cropped round the car and enlarged without smoothing; and how many CSS px a
// metre is at that zoom (the sprite's 17.3 px a metre on screen).
// node tools/scratch/_armzoom.mjs [cars] [speed m/s] [front|rear] [query]   OUT=<folder> ROLL=1
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [carsArg = 'strange-l322', speedArg = '28', endArg = 'front', query = ''] = process.argv.slice(2);
const OUT = process.env.OUT || 'tools/scratch/armzoom';
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const carId of carsArg.split(',')) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3 });
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1${query ? '&' + query : ''}`);
    await page.mouse.click(422, 195);
    await page.waitForTimeout(1200);
    const at = await page.evaluate(async ([id, speed, end, rolled]) => {
      const game = window.__game;
      game.launch('test-track', id, { ai: 1, weather: { mode: 'dry', season: 2, seed: 4 } });
      await new Promise((done) => setTimeout(done, 6000));
      const car = game.car, other = game.ai[0].car, dir = end === 'rear' ? -1 : 1;
      other.x = car.x + Math.cos(car.heading) * 12 * dir;
      other.y = car.y + Math.sin(car.heading) * 12 * dir;
      other.heading = car.heading + Math.PI / 2; other.vx = 0; other.vy = 0;
      game.ai[0].hold = true;
      car.vx = Math.cos(car.heading) * speed * dir; car.vy = Math.sin(car.heading) * speed * dir;
      await new Promise((done) => setTimeout(done, 2500));
      car.vx = 0; car.vy = 0; other.x += 200; other.y += 200;
      if (rolled) {
        const roll = await import('/src/roll.ts');
        roll.startRoll(car, 1, 9);
        const until = performance.now() + 4000;
        while (performance.now() < until && !(car.roll && Math.abs(Math.abs(car.roll.phi
          % (2 * Math.PI)) - Math.PI) < 0.35)) await new Promise((done) => setTimeout(done, 16));
        game.paused = true;
      }
      await new Promise((done) => setTimeout(done, 500));
      const renderer = game.renderer, toCss = innerWidth / renderer.W;
      const x = renderer.toScreenX(car.x) * toCss, y = renderer.toScreenY(car.y) * toCss;
      const perMetre = (renderer.toScreenX(car.x + 1) - renderer.toScreenX(car.x)) * toCss;
      return { x, y, perMetre, dmg: car.dmg?.map((d) => +d.toFixed(2)), lost: car.partLost || '',
        thrown: game.cones.list.filter((cone) => cone.part || cone.rimCol).map((cone) => cone.kind || 'wheel').join(',') };
    }, [carId, +speedArg, endArg, !!process.env.ROLL]);
    const file = `${OUT}/${carId}-${endArg}${process.env.ROLL ? '-rolled' : ''}.png`;
    await page.screenshot({ path: file, clip: { x: Math.max(0, Math.min(844 - 120, at.x - 60)),
      y: Math.max(0, Math.min(390 - 80, at.y - 40)), width: 120, height: 80 } });
    console.log(`${file} ${at.perMetre.toFixed(1)} CSS px/m dmg ${at.dmg} lost ${at.lost} thrown ${at.thrown}${errors.length ? ' PAGE ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
