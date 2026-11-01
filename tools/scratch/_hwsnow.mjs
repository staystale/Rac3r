// _hwsnow.mjs - K6 (owner 11-01): highway snow the AI drove over ahead is fresh again when you
// get there. Highway race in snow, 3 AI, autopilot 90 km/h, 60 s: every 0.5 s the wear cells the
// cars changed (current != orig) - which vanish, and why (far from you / the ground under the cell
// now reads other than its orig). [query]
// node tools/scratch/_hwsnow.mjs [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const extra = process.argv[2] || '';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=90${extra}`);
  await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd',
    { ai: 3, weather: { mode: 'snow', season: 0, seed: 5 } }));
  await page.mouse.click(420, 200);
  await page.waitForTimeout(3000);
  const res = await page.evaluate(async () => {
    const w = await import('/src/world/wear.ts');
    const g = window.__game;
    let seen = new Map(), vanished = 0, vanishedNear = 0, aheadNear = 0;
    const why = {};
    for (let i = 0; i < 120; i++) {
      // before the gap: which worn cells now read a different ground than their orig
      const mismatch = new Map();
      for (const [key, cell] of w.wearMap) {
        if (cell.current === cell.orig) continue;
        const x = (cell.cx + 0.5) * w.WEAR_CELL, y = (cell.cy + 0.5) * w.WEAR_CELL;
        mismatch.set(key, { now: w.cleanAt(x, y), orig: cell.orig, cur: cell.current, x, y });
      }
      await new Promise((r) => setTimeout(r, 500));
      for (const [key, info] of mismatch) {
        if (w.wearMap.has(key)) continue;
        vanished++;
        const dist = Math.hypot(info.x - g.car.x, info.y - g.car.y);
        // ahead of the player: in front along its heading
        const ahead = (info.x - g.car.x) * Math.cos(g.car.heading) + (info.y - g.car.y) * Math.sin(g.car.heading) > 0;
        if (dist < 300) { vanishedNear++; if (ahead) aheadNear++;
          const k = info.orig + '->' + info.cur + ' (ground now ' + info.now + ')';
          why[k] = (why[k] || 0) + 1; }
      }
      seen = mismatch;
    }
    return { vanished, vanishedNear, aheadNear, why, kmh: Math.round(Math.hypot(g.car.vx, g.car.vy) * 3.6) };
  });
  console.log(JSON.stringify(res, null, 1));
} finally { await browser.close(); server.stop(); }
