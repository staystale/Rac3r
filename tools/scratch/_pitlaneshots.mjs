// _pitlaneshots.mjs - ?pitstops step 4: a level at its start, with and without the switch (its pit
// lane beside the grid), at 844x390 and 390x844. node tools/scratch/_pitlaneshots.mjs [level]
import { startServer, launchBrowser } from '../lib/browser.mjs';
import { openPage, launchLevel } from '../lib/determinism.mjs';
const level = process.argv[2] || 'lemans';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [tag, extra] of [['off', ''], ['on', '&pitstops=1']]) {
    const errors = [];
    const page = await openPage(browser, server.url, level, errors, extra);
    await page.evaluate(() => { dispatchEvent(new KeyboardEvent('keydown', { key: 'x' })); window.__rt.step(10); });
    await page.evaluate(launchLevel, [level, { ai: 0 }]);
    await page.evaluate(() => window.__rt.step(240));
    for (const [width, height] of [[844, 390], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.__rt.step(30));
      await page.screenshot({ path: `tools/scratch/_pitlane-${level}-${tag}-${width}.png` });
    }
    console.log(`${level} ${tag}: ${errors.length ? errors.join(' | ') : 'no page errors'}`);
    await page.context().close();
  }
} finally { await browser.close(); server.stop(); }
