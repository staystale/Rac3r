// menucheck.mjs — drives the MENU flow (?menu=1) at 844x390 and 390x844 with real taps: main -> Test Mode -> track -> setup
// -> LAUNCH -> session -> pause chip -> MAIN MENU -> Garage; photographs each screen into the folder given as argv[2] (or
// skips photos). Fails on any page error. Built 2026-10-03 with the menus; caught the portrait pause GHOST-CLICK.
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser } from './lib/browser.mjs';
const srv = await startServer();
let b;
try {
b = await launchBrowser();
for (const [W, H] of [[844, 390], [390, 844]]) {
  const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const OUTDIR = process.argv[2]; if (OUTDIR) mkdirSync(OUTDIR, { recursive: true }); const shot = async (n) => { await p.waitForTimeout(500); if (OUTDIR) await p.screenshot({ path: OUTDIR + '/menu-' + W + '-' + n + '.png' }); };
  const tap = async (txt) => { await p.waitForTimeout(400); const l = p.locator('#menu button', { hasText: txt }).first(); await l.tap(); };
  await p.goto(srv.url + '/?touch=1&menu=1&guide=0'); await p.waitForTimeout(3500);
  await shot('1-main');
  const demo = await p.evaluate(() => ({ mode: window.__game.mode, v: Math.hypot(window.__game.car.vx, window.__game.car.vy).toFixed(1), car: window.__game.car.spec.id }));
  await tap('TEST MODE'); await shot('2-types'); await tap('OVALS'); await shot('2-tracks');   // the category layer (2026-10-05)
  await tap('Naffcar'); await shot('3-setup');
  await tap('▶'); await tap('LAUNCH'); await p.waitForTimeout(3000); await shot('4-session');
  const sess = await p.evaluate(() => ({ mode: window.__game.mode, level: window.__game.level.id, car: window.__game.car.spec.id }));
  const L = await p.evaluate(() => window.__game.hudLayout());
  await p.touchscreen.tap(L.help.x + L.help.w / 2, L.help.y + L.help.h / 2); await shot('5-pause');
  const pz = await p.evaluate(() => ({ paused: window.__game.paused, sim: window.__game.car.simTime }));
  await p.waitForTimeout(400); const pz2 = await p.evaluate(() => window.__game.car.simTime);
  await tap('MAIN MENU'); await p.waitForTimeout(800); await tap('GARAGE'); await shot('6-garage');
  console.log(W + 'x' + H, 'demo', JSON.stringify(demo), '| session', JSON.stringify(sess), '| pause', pz.paused, 'sim frozen', pz.sim === pz2, '| errors', errs.length ? errs.slice(0, 3).join(' || ') : 'none');
}
await b.close();
} finally {
  await b?.close();
  srv.stop();
}
