// _hudlean.mjs - phone shots of the in-race HUD with ?hudlean (no car / level list, TUNE, CLEAR),
// portrait and landscape, a 5-AI race on Thruston with the minimap on.
import { startServer, launchBrowser } from '../lib/browser.mjs';
const q = process.argv[2] ?? '&hudlean=1';
const srv = await startServer();
const browser = await launchBrowser();
try {
  for (const [name, W, H] of [['portrait', 390, 844], ['landscape', 844, 390]]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(srv.url + `/?touch=1&guide=0&menu=0&rules=0&level=thruston${q}`);
    await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
    await page.evaluate(() => window.__game.launch('thruston', 'hatch-fwd', { ai: 5, laps: 3 }));
    await page.waitForTimeout(1500); await page.touchscreen.tap(W / 2, H / 2);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `tools/scratch/_hudlean-${name}${q ? '' : '-plain'}.png` });
    console.log(name, errs[0] || 'no errors');
    await ctx.close();
  }
} finally { await browser.close(); srv.stop(); }
