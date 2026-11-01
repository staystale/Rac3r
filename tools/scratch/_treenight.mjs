// _treenight.mjs - K5 (owner 11-01): a lighter edge round tree canopies at night. Castle Cum at
// ?night=1, the car parked beside the nearest tree, zoomed in; photos 844x390 / 390x844. [query]
// node tools/scratch/_treenight.mjs [extra query] [tag]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const extra = process.argv[2] || '', tag = process.argv[3] || 'a';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [w, h] of [[844, 390], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&night=0.8${extra}`);
    await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd', { ai: 0 }));
    await page.mouse.click(w / 2, h / 2);
    await page.waitForTimeout(1500);
    const info = await page.evaluate(async () => {
      const g = window.__game, { reset } = await import('/src/vehicle.ts');
      const trees = g.level.props.filter((p) => p.kind === 'tree');
      const t = trees.sort((a, b) => Math.hypot(a.x - g.car.x, a.y - g.car.y) - Math.hypot(b.x - g.car.x, b.y - g.car.y))[0];
      reset(g.car, t.x + 9, t.y + 1, Math.PI);
      g.renderer.debugZoom(1.1);
      return { trees: trees.length, tree: [Math.round(t.x), Math.round(t.y), t.s] };
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `tools/scratch/_treenight-${tag}-${w}.png` });
    console.log(w, JSON.stringify(info));
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
