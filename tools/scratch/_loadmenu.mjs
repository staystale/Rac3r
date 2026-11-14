// _loadmenu.mjs - THE LOADING SCREEN AND THE MENU (scratch, ?loadscreen=1): the menu race behind
// the main menu never shows the screen; a launch does (and the race is held until the fly-in is
// over); a tap on the screen while it is up reaches nothing (the player's car, the pause); the
// pause menu's RESTART SESSION shows it again; MAIN MENU goes back to a menu race with no screen and
// its cars moving. Prints each check and OK / WRONG. node tools/scratch/_loadmenu.mjs [level]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [levelId = 'knobhill'] = process.argv.slice(2);
const SCREEN_UP = "(() => { const el = document.getElementById('loadscreen');"
  + " return !!el && el.className === ''; })()";
let wrong = 0;

/**
 * Prints one check.
 * @param {string} what the check
 * @param {boolean} isOk whether it held
 * @param {string} [detail] what was seen
 */
function check(what, isOk, detail = '') {
  if (!isOk) wrong++;
  console.log(`${isOk ? 'OK   ' : 'WRONG'} ${what}${detail ? ': ' + detail : ''}`);
}

/**
 * Samples a page-side expression every 50 ms for ms, returning every value seen.
 * @param {import('playwright').Page} page the page
 * @param {string} expr the expression
 * @param {number} ms how long
 * @returns {Promise<unknown[]>} the values
 */
async function sample(page, expr, ms) {
  const seen = [];
  for (let waited = 0; waited < ms; waited += 50) {
    seen.push(await page.evaluate(expr));
    await page.waitForTimeout(50);
  }
  return seen;
}

const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&rules=0&noaudio=1&loadscreen=1`,
    'window.__game.menu');
  const menuSeen = await sample(page, SCREEN_UP, 3000);
  check('the menu race shows no loading screen', !menuSeen.some(Boolean));
  await page.evaluate((level) => {
    window.__game.menu.hide();
    window.__game.launch(level, 'hatch-rwd', { ai: 10, rx: true });
  }, levelId);
  check('a launch puts the screen up at once', await page.evaluate(SCREEN_UP));
  // taps on the screen: the gas pedal's corner and the pause chip's
  await page.touchscreen.tap(780, 330);
  await page.touchscreen.tap(60, 30);
  const during = await sample(page, `[${SCREEN_UP}, window.__game.start.t,
    Math.hypot(window.__game.car.vx, window.__game.car.vy), window.__game.paused,
    window.__game.renderer.flying]`, 6000);
  const held = during.filter(([up, , , , flying]) => up || flying);
  check('the race clock and the car still while the screen or the fly-in is up',
    held.every(([, startT, speed]) => startT === 0 && speed < 0.01), `${held.length} samples`);
  check('a tap on the screen paused nothing', !during.some(([, , , paused]) => paused));
  check('the countdown runs after the fly-in', during.at(-1)[1] > 0
    && !during.at(-1)[4], `lights clock ${during.at(-1)[1].toFixed(2)} s`);
  await page.keyboard.press('p');
  // (a new menu screen ignores taps for its first 350 ms: menu/style.ts GHOST_MS)
  await page.waitForTimeout(500);
  // (a menu button blinks ~160 ms before it acts; a restart's screen holds ~300 ms)
  await page.locator('#menu button', { hasText: 'RESTART SESSION' }).first().click();
  const restartSeen = await sample(page, `[${SCREEN_UP}, document.getElementById('loadscreen')
    .className, window.__game.start.t.toFixed(2), window.__game.paused]`, 1500);
  check('RESTART SESSION shows the screen', restartSeen.some(([up]) => up),
    restartSeen.slice(0, 6).map((row) => row.slice(1).join('/')).join(' '));
  await page.waitForTimeout(4000);
  await page.keyboard.press('p');
  // (a new menu screen ignores taps for its first 350 ms: menu/style.ts GHOST_MS)
  await page.waitForTimeout(500);
  await page.locator('#menu button', { hasText: 'MAIN MENU' }).first().click();
  await page.waitForTimeout(500);
  const backSeen = await sample(page, `[${SCREEN_UP}, window.__game.mode]`, 3000);
  check('MAIN MENU: no screen, the menu race', backSeen.every(([up, mode]) => !up && mode === 'menu'));
  const moving = await page.evaluate(() => window.__game.ai.filter((entry) =>
    Math.hypot(entry.car.vx, entry.car.vy) > 2).length);
  check('the menu race\'s cars move', moving > 0, `${moving} moving`);
  check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  console.log(wrong ? `loadmenu: ${wrong} WRONG` : 'loadmenu: all OK');
  if (wrong) process.exitCode = 1;
} finally {
  await browser.close();
  server.stop();
}
