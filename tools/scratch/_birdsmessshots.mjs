// _birdsmessshots.mjs - THE BIRD'S MESS in the live game at phone size (scratch): the day overview
// (the menu thumbnail), the whole bowl at night, the head-to-head start (the rival on the other
// lane, held at the lights), the crossover driven from below and from above (the demo driver, a
// shot every SHOT_S s) and each corner of the lap with the car parked on it - with the darkness,
// the page errors and what the level holds. Written to OUT (default shots/birdsmess).
// node tools/scratch/_birdsmessshots.mjs [level] [query]   (env VIEW, ZOOM, OUT, SHOTS; CHECK_PORT)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [level = 'birdsmess', query = 'birdsmess=1'] = process.argv.slice(2);
const ZOOM = +(process.env.ZOOM || 0.6), SHOTS = +(process.env.SHOTS || 4), SHOT_S = 0.4;
const OUT = process.env.OUT || 'shots/birdsmess';
fs.mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  const [viewW, viewH] = (process.env.VIEW || '844x390').split('x').map(Number);
  const tag = `${viewW}x${viewH}`;
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=${level}&${query}`);
  await page.mouse.click(viewW / 2, viewH / 2);
  await page.waitForTimeout(1500);
  await page.evaluate((lv) => window.__game.launch(lv, window.__game.car.spec.id,
    { ai: 1, laps: 1 }), level);
  await page.waitForTimeout(2500);
  const info = await page.evaluate(async () => {
    const game = window.__game, lv = game.level, { DAYLIGHT } = await import('/src/world/daylight.ts');
    return { lap: +lv.subtrack.totalDist.toFixed(1), props: lv.props.length, cones: lv.cones.length,
      darkness: +DAYLIGHT.darkness.toFixed(2), held: !game.start.green,
      apart: +Math.hypot(game.car.x - game.ai[0].car.x, game.car.y - game.ai[0].car.y).toFixed(1) };
  });
  console.log(JSON.stringify(info));
  const shoot = (name) => page.screenshot({ path: `${OUT}/${level}-${name}-${tag}.png` });
  // the start: both cars at the lights, zoomed out to hold them both
  await page.evaluate(() => window.__game.renderer.debugZoom(0.45));
  await page.waitForTimeout(600);
  await shoot('start');
  // the day overview (the menu's thumbnail) and the whole bowl at night, the camera at its middle
  const url = await page.evaluate(() => window.__game.renderer.thumbnail(1600).toDataURL());
  fs.writeFileSync(`${OUT}/${level}-overview-day.png`, Buffer.from(url.split(',')[1], 'base64'));
  await page.waitForTimeout(+(process.env.SETTLE_MS || 7000));
  await page.evaluate(async () => {
    const game = window.__game, { reset } = await import('/src/vehicle.ts');
    game.car.crossing = -1;
    reset(game.car, -5, 0, 0);
    game.input.update = () => ({ throttle: 0, brake: 1, steer: 0, handbrake: 0, reverse: 0,
      shiftUp: false, shiftDown: false });
  });
  await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom),
    +(process.env.BOWL_ZOOM || 0.09));
  await page.waitForTimeout(900);
  await shoot('night-bowl');
  for (const leg of ['under', 'over']) {
    await page.evaluate(async (which) => {
      const game = window.__game, sub = game.level.subtrack, span = sub.under[0];
      const at = which === 'under' ? span.d0 - 15 : span.over - 30;
      let best = sub.pts[0];
      for (const point of sub.pts) if (point.dist <= at) best = point;
      const { reset } = await import('/src/vehicle.ts');
      const { repair } = await import('/src/damage.ts');
      repair(game.car);
      game.car.crossing = -1;
      reset(game.car, best.x, best.y, best.heading);
      const speed = which === 'under' ? 12 : 18;
      Object.assign(game.car, { vx: speed * Math.cos(best.heading),
        vy: speed * Math.sin(best.heading) });
      const auto = await import('/src/ai/autodrive.ts');
      const driver = auto.createAutoDriver(sub);
      game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false,
        shiftDown: false });
    }, leg);
    await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), ZOOM);
    for (let shot = 0; shot < SHOTS; shot++) {
      await page.waitForTimeout(SHOT_S * 1000);
      const state = await page.evaluate(() => {
        const game = window.__game, car = game.car, way = car.crossing ?? -1;
        const crossing = way >= 0 ? game.level.crossings[way] : null;
        return { level: crossing ? (crossing.track ? 'UNDERPASS' : crossing.kind) : 'ground',
          at: [+car.x.toFixed(1), +car.y.toFixed(1)], hit: car._hitKind || null,
          kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6) };
      });
      console.log(leg, shot, JSON.stringify(state));
      await shoot(`x-${leg}-${shot}`);
    }
  }
  // each corner: the lap's sharpest turns (heading change over 30 m), 60 m apart at least
  const corners = await page.evaluate(() => {
    const sub = window.__game.level.subtrack, pts = sub.pts, found = [];
    const headingAt = (dist) => {
      const wrapped = ((dist % sub.totalDist) + sub.totalDist) % sub.totalDist;
      let best = pts[0];
      for (const point of pts) if (point.dist <= wrapped) best = point;
      return best.heading;
    };
    const turnAt = (dist) => Math.abs(Math.atan2(Math.sin(headingAt(dist + 15) - headingAt(dist - 15)),
      Math.cos(headingAt(dist + 15) - headingAt(dist - 15))));
    const turns = [];
    for (let dist = 0; dist < sub.totalDist; dist += 5) turns.push([dist, turnAt(dist)]);
    turns.sort((first, second) => second[1] - first[1]);
    for (const [dist, turn] of turns) {
      if (turn < 0.4) break;
      const gap = (other) => Math.min(Math.abs(other - dist), sub.totalDist - Math.abs(other - dist));
      if (found.every((other) => gap(other) > 60)) found.push(dist);
    }
    return found.sort((first, second) => first - second);
  });
  console.log('corners at', corners.join(', '));
  for (const dist of corners) {
    await page.evaluate(async (where) => {
      const game = window.__game, sub = game.level.subtrack;
      let best = sub.pts[0];
      for (const point of sub.pts) if (point.dist <= where) best = point;
      const { reset } = await import('/src/vehicle.ts');
      game.car.crossing = -1;
      reset(game.car, best.x, best.y, best.heading);
      game.input.update = () => ({ throttle: 0, brake: 1, steer: 0, handbrake: 0, reverse: 0,
        shiftUp: false, shiftDown: false });
    }, dist);
    await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), ZOOM);
    await page.waitForTimeout(900);
    await shoot(`corner-${dist}`);
  }
  console.log(errors.length ? `ERRORS ${errors.slice(0, 5).join(' | ')}` : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
