// _tunnellights.mjs - A CAR'S LIGHTS THROUGH A LEVEL'S TUNNELS AT NIGHT (scratch): headlights on,
// the car driven through each tunnel crossing (a track tunnel along the race road, any other on
// the crossing's own line) and stopped on the open road before it, in its first open cut, under
// its cover and in its last cut; at each stop what the game says (on the crossing, underground)
// and the light on the screen: the mean brightness of the road 6-14 m ahead of the car and 1-3 m
// behind it (its tail lights), and a photo. node tools/scratch/_tunnellights.mjs <level> [query]
// [W] [H]   (CHECK_PORT; the lock: one browser)
import { startServer, launchBrowser } from '../lib/browser.mjs';

const [levelId = 'wobbly', query = '', width = '844', height = '390'] = process.argv.slice(2);
const server = await startServer();
let browser;
try {
  browser = await launchBrowser();
  const page = await (await browser.newContext({ viewport: { width: +width, height: +height },
    deviceScaleFactor: 1 })).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`${server.url}/?menu=1&guide=0&night=0.8&${query}`);
  await page.waitForFunction(() => window.__game && window.__game.menu, null, { timeout: 90000 });
  const ways = await page.evaluate(async (id) => {
    const game = window.__game;
    game.menu.hide();
    game.launch(id, 'hatch-rwd', { ai: 0 });
    await new Promise((done) => setTimeout(done, 2500));
    return (game.level.crossings || []).map((way, index) => ({ index, kind: way.kind,
      track: !!way.track, length: way.length, cut: way.cut, bent: !!way.walls?.[0]?.pts?.length
        && way.walls[0].pts.length > 2 })).filter((way) => way.kind === 'tunnel');
  }, levelId);
  console.log(`${levelId}: ${ways.length} tunnels`, JSON.stringify(ways));
  for (const way of ways) {
    const stops = [['road', -30], ['open cut', way.cut * 0.5], ['under', way.length / 2],
      ['last cut', way.length - way.cut * 0.5]];
    for (const [label, along] of stops) {
      const state = await page.evaluate(async ([index, stopAlong]) => {
        const game = window.__game, lab = await import('/src/lab.js');
        const geo = await import('/src/world/crossinggeo.ts');
        const way = game.level.crossings[index], sub = lab.LEVEL.subtrack, car = game.car;
        // the road m at the way's line: a track tunnel follows the race road
        const pointAt = (wayAlong) => [way.ax + way.dirX * wayAlong, way.ay + way.dirY * wayAlong];
        const roadAt = (wayAlong) => {
          const [x, y] = pointAt(wayAlong);
          return lab.querySubtrack(sub, x, y).trackDist;
        };
        let along = -18;
        // (the race road may run the way's line either way: then the stops are counted from B)
        const total = sub ? sub.totalDist : 1;
        const forward = !way.track || ((roadAt(way.length - 0.5) - roadAt(0.5) + total) % total)
          < total / 2;
        const startDist = way.track ? roadAt(forward ? 0.5 : way.length - 0.5) - 18 : 0;
        const first = way.track ? lab.onTrack(sub, startDist, 0, {}) : null;
        const [sx, sy] = first ? [first.x, first.y] : pointAt(-18);
        const heading = first ? first.rot : Math.atan2(way.dirY, way.dirX);
        const { reset } = await import('/src/vehicle.ts');
        reset(car, sx, sy, heading);
        car.crossing = -1;
        car.lightsOn = true;
        let roadDist = startDist;
        game.input.update = () => {
          const speed = Math.hypot(car.vx, car.vy);
          let wantX, wantY;
          if (way.track) {
            const near = lab.querySubtrack(sub, car.x, car.y).trackDist;
            if (Math.abs(near - roadDist) < 12) roadDist = near;
            const target = lab.onTrack(sub, roadDist + 8, 0, {});
            [wantX, wantY] = [target.x, target.y];
          } else {
            const ahead = geo.alongOf(way, car.x, car.y) + 8;
            [wantX, wantY] = pointAt(ahead);
          }
          let turn = Math.atan2(wantY - car.y, wantX - car.x) - car.heading;
          turn = Math.atan2(Math.sin(turn), Math.cos(turn));
          return { steer: Math.max(-1, Math.min(1, turn * 2.5)), throttle: speed < 8 ? 0.6 : 0,
            brake: 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false };
        };
        // drive until the stop, then hold the car still there
        const began = performance.now();
        await new Promise((done) => {
          const tick = () => {
            const onWay = geo.alongOf(way, car.x, car.y);
            along = forward ? onWay : way.length - onWay;
            if (along >= stopAlong || performance.now() - began > 20000) return done();
            requestAnimationFrame(tick);
          };
          tick();
        });
        game.input.update = () => ({ steer: 0, throttle: 0, brake: 1, handbrake: 1, reverse: 0,
          shiftUp: false, shiftDown: false });
        car.vx = 0;
        car.vy = 0;
        await new Promise((done) => setTimeout(done, 600));
        const sample = (from, to) => {
          const pts = [];
          for (let ahead = from; ahead <= to; ahead += 1) for (let side = -2; side <= 2; side += 1) {
            const x = car.x + Math.cos(car.heading) * ahead - Math.sin(car.heading) * side;
            const y = car.y + Math.sin(car.heading) * ahead + Math.cos(car.heading) * side;
            pts.push([game.renderer.toScreenX(x), game.renderer.toScreenY(y)]);
          }
          return pts;
        };
        return { along: +along.toFixed(1), crossing: car.crossing, underground:
          geo.isUnderground(car), at: [+car.x.toFixed(1), +car.y.toFixed(1)],
          ahead: sample(6, 14), behind: sample(-3, -1) };
      }, [way.index, along]);
      const path = `tools/scratch/_tl-${levelId}-${way.index}-${label.replace(' ', '')}-${width}x${height}.png`;
      const shot = await page.screenshot({ path });
      const lum = await page.evaluate(async ([png, ahead, behind]) => {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const mean = (pts) => {
          let sum = 0, count = 0;
          for (const [x, y] of pts) {
            if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
            const [r, g, b] = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
            sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
            count++;
          }
          return count ? +(sum / count).toFixed(1) : null;
        };
        return { ahead: mean(ahead), behind: mean(behind) };
      }, [shot.toString('base64'), state.ahead, state.behind]);
      console.log(`  tunnel ${way.index} (${way.track ? 'track' : 'road'}${way.bent ? ', bent' : ''})`
        + ` ${label.padEnd(8)} along ${state.along}: on crossing ${state.crossing}, underground`
        + ` ${state.underground}; brightness ahead ${lum.ahead}, behind ${lum.behind}  ${path}`);
    }
  }
  console.log('errors', errors.length ? errors.slice(0, 3) : 'none');
} finally {
  await browser?.close();
  server.stop();
}
