// _c9shots.mjs - C9 armco dents in the real game (?armcodent=1): Castle Cum's longest armco run,
// the hatch driven square into it at four spots 12 m apart - 50 km/h, 80 km/h, 120 km/h, and
// 80 km/h twice - then parked beside them for a photo at 390x844 and 844x390 (dpr 3). Prints each
// spot's dent depth (the rail's furthest point from where it was) and whether it tore; then a
// RESTART and the rail is checked straight. Fails on page errors.
// The tyre stacks within 45 m of the spots are cleared first (bare rail).
// node tools/scratch/_c9shots.mjs [extra query]   -> shots/look/c9-<port|land>.png
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const query = process.argv[2] ?? '&armcodent=1';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height, tag] of [[390, 844, 'port'], [844, 390, 'land']]) {
    const context = await browser.newContext({ viewport: { width, height },
      deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0${query}`);
    await page.touchscreen.tap(width / 2, height / 2);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
      { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
    await page.waitForTimeout(3000);
    // the rail, its middle segment's line, and the spots along it
    const setup = await page.evaluate(async () => {
      const { LEVEL } = await import('/src/world/state.ts');
      const rail = LEVEL.barriers.filter((item) => item.kind === 'armco')
        .sort((a, b) => b.pts.length - a.pts.length)[0];
      window.__c9 = { rail, before: rail.pts.map(([x, y]) => [x, y]) };
      // the tyre stacks in front of this rail would take the hits first: cleared round the spots
      const [mx, my] = rail.pts[Math.floor(rail.pts.length / 2)], list = window.__game.cones.list;
      for (let i = list.length - 1; i >= 0; i--) {
        if (Math.hypot(list[i].x - mx, list[i].y - my) < 45) list.splice(i, 1);
      }
      return { points: rail.pts.length };
    });
    const hit = (spot, kmh) => page.evaluate(async ([index, metres]) => {
      const { rail, before } = window.__c9, car = window.__game.car;
      const [ax, ay] = before[index], [bx, by] = before[index + 1];
      const len = Math.hypot(bx - ax, by - ay), tx = (bx - ax) / len, ty = (by - ay) / len;
      const nx = -ty, ny = tx;
      // 3 m out: the speed at the rail is the speed asked for (from further out the runoff slows it)
      car.x = ax + nx * 3; car.y = ay + ny * 3;
      car.heading = Math.atan2(-ny, -nx); car.vx = -nx * metres; car.vy = -ny * metres;
      car.yawRate = 0;
      for (let frame = 0; frame < 60; frame++) await new Promise((done) => requestAnimationFrame(done));
      // the furthest the rail now is behind the original line, within 4 m of the spot
      let depth = 0;
      for (const [x, y] of rail.pts) {
        const along = (x - ax) * tx + (y - ay) * ty;
        if (Math.abs(along) < 4) depth = Math.max(depth, -((x - ax) * nx + (y - ay) * ny));
      }
      const { isTornAfter } = await import('/src/world/armcodent.ts');
      const torn = rail.pts.some(([x, y], i) => isTornAfter(rail.pts[i])
        && Math.abs((x - ax) * tx + (y - ay) * ty) < 4);
      // the rail's torn length, m
      let gap = 0;
      for (let i = 0; i < rail.pts.length - 1; i++) {
        if (isTornAfter(rail.pts[i])) {
          gap += Math.hypot(rail.pts[i + 1][0] - rail.pts[i][0], rail.pts[i + 1][1] - rail.pts[i][1]);
        }
      }
      return { depth: depth.toFixed(2) + ' m', torn, gap: gap.toFixed(1) + ' m', points: rail.pts.length };
    }, [spot, kmh / 3.6]);
    const mid = Math.floor(setup.points / 2);
    const results = [];
    for (const [offset, kmh] of [[-12, 50], [-6, 80], [0, 120], [6, 80], [6, 80]]) {
      results.push([`spot ${offset * 2} m, ${kmh} km/h`, await hit(mid + offset, kmh)]);
    }
    // park beside the dents, still, and photograph
    await page.evaluate(([index]) => {
      const { before } = window.__c9, car = window.__game.car, g = window.__game;
      const [ax, ay] = before[index], [bx, by] = before[index + 1];
      const len = Math.hypot(bx - ax, by - ay), tx = (bx - ax) / len, ty = (by - ay) / len;
      car.x = ax - ty * 5; car.y = ay + tx * 5; car.heading = Math.atan2(ty, tx);
      car.vx = 0; car.vy = 0; car.yawRate = 0;
      g.input.update = () => ({ steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0,
        shiftUp: false, shiftDown: false });
      if (g.renderer.snap) g.renderer.snap(car);
    }, [mid - 1]);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `shots/look/c9-${tag}.png` });
    // RESTART: the rail straight again
    const after = await page.evaluate(async () => {
      const { doRestart } = await import('/src/game/session.js');
      doRestart();
      const { rail, before } = window.__c9;
      const same = rail.pts.length === before.length
        && rail.pts.every(([x, y], i) => x === before[i][0] && y === before[i][1]);
      return { straight: same, segs: rail._segs ? rail._segs.length : 0 };
    });
    for (const [label, result] of results) console.log(tag, label, JSON.stringify(result));
    console.log(tag, 'after RESTART', JSON.stringify(after), '| page errors:',
      errors.length ? errors.join(' / ') : 'none');
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
