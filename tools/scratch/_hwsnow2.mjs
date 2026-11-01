// _hwsnow2.mjs - K6 probe 2: highway snow race, what lies and who makes worn cells. Every 5 s:
// the weather, the ground under you and each AI, worn cells in all and near each AI.
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=90${process.argv[2] || ""}`);
  await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd',
    { ai: 3, weather: { mode: 'snow', season: 0, seed: 5 } }));
  await page.mouse.click(420, 200);
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(5000);
    console.log(await page.evaluate(async () => {
      const w = await import('/src/world/wear.ts'), { WEATHER } = await import('/src/world/weather.ts');
      const g = window.__game, cars = [g.car, ...g.ai.map((e) => e.car)];
      const worn = [...w.wearMap.values()].filter((c) => c.current !== c.orig);
      const near = (car) => worn.filter((c) => Math.hypot((c.cx + 0.5) * 1.5 - car.x, (c.cy + 0.5) * 1.5 - car.y) < 40).length;
      return `snow ${WEATHER.snow.toFixed(2)} kind ${WEATHER.kind} cells ${w.wearMap.size} worn ${worn.length} | `
        + cars.map((car, k) => `${k ? 'ai' + k : 'you'} ${car.surface.id} d${Math.round(Math.hypot(car.x - g.car.x, car.y - g.car.y))} n${near(car)}`).join(', ');
    }));
  }
} finally { await browser.close(); server.stop(); }
