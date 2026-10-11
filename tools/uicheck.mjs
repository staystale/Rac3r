// uicheck.mjs — drive the HUD with REAL TOUCH TAPS at phone size.
// Exists because "I can't change vehicle" shipped: every harness tested logic, none tested whether a
// thumb could actually reach the control (CLAUDE.md §3, the layout-harness lesson).
import { startServer, launchBrowser } from './lib/browser.mjs';
import { SPAWN } from '../src/lab.js';
const srv = await startServer();
let b, b2;
try {
b = await launchBrowser();
const fails = [];
for (const [label, W, H] of [['landscape 844x390', 844, 390], ['portrait 390x844', 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => fails.push(label + ': ' + e.message));
  await p.goto(srv.url + '/?touch=1');
  await p.touchscreen.tap(W / 2, H / 2);   // dismisses the boot overlay
  await p.waitForTimeout(150);
  const start = await p.evaluate(() => window.__game.car.spec.id);
  // tap the chip (top-left) -> must expand
  await p.touchscreen.tap(60, 29);
  await p.waitForTimeout(120);
  const expanded = await p.evaluate(() => window.__game.hudExpanded);
  // tap the 4th row (muscle) -> must switch car
  await p.touchscreen.tap(60, 12 + 34 + 6 + 3 * 32 + 15);
  await p.waitForTimeout(150);
  const after = await p.evaluate(() => window.__game.car.spec.id);
  // steering must NOT have been engaged by those taps
  const steer = await p.evaluate(() => window.__game.in.steer);
  // RESTART must be reachable and return to spawn
  await p.evaluate(() => { window.__game.car.x = 40; });
  const rb = await p.evaluate(() => window.__game.hudLayout());
  await p.touchscreen.tap(rb.restart.x + rb.restart.w / 2, rb.restart.y + rb.restart.h / 2);
  await p.waitForTimeout(120);
  const resetX = await p.evaluate(() => window.__game.car.x);
  console.log(`${label.padEnd(20)} start=${start} expanded=${expanded} after=${after} steer=${steer} resetX=${resetX.toFixed(1)}`);
  if (!expanded) fails.push(`${label}: tapping the car chip did not open the selector`);
  if (after === start) fails.push(`${label}: tapping a car row did not change the car`);
  if (Math.abs(steer) > 0.01) fails.push(`${label}: a HUD tap also steered the car (steer=${steer})`);
  // Compare against the REAL spawn, not a hard-coded 0. MEASURED BUG IN THIS HARNESS, 2026-09-28: the
  // spawn moved into the lab quadrant (x -45) and this failed both sizes while RESET worked perfectly.
  if (Math.abs(resetX - SPAWN.x) > 1) fails.push(`${label}: RESTART did not reach the world (x ${resetX.toFixed(1)}, want ${SPAWN.x})`);
  await ctx.close();
}
await b.close();
console.log(fails.length ? '\nFAIL:\n  ' + fails.join('\n  ') : '\nHUD reachable on touch: OK');
process.exitCode = fails.length ? 1 : 0;

// ---- OVERLAP ASSERTION. Added after the TUNE chip silently landed on top of RESET at 390 px wide and
// ate its taps. No two top-level controls may share a pixel, at any width we support.
// CLAUDE.md rule 19: proved by reintroducing the bug and confirming this fires, then restoring.
b2 = await launchBrowser();
const overlaps = [];
for (const [W, H] of [[844, 390], [390, 844], [1280, 720], [360, 640], [412, 915], [768, 1024]]) {
  const ctx = await b2.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(srv.url + '/?touch=1');
  await p.touchscreen.tap(W / 2, H / 2);
  await p.waitForTimeout(120);
  // checked twice: tyre HUD off and ON (2026-10-03: the strip grows the speed panel and pushes lap + tally down)
  for (const tyreHud of [false, true]) {
  const bad = await p.evaluate((tyreHud) => {
    window.__game.setTyreHud(tyreHud);
    const L = window.__game.hudLayout();
    // speed panel and lap panel included after controls collided in narrow viewports — every control lane
    // must be tested across all supported sizes.
    const named = [['carChip', L.chip], ['tune', L.tuneChip], ['restart', L.restart], ['reset', L.reset], ['clear', L.clear], ['speed', L.speed], ['lap', L.lap], ['fps', L.fps], ['tally', L.tally], ['help', L.help], ['abs', L.absChip], ['tcs', L.tcsChip]];
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const out = [];
    for (let i = 0; i < named.length; i++)
      for (let j = i + 1; j < named.length; j++)
        if (hit(named[i][1], named[j][1])) out.push(`${named[i][0]} overlaps ${named[j][0]}`);
    return out;
  }, tyreHud);
  if (bad.length) overlaps.push(`${W}x${H}${tyreHud ? ' (tyre HUD on)' : ''}: ${bad.join('; ')}`);
  }
  await ctx.close();
}
await b2.close();
console.log(overlaps.length ? 'OVERLAP FAIL:\n  ' + overlaps.join('\n  ') : 'no control overlaps at 6 sizes, tyre HUD off and on: OK');
if (overlaps.length) process.exitCode = 1;
} finally {
  await b?.close();
  await b2?.close();
  srv.stop();
}
