// _markage.mjs - K4 (owner 11-01): tyre marks fade oldest first, in small cells. Castle Cum,
// paused; a 20 m skid A laid at t 0 and B at t 60 s beside it, then the marks layer faded by hand
// (marks.fade) and each skid's ink read every 15 s. Plus the fade's cost with a busy layer.
// Off / on ?markage=1.
// node tools/scratch/_markage.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const q of ['', '&markage=1']) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1${q}`);
    await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd', { ai: 0 }));
    await page.waitForTimeout(1500);
    const res = await page.evaluate(async () => {
      const g = window.__game, marks = g.marks;
      g.paused = true;
      marks.clear();
      const { MARK_PPM, MARK_EXTENT } = await import('/src/marks.js');
      const skid = (key, x0, y) => {
        for (let x = x0; x <= x0 + 20; x += 0.1) {
          marks.stamp([{ key, x, y, slip: 8, width: 0.2, heat: 95 }]);
        }
      };
      const ctx = marks.canvas.getContext('2d');
      const ink = (x0, y) => {
        const u = Math.round((x0 + 10 + MARK_EXTENT) * MARK_PPM), v = Math.round((y + MARK_EXTENT) * MARK_PPM);
        const d = ctx.getImageData(u - 30, v - 2, 60, 5).data;
        let sum = 0; for (let i = 3; i < d.length; i += 4) sum += d[i];
        return sum;
      };
      const fade = (s) => { for (let t = 0; t < s; t += 1 / 120) marks.fade(1 / 120); };
      skid('a', -60, -40);
      const a0 = ink(-60, -40);
      fade(60);
      skid('b', -60, -30);
      const b0 = ink(-60, -30);
      const rows = [];
      for (let t = 60; t <= 240; t += 10) {
        rows.push(`${t}s A ${Math.round(100 * ink(-60, -40) / a0)}% B ${Math.round(100 * ink(-60, -30) / b0)}%`);
        fade(10);
      }
      // cost: marks over the whole floor, then the fade's ms a second of game time
      for (let k = 0; k < 400; k++) skid('c' + k, -150 + (k % 20) * 15, -150 + Math.floor(k / 20) * 15);
      const t0 = performance.now(); fade(200); const ms = (performance.now() - t0) / 200;
      return { rows, msPerGameSecond: +ms.toFixed(3) };
    });
    console.log(q || '(off)');
    console.log('  ' + res.rows.join('\n  '));
    console.log('  fade cost ms per game second:', res.msPerGameSecond);
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
