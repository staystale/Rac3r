// _rocrace.mjs - A RACE OF CHAMPIONS STADIUM'S SPLIT START in the real game (Level.splitStart, owner
// 11-11: "cars on separate track halves and timed, 1 full lap"): VS AI through the real launch,
// the player driven by the racing AI; at the lights each car's pose, its road m, its own line
// (_origin) and progress, the gap between the two cars; photos of the start and, at the end, the
// podium and the table; the results (both times, the winner). Modelled on tools/racecheck4.mjs.
// node tools/scratch/_rocrace.mjs [level] [ai n] [laps] [W] [H]   (env RAC3R_QUERY: the switches)
import { startServer, launchBrowser } from '../lib/browser.mjs';
const [level = 'wobbly', aiCount = '1', laps = '1', width = '844', height = '390'] =
  process.argv.slice(2);
const OUT = process.env.OUT || 'tools/scratch';
const query = process.env.RAC3R_QUERY || 'wobbly=1&stadeprance=1';
const server = await startServer();
let browser;
try {
  browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: +width, height: +height },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`${server.url}/?menu=1&guide=0&${query}`);
  await page.waitForFunction(() => window.__game && window.__game.menu, null, { timeout: 90000 });
  await page.evaluate(async ([levelId, count, lapCount]) => {
    const game = window.__game;
    game.menu.hide();
    game.launch(levelId, 'hatch-rwd', { ai: count, diff: 2, laps: lapCount });
    const ai = { ...await import('/src/ai/circuit.ts'), ...await import('/src/ai/traits.ts') };
    const lab = await import('/src/lab.js');
    const driver = ai.createAIDriver(lab.LEVEL, ai.aiTraits(3, 0, 1, 99));
    game.input.update = () => ({ ...driver.drive(game.car, 1 / 60,
      { cars: game.ai.map((entry) => entry.car), lap: 1, laps: lapCount }), reverse: 0,
      shiftUp: false, shiftDown: false });
  }, [level, +aiCount, +laps]);
  const slug = `${level}-${width}x${height}`;
  await page.waitForTimeout(1500);
  const grid = await page.evaluate(async () => {
    const game = window.__game, lab = await import('/src/lab.js');
    const sub = lab.LEVEL.subtrack;
    const pose = (car) => ({ x: +car.x.toFixed(1), y: +car.y.toFixed(1),
      road: +lab.querySubtrack(sub, car.x, car.y).trackDist.toFixed(1),
      origin: car._origin ?? 0, prog: car._prog === undefined ? null : +car._prog.toFixed(1) });
    const cars = [game.car, ...game.ai.map((entry) => entry.car)];
    return { split: !!lab.LEVEL.splitStart, lap: +sub.totalDist.toFixed(1), held: !game.start.green,
      cars: cars.map(pose), apart: +Math.hypot(cars[0].x - cars[1].x, cars[0].y - cars[1].y)
        .toFixed(1) };
  });
  console.log('grid', JSON.stringify(grid));
  // (zoomed out for the start: both cars in one frame, then the game's own zoom again)
  await page.evaluate(() => window.__game.renderer.debugZoom(0.45));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/_rocrace-${slug}-start.png` });
  await page.evaluate(() => window.__game.renderer.debugZoom(null));
  let state = null;
  const began = Date.now();
  while (Date.now() - began < 60000 + 75000 * +laps) {
    await page.waitForTimeout(500);
    state = await page.evaluate(() => {
      const flow = window.__game.flow;
      return flow && { state: flow.state, t: +flow.t.toFixed(1), shown: !!window.__game.flowShown,
        progs: flow.entries.map((entry) => Math.round(entry.car._prog ?? -1)),
        laps: flow.entries.map((entry) => entry.lapDone) };
    });
    if (!state) break;
    if (state.shown) break;
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/_rocrace-${slug}-podium.png` });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/_rocrace-${slug}-table.png` });
  const results = await page.evaluate(() => {
    const flow = window.__game.flow;
    return flow && flow.results && flow.results.map((row) => ({ pos: row.pos,
      who: row.player ? 'YOU' : '#' + row.num, time: +row.total.toFixed(2), est: row.est,
      laps: row.laps, lapTimes: (flow.entries.find((entry) => entry.car === row.car) || {}).laps }));
  });
  console.log('end', JSON.stringify(state));
  console.log('results', JSON.stringify(results));
  console.log('errors', errors.length ? errors : 'none');
} finally {
  await browser?.close();
  server.stop();
}
