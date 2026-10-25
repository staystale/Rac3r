// _oil.mjs - car systems C6 (world/oil.ts) in the real game, ?oil=1: a spill and the grip on it,
// the autopilot driving through it (spread the way it drove), oil beside water in the rain (50:50
// a second), a cracked sump's drip, a crash spill, soaking into gravel; photos 844x390 / 390x844.
// node tools/scratch/_oil.mjs <out folder> [level]
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const out = process.argv[2] || '.';
const level = process.argv[3] || 'castle-cum';
mkdirSync(out, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
let errors = 0;

async function open(size, query = '', weather = { mode: 'dry', season: 2, seed: 4 }) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => { errors++; console.log('PAGE ERROR ' + error.message); });
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&oil=1&dev=1${query}`);
  await page.touchscreen.tap(size.width / 2, size.height / 2);
  await page.waitForTimeout(300);
  await page.evaluate(([id, wx]) => window.__game.launch(id, 'hatch-rwd', { ai: 0, weather: wx }),
    [level, weather]);
  await page.waitForTimeout(2000);
  return { context, page };
}
const oilCount = (page) => page.evaluate(async () => {
  const { wearMap } = await import('/src/world/wear.ts');
  return [...wearMap.values()].filter((cell) => cell.cover === 'oil').length;
});

try {
  // 1 a spill 25 m ahead on the racing line, the grip on it, the autopilot through it for 3 laps
  {
    const { context, page } = await open({ width: 844, height: 390 }, '&autopilot=1');
    const res = await page.evaluate(async () => {
      const game = window.__game, car = game.car, oil = await import('/src/world/oil.ts');
      const wear = await import('/src/world/wear.ts');
      const { shared } = await import('/src/game/state.js');
      shared.settings.autopilot = false;
      const ahead = 25, cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
      let spilled = 0;
      for (let along = -1.5; along <= 1.5; along += 1.5) for (let side = -1.5; side <= 1.5; side += 1.5) {
        if (oil.spillOil(car.x + cosH * (ahead + along) - sinH * side,
          car.y + sinH * (ahead + along) + cosH * side, oil.SPILL_GEN)) spilled++;
      }
      const at = wear.groundAt(car.x + cosH * ahead, car.y + sinH * ahead).surface;
      const dry = wear.groundAt(car.x - cosH * 10, car.y - sinH * 10).surface;
      game.renderer.debugZoom(2.2);
      return { spilled, at: at.id + ' mu ' + at.mu.toFixed(3) + ' under ' + at.under,
        dry: dry.id + ' mu ' + dry.mu.toFixed(3) };
    });
    console.log('SPILL: ' + JSON.stringify(res));
    await page.screenshot({ path: join(out, 'spill-before-land.png') });
    // the car put on the spill, rolling slowly
    await page.evaluate(() => { const car = window.__game.car;
      car.x += Math.cos(car.heading) * 23; car.y += Math.sin(car.heading) * 23;
      car.vx = Math.cos(car.heading) * 3; car.vy = Math.sin(car.heading) * 3; });
    await page.waitForTimeout(800);
    const onIt = await page.evaluate(() => window.__game.car.surface.id + ' '
      + window.__game.car.surface.mu.toFixed(3));
    console.log('car on: ' + onIt);
    await page.screenshot({ path: join(out, 'spill-on-land.png') });
    await page.evaluate(async () => {
      const { shared } = await import('/src/game/state.js');
      shared.settings.autopilot = true;
      window.__game.renderer.debugZoom(1);
    });
    const before = await oilCount(page);
    await page.waitForTimeout(90000);
    console.log(`DRIVE-THROUGH: oil cells ${before} -> ${await oilCount(page)} after 150 s autopilot`);
    await context.close();
  }
  // 2 oil beside water: rain, a spill, 30 s
  {
    const { context, page } = await open({ width: 844, height: 390 }, '&rain=1',
      { mode: 'heavy', season: 2, seed: 4 });
    await page.waitForTimeout(3000);
    await page.evaluate(async () => {
      const car = window.__game.car, oil = await import('/src/world/oil.ts');
      const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
      const wear = await import('/src/world/wear.ts');
      const x0 = car.x + cosH * 8, y0 = car.y + sinH * 8;
      oil.spillOil(x0, y0, oil.SPILL_GEN);
      // a ring of the tyres' water round it (as a leak or meltwater leaves)
      const cx = Math.floor(x0 / wear.WEAR_CELL), cy = Math.floor(y0 / wear.WEAR_CELL);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0]]) {
        const cell = wear.getCell(cx + dx, cy + dy, true);
        if (cell && !cell.cover) { cell.cover = 'wet'; cell.standing = true; cell.current = 'wet';
          wear.wearDirty.push(cell); }
      }
      car.vx = 0; car.vy = 0;
      window.__game.renderer.debugZoom(2.2);
    });
    const counts = [await oilCount(page)];
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(5000); counts.push(await oilCount(page)); }
    console.log('WATER SPREAD (heavy rain, every 5 s): ' + counts.join(' '));
    await page.screenshot({ path: join(out, 'water-spread-land.png') });
    await context.close();
  }
  // 3 a cracked sump at 25 km/h for 60 s; 4 a crash spill; 5 gravel soaks it
  {
    const { context, page } = await open({ width: 390, height: 844 }, '&autopilot=25');
    await page.waitForTimeout(3000);
    await page.evaluate(() => { window.__game.car.oilLeak = 1 / 60; });
    await page.waitForTimeout(62000);
    const drip = await page.evaluate(() => Math.round(window.__game.car.engOil * 100));
    console.log(`SUMP: oil ${drip} %, oil cells ${await oilCount(page)} (a full sump = ~20)`);
    await page.evaluate(() => window.__game.renderer.debugZoom(1.6));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(out, 'sump-port.png') });
    const crash = await page.evaluate(async () => {
      const car = window.__game.car, damage = await import('/src/damage.ts');
      const oil = await import('/src/world/oil.ts'), wear = await import('/src/world/wear.ts');
      const count = () => [...wear.wearMap.values()].filter((cell) => cell.cover === 'oil').length;
      const before = count();
      let spills = 0;
      for (let i = 0; i < 20; i++) {
        const n0 = count();
        // a head-on stop from 70 km/h
        car.vx = 0; car.vy = 0;
        damage.hit(car, Math.cos(car.heading) * 19, Math.sin(car.heading) * 19);
        if (count() > n0) spills++;
        damage.repair(car);
      }
      const gravel = [];
      for (let x = -600; x < 600 && gravel.length < 1; x += 3) for (let y = -600; y < 600; y += 3) {
        if (wear.layersAt(x, y).base === 'gravel') { gravel.push([x, y]); break; }
      }
      const soaked = gravel.length ? !oil.spillOil(gravel[0][0], gravel[0][1], 3) : null;
      return { spills, cells: count() - before, soaked };
    });
    console.log(`CRASH: 20 head-on 70 km/h hits spilled ${crash.spills} times, ${crash.cells} cells;`
      + ` gravel soaked it: ${crash.soaked}`);
    await context.close();
  }
  console.log(`page errors: ${errors}`);
} finally {
  await browser.close();
  server.stop();
}
