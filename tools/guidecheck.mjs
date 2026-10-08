// guidecheck.mjs — the HOW TO PLAY guide (src/guide.js), driven with real taps at 6 screen sizes.
// Checks, for every card: the card is fully on screen, it does NOT cover the thing it points at, NEXT is inside
// it. Plus: a stray tap on the world neither advances a card nor steers; the sim is paused while it is open;
// DONE closes it and marks it seen; the "?" chip reopens it. Needs the server on 8080.
// Optional: node tools/guidecheck.mjs <dir>  -> also photographs every card into <dir>.
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const OUT = process.argv[2];
const b = await chromium.launch({ channel: 'msedge' });
const errs = [];
const sizes = [[844, 390, 'touch=1'], [390, 844, 'touch=1'], [360, 640, 'touch=1'], [412, 915, 'touch=1'], [768, 1024, 'touch=1'], [1280, 720, 'pc=1']];
for (const lv of ['', '&level=grass-track']) for (const [W, H, q] of sizes) {
  const tag = `${W}x${H}${lv ? ' grass' : ''}`;
  const touch = q !== 'pc=1';
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${tag}: ${e.message}`));
  await p.goto(`http://localhost:8080/?${q}&guide=1${lv}`);
  await p.mouse.click(W / 2, H / 2);
  // wait for the fly-in, not a fixed time: MEASURED, the Grass Track fly-in takes ~2.5 s in headless Edge at 15-30 fps
  await p.waitForFunction(() => window.__game.guide.active, null, { timeout: 8000 }).catch(() => {});
  const n = await p.evaluate(() => window.__game.guide.count);
  if (!(await p.evaluate(() => window.__game.guide.active))) { errs.push(`${tag}: guide did not open after the fly-in`); await ctx.close(); continue; }
  const t0 = await p.evaluate(() => window.__game.car.simTime);
  for (let i = 0; i < n; i++) {
    const { box, nextB, target } = await p.evaluate(() => window.__game.guide.last);
    if (OUT) await p.screenshot({ path: `${OUT}/${tag.replace(' ', '-')}-${i}.png` });
    if (box.x < 0 || box.y < 0 || box.x + box.w > W || box.y + box.h > H) errs.push(`${tag} card ${i}: off screen`);
    if (target && box.x < target.x + target.w && target.x < box.x + box.w && box.y < target.y + target.h && target.y < box.y + box.h)
      errs.push(`${tag} card ${i}: card covers its own target`);
    if (nextB.x < box.x || nextB.x + nextB.w > box.x + box.w) errs.push(`${tag} card ${i}: NEXT outside the card`);
    if (i === 0) {
      await p.mouse.click(W * 0.25, H * 0.75); await p.waitForTimeout(80);
      const s = await p.evaluate(() => ({ card: window.__game.guide.card, steer: window.__game.in.steer }));
      if (s.card !== 0) errs.push(`${tag}: a stray tap moved the card`);
      if (Math.abs(s.steer) > 0.01) errs.push(`${tag}: a tap under the guide steered`);
    }
    await p.mouse.click(nextB.x + nextB.w / 2, nextB.y + nextB.h / 2);
    await p.waitForTimeout(100);
  }
  const t1 = await p.evaluate(() => window.__game.car.simTime);
  if (t1 !== t0) errs.push(`${tag}: the sim ran while the guide was open`);
  const after = await p.evaluate(() => ({ active: window.__game.guide.active, seen: window.__game.guide.seen, help: window.__game.hudLayout().help }));
  if (after.active || !after.seen) errs.push(`${tag}: DONE did not close it / mark it seen`);
  const h = after.help;
  await p.mouse.click(h.x + h.w / 2, h.y + h.h / 2); await p.waitForTimeout(100);
  if ((await p.evaluate(() => window.__game.guide.card)) !== 0) errs.push(`${tag}: "?" did not reopen the guide`);
  console.log(`${tag.padEnd(16)} ${n} cards ok, ? at ${h.x},${h.y}${h.row3 ? ' (row 3)' : ''}`);
  await ctx.close();
}
await b.close();
console.log(errs.length ? '\nFAIL:\n  ' + errs.join('\n  ') : '\nguide: every card on screen, clear of its target, taps consumed, sim paused, ? replays: OK');
process.exitCode = errs.length ? 1 : 0;
