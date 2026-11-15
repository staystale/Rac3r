// _rxguideshots.mjs - photographs the rallycross EVENT RULES walkthrough (guide.ts RULES.rx, forced
// with ?rules=1) on an RX race, portrait and landscape, with RXGUIDE_QUERY added to the link (e.g.
// rxguide=1). Writes tools/scratch/_rxguide-<query>-<W>-<n>.png. node tools/scratch/_rxguideshots.mjs
import { startServer, launchBrowser } from '../lib/browser.mjs';

const EXTRA = process.env.RXGUIDE_QUERY || '';
const LEVEL_ID = process.env.RXGUIDE_LEVEL || 'knobhill-rx';
const srv = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of [[390, 844], [844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(`${srv.url}/?touch=1&guide=0&menu=1&rules=1${EXTRA ? '&' + EXTRA : ''}`);
    await page.waitForFunction(() => window.__game && window.__game.menu, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__game.menu.hide());
    await page.evaluate((id) => window.__game.launch(id, 'rx-super', { ai: 3, diff: 2, rx: true,
      laps: 3 }), LEVEL_ID);
    await page.waitForFunction(() => window.__game.guide.active, null, { timeout: 30000,
      polling: 250 }).catch(() => {});
    const info = await page.evaluate(() => ({ active: window.__game.guide.active,
      kind: window.__game.guide.kind, count: window.__game.guide.count }));
    const tag = EXTRA.replace(/[^a-z0-9]+/gi, '') || 'plain';
    for (let card = 0; card < info.count; card++) {
      await page.screenshot({ path: `tools/scratch/_rxguide-${tag}-${LEVEL_ID}-${width}-${card + 1}.png` });
      const last = await page.evaluate(() => window.__game.guide.last);
      if (!last) break;
      await page.touchscreen.tap(last.nextB.x + last.nextB.w / 2, last.nextB.y + last.nextB.h / 2);
      await page.waitForTimeout(350);
    }
    console.log(`${width}x${height} ${LEVEL_ID}`, JSON.stringify(info),
      errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors');
    await context.close();
  }
} finally {
  await browser.close();
  srv.stop();
}
