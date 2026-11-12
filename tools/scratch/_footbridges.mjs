// _footbridges.mjs - A LEVEL'S OVERHEAD DECKS (scratch): each overhead prop with a deck
// (render/props/bridges.ts overheadDeck - footbridges, road bridges) and how far its middle is
// from the race road, so a light or drawing check can drive under the ones over it.
// node tools/scratch/_footbridges.mjs <level>   (CHECK_PORT; one browser)
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [levelId = 'moanaco'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=${levelId}`);
  const decks = await page.evaluate(async () => {
    const { overheadDeck } = await import('/src/render/props/bridges.ts');
    const { PROPS } = await import('/src/world/state.ts');
    const sub = window.__game.level.subtrack;
    const out = [];
    for (const prop of PROPS.list || PROPS) {
      const deck = overheadDeck(prop);
      if (!deck) continue;
      let nearest = Infinity, along = 0;
      for (const point of sub.pts) {
        const gap = Math.hypot(point.x - prop.x, point.y - prop.y);
        if (gap < nearest) { nearest = gap; along = point.dist; }
      }
      out.push({ kind: prop.kind, x: +prop.x.toFixed(1), y: +prop.y.toFixed(1),
        halfLength: +deck.halfLength.toFixed(1), halfWidth: +deck.halfWidth.toFixed(1),
        roadM: +nearest.toFixed(1), along: Math.round(along) });
    }
    return out;
  });
  for (const deck of decks) console.log(JSON.stringify(deck));
} finally {
  await browser.close();
  server.stop();
}
