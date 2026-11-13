// _cutroadshots.mjs - THE ROAD DOWN IN A CROSSOVER'S CUT against the road outside it (scratch):
// for each level with an underpass of the race road, a race is run a while (the field wears the
// road), then the car is parked in each open cut (at each portal's mouth, on each half of the
// road), 30 m outside it and 150 m before it, the cars beside it taken off, and each photographed at phone size -
// by day, at night and wet - with the switch off and on (?cutroad=1).
// Written to OUT (default shots/cutroad) as <level>-<side>-<when>-<spot>-<size>.png.
// node tools/scratch/_cutroadshots.mjs [levels, comma separated]  (env SIZES, SIDES, WHENS, RACE_S,
// ZOOM; CHECK_PORT)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const LEVELS = (process.argv[2] || 'xgayms,birdsmess,stadeprance,wobbly').split(',');
const SIZES = (process.env.SIZES || '844x390,390x844').split(',');
const SIDES = (process.env.SIDES || 'off,on').split(',');
// [name, start hour, query]: by day, at night (TEST MODE's hour), wet by day (the tools' ?rain=)
const WHENS = [['day', 13, ''], ['night', 23, ''], ['wet', 13, '&rain=0.8']]
  .filter(([name]) => (process.env.WHENS || 'day,night,wet').split(',').includes(name));
const RACE_S = +(process.env.RACE_S || 25), ZOOM = +(process.env.ZOOM || 0.8);
const OUT = process.env.OUT || 'shots/cutroad';
fs.mkdirSync(OUT, { recursive: true });

/** Page side: where to park - each portal's mouth's cut (both halves of the road) and 30 m out. */
function cutSpots() {
  const game = window.__game, sub = game.level.subtrack, spots = [];
  const at = (dist, off) => {
    let best = sub.pts[0];
    const along = ((dist % sub.totalDist) + sub.totalDist) % sub.totalDist;
    for (const point of sub.pts) if (point.dist <= along) best = point;
    return [best.x + best.nx * off, best.y + best.ny * off, best.heading];
  };
  (sub.under || []).forEach((span, index) => {
    const cut = span.cut || 0;
    for (const [end, inward, way] of [[span.d0, 1, 'in'], [span.d1, -1, 'out']]) {
      for (const off of [-2.5, 2.5]) {
        const lane = off < 0 ? 'a' : 'b';
        spots.push([`u${index}-${way}-cut-${lane}`, ...at(end + inward * cut * 0.5, off)]);
      }
      spots.push([`u${index}-${way}-outside`, ...at(end - inward * 30, 0)]);
    }
    // (and the lap's road far from the crossover, for its look)
    spots.push([`u${index}-lap`, ...at(span.d0 - 150, 0)]);
  });
  return spots;
}

/** Page side: the car at a spot (heading along the road into the cut), the field taken away. */
async function parkAt([x, y, heading, zoom]) {
  const game = window.__game, { reset } = await import('/src/vehicle.ts');
  game.car.crossing = -1;
  reset(game.car, x, y, heading);
  for (const other of game.ai || []) Object.assign(other.car, { x: 1e5, y: 1e5, vx: 0, vy: 0 });
  game.input.update = () => ({ throttle: 0, brake: 1, steer: 0, handbrake: 0, reverse: 0,
    shiftUp: false, shiftDown: false });
  game.renderer.debugZoom(zoom);
}

/**
 * One level, side and size: race a while, then each spot at each time of day.
 * @param browser the browser
 * @param base the server's url
 * @param job {level, side, size}
 */
async function shootLevel(browser, base, { level, side, size }) {
  const [width, height] = size.split('x').map(Number);
  for (const [when, hour, extra] of WHENS) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const query = (side === 'on' ? '&cutroad=1' : '') + extra;
    await gotoGame(page, `${base}/?pc=1&guide=0&menu=0&noaudio=1&level=${level}${query}`);
    await page.mouse.click(width / 2, height / 2);
    await page.evaluate(([lv, at]) => window.__game.launch(lv, window.__game.car.spec.id,
      { ai: 8, laps: 5, time: at }), [level, hour]);
    await page.evaluate(async () => {
      const game = window.__game, auto = await import('/src/ai/autodrive.ts');
      const driver = auto.createAutoDriver(game.level.subtrack);
      game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false,
        shiftDown: false });
    });
    await page.waitForTimeout(RACE_S * 1000);
    const spots = await page.evaluate(cutSpots);
    for (const [name, x, y, heading] of spots) {
      await page.evaluate(parkAt, [x, y, heading, ZOOM]);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${level}-${side}-${when}-${name}-${size}.png` });
    }
    console.log(level, side, when, size, spots.length, 'spots',
      errors.length ? `ERRORS ${errors.slice(0, 3).join(' | ')}` : 'errors none');
    await context.close();
  }
}

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const level of LEVELS) for (const size of SIZES) for (const side of SIDES)
    await shootLevel(browser, server.url, { level, side, size });
} finally {
  await browser.close();
  server.stop();
}
