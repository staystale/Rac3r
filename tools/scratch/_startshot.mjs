// _startshot.mjs - A BIG FIELD INTO THE FIRST CORNER IN THE REAL GAME (owner 11-09, Spa: "lots of
// crashes with big grids", "I think it's the hair pin first corner"): LEVEL raced VS AI with N
// cars from the grid; phone-size photos at each of SHOTS seconds after the green, the camera on
// the player in the middle of the grid (the autopilot drives it), and where every car is then:
// on the road or off it, how fast.
// [LEVEL=spa] [N=19] [SHOTS=7,9,11,13] [QUERY=] node tools/scratch/_startshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const level = process.env.LEVEL || 'spa', count = +(process.env.N || 19);
const shots = (process.env.SHOTS || '7,9,11,13').split(',').map(Number);
const query = process.env.QUERY ?? '';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = []; page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1&${query}`);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(800);
  await page.evaluate(([id, ai]) => window.__game.launch(id, 'saloon-rwd', { ai, diff: 2, laps: 3 }),
    [level, count]);
  // the green: the start's clock past its green
  for (let waited = 0; waited < 120; waited++) {
    if (await page.evaluate(() => { const s = window.__game.start;
      return s && s.t >= (s.tGreen0 ?? s.tGreen); })) break;
    await page.waitForTimeout(250);
  }
  const green = Date.now();
  for (const at of shots) {
    await page.waitForTimeout(Math.max(0, at * 1000 - (Date.now() - green)));
    const res = await page.evaluate(() => {
      const game = window.__game, sub = game.level.subtrack;
      const cars = [game.car, ...game.ai.map((entry) => entry.car)];
      const kmh = cars.map((car) => Math.round(Math.hypot(car.vx, car.vy) * 3.6));
      return { off: cars.filter((car) => car._lastOn === undefined ? false : false).length,
        width: sub.width, kmh: kmh.slice(0, 20).join(' '),
        rolled: cars.filter((car) => car.roll).length };
    });
    await page.screenshot({ path: `tools/scratch/_startshot-${level}-${at}s.png` });
    console.log(`${at} s: speeds ${res.kmh}${res.rolled ? `, ${res.rolled} rolled` : ''}`);
  }
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 2).join(' | ') : 'errors none');
} finally { await browser.close(); server.stop(); }
