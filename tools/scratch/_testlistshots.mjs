// scratch (S-A, 2026-10-06): the FPS corner + the pause menu's TESTING list, in the real game on :8080. Photos at 390x844 + 844x390:
// shots/look/sa-hud-<size>.png (FPS strip top right), sa-pause-<size>.png, sa-tests-<size>.png. Checks: the FPS strip is drawn (number
// read back from game.fps / fpsLow), the TESTING button shows the count from src/testlist.js, the list shows every entry, BACK returns to
// the pause menu, and no page errors. node tools/_testlistshots.mjs
import { startServer, launchBrowser } from '../lib/browser.mjs';
import { TEST_LIST } from '../../src/testlist.js';
const srv = await startServer();
process.on('exit', srv.stop);
const b = await launchBrowser();
let bad = 0; const fail = (m) => { bad++; console.log('FAIL ' + m); };
for (const [w, h, tag] of [[390, 844, 'port'], [844, 390, 'land']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${srv.url}/index.html?touch=1&guide=0&rules=0&menu=1`); await p.waitForTimeout(2500);
  await p.evaluate(() => window.__game.launch('highway', 'saloon-rwd', { traffic: 0 })); await p.evaluate(() => { const m = document.getElementById('menu'); if (m) m.className = 'gone'; }); await p.waitForTimeout(12000);
  const g = await p.evaluate(() => ({ fps: window.__game.fps, low: window.__game.fpsLow, test: window.__game.testMode }));
  if (!g.test) fail(`${tag}: game.testMode is off`); if (!(g.fps > 0) || !(g.low > 0)) fail(`${tag}: fps ${g.fps} low ${g.low}`);
  await p.screenshot({ path: `shots/look/sa-hud-${tag}.png` });
  // open the pause menu the way the player does: the game's pause hook
  await p.keyboard.press('p'); await p.waitForTimeout(300); const opened = await p.evaluate(() => !!document.querySelector('#menu h2') && document.querySelector('#menu h2').textContent === 'PAUSED');
  if (!opened) { fail(`${tag}: P did not open the pause menu`); await ctx.close(); continue; }
  await p.waitForTimeout(500); await p.screenshot({ path: `shots/look/sa-pause-${tag}.png` });
  const btnTxt = await p.evaluate(() => [...document.querySelectorAll('#menu button')].map((x) => x.textContent));
  const tb = btnTxt.find((t) => t.startsWith('TESTING'));
  if (!tb) fail(`${tag}: no TESTING button (buttons: ${btnTxt.join(' | ')})`); else if (!tb.includes(String(TEST_LIST.length))) fail(`${tag}: button says "${tb}", list has ${TEST_LIST.length}`);
  if (tb) {
    await p.waitForTimeout(400); await p.getByRole('button', { name: /^TESTING/ }).click(); await p.waitForTimeout(500);
    await p.screenshot({ path: `shots/look/sa-tests-${tag}.png` });
    const n = await p.evaluate(() => document.querySelectorAll('#menu .test').length); if (n !== TEST_LIST.length) fail(`${tag}: ${n} cards shown, list has ${TEST_LIST.length}`);
    await p.waitForTimeout(400); await p.getByRole('button', { name: 'BACK' }).click(); await p.waitForTimeout(400);
    const back = await p.evaluate(() => document.querySelector('#menu h2') && document.querySelector('#menu h2').textContent); if (back !== 'PAUSED') fail(`${tag}: BACK went to "${back}"`);
  }
  console.log(`${tag}: fps ${g.fps.toFixed(0)} low ${g.low.toFixed(0)} | button "${tb}" | page errors: ${errs.length ? errs.join(' / ') : 'none'}`);
  if (errs.length) bad++;
  await ctx.close();
}
await b.close();
console.log(bad ? `${bad} FAIL(S)` : 'ALL OK');
srv.stop();
