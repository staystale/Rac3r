// _hwfieldshots.mjs - ?mudwater=1 on the highway: a hot dry spell part-way (drying 1.0 applied at
// once: blocks whose need is under it dry, the rest stay ploughed mud), the car parked in the
// middle of a ploughed field; photos at 844x390 and 390x844, the frame times there, page errors.
// node tools/scratch/_hwfieldshots.mjs [dryBy]
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const dryBy = +(process.argv[2] || 1);
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of [[844, 390], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3,
      isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const notes = [];
    page.on('pageerror', (error) => notes.push('ERROR ' + error));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&level=highway&mudwater=1`);
    await page.touchscreen.tap(width / 2, height / 2);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd', { ai: 0 }));
    await page.waitForTimeout(4000);
    const where = await page.evaluate(async (amount) => {
      const mud = await import('/src/world/levelmud.ts');
      const blocks = await import('/src/world/fieldblocks.ts');
      const weather = await import('/src/world/weather.ts');
      const game = window.__game;
      weather.WEATHER.trackC = 35; weather.WEATHER.rain = 0; weather.setWetness(0);
      mud.dryLevelMud(amount, { mud: 'dirt' });
      // the nearest field in blocks, the car parked at its edge nearest the road
      const fields = game.level.zones.filter((zone) => zone.blocks);
      fields.sort((first, second) => Math.hypot(first.x - game.car.x, first.y - game.car.y)
        - Math.hypot(second.x - game.car.x, second.y - game.car.y));
      const field = fields[0];
      if (!field) return null;
      const dried = field.blocks.filter((block) => block.art).length;
      const spot = blocks.blockCentre(field, { u0: 0, u1: 0, v0: 0, v1: 0 });
      // the sim paused (the highway puts a car off the road back on it), the camera on the field
      const state = await import('/src/game/state.js');
      state.shared.paused = true;
      game.car.x = spot.x; game.car.y = spot.y; game.car.vx = game.car.vy = 0;
      game.renderer.snap(game.car);
      return `field ${field.w.toFixed(0)} x ${field.h.toFixed(0)} m, ${field.blocks.length} blocks,`
        + ` ${dried} dried; ${fields.length} fields in blocks loaded`;
    }, dryBy);
    console.log(`${width}x${height}: ${where}`);
    const ms = await page.evaluate(async () => {
      const weather = await import('/src/world/weather.ts');
      const times = [];
      let last = performance.now();
      await new Promise((done) => {
        const tick = (now) => {
          weather.WEATHER.trackC = 35;
          times.push(now - last); last = now;
          if (times.length < 240) requestAnimationFrame(tick); else done();
        };
        requestAnimationFrame(tick);
      });
      times.sort((first, second) => first - second);
      return `median ${times[120].toFixed(1)} max ${times[239].toFixed(1)} ms`;
    });
    const file = join(tmpdir(), `hwfield-${width}x${height}.png`);
    await page.screenshot({ path: file });
    console.log(`  frames ${ms}  ${file}`);
    console.log(notes.length ? notes.slice(0, 4).join('\n') : '  no page errors');
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
