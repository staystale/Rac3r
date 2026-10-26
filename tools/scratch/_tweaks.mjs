// _tweaks.mjs - oil wearing away and glass pops measured in the game's own modules: 50 crash-strength
// oil spills each driven over 20 times (cells left, spreads), and 400 tyre passes over glass
// (punctures: pops vs slow leaks).
// node tools/scratch/_tweaks.mjs [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const query = process.argv[2] || '';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1${query}`);
  await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
  await page.waitForTimeout(2500);
  const res = await page.evaluate(async () => {
    const car = window.__game.car, oil = await import('/src/world/oil.ts');
    const wear = await import('/src/world/wear.ts'), pass = await import('/src/world/pass.ts');
    const debris = await import('/src/world/debris.ts');
    const W = wear.WEAR_CELL, oilAt = (x, y) => {
      const cell = wear.wearMap.get(wear.wearKey(Math.floor(x / W), Math.floor(y / W)));
      return cell && cell.cover === 'oil' ? cell : null;
    };
    const countOil = () => [...wear.wearMap.values()].filter((cell) => cell.cover === 'oil').length;
    // oil: spills 30 m apart along +x from the car, a car's wheel driving +x over each 20 times
    let spills = 0;
    const cars = { vx: 1, vy: 0 };
    for (let i = 0; i < 50; i++) {
      const x = car.x + 40 + i * 30, y = car.y;
      if (oil.spillOil(x, y, oil.SPILL_GEN)) spills++;
    }
    const before = countOil();
    for (let round = 0; round < 20; round++) {
      for (let i = 0; i < 50; i++) {
        const cell = oilAt(car.x + 40 + i * 30, car.y);
        pass.notePass(cars, 0, 1, 0);
        if (cell) oil.passOilCell(cell);
      }
    }
    let originalsLeft = 0;
    for (let i = 0; i < 50; i++) if (oilAt(car.x + 40 + i * 30, car.y)) originalsLeft++;
    const oilRes = { spills, before, after: countOil(), originalsLeft };
    // glass: 400 passes over fresh glass cells, the burst read straight off the car
    let pops = 0, slow = 0;
    const tyreCar = { vx: 1, vy: 0, burstTyre: -1, burstSlow: false };
    for (let i = 0; i < 400; i++) {
      const cell = wear.getCell(Math.floor((car.x - 60) / W) - i, Math.floor((car.y + 60) / W), true);
      if (!cell) continue;
      cell.cover = 'glass';
      tyreCar.burstTyre = -1;
      pass.notePass(tyreCar, 0, 1, 0);
      debris.passGlassCell(cell);
      if (tyreCar.burstTyre >= 0) { if (tyreCar.burstSlow) slow++; else pops++; }
    }
    return { oil: oilRes, glass: { passes: 400, slow, pops } };
  });
  console.log(`${query || '(no switches)'}: ${JSON.stringify(res)}`);
} finally {
  await browser.close();
  server.stop();
}
