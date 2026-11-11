// _bridgeshot.mjs - THE ENDLESS ROAD'S DRIVABLE BRIDGES (?drivebridges=1) in the real game: the
// autopilot drives the road (ROAD, SCENERY) until a drivable bridge has loaded ahead, a photo as it
// passes under it, then the car is set on the bridge's approach and driven over by its own physics
// (the autopilot off), a photo on the deck and one past it; the crossing the car was on at each.
// [ROAD=motorway] [SCENERY=countryside] [VIEW=390x844] [Q=] node tools/scratch/_bridgeshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const ROAD = process.env.ROAD || 'motorway', SCENERY = process.env.SCENERY || 'countryside';
const tag = `${SCENERY}-${ROAD}-${width}x${height}`;
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + `&drivebridges=1&desertroads=1${process.env.Q || ''}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate(([road, scenery, density]) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road, scenery, traffic: density }), [ROAD, SCENERY, +(process.env.TRAFFIC || 0)]);
  // drive on until a drivable bridge is within 260 m ahead (still ahead once photographed)
  let way = null;
  for (let waited = 0; waited < 240 && !way; waited += 0.5) {
    way = await page.evaluate(() => {
      const game = window.__game, car = game.car;
      for (const [index, item] of (game.level.crossings || []).entries()) {
        if (!item.length) continue;
        const midX = item.ax + item.dirX * item.length / 2, midY = item.ay + item.dirY
          * item.length / 2, gap = Math.hypot(midX - car.x, midY - car.y);
        const ahead = (midX - car.x) * car.vx + (midY - car.y) * car.vy > 0;
        if (gap < 260 && ahead) return { index, ...item, walls: undefined };
      }
      return null;
    });
    if (!way) await page.waitForTimeout(500);
  }
  if (!way) throw new Error('no drivable bridge reached');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `tools/scratch/_bridge-under-${tag}.png` });
  // on its approach, 20 m out from end A, heading along it at 8 m/s; the autopilot off
  const result = await page.evaluate((item) => {
    const game = window.__game, car = game.car, mid = (item.minAcross + item.maxAcross) / 2;
    game.setAutopilot(false);
    car.x = item.ax - item.dirX * 20 - item.dirY * mid;
    car.y = item.ay - item.dirY * 20 + item.dirX * mid;
    car.heading = Math.atan2(item.dirY, item.dirX);
    car.vx = item.dirX * 8;
    car.vy = item.dirY * 8;
    car.crossing = -1;
    // (straight: no turn left from the autopilot)
    car.yawRate = 0;
    car.delta = 0;
    car.crossX = car.x;
    car.crossY = car.y;
    return { x: car.x, y: car.y };
  }, way);
  // the throttle held (W) the whole way over
  await page.keyboard.down('KeyW');
  // (PROBE=1: the car each 100 ms - along / across the way, speed, what it hit)
  if (process.env.PROBE) for (let tick = 0; tick < 60; tick++) {
    const row = await page.evaluate((item) => {
      const car = window.__game.car, along = (car.x - item.ax) * item.dirX + (car.y - item.ay)
        * item.dirY, across = (car.y - item.ay) * item.dirX - (car.x - item.ax) * item.dirY;
      const hit = car._hitKind || '';
      car._hitKind = null;
      return `${along.toFixed(1)} ${across.toFixed(2)} ${(Math.hypot(car.vx, car.vy) * 3.6)
        .toFixed(0)} km/h on ${car.crossing} ${hit}`;
    }, way);
    console.log(row);
    await page.waitForTimeout(100);
  }
  const seen = [];
  for (const wait of [2600, 3200]) {
    await page.waitForTimeout(wait);
    seen.push(await page.evaluate(() => {
      const car = window.__game.car;
      return { crossing: car.crossing, kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6) };
    }));
    await page.screenshot({ path: `tools/scratch/_bridge-${seen.length === 1 ? 'deck' : 'past'}-${tag}.png` });
  }
  console.log(`${tag}: bridge ${way.index} ${way.length.toFixed(1)} m, set at`
    + ` ${JSON.stringify(result)}; on the deck ${JSON.stringify(seen[0])}, past it`
    + ` ${JSON.stringify(seen[1])}; errors ${errors.length ? errors.join(' | ') : 'none'}`);
} finally {
  await browser.close();
  server.stop();
}
