// _gpustat.mjs - THE FRAME-DROP HUNT ON A DESKTOP (?report=1, src/ui/gpustat.ts): the
// game at the owner's phone size (440x738, dpr 3), the highway on the autopilot (zoomed out at
// speed), traffic 0.6, for SECONDS a condition - day, night, rain - its phone reports written by
// the test server to OUT, then read by tools/phonereport.mjs (the same reading as the phone's).
// A condition may skip layers to see what they cost the GPU (the fences): "night/skip=night".
// [CONDITIONS=day;night;rain] [SECONDS=40] [CPU=1] [OUT=<file>] [CHECK_PORT=..]
//   node tools/scratch/_gpustat.mjs
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const OUT = process.env.OUT || join(tmpdir(), 'rac3r-gpustat.jsonl');
process.env.RAC3R_REPORT_LOG = OUT;
rmSync(OUT, { force: true });
const { startServer, launchBrowser, gotoGame } = await import('../lib/browser.mjs');
const CONDITIONS = (process.env.CONDITIONS || 'day;night;rain').split(';');
const SECONDS = +(process.env.SECONDS || 40), CPU = +(process.env.CPU || 1);
const QUERY = { day: '', night: '&night=0.9', rain: '&rain=0.8' };
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  for (const entry of CONDITIONS) {
    const [condition, extra = ''] = entry.split('/');
    const context = await browser.newContext({ viewport: { width: 440, height: 738 },
      deviceScaleFactor: 3 });
    const page = await context.newPage();
    page.on('pageerror', (err) => errors.push(`${entry}: ${err.message}`));
    if (CPU > 1) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    }
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
      + `&report=1&cond=${condition}${QUERY[condition] ?? ""}`
      + (extra ? '&' + extra : ''));
    await page.mouse.click(220, 369);
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd',
      { ai: 0, road: 'motorway', scenery: 'countryside', traffic: 0.6 }));
    await page.waitForTimeout(SECONDS * 1000);
    // (the last part-batch posted as the page is left)
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    await page.waitForTimeout(500);
    await context.close();
    console.log(entry, 'done');
  }
} finally {
  await browser.close();
  server.stop();
  console.log(errors.length ? 'PAGE ERRORS:\n  ' + errors.join('\n  ') : 'no page errors');
}
const read = spawnSync(process.execPath, ['tools/phonereport.mjs', OUT], { encoding: 'utf8' });
console.log(read.stdout + read.stderr);
