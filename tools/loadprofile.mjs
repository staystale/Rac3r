// loadprofile.mjs - WHERE A PAGE LOAD'S TIME GOES: the CDP sampling profiler from opening
// ?level=<id> (the modules, ?bundle=0, so the functions keep their names) until the level is
// built and FRAMES frames drawn; written as a .cpuprofile for tools/cpuprof.mjs.
// node tools/loadprofile.mjs <level> <out.cpuprofile> [cpu 1] [extra query]
import fs from 'node:fs';
import { startServer, launchBrowser } from './lib/browser.mjs';

const [levelId = 'test-track', outFile = 'load.cpuprofile', cpuArg = '1', extra = ''] =
  process.argv.slice(2);
// frames drawn after the level is built before the profile stops
const FRAMES = 30;
const server = await startServer();
let browser;
try {
  browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__frames = 0;
    window.requestAnimationFrame = (callback) => raf((stamp) => {
      window.__frames++;
      callback(stamp);
    });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +cpuArg });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  const started = Date.now();
  await page.goto(`${server.url}/?bundle=0&touch=1&guide=0&level=${levelId}&car=track-rwd${extra}`);
  await page.waitForFunction((id) => window.__game?.level?.id === id, levelId,
    { timeout: 120000, polling: 50 });
  const builtMs = Date.now() - started;
  const framesAt = await page.evaluate(() => window.__frames);
  await page.waitForFunction((count) => window.__frames >= count, framesAt + FRAMES,
    { timeout: 120000 });
  const { profile } = await cdp.send('Profiler.stop');
  fs.writeFileSync(outFile, JSON.stringify(profile));
  console.log(`${levelId}: built ${builtMs} ms, drawn ${Date.now() - started} ms -> ${outFile}`);
} finally {
  await browser?.close();
  server.stop();
}
