// menucheck.mjs — drives the MENU flow (?menu=1) at 844x390 and 390x844 with real taps: main -> Test Mode -> track -> setup
// -> LAUNCH -> session -> pause chip -> MAIN MENU -> Garage; photographs each screen into the folder given as argv[2] (or
// skips photos). Fails on any page error. Built 2026-10-03 with the menus; caught the portrait pause GHOST-CLICK.
// Waits for each button / screen (up to STEP_MS), not fixed sleeps: on CI the WebGL2 ground runs in software
// (SwiftShader), several times slower, and a fixed sleep timed out there; a step that never comes is named.
const STEP_MS = 60000;
// the step under way, printed if one fails (the suite shows only the last lines of a tool)
let step = 'start';
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, extraQuery, gotoGame } from './lib/browser.mjs';
import { TEST_LIST } from '../src/testlist.js';
const srv = await startServer();
let b;
try {
b = await launchBrowser();
for (const [W, H] of [[844, 390], [390, 844]]) {
  const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const OUTDIR = process.argv[2]; if (OUTDIR) mkdirSync(OUTDIR, { recursive: true }); const shot = async (n) => { step = W + 'x' + H + ' photo ' + n; await p.waitForTimeout(500); if (OUTDIR) await p.screenshot({ path: OUTDIR + '/menu-' + W + '-' + n + '.png' }); };
  const tap = async (txt) => {
    step = W + 'x' + H + ' tap ' + txt;
    await p.waitForTimeout(400);
    const button = p.locator('#menu button', { hasText: txt }).first();
    await button.waitFor({ state: 'visible', timeout: STEP_MS }).catch(() => {
      throw new Error(W + 'x' + H + ': the ' + txt + ' button never showed');
    });
    // the tap waits for the button to settle (a screen easing in): slow on CI too
    await button.tap({ timeout: STEP_MS });
  };
  // a timed poll, not waitForFunction's default animation-frame poll (tools/lib/browser.mjs gotoGame)
  const waitFor = async (what, test) => {
    step = W + 'x' + H + ' wait for ' + what;
    await p.waitForFunction(test, null, { timeout: STEP_MS, polling: 250 }).catch(() => {
      throw new Error(W + 'x' + H + ': ' + what + ' never happened');
    });
  };
  await gotoGame(p, srv.url + '/?touch=1&menu=1&guide=0' + extraQuery());
  await waitFor('the menu demo', () => window.__game.mode === 'menu');
  await p.waitForTimeout(1500);
  await shot('1-main');
  const demo = await p.evaluate(() => ({ mode: window.__game.mode, v: Math.hypot(window.__game.car.vx, window.__game.car.vy).toFixed(1), car: window.__game.car.spec.id }));
  await tap('TEST MODE'); await shot('2-types'); await tap('OVALS'); await shot('2-tracks');   // the category layer (2026-10-05)
  await tap('Naffcar'); await shot('3-setup');
  await tap('▶'); await tap('LAUNCH');
  await waitFor('the session', () => window.__game.mode === 'session' && !!window.__game.hudLayout().help);
  await p.waitForTimeout(1500); await shot('4-session');
  const sess = await p.evaluate(() => ({ mode: window.__game.mode, level: window.__game.level.id, car: window.__game.car.spec.id }));
  const L = await p.evaluate(() => window.__game.hudLayout());
  await p.touchscreen.tap(L.help.x + L.help.w / 2, L.help.y + L.help.h / 2); await shot('5-pause');
  const pz = await p.evaluate(() => ({ paused: window.__game.paused, sim: window.__game.car.simTime }));
  await p.waitForTimeout(400); const pz2 = await p.evaluate(() => window.__game.car.simTime);
  await tap('MAIN MENU'); await p.waitForTimeout(800); await tap('GARAGE'); await shot('6-garage');
  await tap('PAINT'); await shot('7-paint'); await tap('BACK');   // paint shop, back to the garage with its BACK button
  await tap('TYRES'); await shot('8-tyres'); await tap('BACK');
  // RESULTS and TESTING are not reachable by a tap from the menu (a finished race / the pause chip open them), but the game
  // exposes window.__game.menu (pause / results), so call those with a stand-in race flow / pause actions
  await p.evaluate(() => {
    const g = window.__game, me = { car: g.car, player: true, pos: 1, num: 1, total: 62.34, gap: 0, best: 30.12, penalty: 0, bill: 120, paint: '#d8453c' };
    const ai = [2, 3, 4].map(n => ({ car: g.car, player: false, pos: n, num: n, total: 62.34 + n, gap: n, best: 30.5 + n / 10, penalty: n === 3 ? 5 : 0, bill: 0, paint: '#3a7bd8' }));
    g.menu.results({ results: [me, ...ai], laps: 2 }, { name: 'menucheck', restart() {}, tracks() {}, menu() {} });
  });
  await shot('9-results'); await tap('RESULTS'); await shot('9-results-table');
  await p.evaluate(() => window.__game.menu.pause({ resume() {}, restart() {}, guide() {}, exit() {}, tests: true }));
  // the TESTING button shows only while the test list has entries
  const hasTesting = (await p.locator('#menu button', { hasText: 'TESTING' }).count()) > 0;
  if (hasTesting !== TEST_LIST.length > 0) errs.push('TESTING button ' + (hasTesting ? 'shown' : 'missing') + ' with ' + TEST_LIST.length + ' tests');
  if (hasTesting) { await tap('TESTING'); await shot('10-testing'); }
  console.log(W + 'x' + H, 'demo', JSON.stringify(demo), '| session', JSON.stringify(sess), '| pause', pz.paused, 'sim frozen', pz.sim === pz2, '| errors', errs.length ? errs.slice(0, 3).join(' || ') : 'none');
  if (errs.length) process.exitCode = 1;
}
await b.close();
} catch (error) {
  console.log('menucheck FAILED at ' + step + ': ' + String(error && error.message).split(String.fromCharCode(10))[0]);
  process.exitCode = 1;
} finally {
  await b?.close();
  srv.stop();
}
