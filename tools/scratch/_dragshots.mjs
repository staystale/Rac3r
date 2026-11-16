// _dragshots.mjs - a car DRAGGING a torn-off corner (world/debris.ts dragReach): the
// sparks off its snapped arm's end and the end glowing on tarmac, the dirt it throws on grass, the
// score inboard of where the tyre ran. The hatch-fwd on the Test Track, its front-left torn off by
// a big hit (the wishbone gone: the subframe drags) and its rear-right by a small one (the arm
// drags), both wings torn, driven straight at ~12 m/s; photos at 844x390 and 390x844, zoomed in.
// node tools/scratch/_dragshots.mjs <dir> [extra query]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [OUT = 'tools/scratch/dragshots', query = 'x=1'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of [[844, 390], [390, 844]])
    for (const ground of ['tarmac', 'grass']) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&${query}`);
      await page.mouse.click(width / 2, height / 2);
      await page.waitForTimeout(1200);
      const state = await page.evaluate(async (want) => {
        const game = window.__game, { wheelBits } = await import('/src/world/debris.ts');
        const { damageInit } = await import('/src/damage.ts');
        const { groundAt } = await import('/src/world/wear.ts');
        game.launch('test-track', 'hatch-fwd', { ai: 0, weather: { mode: 'dry', season: 2,
          seed: 4 } });
        await new Promise((done) => setTimeout(done, 2500));
        const car = game.car;
        // (onto grass: step sideways from the grid until the ground is grass)
        if (want === 'grass') {
          const sideX = -Math.sin(car.heading), sideY = Math.cos(car.heading);
          for (let step = 4; step < 80; step++) {
            const x = car.x + sideX * step, y = car.y + sideY * step;
            if (groundAt(x, y).surface.id.startsWith('grass')) {
              car.x = x + sideX * 6; car.y = y + sideY * 6;
              break;
            }
          }
        }
        damageInit(car);
        car.wheelOff = [true, false, false, true];
        wheelBits(car, 0, 0.8);
        wheelBits(car, 3, 0.4);
        car.partSpawn = [];
        // (their wings torn too, as a crash that takes a wheel does: the snapped corner shows)
        car.partLost = 'wing:0,wing:3';
        game.renderer.debugZoom(3);
        return { surface: groundAt(car.x, car.y).surface.id, suspOff: car.suspOff };
      }, ground);
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(1400);
      for (const shot of [0, 1]) {
        await page.screenshot({ path: `${OUT}/drag-${ground}-${width}x${height}-${shot}.png` });
        await page.waitForTimeout(150);
      }
      const after = await page.evaluate(() => {
        const car = window.__game.car;
        return { speed: +Math.hypot(car.vx, car.vy).toFixed(1), sparks: car.rimSparks,
          dirt: (car.dragSpray || []).map(Boolean) };
      });
      await page.keyboard.up('KeyW');
      console.log(width, ground, JSON.stringify(state), JSON.stringify(after),
        errors.length ? 'ERRORS ' + errors.join(' | ') : 'errors none');
      await page.close();
    }
} finally { await browser.close(); server.stop(); }
