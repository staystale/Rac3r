// _xgaymsshots.mjs - L.A. LIVELY (X Gayms) in the live game at phone size (scratch): by day and at
// night (TEST MODE's start hour) - the start, the gap jump driven at a speed (a shot every
// JUMP_SHOT_S s: take-off, in the air, the landing), the joker's split and merge, the crossover
// driven from below and from above, each corner with the car parked on it, and the whole map
// (the day's thumbnail; the night's from high up) - with the darkness and the page errors.
// Written to OUT (default shots/xgayms). node tools/scratch/_xgaymsshots.mjs  (env VIEW, ZOOM,
// OUT, JUMP_KMH; CHECK_PORT)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const level = 'xgayms', query = 'x=0';
const ZOOM = +(process.env.ZOOM || 0.6), JUMP_KMH = +(process.env.JUMP_KMH || 80);
const JUMP_SHOT_S = 0.22, JUMP_SHOTS = 11;
const OUT = process.env.OUT || 'shots/xgayms';
fs.mkdirSync(OUT, { recursive: true });

/** Puts the car at a spot, held on the brake (a parked car for a photograph). */
async function parkAt(page, x, y, heading) {
  await page.evaluate(async ([px, py, ph]) => {
    const game = window.__game, { reset } = await import('/src/vehicle.ts');
    game.car.crossing = -1;
    reset(game.car, px, py, ph);
    game.input.update = () => ({ throttle: 0, brake: 1, steer: 0, handbrake: 0, reverse: 0,
      shiftUp: false, shiftDown: false });
  }, [x, y, heading]);
}

/** The gap jump: the car on the joker straight at JUMP_KMH, held to it on the lane's middle. */
async function shootJump(page, shoot, when) {
  await page.evaluate(async (kmh) => {
    const game = window.__game, { reset } = await import('/src/vehicle.ts');
    const { repair } = await import('/src/damage.ts');
    repair(game.car);
    game.car.crossing = -1;
    reset(game.car, 128, -140, Math.PI);
    game.car.vx = -kmh / 3.6;
    game.input.update = () => {
      const car = game.car, speed = Math.hypot(car.vx, car.vy) * 3.6;
      const headErr = Math.atan2(Math.sin(car.heading - Math.PI), Math.cos(car.heading - Math.PI));
      return { throttle: speed < kmh ? 1 : 0.15, brake: 0, handbrake: 0, reverse: 0,
        steer: Math.max(-1, Math.min(1, -(car.y + 140) * 0.08 - headErr * 1.5)),
        shiftUp: false, shiftDown: false };
    };
  }, JUMP_KMH);
  await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), ZOOM);
  for (let shot = 0; shot < JUMP_SHOTS; shot++) {
    await page.waitForTimeout(JUMP_SHOT_S * 1000);
    const state = await page.evaluate(() => {
      const car = window.__game.car;
      return { x: +car.x.toFixed(1), z: +(car.z || 0).toFixed(2), air: +car.air.toFixed(2),
        kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6) };
    });
    console.log(when, 'jump', shot, JSON.stringify(state));
    await shoot(`${when}-jump-${shot}`);
  }
}

/** The crossover from below and from above, the demo driver on the lap. */
async function shootCrossover(page, shoot, when) {
  for (const leg of ['under', 'over']) {
    await page.evaluate(async (which) => {
      const game = window.__game, sub = game.level.subtrack, span = sub.under[0];
      const at = which === 'under' ? span.d0 - 15 : span.over - 30;
      let best = sub.pts[0];
      for (const point of sub.pts) if (point.dist <= at) best = point;
      const { reset } = await import('/src/vehicle.ts');
      game.car.crossing = -1;
      reset(game.car, best.x, best.y, best.heading);
      Object.assign(game.car, { vx: 14 * Math.cos(best.heading), vy: 14 * Math.sin(best.heading) });
      const auto = await import('/src/ai/autodrive.ts');
      const driver = auto.createAutoDriver(sub);
      game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false,
        shiftDown: false });
    }, leg);
    await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), ZOOM);
    for (let shot = 0; shot < 3; shot++) {
      await page.waitForTimeout(500);
      const state = await page.evaluate(() => {
        const game = window.__game, car = game.car, way = car.crossing ?? -1;
        const crossing = way >= 0 ? game.level.crossings[way] : null;
        return { level: crossing ? (crossing.track ? 'UNDERPASS' : crossing.kind) : 'ground',
          at: [+car.x.toFixed(1), +car.y.toFixed(1)], hit: car._hitKind || null };
      });
      console.log(when, leg, shot, JSON.stringify(state));
      await shoot(`${when}-x-${leg}-${shot}`);
    }
  }
}

// the spots photographed with the car parked: the lap's corners and the joker's split and merge
const SPOTS = [
  ['corner-west-lot', -142, 82, -Math.PI / 2], ['corner-avenue', -142, 6, 0],
  ['corner-east-jog', 82, -14, -Math.PI / 2], ['corner-east-lot', 150, -60, -Math.PI / 2],
  ['joker-split', 150, -95, -Math.PI / 2], ['corner-north', 8, -106, Math.PI / 2],
  ['joker-merge', 0, -100, Math.PI / 2], ['corner-south', -6, 86, Math.PI],
  ['street-avenue', -70, 0, 0], ['street-south', -60, 90, Math.PI],
];

/** One time of day: launch at that hour, then every shot. */
async function shootAt(page, shoot, hour, when) {
  await page.evaluate(([lv, at]) => window.__game.launch(lv, window.__game.car.spec.id,
    { ai: 5, laps: 3, time: at }), [level, hour]);
  await page.waitForTimeout(3000);
  const info = await page.evaluate(async () => {
    const game = window.__game, lv = game.level, { DAYLIGHT } = await import('/src/world/daylight.ts');
    return { lap: +lv.subtrack.totalDist.toFixed(1), props: lv.props.length, cones: lv.cones.length,
      darkness: +DAYLIGHT.darkness.toFixed(2) };
  });
  console.log(when, JSON.stringify(info));
  await page.evaluate(() => window.__game.renderer.debugZoom(0.45));
  await page.waitForTimeout(600);
  await shoot(`${when}-start`);
  if (when === 'day') {
    const url = await page.evaluate(() => window.__game.renderer.thumbnail(1600).toDataURL());
    fs.writeFileSync(`${OUT}/${level}-overview-day.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  await page.waitForTimeout(5000);
  await shootJump(page, shoot, when);
  for (const [name, x, y, heading] of SPOTS) {
    await parkAt(page, x, y, heading);
    await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), ZOOM);
    await page.waitForTimeout(800);
    await shoot(`${when}-${name}`);
  }
  await shootCrossover(page, shoot, when);
  await parkAt(page, 0, -30, 0);
  await page.evaluate(() => window.__game.renderer.debugZoom(0.1));
  await page.waitForTimeout(900);
  await shoot(`${when}-map`);
}

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
  const shoot = (name) => page.screenshot({ path: `${OUT}/${level}-${name}-${tag}.png` });
  await shootAt(page, shoot, 13, 'day');
  await shootAt(page, shoot, 23, 'night');
  console.log(errors.length ? `ERRORS ${errors.slice(0, 5).join(' | ')}` : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
