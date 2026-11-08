// _fenceshot.mjs - the player's car set square at a catch fence at a speed (km/h), from the track
// side, photographed as it hits: whether it tore, the shreds thrown, the car's speed and damage.
// node tools/scratch/_fenceshot.mjs [level] [km/h] [fence index]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [level = 'brands-snatch', kmh = '70', pick = '0'] = process.argv.slice(2);
const ZOOM = +(process.env.ZOOM || 0.8);
const server = await startServer();
const browser = await launchBrowser();
try {
  const [viewW, viewH] = (process.env.VIEW || '844x390').split('x').map(Number);
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=${level}`);
  await page.mouse.click(viewW / 2, viewH / 2);
  await page.waitForTimeout(1500);
  await page.evaluate((lv) => window.__game.launch(lv, window.__game.car.spec.id, { ai: 0 }), level);
  await page.waitForTimeout(2500);
  const aim = await page.evaluate(([index, speed]) => {
    const game = window.__game, fences = game.level.barriers.filter((b) => b.kind === 'catchfence');
    const fence = fences[+index % fences.length], mid = Math.floor(fence.pts.length / 2);
    const [ax, ay] = fence.pts[mid - 1], [bx, by] = fence.pts[mid];
    const len = Math.hypot(bx - ax, by - ay), cx = (ax + bx) / 2, cy = (ay + by) / 2;
    let nx = -(by - ay) / len, ny = (bx - ax) / len;
    // from the track's side
    const sub = game.level.subtrack;
    const near = sub.pts.reduce((best, p) => (Math.hypot(p.x - cx, p.y - cy)
      < Math.hypot(best.x - cx, best.y - cy) ? p : best), sub.pts[0]);
    if ((near.x - cx) * nx + (near.y - cy) * ny < 0) { nx = -nx; ny = -ny; }
    const car = game.car, heading = Math.atan2(-ny, -nx), v = speed / 3.6;
    Object.assign(car, { x: cx + nx * 6, y: cy + ny * 6, heading, vx: -nx * v, vy: -ny * v,
      yawRate: 0 });
    return { fences: fences.length, at: [cx.toFixed(1), cy.toFixed(1)] };
  }, [pick, +kmh]);
  console.log(`${aim.fences} catch fences; hitting one at ${aim.at} at ${kmh} km/h`);
  await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), ZOOM);
  let last = 0;
  for (const at of [0.2, 0.4, 0.8, 1.6]) {
    await page.waitForTimeout((at - last) * 1000);
    last = at;
    const state = await page.evaluate(() => {
      const game = window.__game, car = game.car;
      const bits = game.cones.list.filter((o) => o.kind === 'mesh' || o.kind === 'fencepost');
      return `${(Math.hypot(car.vx, car.vy) * 3.6).toFixed(0)} km/h, damage bill `
        + `${(car.dmgBill || 0).toFixed(0)}, shreds ${bits.length}`;
    });
    await page.screenshot({ path: `tools/scratch/_fenceshot-${level}-${kmh}-${at}s.png` });
    console.log(`+${at} s: ${state}`);
  }
  console.log(errors.length ? `ERRORS ${errors.slice(0, 5).join(' | ')}` : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
