// _c8measure.mjs - C8 post hits: the player's hatch driven into a fresh Castle Cum street light,
// then into a tree trunk, at a range of closing speeds, dead centre and 0.6 m off centre. Prints
// the damage per corner (damage.ts order: the fronts, then the rears), the total, the speed kept,
// whether the post snapped and the radiator leak (engLeak). A fresh launch per run.
// node tools/scratch/_c8measure.mjs [extra query] [lamp|tree|both]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const query = process.argv[2] || '', which = process.argv[3] || 'both';
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
  const run = async (target, kmh, side) => {
    await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
      { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
    await page.waitForTimeout(3000);
    return page.evaluate(async ([kind, metres, across]) => {
      const car = window.__game.car;
      let post, dirX, dirY;
      if (kind === 'lamp') {
        post = (await import('/src/world/lamps.ts')).activeLamps()
          .find((item) => item.kind === 'street');
        dirX = Math.cos(post.rot + Math.PI / 2); dirY = Math.sin(post.rot + Math.PI / 2);
      } else {
        const { LEVEL } = await import('/src/world/state.ts');
        // a tree with nothing else solid within 12 m (a clean run in)
        post = LEVEL.solids.find((tree) => tree.kind === 'tree' && LEVEL.solids.every((other) =>
          other === tree || Math.hypot(other.x - tree.x, other.y - tree.y) > 12));
        dirX = 1; dirY = 0;
      }
      if (!post) return { error: 'no ' + kind };
      car.x = post.x - dirX * 6 - dirY * across; car.y = post.y - dirY * 6 + dirX * across;
      car.heading = Math.atan2(dirY, dirX); car.vx = dirX * metres; car.vy = dirY * metres;
      car.yawRate = 0;
      let after = null;
      for (let frame = 0; frame < 90 && after === null; frame++) {
        await new Promise((done) => requestAnimationFrame(done));
        if ((car.dmgHits || 0) > 0 || post.down || Math.hypot(car.vx, car.vy) < metres * 0.9
            || Math.hypot(car.x - post.x, car.y - post.y) > 8) after = Math.hypot(car.vx, car.vy);
      }
      await new Promise((done) => setTimeout(done, 150));
      const dmg = car.dmg || [0, 0, 0, 0];
      return { dmg: dmg.map((x) => x.toFixed(2)).join(' '),
        total: dmg.reduce((a, b) => a + b, 0).toFixed(2),
        kept: after === null ? '-' : (after / metres * 100).toFixed(0) + '%', snapped: !!post.down,
        radiator: car.engLeak ? (1 / car.engLeak).toFixed(0) + ' s' : '-' };
    }, [target, kmh / 3.6, side]);
  };
  const targets = which === 'both' ? ['lamp', 'tree'] : [which];
  for (const target of targets) {
    for (const side of [0, 0.6]) {
      for (const kmh of [20, 30, 40, 45, 50, 60, 80, 100, 130]) {
        const result = await run(target, kmh, side);
        console.log(`${target} ${side ? 'offset' : 'centre'} ${kmh} km/h`, JSON.stringify(result));
      }
    }
  }
  await context.close();
} finally {
  await browser.close();
  server.stop();
}
