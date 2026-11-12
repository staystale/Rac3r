// _benchframes.mjs - the Festival of Splat in the real game at phone size, CPU slowed (CPU=4 like
// a phone): every frame's time over SECONDS after the restart - median, the worst, frames over
// 25 ms, and the worst half-second's fps. Run from two worktrees to compare builds.
// [CPU=4] [SECONDS=10] [VIEW=390x844] node tools/scratch/_benchframes.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  const [viewW, viewH] = (process.env.VIEW || '390x844').split('x').map(Number);
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH }, hasTouch: true });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (err) => errors.push(err.message));
  const cpu = +(process.env.CPU || 4);
  if (cpu > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await gotoGame(page, `${server.url}/?touch=1&guide=0&noaudio=1&menu=0&level=crash-bench`);
  await page.waitForTimeout(1500);
  await page.touchscreen.tap(viewW / 2, viewH / 2);
  const res = await page.evaluate(async (ms) => {
    window.__game.restart();
    const times = []; let last = performance.now(), rolled = 0;
    const start = last;
    while (performance.now() - start < ms) {
      await new Promise((done) => requestAnimationFrame(done));
      const now = performance.now(); times.push(now - last); last = now;
    }
    for (const ai of window.__game.ai || []) if (ai.car._rolls) rolled++;
    const sorted = [...times].sort((a, b) => a - b);
    let worstHalf = Infinity;
    for (let i = 0; i < times.length; i++) {
      let sum = 0, n = 0;
      for (let j = i; j < times.length && sum < 500; j++) { sum += times[j]; n++; }
      if (sum >= 500) worstHalf = Math.min(worstHalf, n / (sum / 1000));
    }
    return { frames: times.length, medianMs: +sorted[times.length >> 1].toFixed(1),
      worstMs: +sorted.at(-1).toFixed(1), over25: times.filter((t) => t > 25).length,
      worstHalfFps: +worstHalf.toFixed(1), carsRolled: rolled };
  }, +(process.env.SECONDS || 10) * 1000);
  console.log(JSON.stringify(res), errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally { await browser.close(); server.stop(); }
