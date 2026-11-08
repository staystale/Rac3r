// _benchreport.mjs - the Festival of Splat in the real game at phone size with ?report=1, so
// tools/phonereport.mjs can split each frame into sim and draw on the laptop the way it does the
// owner's phone. The run is restarted (the field lined up again), watched SECONDS, then the page is
// left so the reporter posts what is waiting.
// RAC3R_REPORT_LOG=<file> [CPU=4] [VIEW=390x844] [SECONDS=10] node tools/scratch/_benchreport.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  const [viewW, viewH] = (process.env.VIEW || '390x844').split('x').map(Number);
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH },
    hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const cpu = +(process.env.CPU || 1);
  if (cpu > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  await gotoGame(page, `${server.url}/?touch=1&guide=0&noaudio=1&menu=0&level=crash-bench`
    + '&report=1');
  await page.waitForTimeout(1500);
  // the 'tap to drive' card, as on the phone
  await page.touchscreen.tap(viewW / 2, viewH / 2);
  await page.evaluate(() => window.__game.restart());
  await page.waitForTimeout(+(process.env.SECONDS || 10) * 1000);
  const loose = await page.evaluate(() => window.__game.cones.list.length);
  // leaving the page posts the frames still waiting (src/ui/report.ts)
  await page.goto('about:blank');
  await page.waitForTimeout(1000);
  console.log(`CPU x${cpu}, ${viewW}x${viewH}, loose objects at the end ${loose}`);
  console.log(errors.length ? `ERRORS ${errors.slice(0, 5).join(' | ')}` : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
