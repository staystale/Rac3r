// _hwdodgeshot.mjs - BUG 10 (the highway racers and oncoming cars) PHOTOS: a highway race on the
// twisty single lane with traffic, 5 AI, your car on ?autopilot, deterministic (seeded, fake clock:
// the race waits while a photo is taken). The camera is put on a RACER (the tool swaps which car
// the renderer follows; the HUD stays yours), so any racer can be photographed, not only one near
// your car. The first case of either kind:
// - BACK: a racer over the road's middle line while its driver keeps it to its side for an oncoming
//   car (drv.state.keepMax set, state.oncomingCar ahead) - photographed then, 0.6 s and 1.2 s later.
// - HELD: a racer kept to its side, on it, behind a slower same-way car within 30 m in its lane,
//   with the oncoming car ahead - photographed then and 1.2 s later (still behind, still in lane).
// Searching is not drawn (fast); each case is drawn from 0.5 s on (the camera on it). Gives up after SECONDS.
// SHOTS=<folder> VIEW=844x390 SEED=1 SECONDS=150 FROM=40 CHECK_PORT=...
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';
import { installDeterminism, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const SHOTS = process.env.SHOTS || 'hwdodgeshots';
const [VIEW_W, VIEW_H] = (process.env.VIEW || '844x390').split('x').map(Number);
const SEED = Number(process.env.SEED || 1), SECONDS = Number(process.env.SECONDS || 150);
// s of race before the search starts (40 by default: the field racing, strung out)
const FROM = Math.max(40, Number(process.env.FROM || 40));
// frames between looks while searching (0.1 s)
const LOOK_FRAMES = 6;

/** Page side: the renderer follows window.__shotCar when set (the race is untouched). */
function installCameraSwap() {
  const game = window.__game, renderer = game.renderer, frame = renderer.frame;
  window.__drawOn = true;
  renderer.frame = (raceGame, wallDt, wallT) => {
    if (!window.__drawOn) return;
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

/** Page side: a case to photograph, or null. */
function findCase(wanted) {
  const game = window.__game, geo = game.level._hw.geo;
  const cars = [game.car, ...game.ai.map((entry) => entry.car), ...game.traffic.cars];
  for (const entry of game.ai) {
    const car = entry.car, state = entry.drv.state, mine = car._hwf, other = state.oncomingCar;
    if (!Number.isFinite(state.keepMax) || !mine || !other || !other._hwf) continue;
    const over = mine.off - (geo.oppL - car.spec.wid / 2);
    const oncomingAhead = other._hwf.s - mine.s;
    // (a clean case: no other car within 6 m)
    const crowded = cars.some((near) => near !== car && near._hwf
      && Math.abs(near._hwf.s - mine.s) < 6
      && Math.abs(near._hwf.off - mine.off) < 4);
    if (crowded) continue;
    if (wanted.includes('BACK') && over > 0.3 && oncomingAhead < 160
      && mine.v > 20) {
      return { kind: 'BACK', num: car.num, over: +over.toFixed(1), oncomingAhead: +oncomingAhead
        .toFixed(0) };
    }
    if (!wanted.includes('HELD') || over > -0.3 || oncomingAhead > 100) continue;
    for (const ahead of cars) {
      const frame = ahead._hwf;
      if (ahead === car || !frame || frame.v < 2 || mine.v < 20) continue;
      const gap = frame.s - mine.s;
      if (gap > 6 && gap < 30 && Math.abs(frame.off - mine.off) < 1.8 && frame.v < mine.v - 3) {
        return { kind: 'HELD', num: car.num, gap: +gap.toFixed(0), aheadV: +frame.v.toFixed(1),
          myV: +mine.v.toFixed(1), oncomingAhead: +oncomingAhead.toFixed(0) };
      }
    }
  }
  return null;
}

/** Page side: what a racer is doing now (for the log). */
function racerNow(num) {
  const game = window.__game, geo = game.level._hw.geo;
  const entry = game.ai.find((item) => item.car.num === num);
  const car = entry.car, mine = car._hwf, other = entry.drv.state.oncomingCar;
  return { over: +(mine.off - (geo.oppL - car.spec.wid / 2)).toFixed(1), v: +mine.v.toFixed(1),
    kept: Number.isFinite(entry.drv.state.keepMax),
    oncomingAhead: other && other._hwf ? +(other._hwf.s - mine.s).toFixed(0) : null };
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
    + `&level=highway&autopilot=1${extraQuery()}`, 'window.__rt');
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((seed) => window.__rt.seed(seed), SEED);
  await page.evaluate(launchLevel, ['highway', { car: 'hatch-rwd', ai: 5, traffic: 1.5,
    road: 'twisty' }]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(installCameraSwap);
  await page.evaluate(`window.__findCase = ${findCase.toString()};
    window.__racerNow = ${racerNow.toString()};`);
  // (the racers' grid and rolling start, drawn: the fly-in runs in the drawing)
  await page.evaluate(() => window.__rt.step(480));
  // (then to FROM s, undrawn: the field strung out, racing)
  await page.evaluate((count) => { window.__drawOn = false; window.__rt.step(count); }, FROM * 60 - 480);
  const wanted = [['BACK', 'HELD']];
  let shot = 0, frames = FROM * 60;
  while (shot < wanted.length && frames < SECONDS * 60) {
    const found = await page.evaluate(([look, kinds]) => {
      window.__rt.step(look);
      return window.__findCase(kinds);
    }, [LOOK_FRAMES, wanted[shot]]);
    frames += LOOK_FRAMES;
    if (process.env.DEBUG && frames % 600 === 0) console.log(frames / 60, await page.evaluate(() => window.__game.ai.map((entry) => [entry.car.num, Math.round(entry.car._hwf?.v ?? -99), Number.isFinite(entry.drv.state.keepMax), +(entry.car._hwf ? entry.car._hwf.off - (window.__game.level._hw.geo.oppL - entry.car.spec.wid / 2) : 0).toFixed(1)].join(" ")).join(" | ")));
    if (!found) continue;
    // the camera onto it and the ground painted (0.5 s drawn), then the photos
    await page.evaluate((num) => {
      const game = window.__game;
      window.__shotCar = game.ai.find((entry) => entry.car.num === num).car;
      window.__drawOn = true;
      game.renderer.snap(window.__shotCar);
      window.__rt.step(30);
    }, found.num);
    const name = `${SHOTS}/hwdodge-${found.kind.toLowerCase()}-${shot + 1}-${VIEW_W}x${VIEW_H}`;
    const offsets = found.kind === 'BACK' ? [0, 36, 36] : [0, 72];
    const states = [];
    for (let i = 0; i < offsets.length; i++) {
      await page.evaluate((count) => window.__rt.step(count), offsets[i]);
      await page.screenshot({ path: `${name}-${i}.png` });
      states.push(await page.evaluate((num) => window.__racerNow(num), found.num));
    }
    console.log(`${name}: ${JSON.stringify(found)} then ${JSON.stringify(states)}`);
    await page.evaluate(() => { window.__drawOn = false; window.__shotCar = null; });
    frames += 30 + offsets.reduce((sum, count) => sum + count, 0);
    shot++;
  }
  if (shot < wanted.length) console.log(`only ${shot} cases in ${SECONDS} s`);
  if (errors.length) console.log('PAGE ERRORS: ' + errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.stop();
}
