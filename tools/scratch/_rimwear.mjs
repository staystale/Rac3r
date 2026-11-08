// _rimwear.mjs - do rims / hubs mark soft ground (owner 11-03: "rims / hubs can mark soft surfaces
// ... that shouldn't be possible")? On Grass Track the player's car gets its FRONT-LEFT tyre on the
// rim and its REAR-LEFT wheel torn off (corners 1 and 3, the +y side), then drives 4 s with a
// slide; counts the new wear cells under each SIDE's wheels and shoots the marks.
// node tools/scratch/_rimwear.mjs [query]
import { startServer, launchBrowser } from '../lib/browser.mjs';
const q = process.argv[2] || '';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 751 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + `/?touch=1&guide=0&menu=0&rules=0&level=grass-track${q}`);
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.evaluate(() => window.__game.launch('grass-track', 'hatch-fwd', { ai: 0, laps: 9 }));
  await page.waitForTimeout(1500); await page.touchscreen.tap(220, 375); await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const game = window.__game, car = game.car, wear = await import('/src/world/wear.ts');
    const wheels = await import('/src/world/wheels.ts');
    car.onRim = car.onRim || [false, false, false, false];
    car.onRim[1] = true;                       // front, +y side: on the rim
    car.wheelOff = car.wheelOff || [false, false, false, false];
    car.wheelOff[3] = true;                    // rear, +y side: gone
    const seen = { left: new Set(), right: new Set() };
    let t = 0;
    game.input.update = () => ({ steer: t > 1.5 ? 0.6 : 0, throttle: 0.8, brake: 0, handbrake: t > 2 ? 1 : 0, reverse: 0, shiftUp: false, shiftDown: false });
    const before = new Set([...wear.wearMap.values()].filter((c) => c.passes > 0));
    for (let i = 0; i < 40; i++) {
      await new Promise((res) => setTimeout(res, 100)); t += 0.1;
      const w = wheels.carWheels(car);
      // carWheels: 0 FL +y, 1 FR -y, 2 RL +y, 3 RR -y
      for (const [idx, side] of [[0, 'left'], [2, 'left'], [1, 'right'], [3, 'right']]) {
        const c = wear.wearMap.get(wear.wearKey(Math.floor(w[idx].x / wear.WEAR_CELL), Math.floor(w[idx].y / wear.WEAR_CELL)));
        if (c && c.passes > 0 && !before.has(c)) seen[side].add(c);
      }
    }
    game.input.update = () => ({ steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false });
    const sum = (set) => [...set].filter((c) => c.base !== c.orig).length;
    return { left: seen.left.size, right: seen.right.size, lp: sum(seen.left), rp: sum(seen.right), ground: wear.groundSurfaceAt(car.x, car.y).id };
  });
  await page.waitForTimeout(1200);
  const name = `tools/scratch/_rimwear${q ? '-on' : '-off'}.png`;
  await page.screenshot({ path: name });
  console.log(`${q || 'plain'}: worn cells under the LEFT wheels (rim + hub) ${r.left} cells / ${r.lp} worn down a grade, RIGHT (tyres) ${r.right} / ${r.rp}; ground ${r.ground}; ${name}`, errs[0] || '');
} finally { await browser.close(); srv.stop(); }
