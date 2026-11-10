// _coverheap.mjs - WHAT A LEVEL'S GROUND COVERS HOLD (render/ground/covers.ts: Yass Marina's
// marina): the level loaded at phone size, the car set by the water so its covers are merged and
// painted, then after a forced GC the JS heap; the merged covers' cell count. RUNS loads, the heap
// each (a fresh page each).
// [RUNS=3] [AT=x,y] node tools/scratch/_coverheap.mjs [level]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const level = process.argv[2] || 'yasmarina', RUNS = +(process.env.RUNS || 3);
const [atX, atY] = (process.env.AT || '330,-560').split(',').map(Number);
const server = await startServer();
const browser = await launchBrowser();
try {
  const heaps = [];
  for (let run = 0; run < RUNS; run++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=${level}`);
    await page.waitForTimeout(1500);
    const cells = await page.evaluate(async ([x, y]) => {
      const game = window.__game;
      Object.assign(game.car, { x, y, vx: 0, vy: 0 });
      game.renderer.snap(game.car);
      await new Promise((done) => setTimeout(done, 2500));
      const merged = game.level._merged || [];
      return merged.reduce((sum, grp) => sum + (grp.cells ? grp.cells.length : grp.gx.length), 0);
    }, [atX, atY]);
    await cdp.send('HeapProfiler.collectGarbage');
    await page.waitForTimeout(300);
    await cdp.send('HeapProfiler.collectGarbage');
    const { usedSize } = await cdp.send('Runtime.getHeapUsage');
    heaps.push(usedSize / 1048576);
    console.log(`run ${run + 1}: ${level} JS heap ${(usedSize / 1048576).toFixed(1)} MB, merged`
      + ` cover cells ${cells}`);
    await context.close();
  }
  heaps.sort((low, high) => low - high);
  console.log(`median ${heaps[heaps.length >> 1].toFixed(1)} MB`);
} finally {
  await browser.close();
  server.stop();
}
