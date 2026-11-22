// _spikeslook.mjs - SPIKES PEAK's looks (?spikespeak and its rework switches by RAC3R_QUERY): the
// car put on the road at each AT game m (stopped, facing up the road), the ground left to settle,
// a photo; the hill shade's cost (render/glshade.ts: chunks computed and their ms) and the frame
// rate read with each. tools/scratch/_spikeslook-<NAME>-at<m>-<view>.png.
// [NAME=base] [VIEW=390x844] [AT=1818,6467,9484] node tools/scratch/_spikeslook.mjs
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const NAME = process.env.NAME || 'base', AT = (process.env.AT || '1818,6467,9484').split(',')
  .map(Number);
const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&rules=0&noaudio=1&spikespeak=1` + extraQuery());
  const began = Date.now();
  await page.evaluate(() => window.__game.launch('spikes-peak', 'saloon-rwd', { ai: 0, laps: 1,
    weather: { mode: 'dry', season: 2, seed: 4 } }));
  await page.waitForFunction(() => window.__game.mode === 'session' && window.__game.level.id
    === 'spikes-peak', null, { polling: 100, timeout: 60000 });
  console.log('loaded ms', Date.now() - began, 'loose', await page.evaluate(() =>
    window.__game.cones && window.__game.cones.list ? window.__game.cones.list.length : null));
  await page.mouse.click(width / 2, height / 2);
  for (const dist of AT) {
    await page.evaluate((at) => {
      const game = window.__game, pts = game.level.subtrack.pts;
      let best = pts[0];
      for (const pt of pts) if (Math.abs(pt.dist - at) < Math.abs(best.dist - at)) best = pt;
      const car = game.car;
      car.x = best.x;
      car.y = best.y;
      car.heading = Math.atan2(best.dirY, best.dirX);
      car.vx = 0;
      car.vy = 0;
      car.yawRate = 0;
      if (game.renderer.snap) game.renderer.snap(car);
    }, dist);
    await page.waitForTimeout(2500);
    const stats = await page.evaluate(() => ({ shade: window.__game.renderer.shadeStats,
      fps: Math.round(window.__game.fps), low: Math.round(window.__game.fpsLow) }));
    await page.screenshot({ path: `tools/scratch/_spikeslook-${NAME}-at${dist}-${width}x${height}.png` });
    console.log(`at ${dist}`, JSON.stringify({ ...stats, msPerChunk: stats.shade
      ? +(stats.shade.ms / Math.max(1, stats.shade.chunks)).toFixed(3) : null }));
  }
  console.log('errors', errors.length ? errors.slice(0, 3).join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}
