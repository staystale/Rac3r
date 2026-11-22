// _pitboxshots.mjs - ?pitstops: photos of how the pit stop is shown (the joker's way), at game zoom,
// at 844x390 and 390x844, an F1 race VS 3 AI (the compulsory stop to do): (1) on the lap before the
// pit entrance (the joker's arrows into it, the lap panel's PIT line), (2) on the pit lane,
// approaching your box (the lane's arrows, your box marked, the lollipop), (3) stopped in your box
// (the menu), (4) held for the work (menu closed), (5) the GO (the lollipop green).
// node tools/scratch/_pitboxshots.mjs [level] [car]
import { startServer, launchBrowser } from '../lib/browser.mjs';

const level = process.argv[2] || 'brands-snatch', carId = process.argv[3] || 'track-rwd';
const OUT = 'tools/scratch/_pitbox-';
const server = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(`${server.url}/?touch=1&guide=0&rules=0&menu=1&pitstops=1`);
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(([lv, car]) => {
    window.__game.menu.hide();
    window.__game.launch(lv, car, { ai: 3, laps: 5, pits: true });
  }, [level, carId]);
  await page.waitForFunction(() => window.__game.car && !window.__game.raceHeld, null,
    { timeout: 60000 });
  await page.waitForTimeout(6000);
  const put = (pose) => page.evaluate((one) => {
    const car = window.__game.car;
    Object.assign(car, { x: one.x, y: one.y, heading: one.heading, vx: one.v * Math.cos(one.heading),
      vy: one.v * Math.sin(one.heading), yawRate: 0 });
    car._p = null;
  }, pose);
  const both = async (name) => {
    await page.screenshot({ path: `${OUT}${name}-844.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}${name}-390.png` });
    await page.setViewportSize({ width: 844, height: 390 });
  };
  const spots = await page.evaluate(async () => {
    const game = window.__game, pits = game.level.pits, sub = game.level.subtrack;
    const { onTrack } = await import('/src/world/tyrewall.ts');
    const { myBox } = await import('/src/game/pitstop.ts');
    const total = sub.totalDist, back = onTrack(sub, ((pits.entryD - 110) % total + total) % total,
      0, {});
    const box = myBox(), geo = await import('/src/world/venuegeo.ts');
    // (the lane's own line, 25 m before your box)
    let boxAlong = 0, bestD = Infinity;
    for (let along = 0; along < geo.lineLength(pits.pts); along += 0.5) {
      const spot = geo.pointAlong(pits.pts, along), dist = Math.hypot(spot.x - box.x, spot.y - box.y);
      if (dist < bestD) [bestD, boxAlong] = [dist, along];
    }
    const mid = geo.pointAlong(pits.pts, boxAlong - 25), ahead = geo.pointAlong(pits.pts, boxAlong - 24);
    return { lap: { x: back.x, y: back.y, heading: back.rot },
      lane: { x: mid.x, y: mid.y, heading: Math.atan2(ahead.y - mid.y, ahead.x - mid.x) },
      box: { x: box.x, y: box.y, heading: box.heading }, arrows: pits.arrows.length,
      boxes: pits.boxes.length };
  });
  console.log(`${level}: ${spots.boxes} boxes, ${spots.arrows} arrows (+ your box's)`);
  const where = (spot) => page.evaluate(async (one) => {
    const game = window.__game, sub = game.level.subtrack;
    const { querySubtrack } = await import('/src/world/tyrewall.ts');
    const { onPitLane } = await import('/src/world/pitlane.ts');
    const { onLane } = await import('/src/game/order.ts');
    const hit = querySubtrack(sub, one.x, one.y);
    return `track ${hit.trackDist.toFixed(0)} m, ${hit.dist.toFixed(1)} m off its middle (half `
      + `${sub.width / 2}), onLane ${onLane(one.x, one.y)}, onPitLane `
      + `${onPitLane(game.level, one.x, one.y)}`;
  }, spot);
  console.log(`  lane spot: ${await where(spots.lane)}; box: ${await where(spots.box)}`);
  // the pit-stop state as the HUD reads it
  const cueNow = () => page.evaluate(() => JSON.stringify({ cue: window.__game.pitCue,
    arrows: (window.__game.pitArrows || []).length, box: !!window.__game.pitBox }));
  // (1) the lap before the entrance, at speed
  await put({ ...spots.lap, v: 35 });
  await page.waitForTimeout(1300);
  console.log(`  (1) approaching the entrance: ${await cueNow()}`);
  await both('1-entrance');
  // (2) on the lane, approaching your box at the limit
  await put({ ...spots.lane, v: 15 });
  await page.waitForTimeout(900);
  console.log(`  (2) on the lane: ${await cueNow()}`);
  await both('2-lane');
  // (3) stopped in the box: the menu
  await put({ ...spots.box, v: 0 });
  await page.waitForTimeout(900);
  console.log(`  (3) in the box: ${await cueNow()}`);
  await both('3-box-menu');
  // (4) the work (fresh tyres), the menu closed
  await page.locator('#menu button', { hasText: '▶' }).first().click();
  await page.locator('#menu button', { hasText: 'CONFIRM' }).first().click();
  await page.waitForTimeout(700);
  console.log(`  (4) the work: ${await cueNow()}`);
  await both('4-work');
  // (5) the GO
  await page.waitForFunction(() => !!window.__game.pitGo, null, { timeout: 60000 });
  await page.waitForTimeout(150);
  console.log(`  (5) GO: ${await cueNow()}`);
  await both('5-go');
  console.log(`  page errors: ${errors.length ? errors.slice(0, 3).join(' | ') : 'none'}`);
} finally {
  await browser.close();
  server.stop();
}
