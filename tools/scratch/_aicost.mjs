// _aicost.mjs - frame cost with N AI cars on a circuit (the cap lifted locally): sim and draw ms
// a frame (game.simMs / drawMs, smoothed), measured 8 s into a race on the demo driver; a grid
// shot at the start. node tools/scratch/_aicost.mjs [level]
import { startServer, launchBrowser } from '../lib/browser.mjs';
const level = process.argv[2] || 'thruston';
const srv = await startServer();
const browser = await launchBrowser();
try {
  for (const n of [5, 10, 15, 20]) {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(srv.url + `/?touch=1&guide=0&menu=0&rules=0&level=${level}`);
    await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
    await page.evaluate(([lv, count]) => window.__game.launch(lv, 'hatch-fwd', { ai: count, laps: 3 }), [level, n]);
    await page.waitForTimeout(1500); await page.mouse.click(422, 195); await page.waitForTimeout(500);
    if (n === 20) await page.screenshot({ path: `tools/scratch/_ai20-grid.png` });
    await page.evaluate(async () => {
      const game = window.__game, auto = await import('/src/ai/autodrive.ts');
      const driver = auto.createAutoDriver(game.level.subtrack);
      game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false, shiftDown: false });
    });
    await page.waitForTimeout(8000);
    const r = await page.evaluate(() => ({ ai: window.__game.ai.length, sim: +(window.__game.simMs || 0).toFixed(2), draw: +(window.__game.drawMs || 0).toFixed(2) }));
    console.log(`${level} ${n} AI asked: ${r.ai} on track, sim ${r.sim} ms, draw ${r.draw} ms a frame`, errs.length ? errs[0] : '');
    await ctx.close();
  }
} finally { await browser.close(); srv.stop(); }
