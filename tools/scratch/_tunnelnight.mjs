// _tunnelnight.mjs - A CAR IN A TUNNEL AT NIGHT, its lights (render/light.ts clipToCut): the level
// (LEVEL) at night, its first tunnel (or, on the highway with ?roadtunnels=1, the first one
// driven to); the car set still with its lights on in the open cut, going in (a third of the cut
// from end A, nose toward B) and coming out (a third of the cut from end B, nose out past it); a
// photo of each.
// [LEVEL=brands-snatch] [VIEW=844x390] [TAG=after] [Q=] node tools/scratch/_tunnelnight.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [width, height] = (process.env.VIEW || '844x390').split('x').map(Number);
const LEVEL_ID = process.env.LEVEL || 'brands-snatch', TAG = process.env.TAG || 'after';
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (err) => errors.push(err.message));
  const highway = LEVEL_ID === 'highway';
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&night=0.9`
    + `${highway ? '&autopilot=1&roadtunnels=1' : ''}${process.env.Q || ''}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate(([id, isHighway]) => window.__game.launch(id, 'hatch-rwd', isHighway
    ? { ai: 0, road: 'motorway', scenery: 'countryside', traffic: 0 } : { ai: 0 }),
  [LEVEL_ID, highway]);
  await page.waitForTimeout(3000);
  // the tunnel: the first (the highway: the first within 300 m ahead, driven to)
  let way = null;
  for (let waited = 0; waited < (highway ? 400 : 1) && !way; waited++) {
    way = await page.evaluate((isHighway) => {
      const game = window.__game, car = game.car;
      const index = (game.level.crossings || []).findIndex((item) => item.kind === 'tunnel'
        && (!isHighway || Math.hypot(item.ax - car.x, item.ay - car.y) < 300));
      return index < 0 ? null : { index, ...game.level.crossings[index], walls: undefined,
        hidden: undefined };
    }, highway);
    if (!way && highway) await page.waitForTimeout(500);
  }
  if (!way) throw new Error('no tunnel found');
  console.log(`tunnel ${way.index}: ${way.length.toFixed(0)} m, open cuts ${way.cut.toFixed(1)} m`);
  await page.evaluate(() => window.__game.setAutopilot?.(false));
  for (const [name, along, nose] of [['in', way.cut / 3, 1], ['out', way.length - way.cut / 3,
    1]]) {
    await page.evaluate(([item, at, dir]) => {
      // (a bent tunnel: on its road line, which starts and ends on the A-B line)
      const game = window.__game, car = game.car, mid = item.mouth ? 0 : (item.minAcross
        + item.maxAcross) / 2;
      car.x = item.ax + item.dirX * at - item.dirY * mid;
      car.y = item.ay + item.dirY * at + item.dirX * mid;
      car.heading = Math.atan2(item.dirY * dir, item.dirX * dir);
      car.vx = car.vy = car.yawRate = 0;
      car.crossing = item.index;
      car.lightsOn = true;
      game.renderer?.snap?.(car);
    }, [way, along, nose]);
    await page.keyboard.down('Space');
    await page.waitForTimeout(1200);
    await page.keyboard.up('Space');
    const state = await page.evaluate(() => ({ crossing: window.__game.car.crossing,
      lights: window.__game.car.lightsOn }));
    const path = `tools/scratch/_tunnel-${LEVEL_ID}-${name}-${width}x${height}-${TAG}.png`;
    await page.screenshot({ path });
    console.log('photo', path, JSON.stringify(state));
  }
} finally {
  await browser.close();
  server.stop();
  console.log(errors.length ? 'PAGE ERRORS:\n  ' + errors.join('\n  ') : 'no page errors');
}
