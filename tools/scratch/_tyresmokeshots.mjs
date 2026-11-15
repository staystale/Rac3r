// _tyresmokeshots.mjs - TYRE SMOKE PHOTOS in the real game (Thruston, no AI, aids off), at
// 844x390 and 390x844, of three scenes:
//   burnout  the RWD hatch held by the brake at 0.4, full throttle, 5 s from cold
//   lockup   the hatch at 30 m/s down the start straight, tyres 90 C, full brake, ABS off, 0.9 s
//   corner   the racing AI drives the F2 (?autopilot=1), its tyres preset to 95 C; a burst of
//            shots through the fast corners (each logged with its speed and tyre smoke)
// Each shot's line gives both rules' strength for the four tyres at that moment (render/
// tyresmoke.ts), whichever the page draws. RAC3R_QUERY=tyresmoke=1 for the window rule.
// node tools/scratch/_tyresmokeshots.mjs <out dir> [scenes,...]
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';
import { mkdirSync } from 'node:fs';

const [outDir = 'tools/scratch/_tyresmokeshots', scenesArg = 'burnout,lockup,corner'] =
  process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const tag = extraQuery().includes('tyresmoke=1') ? 'on' : 'off';
const VIEWS = [[844, 390], [390, 844]];
const HELD = { steer: 0, throttle: 0, brake: 0, handbrake: 0, reverse: 0, shiftUp: false,
  shiftDown: false };

/** In the page: both rules' strength of the player's four tyres now. */
async function smokeNow(page) {
  return page.evaluate(async () => {
    const rules = await import('/src/render/tyresmoke.ts');
    const car = window.__game.car, telem = car.t;
    const tyres = [0, 1, 2, 3].map((tyre) => ({ front: tyre < 2, heat: car.tyreT[tyre],
      slip: tyre < 2 ? telem.slipSpeedF : telem.slipSpeedR }));
    const fix = (list) => list.map((value) => value.toFixed(2)).join(' ');
    return `speed ${Math.hypot(car.vx, car.vy).toFixed(0)} m/s, tyres ${car.tyreT.map((heat) =>
      heat.toFixed(0)).join('/')} C, old ${fix(tyres.map(rules.earlySmokeStrength))}, new ${
      fix(tyres.map((tyre) => rules.windowSmokeStrength(tyre, car)))}`;
  });
}

/** Launches Thruston with no AI in a car, the aids off, the camera pinned. */
async function startCar(page, carId) {
  await page.evaluate((id) => window.__game.launch('thruston', id, { ai: 0 }), carId);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const car = window.__game.car;
    car.absOn = false;
    car.tcsOn = false;
    window.__game.renderer.debugZoom(0.9);
  });
}

/** Holds an input from now on. */
const hold = (page, input) => page.evaluate((held) => {
  window.__game.input.update = () => held;
}, { ...HELD, ...input });

const SCENES = {
  async burnout(page, shoot) {
    await startCar(page, 'hatch-rwd');
    await page.evaluate(() => { window.__game.car.tyreT = [18, 18, 18, 18]; });
    await hold(page, { throttle: 1, brake: 0.4 });
    await page.waitForTimeout(5000);
    await shoot('burnout');
  },
  async lockup(page, shoot) {
    await startCar(page, 'hatch-rwd');
    await page.evaluate(() => {
      // on the track, along it: the start of the lap's straightest 100 m
      const game = window.__game, car = game.car, pts = game.level.subtrack.pts;
      const turnOver = (index) => {
        const ahead = pts.find((point) => point.dist > pts[index].dist + 100);
        return ahead ? Math.abs(Math.atan2(Math.sin(ahead.heading - pts[index].heading),
          Math.cos(ahead.heading - pts[index].heading))) : Infinity;
      };
      let best = 0;
      for (let index = 0; index < pts.length; index += 5) {
        if (turnOver(index) < turnOver(best)) best = index;
      }
      const spot = pts[best];
      Object.assign(car, { x: spot.x, y: spot.y, heading: spot.heading, yawRate: 0,
        vx: 30 * Math.cos(spot.heading), vy: 30 * Math.sin(spot.heading) });
    });
    // the camera catches the car up first
    await hold(page, { throttle: 0.6 });
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.__game.car.tyreT = [90, 90, 90, 90]; });
    await hold(page, { brake: 1 });
    await page.waitForTimeout(900);
    await shoot('lockup');
  },
  async corner(page, shoot) {
    await startCar(page, 'f2-rwd');
    await page.evaluate(() => { window.__game.car.tyreT = [95, 95, 95, 95]; });
    await page.waitForTimeout(12000);
    for (let shot = 0; shot < 16; shot++) {
      await page.waitForTimeout(700);
      await shoot(`corner${shot}`);
    }
  },
};

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [viewW, viewH] of VIEWS) {
    for (const scene of scenesArg.split(',')) {
      const context = await browser.newContext({ viewport: { width: viewW, height: viewH } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=thruston${
        scene === 'corner' ? '&autopilot=1' : ''}${extraQuery()}`);
      await page.mouse.click(viewW / 2, viewH / 2);
      await page.waitForTimeout(1000);
      const shoot = async (name) => {
        const file = `${outDir}/${name}-${viewW}x${viewH}-${tag}.png`;
        const state = await smokeNow(page);
        await page.screenshot({ path: file });
        console.log(`${file}: ${state}`);
      };
      await SCENES[scene](page, shoot);
      if (errors.length) console.log(`PAGE ERRORS ${errors.slice(0, 3).join(' | ')}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}
