// _round2shots.mjs - the second lighting round's photos and checks (844x390): trees (?trees=1) by
// season by day and at night beside a backlit board; a wooden marshal hut (?woodmarshal=1)
// smashed at 15 m/s; hot brakes (?brakeglow=1) after a hard stop at night; a damaged headlight
// (?carlamps=1) sampled for 10 s (flicker, then steady or dead).
// node tools/scratch/_round2shots.mjs <out folder>
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const out = process.argv[2] || '.';
const server = await startServer();
const browser = await launchBrowser();
const SWITCHES = 'trees=1&woodmarshal=1&brakeglow=1&carlamps=1';

async function open(level, extra, season) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&${SWITCHES}${extra}`);
  await page.touchscreen.tap(422, 195);
  await page.waitForTimeout(400);
  await page.evaluate(([id, seasonNo]) => window.__game.launch(id, 'hatch-rwd',
    { ai: 0, weather: { mode: seasonNo === 0 ? 'snow' : 'dry', season: seasonNo, seed: 4 } }),
  [level, season]);
  await page.waitForTimeout(3000);
  return { context, page };
}
const shot = (page, name) => page.screenshot({ path: join(out, name) });
const goTo = (page, kind) => page.evaluate(async (propKind) => {
  const state = await import('/src/world/state.ts');
  const prop = state.PROPS.find((item) => item.kind === propKind);
  const car = window.__game.car;
  car.x = prop.x + 10; car.y = prop.y + 10; car.vx = 0; car.vy = 0;
  window.__game.renderer.debugZoom(0.6);
  return { x: prop.x, y: prop.y };
}, kind);

try {
  for (const [season, name] of [[2, 'summer'], [3, 'autumn'], [0, 'winter']]) {
    const { context, page } = await open('killder', '', season);
    await goTo(page, 'tree');
    await page.waitForTimeout(1500);
    await shot(page, `r2-trees-${name}.png`);
    await context.close();
  }
  {
    const { context, page } = await open('brands-snatch', '&night=0.8', 2);
    await goTo(page, 'board');
    await page.waitForTimeout(1500);
    await shot(page, 'r2-trees-night-board.png');
    // the marshal hut: driven into at 15 m/s
    const hut = await goTo(page, 'marshal');
    const result = await page.evaluate(async (spot) => {
      const car = window.__game.car;
      car.x = spot.x - 12; car.y = spot.y; car.heading = 0; car.vx = 15; car.vy = 0; car.yawRate = 0;
      await new Promise((done) => setTimeout(done, 2000));
      const box = await import('/src/world/marshalbox.ts');
      const state = await import('/src/world/state.ts');
      const prop = state.PROPS.find((item) => item.kind === 'marshal');
      const pallets = window.__game.cones.list.filter((cone) => cone.kind === 'pallet'
        || cone.kind === 'splinters').length;
      return { wrecked: box.isHutWrecked(prop), pallets, carX: car.x - spot.x,
        speed: Math.hypot(car.vx, car.vy).toFixed(1) };
    }, hut);
    console.log('marshal hut at 15 m/s:', JSON.stringify(result));
    await page.evaluate((spot) => {
      const car = window.__game.car;
      car.x = spot.x + 6; car.y = spot.y + 6; car.vx = 0; car.vy = 0;
    }, hut);
    await page.waitForTimeout(1200);
    await shot(page, 'r2-marshal-wrecked.png');
    // hot brakes: 3 s of full braking at 45 m/s held
    await page.evaluate(async () => {
      const car = window.__game.car;
      const hold = setInterval(() => { car.vx = 45; car.vy = 0; car.heading = 0; car.brakeLight = 1; }, 5);
      await new Promise((done) => setTimeout(done, 3000));
      clearInterval(hold);
      car.vx = 0;
      window.__game.renderer.debugZoom(1.4);
    });
    await page.waitForTimeout(300);
    await shot(page, 'r2-brakeglow.png');
    // a damaged headlight: front-left at 0.25 damage, sampled 10 s
    const samples = await page.evaluate(async () => {
      const cars = await import('/src/render/cars.ts');
      const car = window.__game.car;
      car.dmg[0] = 0.25;
      const levels = [];
      for (let i = 0; i < 50; i++) {
        levels.push(cars.lampLevel(car, 0));
        await new Promise((done) => setTimeout(done, 200));
      }
      return levels.join('');
    });
    console.log('headlight at 0.25 damage, every 0.2 s for 10 s:', samples);
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
