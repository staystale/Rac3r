// _rolljump.mjs - ONE CAR OVER ROUGH GROUND, in the real game: the level launched with the car,
// the player driven by ?autopilot (with AI cars when the level runs them), read every frame for
// SECONDS of real time. Per car: metres covered, top speed, jumps (air spells over 0.2 s) with the
// longest air and the hardest landing (the highest load factor in the 0.5 s after touchdown),
// rolls (a roll started from the wheels) and how each ended, put-backs (a jump of over 8 m in a
// frame); page errors. Nothing in the game is changed: it only reads.
// node tools/scratch/_rolljump.mjs <level | deafvalley> <car> [seconds 120] [ai 0] [seed 1]
// (deafvalley: the highway's single-lane canyon road; RAC3R_QUERY for the car's switch)
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const [LEVEL = 'stage-sahara-sandpants', CAR = 'hatch-fwd', SECONDS = '120', AI = '0',
  SEED = '1'] = process.argv.slice(2);
const server = await startServer();
let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&loadscreen=0&noaudio=1`
    + '&autopilot=1'
    + `&seed=${SEED}${extraQuery()}`);
  await page.evaluate(startReading, [LEVEL, CAR, +AI]);
  // (a session waits for a first tap to start)
  await page.waitForTimeout(1500);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(+SECONDS * 1000);
  const report = await page.evaluate(() => window.__rolljump.cars);
  console.log(`${LEVEL} ${CAR} ${SECONDS} s real, ai ${AI}, seed ${SEED}`);
  report.forEach((each, slot) => console.log(`  ${slot ? 'ai' + slot : 'you'}: `
    + `${(each.metres / 1000).toFixed(2)} km, top ${each.top.toFixed(0)} km/h | jumps `
    + `${each.jumps}, longest air ${each.maxAir.toFixed(2)} s, hardest landing x${each.maxLand
      .toFixed(2)} | rolls ${each.rolls} (ended ${JSON.stringify(each.ends)}) | put-backs `
    + `${each.resets}`));
  console.log(errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
} finally {
  await browser?.close();
  server.stop();
}

/**
 * In the page: launches the level and reads every car each frame.
 * @param {[string, string, number]} args level, car, AI count
 */
function startReading([level, car, aiCount]) {
  const game = window.__game;
  if (level === 'deafvalley') game.launch('highway', car, { ai: aiCount, road: 'canyon' });
  else game.launch(level, car, { ai: aiCount });
  const rec = window.__rolljump = { cars: [] };
  let last = performance.now();
  const sample = (each, slot, now) => {
    const own = rec.cars[slot] ??= { metres: 0, top: 0, jumps: 0, maxAir: 0, maxLand: 0,
      rolls: 0, ends: {}, resets: 0, x: each.x, y: each.y, air: 0, landT: -1, phase: 'none' };
    const moved = Math.hypot(each.x - own.x, each.y - own.y);
    if (moved > 8) own.resets++;
    else own.metres += moved;
    own.x = each.x;
    own.y = each.y;
    own.top = Math.max(own.top, Math.hypot(each.vx, each.vy) * 3.6);
    const air = each.air || 0;
    if (air > 0) own.air = Math.max(own.air, air);
    else if (own.air > 0) {
      if (own.air > 0.2) {
        own.jumps++;
        own.maxAir = Math.max(own.maxAir, own.air);
        own.landT = now;
      }
      own.air = 0;
    }
    if (own.landT > 0 && now - own.landT < 500) own.maxLand = Math.max(own.maxLand,
      each.loadK || 0);
    const phase = each.roll ? each.roll.phase : 'none';
    if (own.phase === 'none' && phase === 'rolling') own.rolls++;
    if (own.phase !== 'none' && phase === 'none') own.ends.reset = (own.ends.reset || 0) + 1;
    if (own.phase === 'rolling' && phase !== 'rolling' && phase !== 'none')
      own.ends[phase] = (own.ends[phase] || 0) + 1;
    own.phase = phase;
  };
  const tick = (now) => {
    if (game.car) sample(game.car, 0, now);
    (game.ai || []).forEach((entry, i) => entry.car && sample(entry.car, i + 1, now));
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return last;
}
