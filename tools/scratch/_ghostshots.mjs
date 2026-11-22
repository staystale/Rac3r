// _ghostshots.mjs - ?ghost in the real game (the browser): (1) TEST MODE solo on a circuit with the
// GHOST on, the car on the demo driver for 3 laps (the 3rd down
// on power, so the ghost shows ahead) - per lap: its time, whether the ghost shows, how
// far it is from the car (it races the best lap: it starts each lap on the line with the car), that
// it is never in the field; a shot of it at 844x390; then the page hidden (a safe moment) saves the best;
// (2) the setup's GHOST row and SETTINGS > ACCOLADES with that best, at 390x844 and 844x390.
// node tools/scratch/_ghostshots.mjs [level]   (CHECK_PORT, the browser lock: the caller's)
import { startServer, launchBrowser } from '../lib/browser.mjs';
import { openPage, launchLevel, installDriver } from '../lib/determinism.mjs';

const level = process.argv[2] || 'thruston';
const OUT = 'tools/scratch/_ghost-';
const server = await startServer();
const browser = await launchBrowser();
let saved = {};
try {
  const errors = [];
  const page = await openPage(browser, server.url, level, errors, '&ghost=1');
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((value) => window.__rt.seed(value), 1);
  await page.evaluate(launchLevel, [level, { ai: 0, ghost: true }]);
  await page.waitForTimeout(400);
  await page.evaluate(installDriver);
  let lastLap = 0, shot = false;
  const seen = {};
  for (let frame = 0; frame < 60 * 260 && lastLap < 4; frame += 60) {
    const read = await page.evaluate(() => {
      window.__rt.step(60);
      const game = window.__game, ghost = game.ghostCar;
      // (from lap 3 the car down on power: the ghost - lap 2 - draws ahead of it, into view)
      if (game.lap.lap >= 3 && !game.car._ghostSlowed) {
        game.car._ghostSlowed = true;
        game.car.mods.power *= 0.6;
      }
      return { lap: game.lap.lap, lapTime: game.lap.lapTime, last: game.lap.lastTime,
        best: game.lap.bestTime, ghost: !!ghost,
        apart: ghost ? Math.hypot(ghost.x - game.car.x, ghost.y - game.car.y) : null,
        inField: !!ghost && (game.ai || []).some((rival) => rival.car === ghost) };
    });
    if (read.lap !== lastLap) {
      if (lastLap) console.log(`  lap ${lastLap} done: ${read.last?.toFixed(2)} s (best `
        + `${read.best?.toFixed(2)})`);
      lastLap = read.lap;
    }
    const tally = seen[read.lap] ??= { shown: 0, steps: 0, most: 0, inField: false };
    tally.steps++;
    if (read.ghost) tally.shown++;
    if (read.apart != null) tally.most = Math.max(tally.most, read.apart);
    tally.inField ||= read.inField;
    if (!shot && read.ghost && read.lap >= 3 && read.apart > 6 && read.apart < 16) {
      shot = true;
      await page.screenshot({ path: OUT + 'race-844.png' });
    }
  }
  for (const [lap, tally] of Object.entries(seen)) {
    console.log(`  lap ${lap}: ghost shown ${tally.shown} of ${tally.steps} s, farthest `
      + `${tally.most.toFixed(1)} m from the car, in the field: ${tally.inField}`);
  }
  // (a safe moment: the page hidden - main.ts saveRecords)
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  await page.waitForTimeout(300);
  saved = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage)
    .filter((key) => key.startsWith('rac3r.ghost')).map((key) => [key, localStorage.getItem(key)])));
  const index = JSON.parse(saved['rac3r.ghosts'] || '[]');
  console.log(`  saved: ${index.map((entry) => `${entry.key} ${entry.time.toFixed(2)} s`).join(', ')
    || 'nothing'}; ${Object.keys(saved).length - 1} tape(s), ${Object.values(saved)
    .reduce((all, text) => all + text.length, 0)} characters`);
  console.log(`  page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await page.context().close();
  for (const [width, height] of [[390, 844], [844, 390]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3,
      isMobile: true, hasTouch: true });
    await ctx.addInitScript((items) => {
      for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value);
    }, saved);
    const menu = await ctx.newPage();
    const menuErrors = [];
    menu.on('pageerror', (err) => menuErrors.push(String(err)));
    await menu.goto(server.url + '/?touch=1&menu=1&guide=0&ghost=1&level=' + level);
    await menu.waitForSelector('#menu button', { timeout: 30000 });
    await menu.waitForTimeout(1500);
    const tap = async (text) => {
      await menu.locator('#menu button', { hasText: text }).first().click();
      await menu.waitForTimeout(700);
    };
    await tap('SETTINGS');
    await tap('ACCOLADES');
    await menu.screenshot({ path: `${OUT}accolades-${width}.png` });
    await tap('BACK');
    await tap('BACK');
    await tap('TEST MODE');
    await tap('CIRCUITS');
    await menu.screenshot({ path: `${OUT}circuits-${width}.png` });
    await menu.locator('#menu button', { hasText: /thruston/i }).first().click();
    await menu.waitForTimeout(700);
    await menu.screenshot({ path: `${OUT}track-${width}.png` });
    console.log(`  menus ${width}x${height}: ${menuErrors.length ? menuErrors.join(' | ')
      : 'no errors'}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.stop();
}
