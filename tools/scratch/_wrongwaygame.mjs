// _wrongwaygame.mjs - BUG 5 in the REAL GAME (?wrongway=1): the endless road's wrong-way guard
// against what a driver does, the player's own input replaced by a script (the pedals ramped as
// input.ts ramps them). Each case from a fresh road (RESTART), the car put on the road ~200 m on:
//   reverse15   reverse 15 m from a stop                         must NOT reset
//   uturn       turn round from rest facing back down the road  must NOT reset
//   knock       knocked back at 8 m/s (a head-on), a 1 s reaction, then the brake   must NOT reset
//   reverse80   reverse held, 80 m                               must reset (WRONG WAY)
//   wrongdrive  facing back down the road, throttle held and steering down it, 20 s  must reset
// Each line: what happened (reset or not), when (s) and how far back from the furthest point.
// [ROADS=motorway,twisty,canyon,walled] [CARS=hatch-rwd,rx-super,tractor,f2-rwd]
// [AI=2] [RAC3R_QUERY=wrongway=1] node tools/scratch/_wrongwaygame.mjs
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const ROADS = (process.env.ROADS || 'motorway,twisty,canyon,walled').split(',');
const CARS = (process.env.CARS || 'hatch-rwd,rx-super,tractor,f2-rwd').split(',');
// SHOTS=<folder>: a photo at the end of reverse15 and just after wrongdrive's reset; VIEW=WxH
const SHOTS = process.env.SHOTS || '';
const [VIEW_W, VIEW_H] = (process.env.VIEW || '844x390').split('x').map(Number);
// AI=2: a highway race, each case after the green; TRAFFIC=1 traffic on the road
const AI = Number(process.env.AI || 0), TRAFFIC = Number(process.env.TRAFFIC || 0);
const MUST_RESET = new Set(['reverse80', 'wrongdrive']);
const KINDS = ['reverse15', 'uturn', 'knock', 'reverse80', 'wrongdrive'];
const ROAD_OPTS = {
  motorway: { road: 'motorway' }, twisty: { road: 'twisty' },
  canyon: { road: 'dual', scenery: 'canyon' }, walled: { road: 'walled' },
};

/** Page side: install the scripted driver for one case; window.__ww holds what it saw. */
function startCase(kind) {
  const game = window.__game, level = game.level, car = game.car;
  const highway = window.__wwHighway, frame = level._hw.q;
  const lane = level._hw.geo.centres[0], dist = frame.s + 20;
  const pose = highway.roadPose(level, dist, lane);
  const facesBack = kind === 'uturn' || kind === 'wrongdrive';
  Object.assign(car, { x: pose.x, y: pose.y, heading: pose.h + (facesBack ? Math.PI : 0),
    vx: 0, vy: 0, yawRate: 0, _p: null, prevWheels: null });
  if (kind === 'knock') {
    car.vx = -Math.cos(pose.h) * 8;
    car.vy = -Math.sin(pose.h) * 8;
  }
  const watch = { kind, start: performance.now(), snaps: window.__wwSnaps, reset: null,
    worstBack: 0, done: false, fromS: dist };
  window.__ww = watch;
  const ramp = (heldS, least, full) => Math.min(1, least + (1 - least) * heldS / full);
  game.input.update = () => {
    const heldS = (performance.now() - watch.start) / 1000, state = level._hw;
    const here = state.q;
    if (here) watch.worstBack = Math.max(watch.worstBack, state.best - here.s);
    if (window.__wwSnaps !== watch.snaps && !watch.reset) {
      watch.reset = { atS: heldS, back: watch.worstBack, why: game.notice?.text ?? '-' };
    }
    const input = { steer: 0, throttle: 0, brake: 0, handbrake: 0, reverse: 0, shiftUp: false,
      shiftDown: false };
    if (watch.reset || heldS > 22) {
      if (!watch.done && here) watch.end = { off: here.off, facing: Math.round(Math.abs(Math.atan2(
        Math.sin(car.heading - Math.atan2(here.dy, here.dx)), Math.cos(car.heading
        - Math.atan2(here.dy, here.dx)))) * 180 / Math.PI), speed: Math.hypot(car.vx, car.vy) };
      watch.done = true;
      input.brake = 1;
      return input;
    }
    // (the road frame is the old spot's until the car has been stepped where it was put)
    if (here && Math.abs(here.s - watch.fromS) < 3) watch.seen = true;
    const backFrom = here && watch.seen ? watch.fromS - here.s : 0;
    if (kind === 'reverse15' || kind === 'reverse80') {
      if (backFrom < (kind === 'reverse15' ? 15 : 80)) input.reverse = ramp(heldS, 0.26, 1.5);
      else { input.brake = 1; if (Math.hypot(car.vx, car.vy) < 0.3) watch.done = true; }
    } else if (kind === 'uturn') {
      const off = Math.atan2(Math.sin(car.heading - (here ? Math.atan2(here.dy, here.dx) : 0)),
        Math.cos(car.heading - (here ? Math.atan2(here.dy, here.dx) : 0)));
      if (Math.abs(off) > 0.26) {
        input.steer = off > 0 ? -1 : 1;
        input.throttle = ramp(heldS, 0.26, 1.5);
      } else watch.done = true;
    } else if (kind === 'knock') {
      if (heldS > 1) input.brake = ramp(heldS - 1, 0.28, 1);
      if (heldS > 3 && Math.hypot(car.vx, car.vy) < 0.3) watch.done = true;
    } else {
      // driving the wrong way on purpose: down the road, steering to hold that line
      const down = here ? Math.atan2(-here.dy, -here.dx) : car.heading;
      const err = Math.atan2(Math.sin(car.heading - down), Math.cos(car.heading - down));
      input.steer = Math.max(-1, Math.min(1, -2 * err - 0.3 * car.yawRate));
      input.throttle = ramp(heldS, 0.26, 1.5);
    }
    return input;
  };
}

const server = await startServer();
const browser = await launchBrowser();
let failed = false;
try {
  const errors = [];
  const page = await browser.newPage({ viewport: { width: VIEW_W, height: VIEW_H } });
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&loadscreen=0`
    + extraQuery());
  await page.mouse.click(VIEW_W / 2, VIEW_H / 2);
  await page.waitForTimeout(800);
  for (const road of ROADS) {
    for (const carId of CARS) {
      await page.evaluate(([id, opts, ai, traffic]) => window.__game.launch('highway', id, { ai,
        traffic, ...opts }), [carId, ROAD_OPTS[road], AI, TRAFFIC]);
      await page.evaluate(async () => {
        window.__wwHighway = await import('/src/highway.ts');
        const renderer = window.__game.renderer, snap = renderer.snap;
        window.__wwSnaps = 0;
        renderer.snap = (car) => {
          if (car === window.__game.car) window.__wwSnaps++;
          return snap.call(renderer, car);
        };
      });
      const lines = [];
      for (const kind of KINDS) {
        await page.evaluate(() => window.__game.restart());
        await page.waitForTimeout(1500);
        for (let tries = 0; tries < 30; tries++) {
          if (await page.evaluate(() => !window.__game.start?.on || window.__game.start.green))
            break;
          await page.waitForTimeout(500);
        }
        await page.evaluate(startCase, kind);
        for (let tries = 0; tries < 60; tries++) {
          await page.waitForTimeout(500);
          if (await page.evaluate(() => window.__ww.done)) break;
        }
        const seen = await page.evaluate(() => ({ ...window.__ww }));
        if (SHOTS && (kind === 'reverse15' || kind === 'wrongdrive')) {
          await page.screenshot({ path: `${SHOTS}/_wrongway-${road}-${carId}-${kind}-`
            + `${VIEW_W}x${VIEW_H}.png` });
        }
        const isOk = MUST_RESET.has(kind) === !!seen.reset;
        if (!isOk) failed = true;
        lines.push(`${isOk ? 'OK  ' : 'FAIL'} ${kind.padEnd(10)} `
          + (seen.reset ? `RESET at ${seen.reset.atS.toFixed(1)} s, ${seen.reset.back.toFixed(1)}`
            + ` m back, "${seen.reset.why}"` : `no reset, at most ${seen.worstBack.toFixed(1)}`
            + ' m back' + (seen.end ? ` (ends ${seen.end.off.toFixed(1)} m off the line, facing `
              + `${seen.end.facing} deg off the road, ${seen.end.speed.toFixed(1)} m/s)` : '')));
      }
      console.log(`${road} ${carId}:\n  ${lines.join('\n  ')}`);
    }
  }
  console.log(errors.length ? 'PAGE ERRORS ' + [...new Set(errors)].slice(0, 3).join(' | ')
    : 'page errors none');
  if (errors.length) failed = true;
} finally {
  await browser.close();
  server.stop();
}
console.log(failed ? 'RESULT: FAIL' : 'RESULT: ALL OK');
process.exitCode = failed ? 1 : 0;
