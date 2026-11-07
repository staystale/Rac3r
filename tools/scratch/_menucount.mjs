// _menucount.mjs - the menu race over 20 visits (?menurand=1): the field size wanted / spawned, and
// the camera car's grid place (cars ahead of it on the road just after the spawn, +1).
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=1&rules=0&noaudio=1&menurand=1`);
  await page.waitForTimeout(3000);
  const rows = await page.evaluate(async () => {
    const flow = await import('/src/game/menuflow.ts'), st = await import('/src/game/state.ts');
    const tw = await import('/src/world/tyrewall.ts'), ws = await import('/src/world/state.ts');
    const out = [];
    for (let i = 0; i < 20; i++) {
      flow.enterMenu();
      await new Promise((done) => setTimeout(done, 100));
      const g = window.__game, sub = ws.LEVEL.subtrack, lap = sub.totalDist || 1e9;
      const along = (car) => tw.querySubtrack(sub, car.x, car.y).trackDist;
      const mine = along(g.car);
      const ahead = g.ai.filter((entry) => { let d = along(entry.car) - mine; if (d > lap / 2) d -= lap; if (d < -lap / 2) d += lap; return d > 0; }).length;
      out.push(st.shared.aiCount + '/' + g.ai.length + ' P' + (ahead + 1) + (ws.LEVEL.endless ? 'hw' : ''));
    }
    return out;
  });
  console.log('wanted/spawned AI, camera car place: ' + rows.join(' | '));
} finally { await browser.close(); server.stop(); }
