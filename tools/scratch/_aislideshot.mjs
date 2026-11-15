// _aislideshot.mjs - BUG 9 (?aislide=1) PHOTOS: an AI racer HOLDING A SLIDE. A race on LEVEL
// (default sweaty-lamb: gravel) with 5 AI, your car on ?autopilot, deterministic (seeded, fake
// clock). The camera follows a racer (the renderer's car swapped, as _hwdodgeshot.mjs; the HUD
// stays yours), drawn all the time, each racer in turn for PER s; when the followed racer's driver
// is holding a slide (drv.state.lastDrift this step) with the rear over HOLD_RAD of slip, it is
// photographed then and 0.3 s later.
// SHOTS=<folder> VIEW=844x390 LEVEL=sweaty-lamb CAR=rally-4x4 SEED=1 PER=20 FROM=6 HOLD_RAD=0.15
// RAC3R_QUERY=aislide=1 CHECK_PORT=... node tools/scratch/_aislideshot.mjs
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';
import { installDeterminism, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const SHOTS = process.env.SHOTS || 'aislideshots';
const [VIEW_W, VIEW_H] = (process.env.VIEW || '844x390').split('x').map(Number);
const LEVEL = process.env.LEVEL || 'sweaty-lamb', CAR = process.env.CAR || 'rally-4x4';
const SEED = Number(process.env.SEED || 1), PER = Number(process.env.PER || 20);
const FROM = Number(process.env.FROM || 6), HOLD_RAD = Number(process.env.HOLD_RAD || 0.15);
// frames between looks (0.05 s)
const LOOK_FRAMES = 3;

/** Page side: the renderer follows window.__shotCar when set (the race is untouched). */
function installCameraSwap() {
  const game = window.__game, renderer = game.renderer, frame = renderer.frame;
  renderer.frame = (raceGame, wallDt, wallT) => {
    const target = window.__shotCar;
    if (!target || target === raceGame.car) return frame(raceGame, wallDt, wallT);
    // the racer as "the car" and you in its place among the AI, so every car is drawn once
    const view = new Proxy(raceGame, { get(obj, key) {
      if (key === 'car') return target;
      if (key === 'ai') return obj.ai.map((entry) => (entry.car === target
        ? { ...entry, car: obj.car } : entry));
      return Reflect.get(obj, key);
    } });
    return frame(view, wallDt, wallT);
  };
}

/** Page side: follow racer `index`; its slide now, or null when it is not holding one. */
function followAndLook([index, holdRad]) {
  const game = window.__game, entry = game.ai[index % game.ai.length];
  if (window.__shotCar !== entry.car) {
    window.__shotCar = entry.car;
    game.renderer.snap(entry.car);
  }
  const state = entry.drv.state, slip = Math.abs(entry.car.t.slipR || 0);
  const holding = state.lastDrift !== undefined && state.t - state.lastDrift < 0.02;
  return holding && slip > holdRad ? { num: entry.car.num, slip: +slip.toFixed(2),
    speed: +Math.hypot(entry.car.vx, entry.car.vy).toFixed(1),
    surface: entry.car.surface.id ?? null } : null;
}

const server = await startServer();
const browser = await launchBrowser();
mkdirSync(SHOTS, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.addInitScript(installDeterminism);
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&loadscreen=0&noaudio=1`
    + `&level=${LEVEL}&autopilot=1${extraQuery()}`, 'window.__rt');
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((seed) => window.__rt.seed(seed), SEED);
  await page.evaluate(launchLevel, [LEVEL, { car: CAR, ai: 5 }]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(installCameraSwap);
  await page.evaluate(`window.__look = ${followAndLook.toString()};`);
  await page.evaluate((count) => window.__rt.step(count), FROM * 60);
  let found = null, frames = 0;
  for (let racer = 0; racer < 5 && !found; racer++) {
    for (frames = 0; frames < PER * 60 && !found; frames += LOOK_FRAMES) {
      found = await page.evaluate(([look, index, holdRad]) => {
        window.__rt.step(look);
        return window.__look([index, holdRad]);
      }, [LOOK_FRAMES, racer, HOLD_RAD]);
    }
  }
  if (found) {
    const name = `${SHOTS}/aislide-${LEVEL}-${VIEW_W}x${VIEW_H}`;
    await page.screenshot({ path: `${name}-0.png` });
    await page.evaluate(() => window.__rt.step(18));
    await page.screenshot({ path: `${name}-1.png` });
    console.log(`${name}: ${JSON.stringify(found)}`);
  } else console.log(`no held slide in ${5 * PER} s`);
  if (errors.length) console.log('PAGE ERRORS: ' + errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.stop();
}
