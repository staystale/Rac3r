// _hwbale.mjs - the highway's field bales (highway/fields.ts addBale): how many are loose objects,
// and a hit at SPEED m/s into the nearest: does it burst (straw) and how hard was the car's stop.
// node tools/scratch/_hwbale.mjs [query] [speed]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [query = 'hwbales=1', speedArg = '25'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&${query}`);
  await page.mouse.click(200, 300);
  await page.waitForTimeout(1500);
  const res = await page.evaluate(async (speed) => {
    const g = window.__game;
    g.launch('highway', g.car.spec.id, {});
    await new Promise((done) => setTimeout(done, 2500));
    let bales = [];
    for (let k = 0; k < 40 && !bales.length; k++) {
      bales = g.cones.list.filter((obj) => obj.kind === 'bale');
      if (!bales.length) { g.car.x += Math.cos(g.car.heading) * 150; g.car.y += Math.sin(g.car.heading) * 150; await new Promise((done) => setTimeout(done, 400)); }
    }
    const props = (await import('/src/lab.js')).LEVEL.props.filter((prop) => prop.kind === 'bale').length;
    if (!bales.length) return { loose: 0, props };
    // (the bale moved onto the road ahead of the car: a car put out in the field is reset)
    const bale = bales[0], car = g.car, ahead = 14, h = car.heading;
    bale.x = car.x + Math.cos(h) * ahead; bale.y = car.y + Math.sin(h) * ahead;
    bale.hx = bale.x; bale.hy = bale.y; bale.moved = true;
    g.cones.rebuildGrid();
    car.vx = Math.cos(h) * speed; car.vy = Math.sin(h) * speed;
    const v0 = speed, x0 = bale.x, y0 = bale.y;
    let closest = 99; const startGap = Math.hypot(car.x - bale.x, car.y - bale.y), log = [];
    for (let k = 0; k < 15; k++) { await new Promise((done) => setTimeout(done, 100)); closest = Math.min(closest, Math.hypot(car.x - bale.x, car.y - bale.y)); log.push(Math.round(Math.hypot(car.x - bale.x, car.y - bale.y))); }
    return { startGap: +startGap.toFixed(1), log: log.join(" "), moved: +Math.hypot(bale.x - x0, bale.y - y0).toFixed(2), closest: +closest.toFixed(2), loose: bales.length, props, after: bale.kind, carKmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6), was: Math.round(v0 * 3.6) };
  }, +speedArg);
  console.log(query || '(plain)', JSON.stringify(res));
} finally { await browser.close(); server.stop(); }
