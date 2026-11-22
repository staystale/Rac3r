// _pitstopcheck.mjs - ?pitstops step 1 in the real game (the browser): an F1 car VS 3 AI over 5 laps
// at a venue with a pit lane, PIT STOPS on. Staged, each from the car put down by the tool:
// (1) the LIMITER - on the pit lane at 30 m/s along it: its speed after 2 s, the light on;
// (2) THE BOX - stopped in your box: the PIT STOP menu opens (shots at 844x390 and 390x844), the
//     race clock running on while it is open; the tyres SAME AGAIN and REPAIR picked, CONFIRM & GO:
//     the hold measured against the model, then the GO; the missed-stop penalty before / after;
// (3) THE RESET - put down on the pit lane, RESET: where the car lands (its track m vs the lane's
//     entrance, on the track or not). node tools/scratch/_pitstopcheck.mjs [level] [car]
import { startServer, launchBrowser } from '../lib/browser.mjs';

const level = process.argv[2] || 'brands-snatch', carId = process.argv[3] || 'track-rwd';
const OUT = 'tools/scratch/_pitstop-';
const server = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(`${server.url}/?touch=1&guide=0&rules=0&menu=1&pitstops=1`);
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(([lv, car]) => window.__game.launch(lv, car, { ai: 3, laps: 5, pits: true }),
    [level, carId]);
  await page.waitForFunction(() => window.__game.car && !window.__game.raceHeld, null,
    { timeout: 60000 });
  await page.waitForTimeout(6000);   // the lights: green
  const put = (pose) => page.evaluate((one) => {
    const car = window.__game.car;
    Object.assign(car, { x: one.x, y: one.y, heading: one.heading, vx: one.v * Math.cos(one.heading),
      vy: one.v * Math.sin(one.heading), yawRate: 0 });
    car._p = null;
  }, pose);
  const lane = await page.evaluate(async () => {
    const pits = window.__game.level.pits;
    const geo = await import('/src/world/venuegeo.ts');
    const mid = geo.pointAlong(pits.pts, geo.lineLength(pits.pts) * 0.15);
    const ahead = geo.pointAlong(pits.pts, geo.lineLength(pits.pts) * 0.15 + 1);
    return { x: mid.x, y: mid.y, heading: Math.atan2(ahead.y - mid.y, ahead.x - mid.x),
      boxes: pits.boxes.length, entryD: pits.entryD };
  });
  console.log(`${level}: pit lane with ${lane.boxes} boxes, entrance at ${lane.entryD.toFixed(0)} m`);
  // (1) the limiter
  await put({ x: lane.x, y: lane.y, heading: lane.heading, v: 30 });
  await page.waitForTimeout(2000);
  const limit = await page.evaluate(() => ({ v: Math.hypot(window.__game.car.vx, window.__game.car.vy),
    light: !!window.__game.pitLimiter }));
  console.log(`  limiter: 30 m/s in -> ${(limit.v * 3.6).toFixed(0)} km/h after 2 s, light ${limit.light}`);
  // (2) the box
  const pen0 = await page.evaluate(() => window.__game.car._pitPen || 0);
  const box = await page.evaluate(async () => (await import('/src/game/pitstop.ts')).myBox());
  await put({ x: box.x, y: box.y, heading: box.heading, v: 0 });
  await page.waitForTimeout(800);
  const opened = await page.evaluate(() => !!document.querySelector('#menu h2')
    && document.querySelector('#menu h2').textContent);
  const clock0 = await page.evaluate(() => window.__game.flow?.t ?? 0);
  await page.screenshot({ path: OUT + 'menu-844.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + 'menu-390.png' });
  await page.setViewportSize({ width: 844, height: 390 });
  const damage = await page.evaluate(async () => (await import('/src/game/pitstop.ts')).pitView().damage);
  await page.locator('#menu button', { hasText: '▶' }).first().click();
  await page.locator('#menu button', { hasText: 'REPAIR' }).first().click();
  const clock1 = await page.evaluate(() => window.__game.flow?.t ?? 0);
  const tapped = Date.now();
  await page.locator('#menu button', { hasText: 'CONFIRM' }).first().click();
  await page.waitForFunction(() => !!window.__game.pitGo, null, { timeout: 60000 });
  const held = (Date.now() - tapped) / 1000;
  const model = await page.evaluate(async (dmg) => (await import('/src/game/pitstop.ts'))
    .workTime({ tyre: 'x', repair: true }, dmg), damage);
  const pen1 = await page.evaluate(() => window.__game.car._pitPen || 0);
  console.log(`  box: menu "${opened}"; the race clock ran ${(clock1 - clock0).toFixed(1)} s while it`
    + ` was open; held ${held.toFixed(1)} s after CONFIRM (model ${model.toFixed(1)} s, damage`
    + ` ${(damage * 100).toFixed(0)} %); missed-stop penalty ${pen0} s before, ${pen1} s after`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + 'go-844.png' });
  // (3) the reset
  await page.waitForTimeout(1500);
  await put({ x: lane.x, y: lane.y, heading: lane.heading, v: 0 });
  await page.waitForTimeout(300);
  const back = await page.evaluate(async () => {
    window.__game.reset();
    const { querySubtrack } = await import('/src/world/tyrewall.ts');
    const { onPitLane } = await import('/src/world/pitlane.ts');
    const game = window.__game, hit = querySubtrack(game.level.subtrack, game.car.x, game.car.y);
    return { trackD: hit.trackDist, off: hit.dist, onLane: onPitLane(game.level, game.car.x, game.car.y),
      half: game.level.subtrack.width / 2 };
  });
  console.log(`  reset on the pit lane: lands at ${back.trackD.toFixed(0)} m (entrance ${lane.entryD.toFixed(0)}),`
    + ` ${back.off.toFixed(1)} m off the middle (half width ${back.half}), on the pit lane: ${back.onLane}`);
  console.log(`  page errors: ${errors.length ? errors.slice(0, 3).join(' | ') : 'none'}`);
} finally {
  await browser.close();
  server.stop();
}
