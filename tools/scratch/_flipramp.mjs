// _flipramp.mjs - the Lab's flip ramp (?flipramp=1): a car rolled at it with its +y wheels on
// the ramp at 12 m/s (flips), at 5 m/s (no), and beside it (no); what the roll state, sparks and
// damage did, and photos. node tools/scratch/_flipramp.mjs <out folder>
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const out = process.argv[2] || '.';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [tag, speed, offset, shotMs] of [['look', 0, 3, 600], ['flip', 12, 0, 1400],
    ['slow', 5, 0, 3500], ['beside', 12, 2.5, 3500]]) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&flipramp=1`);
    await page.touchscreen.tap(422, 195);
    await page.waitForTimeout(300);
    const res = await page.evaluate(async ([spd, off, ms]) => {
      const game = window.__game;
      game.launch('lab', 'hatch-rwd', { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
      await new Promise((done) => setTimeout(done, 1500));
      const { levelFlipRamps } = await import('/src/world/flipramps.ts');
      const ramp = levelFlipRamps('lab')[0], car = game.car;
      // +y wheels over the ramp's line (track 1.5 m: half 0.75)
      car.heading = 0; car.x = ramp.x - (spd ? 14 : 2); car.y = ramp.y - 0.75 + off;
      car.vx = spd; car.vy = 0; car.yawRate = 0;
      game.renderer.debugZoom(1.4);
      let rolled = false, sparked = 0, phases = new Set();
      const start = performance.now();
      while (performance.now() - start < ms) {
        await new Promise((done) => requestAnimationFrame(done));
        if (car.roll) { rolled = true; phases.add(car.roll.phase); }
        if (car.sparks) sparked++;
      }
      return { rolled, phases: [...phases], sparkFrames: sparked, rolls: car._rolls || 0,
        dmg: car.dmg ? car.dmg.map((d) => d.toFixed(2)) : null };
    }, [speed, offset, shotMs]);
    console.log(tag + ': ' + JSON.stringify(res));
    await page.screenshot({ path: join(out, `flipramp-${tag}.png`) });
    await context.close();
  }
} finally { await browser.close(); server.stop(); }
