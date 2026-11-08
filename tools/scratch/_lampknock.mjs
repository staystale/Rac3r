// _lampknock.mjs - do AI cars hit lamp posts (owner 11-04: "make them avoid lamppost too in case
// they end up off track")? An N-AI race for SECS s on a level (the player on the demo driver); the
// lamps knocked down at the end, of how many. node tools/scratch/_lampknock.mjs [level] [n] [secs] [query]
import { startServer, launchBrowser } from '../lib/browser.mjs';
const level = process.argv[2] || 'thruston', n = +(process.argv[3] || 15), secs = +(process.argv[4] || 90), q = process.argv[5] || '';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + `/?touch=1&guide=0&menu=0&rules=0&level=${level}${q}`);
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.evaluate(([lv, c]) => window.__game.launch(lv, 'hatch-rwd', { ai: c, laps: 9 }), [level, n]);
  await page.waitForTimeout(1500); await page.mouse.click(422, 195); await page.waitForTimeout(500);
  await page.evaluate(async () => {
    const auto = await import('/src/ai/autodrive.ts');
    const driver = auto.createAutoDriver(window.__game.level.subtrack);
    window.__game.input.update = () => ({ ...driver.drive(window.__game.car), reverse: 0, shiftUp: false, shiftDown: false });
  });
  await page.waitForTimeout(secs * 1000);
  const out = await page.evaluate(async () => {
    const lamps = (await import('/src/world/lamps.ts')).activeLamps();
    return { lamps: lamps.length, down: lamps.filter((l) => l.down).length, hit: lamps.filter((l) => l.down || l.mangle > 0 || Math.hypot(l.leanX, l.leanY) > 0.05).length };
  });
  console.log(`${level} ${n} AI ${secs} s ${q || 'plain'}: lamps ${out.lamps}, knocked down ${out.down}, hit at all ${out.hit}`, errs[0] || '');
} finally { await browser.close(); srv.stop(); }
