// _menucount.mjs - the menu race's field size over N visits (?menurand=1): wanted, and spawned.
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=1&rules=0&noaudio=1&menurand=1`);
  await page.waitForTimeout(3000);
  const rows = await page.evaluate(async () => {
    const flow = await import('/src/game/menuflow.ts'), st = await import('/src/game/state.ts');
    const out = [];
    for (let i = 0; i < 20; i++) {
      flow.enterMenu();
      await new Promise((done) => setTimeout(done, 300));
      out.push(st.shared.aiCount + '/' + window.__game.ai.length);
    }
    return out;
  });
  console.log('wanted/spawned AI: ' + rows.join(' '));
} finally { await browser.close(); server.stop(); }
