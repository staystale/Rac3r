// _moload.mjs - A LEVEL'S LOAD in the live game: a fresh page per level at phone size (844 x 390),
// then the ms from window.__game.launch(level) to its first frame drawn (the call itself - the
// level's build - and the frames after it), and the JS heap there. node tools/scratch/_moload.mjs
// [levels a,b,...] [runs] (env QUERY; CHECK_PORT) (scratch)
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const levels = (process.argv[2] || 'moanaco,yasmarina,brands-snatch').split(',');
const runs = +(process.argv[3] || 2);
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const level of levels) for (let run = 0; run < runs; run++) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
    const page = await context.newPage();
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1${process.env.QUERY || ''}`);
    await page.waitForTimeout(1500);
    const result = await page.evaluate(async (lv) => {
      const frame = () => new Promise((done) => requestAnimationFrame(() => done()));
      const t0 = performance.now();
      window.__game.launch(lv, window.__game.car.spec.id, { ai: 0 });
      const call = performance.now() - t0;
      await frame(); await frame();
      const first = performance.now() - t0;
      // the next 60 frames' gaps (the ground tiles painting in)
      const gaps = []; let last = performance.now();
      for (let i = 0; i < 60; i++) { await frame(); const now = performance.now(); gaps.push(now - last); last = now; }
      gaps.sort((a, b) => a - b);
      return { call, first, settle: gaps.reduce((s, g) => s + g, 0), worstGap: gaps.at(-1),
        heap: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0 };
    }, level);
    console.log(`${level} run ${run}: launch call ${result.call.toFixed(0)} ms, first frame ${result.first.toFixed(0)} ms, next 60 frames ${result.settle.toFixed(0)} ms (worst ${result.worstGap.toFixed(0)}), heap ${result.heap.toFixed(0)} MB`);
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
