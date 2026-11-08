// _tilenight.mjs - tools/tilecost.mjs by DAY (13:00) and at NIGHT (22:56) on the game clock (set
// through its saved key, as on the owner's phone): tiles painted by reason, ms per tile, and the
// frame times (rAF gaps) over the same 600-frame autodrive lap at CPU x4. One level per run.
// node tools/scratch/_tilenight.mjs <level> [extra query]
import { startServer, launchBrowser } from '../lib/browser.mjs';

const level = process.argv[2] || 'castle-cum';
const extra = process.argv[3] || '';
const DAY_S = 86400, SUMMER_DAY_3 = (14 + 2) * DAY_S;
const srv = await startServer();
let browser;
try {
  browser = await launchBrowser();
  for (const [name, hour] of [['day', 13], ['night', 22.93], ['day', 13], ['night', 22.93]]) {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 },
      deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await ctx.addInitScript((seconds) => {
      localStorage.setItem('carsim.clock.v1', String(seconds));
    }, Math.round(SUMMER_DAY_3 + hour * 3600));
    const page = await ctx.newPage();
    page.on('pageerror', (error) => console.log('ERROR ' + error));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(srv.url + '/?touch=1&guide=0&level=' + level + '&car=track-rwd' + extra);
    await page.touchscreen.tap(400, 200);
    await page.waitForTimeout(4000);
    const stats = await page.evaluate(() => new Promise(async (resolve) => {
      const game = window.__game;
      const auto = await import('/src/ai/autodrive.ts');
      const driver = auto.createAutoDriver(game.level.subtrack);
      game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false,
        shiftDown: false });
      const before = game.renderer.tileStats;
      const gaps = [];
      let last = performance.now(), frames = 0;
      function frame(now) {
        gaps.push(now - last);
        last = now;
        if (++frames < 600) requestAnimationFrame(frame);
        else resolve({ before, after: game.renderer.tileStats, gaps });
      }
      requestAnimationFrame(frame);
    }));
    const delta = (key) => stats.after[key] - stats.before[key];
    const painted = delta('tilesPainted');
    const gaps = stats.gaps.slice(1).sort((a, b) => a - b);
    const at = (share) => gaps[Math.floor(share * (gaps.length - 1))].toFixed(1);
    console.log(`${level} ${name}: tiles ${painted} (new ${delta('newTiles')}, wear `
      + `${delta('staleRepaints')}, prefetch ${delta('prefetched')}), ms/tile `
      + `${(painted ? delta('tileMs') / painted : 0).toFixed(1)} | frames median ${at(0.5)} `
      + `p95 ${at(0.95)} worst ${at(1)} over 33 ms ${gaps.filter((gap) => gap > 33).length}`);
    await ctx.close();
  }
} finally {
  await browser?.close();
  srv.stop();
}
