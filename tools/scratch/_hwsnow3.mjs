// _hwsnow3.mjs - K6 probe 3: how long a track in the highway snow lasts. Highway race in snow,
// 3 AI, 50 s: per worn cell (current != orig), the s from worn to back to orig, or to deleted.
// [query] [mode]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const extra = process.argv[2] || '', mode = process.argv[3] || 'snow';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=90${extra}`);
  await page.evaluate((mode) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 3, weather: { mode, season: 0, seed: 5 } }), mode);
  await page.mouse.click(420, 200);
  await page.waitForTimeout(3000);
  console.log(await page.evaluate(async () => {
    const w = await import('/src/world/wear.ts'), { WEATHER } = await import('/src/world/weather.ts');
    const born = new Map(), ends = { refilled: [], deleted: [] }, kinds = {};
    const t0 = performance.now();
    for (let i = 0; i < 250; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const now = (performance.now() - t0) / 1000;
      for (const [key, cell] of w.wearMap) {
        if (cell.current !== cell.orig && !born.has(key)) { born.set(key, now); kinds[cell.orig + '->' + cell.current] = (kinds[cell.orig + '->' + cell.current] || 0) + 1; }
      }
      for (const [key, t] of born) {
        const cell = w.wearMap.get(key);
        if (!cell) { ends.deleted.push(now - t); born.delete(key); }
        else if (cell.current === cell.orig) { ends.refilled.push(now - t); born.delete(key); }
      }
    }
    const stat = (a) => { a.sort((x, y) => x - y); return a.length ? `n ${a.length} median ${a[a.length >> 1].toFixed(1)} s, 90% ${a[Math.floor(a.length * 0.9)].toFixed(1)} s` : 'n 0'; };
    return `snow ${WEATHER.snow.toFixed(2)} trackC ${WEATHER.trackC.toFixed(1)} | refilled: ${stat(ends.refilled)} | deleted: ${stat(ends.deleted)} | still worn ${born.size} | ${JSON.stringify(kinds)}`;
  }));
} finally { await browser.close(); server.stop(); }
