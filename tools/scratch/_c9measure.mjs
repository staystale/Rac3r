// _c9measure.mjs - C9 baseline: the player's hatch driven into Castle Cum's armco (mid-run of the
// longest armco barrier) at a range of speeds, square on (90 deg) and glancing (25 deg). Prints
// the damage per corner (fronts, then rears), the total, the speed kept and the angle it leaves
// at. A fresh launch per run.
// node tools/scratch/_c9measure.mjs [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const query = process.argv[2] || '';
const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0${query}`);
  await page.touchscreen.tap(422, 195);
  await page.waitForTimeout(400);
  const run = async (kmh, angleDeg) => {
    await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
      { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
    await page.waitForTimeout(3000);
    return page.evaluate(async ([metres, angle]) => {
      const { LEVEL } = await import('/src/world/state.ts');
      const car = window.__game.car;
      const rail = LEVEL.barriers.filter((item) => item.kind === 'armco')
        .sort((a, b) => b.pts.length - a.pts.length)[0];
      const mid = Math.floor(rail.pts.length / 2);
      const [ax, ay] = rail.pts[mid], [bx, by] = rail.pts[mid + 1];
      const len = Math.hypot(bx - ax, by - ay), tx = (bx - ax) / len, ty = (by - ay) / len;
      // the side the track is on: +normal (alongTrack offset -16 from the centreline)
      const nx = -ty, ny = tx;
      const rad = angle * Math.PI / 180;
      // heading: into the rail (-normal) at `angle` from the rail's line
      const hx = tx * Math.cos(rad) - nx * Math.sin(rad), hy = ty * Math.cos(rad) - ny * Math.sin(rad);
      const hitX = (ax + bx) / 2, hitY = (ay + by) / 2, back = 2.5 / Math.sin(rad) + 3;
      car.x = hitX - hx * back; car.y = hitY - hy * back;
      car.heading = Math.atan2(hy, hx); car.vx = hx * metres; car.vy = hy * metres;
      car.yawRate = 0;
      let after = null;
      for (let frame = 0; frame < 180 && after === null; frame++) {
        await new Promise((done) => requestAnimationFrame(done));
        // contact: the speed INTO the rail (along -normal) drops by a fifth in a frame
        if (-(car.vx * nx + car.vy * ny) < metres * Math.sin(rad) * 0.8) {
          // read it a third of a second on (the contact runs over several steps)
          for (let wait = 0; wait < 20; wait++) await new Promise((done) => requestAnimationFrame(done));
          after = { vx: car.vx, vy: car.vy };
        }
      }
      await new Promise((done) => setTimeout(done, 150));
      const dmg = car.dmg || [0, 0, 0, 0];
      const out = after ? Math.hypot(after.vx, after.vy) : null;
      // the angle it leaves at, from the rail's line (+ = away from the rail)
      const leave = after ? Math.atan2(after.vx * nx + after.vy * ny,
        Math.abs(after.vx * tx + after.vy * ty)) * 180 / Math.PI : null;
      return { dmg: dmg.map((x) => x.toFixed(2)).join(' '),
        total: dmg.reduce((a, b) => a + b, 0).toFixed(2),
        kept: out === null ? '-' : (out / metres * 100).toFixed(0) + '%',
        leaves: leave === null ? '-' : leave.toFixed(0) + ' deg' };
    }, [kmh / 3.6, angleDeg]);
  };
  for (const angle of [90, 25]) {
    for (const kmh of [30, 50, 80, 120]) {
      console.log(`armco ${angle} deg ${kmh} km/h`, JSON.stringify(await run(kmh, angle)));
    }
  }
  await context.close();
} finally {
  await browser.close();
  server.stop();
}
