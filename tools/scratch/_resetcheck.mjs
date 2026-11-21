// _resetcheck.mjs - THE OWNER'S 11-21 BUGS 1 AND 2 (scratch, diagnosis): a crash then a RESET in
// the real game (game/session.ts doReset, as the R key / the button), per level and case: driven
// into the barrier at speed; rolled (roll.ts startRoll) and reset mid-roll; tipped onto two wheels
// (physics/tip.ts) and reset; reset while still sliding. After each reset: the car's state that
// could hold it (speed, roll, gear, clutch, brakeArmed, gearLock, rpm, the start hold, the low
// range, the tip pull, the hanging parts), then the throttle held 2 s - how far it got.
// REPEAT=<n> runs the crash cases n times a level; the tally counts a BAD reset: rolling or moving
// 50 ms after it, overturned after the throttle, or under 3 m in the 2 s of throttle.
// node tools/scratch/_resetcheck.mjs [levels] [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [levelsArg = 'thruston,knobhill,croughedrx,highway', query = 'x=1'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();

/** In the page: one case, then the reset and 2 s of throttle. */
async function oneCase([levelId, kind]) {
  const game = window.__game, roll = await import('/src/roll.ts');
  if (window.__lastLevel !== levelId) {
    game.launch(levelId, 'hatch-rwd', { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
    await new Promise((done) => setTimeout(done, 3000));
    window.__lastLevel = levelId;
  }
  const car = game.car, wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  if (kind === 'barrier') {
    // (flung sideways off the road at 30 m/s: into whatever stands there)
    car.vx = -sin * 30; car.vy = cos * 30;
    await wait(1500);
  } else if (kind === 'rolling') {
    car.vx = cos * 15; car.vy = sin * 15;
    roll.startRoll(car, 1, 12);
    await wait(500);
  } else if (kind === 'sliding') {
    car.vx = -sin * 20; car.vy = cos * 20;
    await wait(200);
  }
  const before = { speed: Math.hypot(car.vx, car.vy).toFixed(1), roll: car.roll?.phase || null };
  game.reset();
  await wait(50);
  const after = { speed: +Math.hypot(car.vx, car.vy).toFixed(2), roll: car.roll?.phase || null,
    phi: car.roll ? +car.roll.phi.toFixed(2) : 0, gear: car.gear, clutch: car.clutch,
    brakeArmed: car.brakeArmed, gearLock: car.gearLock, rpm: Math.round(car.rpm),
    low: car.lowRange || false, tipPull: car._tipPull || 0, belly: car.bellyDepth || 0,
    surface: car.surface?.id };
  window.__from = [car.x, car.y];
  return { before, after };
}

/** In the page: how far the car got on the throttle since the reset. */
function afterThrottle() {
  const car = window.__game.car, [x0, y0] = window.__from;
  return { moved2s: +Math.hypot(car.x - x0, car.y - y0).toFixed(1),
    kmh: +(Math.hypot(car.vx, car.vy) * 3.6).toFixed(0), rollNow: car.roll?.phase || null,
    gear: car.gear, clutch: +car.clutch.toFixed(2), rpm: Math.round(car.rpm) };
}

try {
  for (const levelId of levelsArg.split(',')) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&${query}`);
    await page.mouse.click(400, 200);
    await page.waitForTimeout(1200);
    const kinds = ['barrier', 'rolling', 'sliding'], repeat = Number(process.env.REPEAT || 1);
    let bad = 0, cases = 0;
    for (const kind of ['plain', ...Array.from({ length: repeat }, () => kinds).flat()]) {
      const state = await page.evaluate(oneCase, [levelId, kind]);
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(2000);
      await page.keyboard.up('KeyW');
      const result = await page.evaluate(afterThrottle);
      const isBad = state.after.roll || state.after.speed > 0.5 || result.rollNow
        || result.moved2s < 3;
      cases++;
      if (isBad) bad++;
      if (isBad || !process.env.REPEAT) console.log(levelId, kind, isBad ? 'BAD' : 'ok',
        JSON.stringify({ ...state, ...result }));
    }
    console.log(levelId, 'resets', cases, 'bad', bad);
    console.log(levelId, errors.length ? 'ERRORS ' + errors.join(' | ') : 'errors none');
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
