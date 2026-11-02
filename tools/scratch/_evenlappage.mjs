// _evenlappage.mjs - ?evenlap=1 in the page: no errors, and Killder's lap evenly spaced (the
// last centreline step = the rest) vs the plain link's stub.
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const q of ['', '&evenlap=1']) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${q}`);
    await page.evaluate(() => window.__game.launch('killder', 'hatch-rwd', { ai: 2 }));
    await page.mouse.click(400, 200);
    await page.waitForTimeout(2500);
    const res = await page.evaluate(() => {
      const pts = window.__game.level.subtrack.pts, n = pts.length;
      const gap = (i) => Math.hypot(pts[(i + 1) % n].x - pts[i].x, pts[(i + 1) % n].y - pts[i].y);
      return { n, last: gap(n - 1).toFixed(3), first: gap(0).toFixed(3), ai: window.__game.ai.length };
    });
    console.log(q || 'plain', JSON.stringify(res));
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
