// _garageshot.mjs - phone-size shot: the player driven into the BACK of Brands Snatch's garage row
// with ?pitsolid=1 (it should stop at the wall drawn).
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + '/?touch=1&guide=0&menu=0&rules=0&level=brands-snatch&pitsolid=1');
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.evaluate(() => window.__game.launch('brands-snatch', 'hatch-fwd', { ai: 0 }));
  await page.waitForTimeout(1500); await page.mouse.click(195, 422); await page.waitForTimeout(800);
  const at = await page.evaluate(() => {
    const game = window.__game, row = game.level.props.find((prop) => prop.kind === 'garagerow');
    const i = Math.round(row.back.length * 0.55), [bx, by] = row.back[i], [fx, fy] = row.front[i];
    const len = Math.hypot(fx - bx, fy - by), nx = (fx - bx) / len, ny = (fy - by) / len;
    Object.assign(game.car, { x: bx - nx * 9, y: by - ny * 9, heading: Math.atan2(ny, nx),
      vx: nx * 10, vy: ny * 10, yawRate: 0 });
    game.input.update = () => ({ steer: 0, throttle: 0.35, brake: 0, handbrake: 0, reverse: 0,
      shiftUp: false, shiftDown: false });
    window.__probe = { bx, by, nx, ny };
    return { bx, by };
  });
  await page.waitForTimeout(2500);
  const depth = await page.evaluate(() => { const p = window.__probe, car = window.__game.car;
    return +((car.x - p.bx) * p.nx + (car.y - p.by) * p.ny).toFixed(1); });
  await page.screenshot({ path: 'tools/scratch/_garage-back.png' });
  console.log('car centre past the back face', depth, 'm;', errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }
