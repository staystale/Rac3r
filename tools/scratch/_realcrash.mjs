// _realcrash.mjs - A REAL CRASH, the game's own path (no damage set by hand): the player's car on
// the test track driven at SPEED m/s, nose first (front) or reversing (rear), into an AI car
// parked across its way; for one corner (left / right) the car slides into it SLEWED 35 degrees, so
// the hit comes from that corner's side as well as its end (centre: straight on).
// Then a still photo of it at the phone's size (844x390 and its crop) and close, and what the
// damage is (each corner's damage, end and side crush, the parts lost, the wheels off).
// node tools/scratch/_realcrash.mjs [cars] [speed m/s] [front|rear] [left|centre|right] [query]
//   OUT=<folder> (default tools/scratch/realcrash)
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [carsArg = 'mini-fwd', speedArg = '20', endArg = 'front', sideArg = 'right', query = '']
  = process.argv.slice(2);
const OUT = process.env.OUT || 'tools/scratch/realcrash';
// CSS px either side of the car the crop takes (phone crop / close)
const SHOTS = [{ name: 'phonecrop', zoom: null, clip: 150 }, { name: 'close', zoom: 1.2, clip: 110 }];

/** Page side: the crash, then the car held still where it ended. */
async function crash([id, speed, end, side]) {
  const game = window.__game;
  game.launch('test-track', id, { ai: 1, weather: { mode: 'dry', season: 2, seed: 4 } });
  // (past the start's countdown)
  await new Promise((done) => setTimeout(done, 6000));
  const car = game.car, other = game.ai[0].car, dir = end === 'rear' ? -1 : 1;
  // (the parked car 12 m ahead or behind, across the way; the car's velocity slewed toward the
  // hit corner's side: +y = right)
  const slew = side === 'centre' ? 0 : (side === 'right' ? 0.6 : -0.6) * dir;
  other.x = car.x + Math.cos(car.heading + slew) * 12 * dir;
  other.y = car.y + Math.sin(car.heading + slew) * 12 * dir;
  other.heading = car.heading + Math.PI / 2;
  other.vx = 0; other.vy = 0;
  game.ai[0].hold = true;
  car.vx = Math.cos(car.heading + slew) * speed * dir;
  car.vy = Math.sin(car.heading + slew) * speed * dir;
  await new Promise((done) => setTimeout(done, 2500));
  car.vx = 0; car.vy = 0;
  // (the other car out of the photo)
  other.x += 200; other.y += 200;
  return { dmg: (car.dmg || []).map((value) => +value.toFixed(2)),
    crushL: (car.crushL || []).map((value) => +value.toFixed(2)),
    crushS: (car.crushS || []).map((value) => +value.toFixed(2)),
    lost: car.partLost || '', wheelsOff: (car.wheelOff || []).map(Number).join('') };
}

mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const carId of carsArg.split(',')) {
    // (one crash, photographed at the phone's own zoom and then close: one page)
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 6 });
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${query ? '&' + query : ''}`);
    await page.mouse.click(422, 195);
    await page.waitForTimeout(1200);
    const state = await page.evaluate(crash, [carId, +speedArg, endArg, sideArg]);
    for (const shot of SHOTS) {
      const at = await page.evaluate(async (zoom) => {
        const game = window.__game;
        if (zoom) game.renderer.debugZoom(zoom);
        await new Promise((done) => setTimeout(done, 700));
        const renderer = game.renderer, toCss = innerWidth / renderer.W;
        return { x: renderer.toScreenX(game.car.x) * toCss, y: renderer.toScreenY(game.car.y) * toCss };
      }, shot.zoom);
      const clipW = shot.clip, clipH = Math.round(clipW * 2 / 3);
      const file = `${OUT}/${carId}-${endArg}-${sideArg}-${shot.name}.png`;
      await page.screenshot({ path: file, clip: { x: Math.max(0, Math.min(844 - clipW, at.x - clipW / 2)),
        y: Math.max(0, Math.min(390 - clipH, at.y - clipH / 2)), width: clipW, height: clipH } });
    }
    console.log(`${carId} ${endArg} ${sideArg} ${JSON.stringify(state)}${errors.length ? ' PAGE ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.stop();
}
