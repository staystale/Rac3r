// _trainnight.mjs - A RAIL BRIDGE'S TRAIN AT NIGHT (?trainlights=1: render/eventglows.ts
// trainLights): the endless road (SCENERY: countryside's passenger trains, canyon's freights) at
// night, the autopilot driven until a rail bridge is within 120 m ahead, then the car put 20 m
// short of it and held; a photo once its train's leading car is over the deck, and one a second
// later (seed 1: a rail bridge in the first 0.8 km on both sceneries' motorway).
// [SCENERY=countryside] [SEED=1] [VIEW=844x390] [TAG=on] [Q=&trainlights=1] node tools/scratch/_trainnight.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [width, height] = (process.env.VIEW || '844x390').split('x').map(Number);
const SCENERY = process.env.SCENERY || 'countryside', TAG = process.env.TAG || 'on';
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + `&night=0.9${process.env.Q ?? '&trainlights=1'}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate((scenery) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road: 'motorway', scenery, traffic: 0 }), SCENERY);
  // (the road's seed: the level's, the road built again from its start)
  await page.evaluate((seed) => {
    window.__game.level.seed = seed;
    window.__game.restart();
  }, +(process.env.SEED || 1));
  let bridge = null;
  for (let waited = 0; waited < 500 && bridge == null; waited++) {
    bridge = await page.evaluate(() => {
      const game = window.__game, car = game.car;
      const index = game.level.props.findIndex((prop) => prop.kind === 'bridge'
        && prop.carries === 'rail' && Math.hypot(prop.x - car.x, prop.y - car.y) < 120
        && (prop.x - car.x) * car.vx + (prop.y - car.y) * car.vy > 0);
      return index < 0 ? null : index;
    });
    if (bridge == null) await page.waitForTimeout(400);
  }
  if (bridge == null) throw new Error('no rail bridge reached');
  // held still 20 m short of it, in the lane it was in (the bridge's middle is the road's line)
  await page.evaluate((index) => {
    const game = window.__game, car = game.car, prop = game.level.props[index];
    const here = game.level._hw.q;
    game.setAutopilot(false);
    car.x = prop.x - here.dx * 20 - here.dy * here.off;
    car.y = prop.y - here.dy * 20 + here.dx * here.off;
    car.heading = Math.atan2(here.dy, here.dx);
    car.vx = car.vy = car.yawRate = 0;
    game.renderer?.snap?.(car);
  }, bridge);
  await page.keyboard.down('Space');
  let seen = null;
  for (let waited = 0; waited < 300 && !seen; waited++) {
    seen = await page.evaluate(async (index) => {
      const prop = window.__game.level.props[index];
      const { trainAt } = await import('/src/world/trains.ts');
      const { trainClock } = await import('/src/render/props/bridges.ts');
      const train = trainAt(prop, trainClock(prop));
      if (!train) return null;
      const nose = train.cars[0] + (train.dir > 0 ? train.carM : 0);
      return Math.abs(nose) < (prop.wid || 30) / 2 ? { nose, dir: train.dir,
        cars: train.cars.length } : null;
    }, bridge);
    if (!seen) await page.waitForTimeout(100);
  }
  console.log('train:', JSON.stringify(seen));
  for (const name of ['a', 'b']) {
    const path = `tools/scratch/_train-${SCENERY}-${name}-${width}x${height}-${TAG}.png`;
    await page.screenshot({ path });
    console.log('photo', path);
    await page.waitForTimeout(1000);
  }
  await page.keyboard.up('Space');
} finally {
  await browser.close();
  server.stop();
  console.log(errors.length ? 'PAGE ERRORS:\n  ' + errors.join('\n  ') : 'no page errors');
}
