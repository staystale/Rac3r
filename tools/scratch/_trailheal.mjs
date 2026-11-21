// _trailheal.mjs - THE RIG'S RESET HEALS (?trailheal, game/session.ts doReset): the Scanyah tractor
// with its trailer on a circuit (Thruston, no AI) and the Lab; the tractor and the trailer given
// the same damage (dented corners, crushed, lost parts, smashed glass, broken suspension, a wheel
// off, flat tyres, a hanging bumper), then RESET (the R key) or RESTART; each car's damage read
// after. A car healed reads all zeros; a photo before and after each (SHOT=1, the car stopped).
// node tools/scratch/_trailheal.mjs [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const extra = process.argv[2] || '';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${extra}`);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(1000);
  for (const [level, how] of [['thruston', 'reset'], ['lab', 'reset'], ['thruston', 'restart']]) {
    await page.evaluate((id) => window.__game.launch(id, 'scanyah-r450', { ai: 0,
      weather: { mode: 'dry', season: 2, seed: 4 } }), level);
    await page.waitForTimeout(1500);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(800);
    const hasTrailer = await page.evaluate(() => {
      const game = window.__game, trailer = game.car.trailer;
      if (!trailer) return false;
      // the same damage on both bodies
      for (const car of [game.car, trailer]) Object.assign(car, {
        dmg: [0.6, 0.5, 0.7, 0.4], crushL: [0.3, 0.2, 0.4, 0.1], crushS: [0.2, 0.2, 0.3, 0.1],
        partsOff: 3, partLost: 'bumper:2,wing:3,panel:1', glassOut: 1, suspOff: [0, 0, 1, 0],
        wheelOff: [false, false, false, true], tyreP: [1, 1, 0.2, 0], onRim: [false, false,
          false, true], bumperHang: [0, 0, 0.8, 0] });
      return true;
    });
    if (!hasTrailer) {
      console.log(`${level} ${how}: NO TRAILER`);
      continue;
    }
    const shot = async (when) => {
      if (!process.env.SHOT) return;
      await page.evaluate(() => {
        const car = window.__game.car;
        car.vx = car.vy = 0;
      });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `tools/scratch/_trailheal-${level}-${how}-${when}`
        + `${extra ? '-on' : '-off'}.png` });
    };
    await shot('before');
    if (how === 'reset') await page.keyboard.press('r');
    else await page.evaluate(() => window.__game.restart?.() ?? window.__game.launch(
      window.__game.level.id, 'scanyah-r450', { ai: 0 }));
    await page.waitForTimeout(800);
    await shot('after');
    const read = await page.evaluate(() => {
      const game = window.__game, sum = (list) => (list || []).reduce((all, value) =>
        all + (+value || 0), 0);
      const of = (car) => (car ? `dmg ${sum(car.dmg).toFixed(2)} crush ${(sum(car.crushL)
        + sum(car.crushS)).toFixed(2)} parts ${car.partsOff} lost '${car.partLost}' glass `
        + `${car.glassOut} susp ${sum(car.suspOff)} wheelsOff ${sum(car.wheelOff)} flat `
        + `${(4 - sum(car.tyreP)).toFixed(1)} rims ${sum(car.onRim)} hang `
        + `${sum(car.bumperHang).toFixed(1)}` : 'none');
      return { tractor: of(game.car), trailer: of(game.car.trailer),
        pin: game.car.trailer ? !game.car.trailer.pinFree : null };
    });
    console.log(`${level} ${how}:\n  tractor ${read.tractor}\n  trailer ${read.trailer}`
      + ` (hitched ${read.pin})`);
  }
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
