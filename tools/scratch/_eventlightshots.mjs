// _eventlightshots.mjs - ?eventlights=1 photos at ?night=0.8 (844x390): on each level, the camera
// put on each new light (a grandstand's festoon, a marshal beacon, a backlit board, the pits, the
// start gantry, the busy corners' floodlights on their tyre rings, a caravan, a stage village,
// a rally stage's fairy lights)
// and photographed; prints how many of each the level has and any page error.
// node tools/scratch/_eventlightshots.mjs <out folder> [level ...]
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const out = process.argv[2] || '.';
const levels = process.argv.slice(3).length ? process.argv.slice(3)
  : ['brands-snatch', 'knobhill', 'grass-track', 'gen-forest-medium-mixed-1001'];
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const level of levels) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 },
      deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log('ERROR ' + error));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&eventlights=1&night=0.8`);
    await page.touchscreen.tap(422, 195);
    await page.waitForTimeout(400);
    await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd',
      { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }), level);
    await page.waitForTimeout(3000);
    const targets = await page.evaluate(async () => {
      const state = await import('/src/world/state.ts');
      const plan = await import('/src/world/lampplan.ts');
      const lamps = await import('/src/world/lamps.ts');
      const first = (kind) => (state.PROPS || []).find((prop) => prop.kind === kind);
      const list = [];
      plan.stageFairyLights(state.LEVEL).slice(0, 2).forEach(([[ax, ay], [bx, by]], i) =>
        list.push({ name: `fairy${i}`, x: (ax + bx) / 2, y: (ay + by) / 2 }));
      for (const kind of ['grandstand', 'stadium_grandstand', 'marshal', 'board', 'gantry',
        'pit_wall']) {
        const prop = first(kind);
        if (prop) list.push({ name: kind, x: prop.x, y: prop.y });
      }
      const pits = first('garagerow');
      if (pits && pits.front) {
        const mid = pits.front[Math.floor(pits.front.length / 2)];
        list.push({ name: 'garagerow', x: mid[0], y: mid[1] });
      }
      plan.cornerSpots(state.LEVEL).forEach((spot, i) => list.push({ name: `corner${i}`, ...spot }));
      const caravan = window.__game.cones.list.find((cone) => cone.kind === 'caravan');
      if (caravan) list.push({ name: 'caravan', x: caravan.x, y: caravan.y });
      if (state.LEVEL.gen) {
        const street = lamps.activeLamps().filter((lamp) => lamp.kind === 'street');
        if (street.length) list.push({ name: 'village', x: street[0].x, y: street[0].y });
      }
      const counts = {};
      for (const prop of state.PROPS || []) counts[prop.kind] = (counts[prop.kind] || 0) + 1;
      return { list, lamps: lamps.activeLamps().length, corners: plan.cornerSpots(state.LEVEL).length,
        tyres: plan.cornerTyres(state.LEVEL).length };
    });
    console.log(level, `lamps ${targets.lamps}, corners ${targets.corners}, ring tyres ${targets.tyres}`);
    for (const target of targets.list.slice(0, 7)) {
      await page.evaluate((spot) => {
        const car = window.__game.car;
        car.x = spot.x + 12; car.y = spot.y + 12; car.vx = 0; car.vy = 0;
        window.__game.renderer.debugZoom(0.7);
      }, target);
      await page.waitForTimeout(1300);
      const name = `event-${level.slice(0, 12)}-${target.name}.png`;
      await page.screenshot({ path: join(out, name) });
      console.log('  photo', name);
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
