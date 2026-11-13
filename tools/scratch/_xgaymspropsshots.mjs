// _xgaymspropsshots.mjs - L.A. LIVELY's DRESSING PASS (?xgaymsprops=1) at phone size, the switch
// off and on (scratch): the car parked (as _xgaymsshots.mjs parks it) at the paddock, the start,
// the jump, both tunnel mouths and the show cars, by day (TEST MODE's start hour 13, no AI) and
// the paddock and the start at night (23), and the whole map (zoomed right out). Written to
// OUT (default shots/xgaymsprops) as <side>-<spot>-<size>.png.
// node tools/scratch/_xgaymspropsshots.mjs  (env SIZES "844x390,390x844", ZOOM; CHECK_PORT)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const OUT = process.env.OUT || 'shots/xgaymsprops';
const SIZES = (process.env.SIZES || '844x390,390x844').split(',');
const ZOOM = +(process.env.ZOOM || 0.35);
fs.mkdirSync(OUT, { recursive: true });
// [name, x, y, heading rad]: where the car is parked (heading +x east, +y south)
// (off the road where the camera's lead would put the dressing out of the picture)
const SPOTS = [
  ['paddock', 155, -15, 0], ['start', -100, 100, Math.PI], ['jump', 95, -140, Math.PI],
  ['tvcamera', 35, -150, Math.PI], ['mouth-north', 0, -35, 0], ['mouth-south', 0, 35, 0],
  ['showcars', -95, 25, 0],
];
// the whole map: the car at the crossing, the camera this far out
const MAP_ZOOM = 0.1;
const NIGHT_SPOTS = ['paddock', 'start'];

/** Page side: the car at a spot, held on the brake, the camera zoomed out. */
async function parkAt([x, y, heading, zoom]) {
  const game = window.__game, { reset } = await import('/src/vehicle.ts');
  game.car.crossing = -1;
  reset(game.car, x, y, heading);
  game.input.update = () => ({ throttle: 0, brake: 1, steer: 0, handbrake: 0, reverse: 0,
    shiftUp: false, shiftDown: false });
  game.renderer.debugZoom(zoom);
}

/**
 * One side of the switch at one size: launch at each hour, photograph the spots.
 * @param browser the browser
 * @param base the server's url
 * @param side 'off' or 'on'
 * @param size 'WxH'
 */
async function shootSide(browser, base, side, size) {
  const [width, height] = size.split('x').map(Number);
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const query = side === 'on' ? '&xgaymsprops=1' : '';
  await gotoGame(page, `${base}/?pc=1&guide=0&menu=0&noaudio=1&level=xgayms${query}`);
  await page.mouse.click(width / 2, height / 2);
  for (const [hour, when] of [[13, 'day'], [23, 'night']]) {
    await page.evaluate((at) => window.__game.launch('xgayms', window.__game.car.spec.id,
      { ai: 0, laps: 3, time: at }), hour);
    await page.waitForTimeout(2500);
    for (const [name, x, y, heading] of SPOTS) {
      if (when === 'night' && !NIGHT_SPOTS.includes(name)) continue;
      await page.evaluate(parkAt, [x, y, heading, ZOOM]);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/${side}-${when}-${name}-${size}.png` });
    }
    if (when === 'day') {
      await page.evaluate(parkAt, [0, -30, 0, MAP_ZOOM]);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/${side}-day-map-${size}.png` });
    }
  }
  const counts = await page.evaluate(() => ({ props: window.__game.level.props.length,
    cones: window.__game.level.cones.length }));
  console.log(side, size, JSON.stringify(counts),
    errors.length ? `ERRORS ${errors.slice(0, 3).join(' | ')}` : 'errors none');
  await context.close();
}

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const size of SIZES) for (const side of ['off', 'on']) {
    await shootSide(browser, server.url, side, size);
  }
} finally {
  await browser.close();
  server.stop();
}
