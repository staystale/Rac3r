// _aiputback.mjs - JOB 2a (?aireset=1): the AI's own crash / injury put-back (game/ai.ts
// stepAIInjury -> aiReset; a roll's calls the same) set up where the old rule could put it AHEAD of
// where the car is, or onto a car. The real game in a browser, real time.
//   back      circuits, RX, stages: an AI car on the road at d0 (its last spot on the road), then
//             30 m back down the run-off, 9 m out; its injury pause ended - put back ahead of where
//             it was (its nearest road point) is a FAIL
//   blocked   the same, with that put-back's own spot (found first, with nothing there) taken by
//             another AI car: landing on it is a FAIL
//   hw        the endless road: an AI racer's put-back with another racer parked on its spot
// Each line: OK / FAIL, the metres put ahead (+) or behind (-) of where it was, the cars it landed
// on. [CASES=circuit,rx,stage,hw-twisty] [RAC3R_QUERY=aireset=1]; exit 1 on a FAIL.
// node tools/scratch/_aiputback.mjs
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const ALL = {
  circuit: ['thruston', { ai: 3 }, ['back', 'blocked']],
  rx: ['knobhill', { ai: 3, rx: true }, ['back', 'blocked']],
  stage: ['gen-forest-medium-mixed-1001', { ai: 3 }, ['back', 'blocked']],
  'hw-twisty': ['highway', { ai: 3, traffic: 0, road: 'twisty' }, ['hw']],
};
const CASES = (process.env.CASES || Object.keys(ALL).join(',')).split(',');
// m a put-back may land ahead and still count as in line (a road point's own rounding)
const TOLERANCE_M = 0.5;

/** Page side: helpers on window.__ap. */
async function installHelpers() {
  const tyrewall = await import('/src/world/tyrewall.ts');
  const game = window.__game;
  const nearest = (x, y) => {
    const sub = game.level.subtrack;
    let best = sub.pts[0], bestD = Infinity;
    for (const point of sub.pts) {
      const dist = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (dist < bestD) { bestD = dist; best = point; }
    }
    return { dist: best.dist, off: (x - best.x) * best.nx + (y - best.y) * best.ny };
  };
  const lapAhead = (from, onto) => {
    const total = game.level.subtrack.totalDist;
    return ((onto - from) % total + total * 1.5) % total - total / 2;
  };
  const put = (car, x, y, heading) => {
    Object.assign(car, { x, y, heading, vx: 0, vy: 0, yawRate: 0, _p: null, prevWheels: null });
  };
  const putOn = (car, dist, off) => {
    const pose = tyrewall.onTrack(game.level.subtrack, dist, off, {});
    put(car, pose.x, pose.y, pose.rot);
  };
  const touching = (car, other) => [car.heading, car.heading + Math.PI / 2, other.heading,
    other.heading + Math.PI / 2].every((angle) => {
    const ax = Math.cos(angle), ay = Math.sin(angle);
    const reach = (body) => body.spec.len / 2 * Math.abs(Math.cos(body.heading) * ax
      + Math.sin(body.heading) * ay) + body.spec.wid / 2 * Math.abs(-Math.sin(body.heading)
      * ax + Math.cos(body.heading) * ay);
    return Math.abs((other.x - car.x) * ax + (other.y - car.y) * ay) < reach(car) + reach(other);
  });
  // the injury pause over this step: the next AI step puts it back
  const hurt = (entry) => { entry.hurtWait = 0; entry.hurtT = 0; };
  window.__ap = { nearest, lapAhead, put, putOn, touching, hurt };
}

/** Waits ms of real time. */
const wait = (page, ms) => page.waitForTimeout(ms);

/** A circuit / stage case. */
async function lapCase(page, kind) {
  const sub = await page.evaluate(() => ({ total: window.__game.level.subtrack.totalDist,
    width: window.__game.level.subtrack.width }));
  const d0 = sub.total * 0.4, back = [d0 - 30, sub.width / 2 + 9];
  // the put-back with nothing in the way: where it lands
  const putBack = (block) => page.evaluate(([dist, where, spot]) => {
    const ap = window.__ap, game = window.__game, entry = game.ai[0], car = entry.car;
    ap.putOn(car, dist, 0);
    car._lastOn = ap.nearest(car.x, car.y);
    ap.putOn(car, where[0], where[1]);
    for (const other of game.ai.slice(1)) ap.put(other.car, other.car.x + 400, other.car.y, 0);
    if (spot) ap.put(game.ai[1].car, spot.x, spot.y, spot.heading);
    ap.hurt(entry);
    return ap.nearest(car.x, car.y).dist;
  }, [d0, back, block]);
  const read = () => page.evaluate(() => {
    const ap = window.__ap, game = window.__game, car = game.ai[0].car;
    return { x: car.x, y: car.y, heading: car.heading, dist: ap.nearest(car.x, car.y).dist,
      onCar: game.ai.slice(1).filter((other) => ap.touching(car, other.car)).length };
  });
  const was = await putBack(null);
  await wait(page, 300);
  let landed = await read();
  if (kind === 'blocked') {
    await putBack(landed);
    await wait(page, 300);
    landed = await read();
  }
  const ahead = await page.evaluate(([from, onto]) => window.__ap.lapAhead(from, onto),
    [was, landed.dist]);
  const fail = ahead > TOLERANCE_M || landed.onCar > 0;
  return `${fail ? 'FAIL' : 'OK  '} ${kind}: ${ahead >= 0 ? '+' : ''}${ahead.toFixed(1)} m from`
    + ` where it was, on ${landed.onCar} car(s)`;
}

/** The endless road: a racer's put-back with another racer parked on its spot. */
async function hwCase(page) {
  const first = await page.evaluate(() => {
    const game = window.__game, entry = game.ai[0];
    window.__ap.hurt(entry);
    return { x: entry.car.x, y: entry.car.y };
  });
  await wait(page, 300);
  const spot = await page.evaluate(() => {
    const car = window.__game.ai[0].car;
    return { x: car.x, y: car.y, heading: car.heading };
  });
  const res = await page.evaluate(([from, at]) => {
    const ap = window.__ap, game = window.__game, entry = game.ai[0], car = entry.car;
    ap.put(car, from.x, from.y, car.heading);
    ap.put(game.ai[1].car, at.x, at.y, at.heading);
    game.ai[1].car.vx = 0;
    ap.hurt(entry);
    return true;
  }, [first, spot]);
  await wait(page, 300);
  const out = await page.evaluate(() => {
    const ap = window.__ap, game = window.__game, car = game.ai[0].car;
    return game.ai.slice(1).filter((other) => ap.touching(car, other.car)).length;
  });
  return `${out ? 'FAIL' : 'OK  '} hw: the put-back with a racer on its spot - on ${out} car(s)`
    + `${res ? '' : ' (no set-up)'}`;
}

const server = await startServer();
const browser = await launchBrowser();
let fails = 0;
try {
  for (const name of CASES) {
    const [level, opts, kinds] = ALL[name];
    const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await gotoGame(page, `${server.url}/?touch=1&menu=0&guide=0&rules=0&loadscreen=0${
      extraQuery()}`);
    await page.evaluate(([id, launch]) => window.__game.launch(id, 'hatch-rwd', launch),
      [level, opts]);
    // (the race starts on your first throttle)
    await page.keyboard.down('ArrowUp');
    await wait(page, 9000);
    await page.keyboard.up('ArrowUp');
    await page.evaluate(installHelpers);
    for (const kind of kinds) {
      const line = kind === 'hw' ? await hwCase(page) : await lapCase(page, kind);
      if (line.startsWith('FAIL')) fails++;
      console.log(`${name.padEnd(10)} ${line}`);
    }
    if (errors.length) console.log(`${name}: page error ${errors[0]}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
process.exit(fails ? 1 : 0);
