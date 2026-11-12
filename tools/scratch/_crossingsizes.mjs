// _crossingsizes.mjs - A LEVEL'S CROSSINGS' SIZES (scratch): each crossing's kind, length, open
// cuts and width, m. node tools/scratch/_crossingsizes.mjs <level> [query]  (CHECK_PORT)
import { startServer, launchBrowser } from '../lib/browser.mjs';

const [levelId = 'birdsmess', query = ''] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${server.url}/?menu=1&guide=0&noaudio=1&${query}`);
  await page.waitForFunction(() => window.__game && window.__game.menu, null, { timeout: 90000 });
  const ways = await page.evaluate(async (id) => {
    const game = window.__game;
    game.menu.hide();
    game.launch(id, 'hatch-rwd', { ai: 0 });
    await new Promise((done) => setTimeout(done, 2500));
    return (game.level.crossings || []).map((way) => ({ kind: way.kind, track: !!way.track,
      length: +way.length.toFixed(1), cut: +way.cut.toFixed(1),
      width: +(way.maxAcross - way.minAcross).toFixed(1), slats: way.hidden?.length || 0 }));
  }, levelId);
  for (const way of ways) console.log(JSON.stringify(way));
} finally {
  await browser.close();
  server.stop();
}
