// _spikestones.mjs - SPIKES PEAK's movable stones in play (?spikerocks; cones/stones.ts): the
// autopilot drives the first UPTO_M m; then every stone on the road - how many moved and how far
// (heavier ones less), how many were hit (their drive-over chance up from where it started), the
// awake ones, and whether a tyre burst. RAC3R_QUERY carries switches. [UPTO_M=2700]
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const UPTO = +(process.env.UPTO_M || 2700);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } }))
    .newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&rules=0&noaudio=1&autopilot=1&spikespeak=1`
    + extraQuery());
  await page.evaluate(() => window.__game.launch('spikes-peak', 'saloon-rwd', { ai: 0, laps: 1,
    weather: { mode: 'dry', season: 2, seed: 4 } }));
  await page.waitForFunction(() => window.__game.mode === 'session', null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.mouse.click(422, 195);
  await page.waitForFunction((upto) => (window.__game.car._prog ?? 0) >= upto, UPTO,
    { polling: 500, timeout: 400000 });
  const report = await page.evaluate(() => {
    const list = window.__game.cones.list.filter((obj) => obj.kind.startsWith('stone'));
    const start = { stone: 0.6, stonemid: 0.25, stonebig: 0 }, byKind = {};
    for (const obj of list) {
      const row = byKind[obj.kind] || (byKind[obj.kind] = { count: 0, moved: 0, maxMoveM: 0,
        hit: 0, maxOver: 0, awake: 0 });
      const move = Math.hypot(obj.x - obj.hx, obj.y - obj.hy);
      row.count++;
      if (move > 0.2) row.moved++;
      row.maxMoveM = Math.max(row.maxMoveM, +move.toFixed(1));
      if ((obj.overChance ?? 0) > start[obj.kind] + 1e-6) row.hit++;
      row.maxOver = Math.max(row.maxOver, +(obj.overChance ?? 0).toFixed(3));
      if (obj.moving || obj.awake) row.awake++;
    }
    const car = window.__game.car;
    return { byKind, burst: car.tyreBurst || car.burst || null, fps: Math.round(window.__game.fps),
      low: Math.round(window.__game.fpsLow) };
  });
  console.log(JSON.stringify(report));
  console.log('errors', errors.length ? errors.slice(0, 3).join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}
