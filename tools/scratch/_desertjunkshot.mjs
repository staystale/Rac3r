// _desertjunkshot.mjs - DEAF VALLEY'S JUNK IN THE GAME (?desertjunk=1): the autopilot down the
// canyon road (ROAD, default dual) for SECONDS at phone size; every quarter second the tumbleweed:
// how many a gust has taken, how many crossed the road within VIEW m of the car (seen crossing),
// how many burst; phone shots when one blows within 35 m of the car, and at the first shack and
// the first heap of drums near it. The frame rate (the HUD's) and page errors printed.
// [SECONDS=90] [ROAD=dual] [VIEW=90] node tools/scratch/_desertjunkshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const SECONDS = +(process.env.SECONDS || 90), ROAD = process.env.ROAD || 'dual',
  VIEW = +(process.env.VIEW || 90);
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + '&desertjunk=1');
  await page.mouse.click(195, 422);
  await page.waitForTimeout(800);
  await page.evaluate((road) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road, scenery: 'canyon' }), ROAD);
  await page.waitForTimeout(1500);
  const shots = { weed: 0, shack: 0, heap: 0 };
  let fpsSum = 0, fpsN = 0;
  for (let t = 0; t < SECONDS; t += 0.25) {
    const got = await page.evaluate((view) => {
      const game = window.__game, car = game.car, pts = game.level._hw.pts, hw = game.level._hw
        .geo.hw;
      // signed m off the road's line (+ the road's left normal), by the nearest point
      const offOf = (x, y) => {
        let best = Infinity, off = 0;
        for (let i = 0; i + 1 < pts.length; i++) {
          const dx = x - pts[i].x, dy = y - pts[i].y, dd = dx * dx + dy * dy;
          if (dd < best) {
            best = dd;
            const hx = pts[i + 1].x - pts[i].x, hy = pts[i + 1].y - pts[i].y, len = Math.hypot(hx,
              hy) || 1;
            off = (dx * -hy + dy * hx) / len;
          }
        }
        return off;
      };
      game._weeds = game._weeds || new Map();
      const near = { weed: null, shack: null, heap: null };
      for (const obj of game.cones.list) {
        const dist = Math.hypot(obj.x - car.x, obj.y - car.y);
        if (obj.kind === 'tumbleweed' || (obj.kind === 'twigs' && game._weeds.has(obj._n))) {
          const rec = game._weeds.get(obj._n) || { blown: false, crossed: false, burst: false,
            side: 0 };
          if (obj.kind === 'twigs') rec.burst = true;
          if (obj.blowing) rec.blown = true;
          if (rec.blown && dist < view) {
            const side = Math.sign(offOf(obj.x, obj.y) - 0);
            const onRoad = Math.abs(offOf(obj.x, obj.y)) < hw;
            if (onRoad) rec.onRoad = true;
            if (rec.side && side && side !== rec.side) rec.crossed = true;
            if (side) rec.side = side;
          }
          game._weeds.set(obj._n, rec);
          if (obj.kind === 'tumbleweed' && obj.blowing && dist < 35) near.weed = dist;
        }
        if (obj.kind === 'barrel' && dist < 40) near.heap = dist;
      }
      for (const prop of game.level.props) if (prop.kind === 'shack'
        && Math.hypot(prop.x - car.x, prop.y - car.y) < 60) near.shack = 1;
      const weeds = [...game._weeds.values()];
      return { near, blown: weeds.filter((rec) => rec.blown).length,
        crossed: weeds.filter((rec) => rec.crossed).length,
        onRoad: weeds.filter((rec) => rec.onRoad).length,
        burst: weeds.filter((rec) => rec.burst).length, km: (game.hwDist || 0) / 1000,
        fps: game.fps || null };
    }, VIEW);
    if (got.fps) { fpsSum += got.fps; fpsN++; }
    for (const kind of ['weed', 'shack', 'heap']) {
      if (got.near[kind] !== null && shots[kind] < (kind === 'weed' ? 4 : 1)) {
        shots[kind]++;
        await page.screenshot({ path: `tools/scratch/_desertjunkshot-${kind}${shots[kind]}.png` });
        // (a close-up round the car: what is near it)
        if (kind === 'weed') await page.screenshot({ path: `tools/scratch/_desertjunkshot-${kind}`
          + `${shots[kind]}-near.png`, clip: { x: 20, y: 330, width: 350, height: 350 } });
      }
    }
    if (t + 0.25 >= SECONDS) console.log(`${got.km.toFixed(2)} km in ${SECONDS} s: tumbleweed`
      + ` blown ${got.blown}, crossed the road in view ${got.crossed}, on the road ${got.onRoad},`
      + ` burst ${got.burst} | shots ${JSON.stringify(shots)}`
      + (fpsN ? ` | fps ${(fpsSum / fpsN).toFixed(0)}` : ''));
    await page.waitForTimeout(250);
  }
} finally {
  console.log('page errors:', errors.length ? errors.join(' || ') : 'none');
  await browser.close();
  server.stop();
}
