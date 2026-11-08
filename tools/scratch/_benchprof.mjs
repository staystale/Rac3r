// _benchprof.mjs - a CPU profile of the Festival of Splat's impact in the real game (phone size):
// the field lined up again, the profiler on FROM s after the restart until TO s, the profile saved
// for a summary (the functions' self and inclusive time).
// [CPU=1] [FROM=1.2] [TO=4.5] [VIEW=390x844] node tools/scratch/_benchprof.mjs <out.cpuprofile>
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const out = process.argv[2] || 'tools/scratch/_benchprof.cpuprofile';
const server = await startServer();
const browser = await launchBrowser();
try {
  const [viewW, viewH] = (process.env.VIEW || '390x844').split('x').map(Number);
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH },
    hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const cpu = +(process.env.CPU || 1);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await gotoGame(page, `${server.url}/?touch=1&guide=0&noaudio=1&menu=0&level=crash-bench`);
  await page.waitForTimeout(1500);
  await page.touchscreen.tap(viewW / 2, viewH / 2);
  await page.evaluate(() => window.__game.restart());
  await page.waitForTimeout(+(process.env.FROM || 1.2) * 1000);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await page.waitForTimeout((+(process.env.TO || 4.5) - +(process.env.FROM || 1.2)) * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  fs.writeFileSync(out, JSON.stringify(profile));
  console.log(`saved ${out}`);
} finally {
  await browser.close();
  server.stop();
}
