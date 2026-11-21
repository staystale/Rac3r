// _labstartshot.mjs - ?labstart (world/labstart.ts): the hatch, the school bus and the Scanyah with
// its trailer at the Lab's start, off and on - a photo at the game's zoom (844x390), then 5 s
// straight ahead at full throttle: how far each got and how fast, whether it touched anything (a
// hit noted on the car). node tools/scratch/_labstartshot.mjs <dir>
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [OUT = 'tools/scratch/labstart'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const CARS = ['hatch-rwd', 'skool-bus', 'scanyah-r450'];
const server = await startServer();
const browser = await launchBrowser();

/**
 * One car, one switch: the photo and the pull-away.
 * @param carId the car
 * @param query the switches
 * @returns its line
 */
async function runCar(carId, query) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&trailer=1${query}`);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(1200);
  await page.evaluate(async (id) => {
    const game = window.__game;
    game.launch('lab', id, { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
    await new Promise((done) => setTimeout(done, 2500));
  }, carId);
  const tag = `${carId}-${query.includes('labstart') ? 'on' : 'off'}`;
  await page.screenshot({ path: `${OUT}/${tag}.png` });
  const result = await page.evaluate(async () => {
    const game = window.__game, car = game.car, from = { x: car.x, y: car.y };
    const bill0 = car.dmgBill || 0;
    game.input.update = () => ({ steer: 0, throttle: 1, brake: 0, handbrake: 0, reverse: 0,
      shiftUp: false, shiftDown: false });
    await new Promise((done) => setTimeout(done, 5000));
    return { metres: Math.hypot(car.x - from.x, car.y - from.y),
      kph: Math.hypot(car.vx, car.vy) * 3.6, hit: (car.dmgBill || 0) > bill0,
      at: `${from.x.toFixed(1)},${from.y.toFixed(1)}` };
  });
  await page.close();
  return `${tag}: start ${result.at}; 5 s flat out ${result.metres.toFixed(1)} m, `
    + `${result.kph.toFixed(0)} km/h, ${result.hit ? 'HIT SOMETHING' : 'no hit'}`
    + (errors.length ? ' ERRORS ' + errors[0] : '');
}

try {
  for (const carId of CARS) {
    for (const query of ['', '&labstart=1']) console.log(await runCar(carId, query));
  }
} finally {
  await browser.close();
  server.stop();
}
