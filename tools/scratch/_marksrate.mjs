// _marksrate.mjs - ?marksage sizing (the owner's 11-21 bug 4): in a real race, how fast the marks
// layer fills (strokes a sim second: marks.stamps, every car inside the layer's window), how far
// its window moves (px a second: the strips it clears) and what a stroke list kept for the aged
// fade's whole life (AGED_FROM_S + AGED_STEPS x AGED_STEP_S = 154 s) would hold, and how many
// 256 px tiles (61 m) a sparse whole-level layer would keep live over that life. The player on
// the autodriver, N AI, CPU x1.
// node tools/scratch/_marksrate.mjs <level,level> [ai] [seconds]
import { startServer, launchBrowser } from '../lib/browser.mjs';

const levels = (process.argv[2] || 'spa').split(',');
const aiCount = +(process.argv[3] || 19);
const seconds = +(process.argv[4] || 120);
const LIFE_S = 154;
const server = await startServer();
const browser = await launchBrowser();

/**
 * One level: launch, drive, sample every 10 s.
 * @param level the level id
 */
async function measureLevel(level) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&level=${level}`);
  await page.waitForFunction(() => window.__game && window.__game.launch, null,
    { timeout: 120000 });
  await page.evaluate(([id, count]) => window.__game.launch(id, 'hatch-fwd',
    { ai: count, laps: 5 }), [level, aiCount]);
  await page.waitForTimeout(1500);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    const game = window.__game, auto = await import('/src/ai/autodrive.ts');
    const driver = auto.createAutoDriver(game.level.subtrack);
    game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false,
      shiftDown: false });
    // each stroke's 256 px tile (61 m) and sim time: the tiles a sparse whole-level layer would
    // hold live (a stroke in the last LIFE_S)
    const marks = game.marks, stamp = marks.stamp, tileM = 256 / 4.2;
    window.__tileT = new Map();
    marks.stamp = (wheels) => {
      for (const wheel of wheels) {
        const before = marks.stamps;
        stamp([wheel]);
        if (marks.stamps > before) window.__tileT.set(Math.floor(wheel.x / tileM) + ','
          + Math.floor(wheel.y / tileM), game.flow ? game.flow.t : 0);
      }
    };
  });
  const samples = [];
  for (let t = 0; t <= seconds; t += 10) {
    samples.push(await page.evaluate(() => {
      const game = window.__game, marks = game.marks;
      const sim = game.flow ? game.flow.t : 0;
      const live = [...window.__tileT.values()].filter((at) => sim - at < 154).length;
      return { sim, stamps: marks.stamps, live, tiles: window.__tileT.size,
        shiftX: marks.shiftX, shiftY: marks.shiftY, now: performance.now() / 1000 };
    }));
    if (t < seconds) await page.waitForTimeout(10000);
  }
  let moved = 0;
  for (let i = 1; i < samples.length; i++) moved += Math.abs(samples[i].shiftX
    - samples[i - 1].shiftX) + Math.abs(samples[i].shiftY - samples[i - 1].shiftY);
  const first = samples[0], last = samples[samples.length - 1];
  const wall = last.sim - first.sim || last.now - first.now, strokes = last.stamps - first.stamps;
  const perSecond = strokes / wall;
  const rates = samples.slice(1).map((row, i) => Math.round((row.stamps - samples[i].stamps)
    / Math.max(0.1, row.sim - samples[i].sim)));
  const real = Math.round(last.now - first.now), list = Math.round(perSecond * LIFE_S);
  console.log(`${level} ${aiCount} AI, ${Math.round(wall)} sim s (${real} real s):`,
    `strokes ${strokes} (${Math.round(perSecond)}/s; each 10 s: ${rates.join(' ')});`,
    `a ${LIFE_S} s list ~${list} strokes;`,
    `window moved ${moved} px (${Math.round(moved / wall)} px/s);`,
    `256 px tiles marked: live (last ${LIFE_S} s) each 10 s ${samples.map((row) => row.live)
      .join(' ')}, ever ${last.tiles}`,
    errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
  await context.close();
}

try {
  for (const level of levels) await measureLevel(level);
} finally {
  await browser.close();
  server.stop();
}
