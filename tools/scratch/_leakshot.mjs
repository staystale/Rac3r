// _leakshot.mjs - are leaked water and spilled oil DRAWN? (owner 11-03: "oil wasn't showing ...
// nor were radiator drips"). Puts a line of oil cells and a line of wet cells (as the sump drip and
// the radiator drip make them) on the road ahead of the player's car, then shoots the phone-size
// screen by day and at night (?night=0.94, the owner's Knobhill run). node tools/scratch/_leakshot.mjs [level]
import { startServer, launchBrowser } from '../lib/browser.mjs';
const level = process.argv[2] || 'knobhill';
const srv = await startServer();
const browser = await launchBrowser();
try {
  for (const night of (process.env.SHOTQ ? [process.env.SHOTQ] : ['', '&night=0.94'])) {
    const ctx = await browser.newContext({ viewport: { width: 440, height: 751 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(srv.url + `/?touch=1&guide=0&menu=0&rules=0&level=${level}${night}`);
    await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
    await page.evaluate((lv) => window.__game.launch(lv, 'hatch-fwd', { ai: 0, laps: 9 }), level);
    await page.waitForTimeout(1500); await page.touchscreen.tap(220, 375); await page.waitForTimeout(1500);
    const info = await page.evaluate(async () => {
      const game = window.__game, car = game.car;
      const oil = await import('/src/world/oil.ts'), wear = await import('/src/world/wear.ts');
      const fx = Math.cos(car.heading), fy = Math.sin(car.heading), sx = -fy, sy = fx;
      let oilN = 0, wetN = 0;
      for (let d = 6; d <= 30; d += 1.5) {
        // oil 2 m to the right of the car's line, water 2 m to the left
        if (oil.spillOil(car.x + fx * d + sx * 2, car.y + fy * d + sy * 2, 2)) oilN++;
        const cell = wear.getCell(Math.floor((car.x + fx * d - sx * 2) / wear.WEAR_CELL), Math.floor((car.y + fy * d - sy * 2) / wear.WEAR_CELL), true);
        if (cell && !cell.fixed && !cell.cover) {
          Object.assign(cell, { cover: 'wet', standing: true, dry: 0, scrub: 0, passes: 0, current: 'wet' });
          wear.wearDirty.push(cell); wetN++;
        }
      }
      return { oilN, wetN, base: wear.groundSurfaceAt(car.x + fx * 10, car.y + fy * 10).id };
    });
    await page.waitForTimeout(1500);
    const name = `tools/scratch/_leakshot-${level}${night ? (night.includes('night') ? '-night' : '-q') : '-day'}.png`;
    await page.screenshot({ path: name });
    console.log(`${name}: oil cells ${info.oilN}, wet cells ${info.wetN}, ground ahead ${info.base}`, errs[0] || '');
    await ctx.close();
  }
} finally { await browser.close(); srv.stop(); }
