// _rollbody.mjs - the rolled car as a BODY (?rollbody=1, render/rollbody.ts), in the game: for
// each car 300 rolls stepped straight through roll.ts (where they came to rest - wheels / side /
// roof - and the quarter turns each); the cost (ms) of making its body and its pictures; then in
// the Lab, clean and damaged (a crushed front corner and roof, a lost door, wing and wheel), the
// car held at each of its 12 angles (one sheet, tools/scratch/_rollbody-<car>[-hurt].png) and a
// real roll photographed mid-spin (-live.png, the blur and whoosh lines).
// node tools/scratch/_rollbody.mjs [cars] [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [carsArg = 'track-rwd,mikra-r1', query = 'rollbody=1'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
const CLIP = 150;

/** In the page: the rest statistics and the cost of a body, then the damage if asked. */
async function setUp([id, damaged]) {
  const game = window.__game, roll = await import('/src/roll.ts');
  game.launch('lab', id, { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
  await new Promise((done) => setTimeout(done, 1500));
  const car = game.car, rests = { wheels: 0, side: 0, roof: 0 };
  let turns = 0;
  for (let n = 0; n < 300; n++) {
    const test = { x: car.x, y: car.y, vx: 0, vy: 9, heading: 0, yawRate: 0, rpm: 800, air: 0,
      spec: car.spec, surface: { id: 'grass' }, roll: null };
    roll.startRoll(test, n % 2 ? 1 : -1, 6 + (n % 9));
    for (let step = 0; step < 4000 && test.roll && test.roll.phase === 'rolling'; step++)
      roll.stepRoll(test, 1 / 120, () => { turns++; });
    rests[!test.roll ? 'wheels' : test.roll.phase]++;
  }
  // the cost: a fresh body and its 12 pictures, then a drawing of a made one
  const { drawRolledBody } = await import('/src/render/rollbody.ts');
  const { drawnSpec } = await import('/src/render/cars.ts');
  const { createCarSprite } = await import('/src/render/carsprite.ts');
  const spec = drawnSpec(car.spec), sprite = createCarSprite().pixelCar(spec),
    off = document.createElement('canvas').getContext('2d');
  // (one body first: the pictures' first reads, which the game does on quiet frames)
  drawRolledBody(off, { ...car, roll: { phi: 1, w: 0 } }, spec, sprite, 4);
  const copy = { ...car }, cost = [];
  for (let k = 0; k < 12; k++) {
    copy.roll = { phase: 'rolling', phi: k * Math.PI / 6, w: 0 };
    const start = performance.now();
    drawRolledBody(off, copy, spec, sprite, 4);
    cost.push(performance.now() - start);
  }
  const again = performance.now();
  for (let k = 0; k < 100; k++) drawRolledBody(off, copy, spec, sprite, 4);
  if (damaged) {
    car.dmg = [0.7, 0.2, 0.3, 0.1]; car.crushL = [0.5, 0.1, 0.1, 0];
    car.crushS = [0.4, 0, 0.3, 0]; car.roofDmg = 0.5; car.wheelOff = [false, false, false, true];
    car.partLost = 'panel:0,wing:2';
  }
  game.renderer.debugZoom(3.4);
  return { rests, turnsEach: +(turns / 300).toFixed(2), firstMs: +cost[0].toFixed(1),
    eachFrameMs: +(cost.slice(1).reduce((a, b) => a + b, 0) / 11).toFixed(2),
    drawMs: +((performance.now() - again) / 100).toFixed(3) };
}

try {
  for (const carId of carsArg.split(',')) {
    for (const hurt of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
      const errors = []; page.on('pageerror', (err) => errors.push(err.message));
      await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&${query}`);
      await page.mouse.click(200, 300);
      await page.waitForTimeout(1200);
      const res = await page.evaluate(setUp, [carId, hurt]);
      await page.waitForTimeout(1500);
      const shots = [];
      for (let k = 0; k < 12; k++) {
        await page.evaluate((phi) => {
          const car = window.__game.car;
          car.vx = 0; car.vy = 0; car.heading = 0;
          car.roll = { phase: 'side', phi, w: 0, still: 0 };
        }, k * Math.PI / 6);
        await page.waitForTimeout(120);
        shots.push((await page.screenshot({ clip: { x: 195 - CLIP / 2, y: 300 - CLIP / 2,
          width: CLIP, height: CLIP } })).toString('base64'));
      }
      // a real roll, photographed mid-spin
      await page.evaluate(async () => {
        const car = window.__game.car, roll = await import('/src/roll.ts');
        car.roll = null; car.heading = -Math.PI / 2; car.vx = 11; car.vy = 0;
        roll.startRoll(car, 1, 13);
      });
      await page.waitForTimeout(110);
      await page.screenshot({ path: `tools/scratch/_rollbody-${carId}${hurt ? '-hurt' : ''}-live.png` });
      const sheet = await browser.newPage({ viewport: { width: CLIP * 4, height: CLIP * 3 } });
      await sheet.setContent(`<body style="margin:0;display:grid;grid-template-columns:repeat(4,${CLIP}px)">${
        shots.map((b64) => `<img src="data:image/png;base64,${b64}">`).join('')}</body>`);
      await sheet.screenshot({ path: `tools/scratch/_rollbody-${carId}${hurt ? '-hurt' : ''}.png` });
      await sheet.close();
      console.log(carId, hurt ? 'damaged' : 'clean', JSON.stringify(res),
        errors.length ? 'ERRORS ' + errors.join(' | ') : 'errors none');
      await page.close();
    }
  }
} finally { await browser.close(); server.stop(); }
