// _bushshot.mjs - a car driven through a bush, photographed (owner 11-03: "tyre marks seem to go
// over bushes they shouldn't"; "bushes should pop in a little burst of green leaf like pixels").
// Finds a bush patch near the start of a level (ground 'bush'), puts the player's car 14 m before
// it aimed through its middle, drives through at ~50 km/h, and shoots mid-bush and after.
// node tools/scratch/_bushshot.mjs [query] [level]
import { startServer, launchBrowser } from '../lib/browser.mjs';
const q = process.argv[2] || '', level = process.argv[3] || 'killder';
const tag = (q.match(/[a-z]+=1/g) || ['plain']).join('-').replace(/=1/g, '');
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 751 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + `/?touch=1&guide=0&menu=0&rules=0&level=${level}${q}`);
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.evaluate((lv) => window.__game.launch(lv, 'hatch-fwd', { ai: 0, laps: 9 }), level);
  await page.waitForTimeout(1500); await page.touchscreen.tap(220, 375); await page.waitForTimeout(1000);
  const found = await page.evaluate(async () => {
    const game = window.__game, car = game.car, wear = await import('/src/world/wear.ts');
    const veh = await import('/src/vehicle.ts');
    // the nearest bush cell to the car, then that patch's middle (its bush cells' mean)
    let best = null;
    for (let r = 4; r < 220 && !best; r += 2) {
      for (let a = 0; a < 64 && !best; a++) {
        const x = car.x + Math.cos(a / 64 * Math.PI * 2) * r, y = car.y + Math.sin(a / 64 * Math.PI * 2) * r;
        if (wear.groundSurfaceAt(x, y).id === 'bush') best = { x, y };
      }
    }
    if (!best) return null;
    let sx = 0, sy = 0, n = 0;
    for (let dx = -4; dx <= 4; dx += 0.5) for (let dy = -4; dy <= 4; dy += 0.5)
      if (wear.groundSurfaceAt(best.x + dx, best.y + dy).id === 'bush') { sx += best.x + dx; sy += best.y + dy; n++; }
    const mid = { x: sx / n, y: sy / n };
    // approach from the side the car was on
    const h = Math.atan2(mid.y - car.y, mid.x - car.x);
    veh.reset(car, mid.x - Math.cos(h) * 14, mid.y - Math.sin(h) * 14, h);
    car.vx = Math.cos(h) * 14; car.vy = Math.sin(h) * 14;
    game.input.update = () => ({ steer: 0, throttle: 0.5, brake: 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false });
    window.__st0 = game.marks.stamps;
    return { mid, cells: n };
  });
  if (!found) { console.log('no bush found near the start'); process.exit(0); }
  for (const [wait, n] of [[800, 1], [250, 2], [300, 3], [450, 4]]) {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `tools/scratch/_bush-${tag}-in${n}.png` });
    await page.screenshot({ path: `tools/scratch/_bush-${tag}-zoom${n}.png`, clip: { x: 150, y: 330, width: 180, height: 180 } });
  }
  await page.evaluate(() => { window.__game.input.update = () => ({ steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false }); });
  await page.waitForTimeout(1600);
  await page.evaluate((m) => { const car = window.__game.car; window.__dist = Math.hypot(car.x - m.x, car.y - m.y); }, found.mid);
  await page.screenshot({ path: `tools/scratch/_bush-${tag}-after.png` });
  found.stamps = await page.evaluate(() => window.__game.marks.stamps - window.__st0);
  console.log(`${level} ${q || 'plain'}: bush of ${found.cells} half-metre squares; mark stamps over the run ${found.stamps}; shots _bush-${tag}-in/-after.png`, errs[0] || '');
} finally { await browser.close(); srv.stop(); }
