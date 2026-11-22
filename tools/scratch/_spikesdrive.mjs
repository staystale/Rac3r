// _spikesdrive.mjs - SPIKES PEAK round 2 (?spikespeak; world/levels/spikes.ts): the hill climb
// driven by the autopilot, solo. Every 2 s where the car is, its speed, the ground's height under
// it, the frame rate; photos at the start and as it reaches each AT game m (hairpins). Also the
// load: ms from the launch to the session, and page errors. Photos
// tools/scratch/_spikes-<what>-<view>.png. [VIEW=390x844] [AT=1818,2539,5415] [UPTO_M=3000]
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const AT = (process.env.AT || '1818,2539').split(',').map(Number), UPTO = +(process.env.UPTO_M || 3000);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&rules=0&noaudio=1&autopilot=1&spikespeak=1`
    + extraQuery());
  const began = Date.now();
  await page.evaluate(() => window.__game.launch('spikes-peak', 'saloon-rwd', { ai: 0, laps: 1,
    weather: { mode: 'dry', season: 2, seed: 4 } }));
  await page.waitForFunction(() => window.__game.mode === 'session' && window.__game.level.id
    === 'spikes-peak', null, { polling: 100, timeout: 60000 });
  console.log('loaded ms', Date.now() - began);
  await page.waitForTimeout(1500);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `tools/scratch/_spikes-start-${width}x${height}.png` });
  const spots = [...AT];
  const drove = Date.now();
  let last = null;
  while (Date.now() - drove < 420000) {
    await page.waitForTimeout(2000);
    last = await page.evaluate(() => {
      const game = window.__game, car = game.car;
      return { t: Math.round((game.stage && game.stage.t) || 0), prog: Math.round(car._prog ?? -1),
        kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6), z: +(car.zR ?? car.groundR ?? 0)
          .toFixed(1), fps: game.fps, low: game.fpsLow, stage: game.stage && game.stage.state };
    });
    console.log(JSON.stringify(last));
    while (spots.length && last.prog >= spots[0] - 30) {
      await page.screenshot({ path: `tools/scratch/_spikes-at${spots[0]}m-${width}x${height}.png` });
      spots.shift();
    }
    if (last.prog >= UPTO || last.stage === 'done') break;
  }
  console.log('errors', errors.length ? errors.slice(0, 3).join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}
