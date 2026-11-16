// _underskincost.mjs - what ?underskin costs when a car's lost-parts picture is made: the car's
// set of lost parts flipped every frame between two sets (so its picture is made every frame),
// the renderer's frame timed, ?underskin=0 vs 1 back to back. node tools/scratch/_underskincost.mjs [car]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [CAR = 'hatch-rwd'] = process.argv.slice(2);
const FRAMES = 300;

/** Page side: the renderer's frame time, ms each, with the lost parts flipped every frame. */
async function timeFrames([car, frames]) {
  const game = window.__game;
  game.launch('lab', car, { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
  await new Promise((done) => setTimeout(done, 1500));
  const sets = ['bonnet:0,bumper:0,wing:0,wing:1', 'boot:2,bumper:2,wing:2,wing:3,panel:1'];
  const times = [];
  for (let i = 0; i < frames; i++) {
    game.car.partLost = sets[i % 2];
    const start = performance.now();
    game.renderer.frame(game, 1 / 60, start / 1000);
    times.push(performance.now() - start);
  }
  times.sort((one, two) => one - two);
  return { median: +times[frames >> 1].toFixed(2), p90: +times[Math.floor(frames * 0.9)].toFixed(2) };
}

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const flag of ['0', '1', '0', '1']) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&underskin=${flag}`);
    await page.mouse.click(400, 200);
    await page.waitForTimeout(1200);
    const result = await page.evaluate(timeFrames, [CAR, FRAMES]);
    console.log(`underskin=${flag} ${CAR}: frame ms ${JSON.stringify(result)}`
      + `${errors.length ? ' ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.stop();
}
