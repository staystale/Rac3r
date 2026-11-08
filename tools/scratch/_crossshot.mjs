// _crossshot.mjs - the player's car rolled onto each bridge / into each tunnel of a level
// (?crossings=1) at phone size, with AI cars on the track: shots as it comes on, mid-way and as it
// leaves: _crossshot-<level>-<index>-<step>.png. node tools/scratch/_crossshot.mjs <level>
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [level = 'brands-snatch', query = 'crossings=1'] = process.argv.slice(2);
const ZOOM = +(process.env.ZOOM || 0.7), SPEED = +(process.env.SPEED || 11);
// SKID=rad: the car turned that far off its line (it slides in, laying marks); TIMES=s,s,...
const SKID = +(process.env.SKID || 0), TIMES = process.env.TIMES || '';
// START=m: along the way the car starts (default 6 m before end A); ONLY=index: one crossing
const START = process.env.START, ONLY = process.env.ONLY;
const server = await startServer();
const browser = await launchBrowser();
try {
  const [viewW, viewH] = (process.env.VIEW || '844x390').split('x').map(Number);
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=${level}&${query}`);
  await page.mouse.click(viewW / 2, viewH / 2);
  await page.waitForTimeout(1500);
  await page.evaluate(([lv, ai]) => window.__game.launch(lv, window.__game.car.spec.id, { ai: +ai }),
    [level, process.env.AI || '4']);
  await page.waitForTimeout(2500);
  const ways = await page.evaluate(() => (window.__game.level.crossings || []).map((way) =>
    ({ kind: way.kind, ax: way.ax, ay: way.ay, dirX: way.dirX, dirY: way.dirY,
      length: way.length, mid: (way.minAcross + way.maxAcross) / 2 })));
  console.log(`${ways.length} crossings`);
  for (const [index, way] of ways.entries()) {
    // set 6 m out from end A on the middle of the way, rolling in
    if (ONLY !== undefined && index !== +ONLY) continue;
    await page.evaluate(({ way: w, speed, skid, start, leak }) => {
      const car = window.__game.car, heading = Math.atan2(w.dirY, w.dirX);
      const at = start === undefined ? -6 : +start;
      const x = w.ax + w.dirX * at - w.dirY * w.mid, y = w.ay + w.dirY * at + w.dirX * w.mid;
      // LEAK=1: the radiator and sump cracked as a bad crash does (water out in 40 s, oil in 60 s)
      if (leak) Object.assign(car, { engLeak: 1 / 40, oilLeak: 1 / 60, engWater: 1, engOil: 1 });
      Object.assign(car, { x, y, heading: heading + skid, vx: Math.cos(heading) * speed,
        vy: Math.sin(heading) * speed, yawRate: 0, crossing: at < 0 ? -1 : w.index, crossX: x,
        crossY: y });
    }, { way: { ...way, index }, speed: SPEED, skid: SKID, start: START, leak: !!process.env.LEAK });
    await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), ZOOM);
    let last = 0;
    const times = TIMES ? TIMES.split(',').map(Number) : [0.9, (way.length / 2 + 6) / SPEED,
      (way.length + 6) / SPEED - 0.5, (way.length + 9) / SPEED];
    for (const at of times) {
      await page.waitForTimeout(Math.max(50, (at - last) * 1000));
      last = at;
      const state = await page.evaluate(() => {
        const car = window.__game.car;
        return `crossing ${car.crossing} at ${car.x.toFixed(1)},${car.y.toFixed(1)} `
          + `${Math.hypot(car.vx, car.vy).toFixed(1)} m/s`;
      });
      const name = `tools/scratch/_crossshot-${level}-${index}-${at.toFixed(2)}s-${viewW}x${viewH}.png`;
      await page.screenshot({ path: name });
      console.log(`${way.kind} ${index} +${at.toFixed(1)} s: ${state}`);
    }
  }
  console.log(errors.length ? `ERRORS ${errors.slice(0, 5).join(' | ')}` : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
