// _lowcard.mjs - ?lowrange=1: the LOW RANGE walkthrough card (guide.ts RULES.lowrange) as it opens
// the first time the Defunder is driven, at 844x390 and 390x844. node tools/scratch/_lowcard.mjs <dir>
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const OUT = process.argv[2] || 'tools/scratch/lowcard';
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of [[844, 390], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&noaudio=1&lowrange=1&rules=1`);
    await page.mouse.click(width / 2, height / 2);
    await page.waitForTimeout(1200);
    const seen = await page.evaluate(async () => {
      const game = window.__game;
      localStorage.removeItem('carsim.rulesSeen');
      game.launch('test-track', 'defunder-110', { ai: 0 });
      for (let wait = 0; wait < 60 && !(game.guide.active && game.guide.kind); wait++)
        await new Promise((done) => setTimeout(done, 200));
      return { kind: game.guide.kind, count: game.guide.count };
    });
    await page.screenshot({ path: `${OUT}/lowcard-${width}x${height}.png` });
    console.log(`${width}x${height} ${JSON.stringify(seen)}${errors.length ? ' PAGE ERRORS ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
} finally { await browser.close(); server.stop(); }
