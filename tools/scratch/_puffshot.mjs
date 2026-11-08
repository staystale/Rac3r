// _puffshot.mjs - phone-size shots of a dusty pack under ?puffpool=1: Knobhill RX, 5 AI, the
// player car on the demo driver; three shots a few seconds apart.
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + '/?touch=1&guide=0&menu=0&rules=0&level=knobhill&puffpool=1');
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.evaluate(() => window.__game.launch('knobhill', 'rally-4x4', { ai: 5, rx: true }));
  await page.waitForTimeout(1500); await page.mouse.click(195, 422); await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const game = window.__game, auto = await import('/src/ai/autodrive.ts');
    const driver = auto.createAutoDriver(game.level.subtrack);
    game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false, shiftDown: false });
  });
  for (const at of [9, 13, 17]) {
    await page.waitForTimeout(4000 + (at === 9 ? 5000 : 0));
    await page.screenshot({ path: `tools/scratch/_puff-${at}.png` });
  }
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }
