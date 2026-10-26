// _debris.mjs - car systems C7 (world/debris.ts) in the real game: head-on hits knock
// parts off (count, kinds) and break glass (cells); 30 parts -> the cap fades the oldest out;
// glass ahead of the autopilot is swept (cells cleared, punctures over many sweeps); photos of
// parts and glass beside the stopped car, 844x390 and 390x844.
// node tools/scratch/_debris.mjs <photo folder> [level]
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const out = process.argv[2] || '.';
const level = process.argv[3] || 'castle-cum';
mkdirSync(out, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
let errors = 0;

async function open(size) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => { errors++; console.log('PAGE ERROR ' + error.message); });
  await gotoGame(page,
    `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=25`);
  await page.touchscreen.tap(size.width / 2, size.height / 2);
  await page.waitForTimeout(300);
  await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }), level);
  await page.waitForTimeout(5000);
  return { context, page };
}

try {
  {
    const { context, page } = await open({ width: 844, height: 390 });
    const res = await page.evaluate(async () => {
      const game = window.__game, car = game.car, damage = await import('/src/damage.ts');
      const wear = await import('/src/world/wear.ts');
      const glass = () => [...wear.wearMap.values()].filter((cell) => cell.cover === 'glass').length;
      const parts = () => game.cones.list.filter((obj) => obj.part);
      const kinds = {};
      let hits = 0;
      // 12 hits from 50 km/h, each mended after (so every corner can lose a part again)
      for (let i = 0; i < 12; i++) {
        const ang = car.heading + [0, Math.PI / 2, 0.6, Math.PI][i % 4];
        car.vx = 0; car.vy = 0;
        damage.hit(car, Math.cos(ang) * 14, Math.sin(ang) * 14);
        hits++;
        await new Promise((done) => setTimeout(done, 120));
        damage.repair(car);
      }
      for (const obj of parts()) kinds[obj.kind] = (kinds[obj.kind] || 0) + 1;
      const first = { hits, parts: parts().length, kinds, glass: glass() };
      // the cap: more hits until 30 parts were made, then 3 s
      for (let i = 0; i < 40 && parts().length < 30; i++) {
        car.vx = 0; car.vy = 0;
        damage.hit(car, Math.cos(car.heading) * 20, Math.sin(car.heading) * 20);
        await new Promise((done) => setTimeout(done, 60));
        damage.repair(car);
      }
      const made = parts().length, fading = parts().filter((obj) => obj.fading).length;
      await new Promise((done) => setTimeout(done, 3500));
      return { first, made, fading, after: parts().length };
    });
    console.log('HITS: ' + JSON.stringify(res));
    await context.close();
  }
  {
    // glass swept by the autopilot: 5 cells across the road ahead, 20 times
    const { context, page } = await open({ width: 844, height: 390 });
    const res = await page.evaluate(async () => {
      const car = window.__game.car, wear = await import('/src/world/wear.ts');
      let laid = 0, swept = 0, punctures = 0;
      for (let round = 0; round < 20; round++) {
        const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading), mine = [];
        for (let side = -3; side <= 3; side += 1.5) {
          const x = car.x + cosH * 20 - sinH * side, y = car.y + sinH * 20 + cosH * side;
          const cell = wear.getCell(Math.floor(x / wear.WEAR_CELL), Math.floor(y / wear.WEAR_CELL),
            true);
          if (cell && !cell.cover) {
            cell.cover = 'glass'; cell.current = 'glass'; wear.wearDirty.push(cell);
            mine.push(cell); laid++;
          }
        }
        const leaksBefore = (car.tyreLeak || []).filter((leak) => leak > 0).length;
        await new Promise((done) => setTimeout(done, 5000));
        swept += mine.filter((cell) => cell.cover !== 'glass').length;
        punctures += (car.tyreLeak || []).filter((leak) => leak > 0).length - leaksBefore;
        const damage = await import('/src/damage.ts');
        damage.repair(car);
      }
      return { laid, swept, punctures };
    });
    console.log('GLASS SWEPT: ' + JSON.stringify(res));
    await context.close();
  }
  for (const size of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    const { context, page } = await open(size);
    await page.evaluate(async () => {
      const game = window.__game, car = game.car, damage = await import('/src/damage.ts');
      const { shared } = await import('/src/game/state.js');
      shared.settings.autopilot = false;
      for (let i = 0; i < 3; i++) {
        const ang = car.heading + [0, Math.PI / 2, 0.6][i];
        car.vx = 0; car.vy = 0;
        damage.hit(car, Math.cos(ang) * 16, Math.sin(ang) * 16);
        await new Promise((done) => setTimeout(done, 150));
      }
      car.vx = 0; car.vy = 0;
      game.renderer.debugZoom(2.2);
    });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(out, `debris-${size.width}x${size.height}.png`) });
    await context.close();
  }
  console.log(`page errors: ${errors}`);
} finally {
  await browser.close();
  server.stop();
}
