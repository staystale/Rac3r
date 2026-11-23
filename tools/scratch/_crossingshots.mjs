// _crossingshots.mjs - EVERY BRIDGE AND TUNNEL photographed (scratch): for each level, each run
// (a tag, a query and an hour) and each view, the player parked with its lights on at each
// crossing's middle (LEVEL.crossings: on the road over a tunnel, on a bridge's deck), the camera
// wide - OUT/<level>-c<i>-<tag>-<view>.png, the crossing's kind printed. One browser for all.
// node tools/scratch/_crossingshots.mjs level ...
//   env RUNS "tag:hour:query;..." (hour 0 = the clock's own), VIEWS "844x390,390x844", OUT, ZOOM,
//   MAX (crossings a level)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const levels = process.argv.slice(2).length ? process.argv.slice(2) : ['suzuka'];
const OUT = process.env.OUT || 'shots/crossings', ZOOM = +(process.env.ZOOM || 0.45);
const MAX = +(process.env.MAX || 6);
const RUNS = (process.env.RUNS || 'night:23:x=1').split(';').map((run) => {
  const [tag, hour, ...query] = run.split(':');
  return { tag, hour: +hour, query: query.join(':') };
});
const VIEWS = (process.env.VIEWS || '844x390').split(',');
fs.mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();

/**
 * One level in one run and view: each crossing photographed.
 * @param page the page
 * @param level the level id
 * @param run the run's tag, hour and query
 * @param view 'WxH'
 * @returns the page errors
 */
async function shootLevel(page, level, run, view) {
  const errors = [];
  const onError = (err) => errors.push(err.message);
  page.on('pageerror', onError);
  const [viewW, viewH] = view.split('x').map(Number);
  await page.setViewportSize({ width: viewW, height: viewH });
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=${level}&${run.query}`);
  await page.mouse.click(viewW / 2, viewH / 2);
  await page.waitForTimeout(1200);
  await page.evaluate(([lv, hour]) => window.__game.launch(lv, window.__game.car.spec.id,
    { ai: 0, laps: 1, ...(hour ? { time: hour } : {}) }), [level, run.hour]);
  await page.waitForTimeout(2000);
  const ways = await page.evaluate(() => (window.__game.level.crossings || []).map((way) => ({
    kind: way.kind, track: !!way.track, length: Math.round(way.length),
    mid: [way.ax + way.dirX * way.length / 2, way.ay + way.dirY * way.length / 2],
    heading: Math.atan2(way.dirY, way.dirX) })));
  for (const [i, way] of ways.slice(0, MAX).entries()) {
    await page.evaluate(async ([x, y, heading, zoom]) => {
      const game = window.__game, { reset } = await import('/src/vehicle.ts');
      reset(game.car, x, y, heading);
      game.car.lightsOn = true;
      game.input.update = () => ({ throttle: 0, brake: 1, steer: 0, handbrake: 0, reverse: 0,
        shiftUp: false, shiftDown: false });
      game.renderer.debugZoom(zoom);
    }, [...way.mid, way.heading, ZOOM]);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/${level}-c${i}-${run.tag}-${view}.png` });
    if (run === RUNS[0] && view === VIEWS[0])
      console.log(level, `c${i}`, way.kind, way.track ? '(the lap under)' : '', way.length, 'm');
  }
  page.off('pageerror', onError);
  return errors;
}

try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } }))
    .newPage();
  for (const level of levels) {
    for (const run of RUNS) {
      for (const view of VIEWS) {
        const errors = await shootLevel(page, level, run, view);
        if (errors.length) console.log(level, run.tag, view, 'ERRORS', errors.slice(0, 2).join(' | '));
      }
    }
  }
  console.log('SHOTSDONE');
} finally {
  await browser.close();
  server.stop();
}
