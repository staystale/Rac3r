// _jerseyroad.mjs - OVER THE JERSEY BARRIER ON THE MOTORWAY (?jerseyover=1; owner 11-09: "hitting
// it over 100mph should flip you and have a high chance to allow you over it into on coming
// traffic"): the player's car put on our carriageway beside a Jersey piece of the central
// reservation, aimed into it at ANGLE deg at MPH, TRIES times; a phone-size photo SHOT s after each
// is put there (and one 0.5 s after it meets it), and where it ends: rolled or not, which side of
// the central reservation, m past its line (the road's own frame).
// [MPH=100] [ANGLE=10] [TRIES=4] [SHOT=1.6] [QUERY=jerseyover=1] node _jerseyroad.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [width, height] = [390, 844];
const mph = +(process.env.MPH || 100), angle = +(process.env.ANGLE || 10);
const tries = +(process.env.TRIES || 4), shot = +(process.env.SHOT || 1.6);
const query = process.env.QUERY ?? 'jerseyover=1';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = []; page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&${query}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd', { ai: 0, road: 'motorway' }));
  await page.waitForTimeout(1500);
  for (let attempt = 0; attempt < tries; attempt++) {
    // a Jersey piece ahead of the car, the car put 4 m off it on our side, aimed into it
    const put = await page.evaluate(({ mph, angle, attempt }) => {
      const game = window.__game, car = game.car, level = game.level;
      // (ahead of the furthest point reached: behind it the wrong-way guard resets the car)
      const pieces = level.barriers.filter((bar) => bar.kind === 'jersey' && bar.pts.length > 8
        && bar._s > level._hw.best + 20).sort((a, b) => a._s - b._s);
      const near = pieces.length ? { bar: pieces[0] } : null;
      if (!near) return null;
      const [ax, ay] = near.bar.pts[3], [bx, by] = near.bar.pts[5];
      let dx = bx - ax, dy = by - ay; const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      if (dx * Math.cos(car.heading) + dy * Math.sin(car.heading) < 0) { dx = -dx; dy = -dy; }
      // our side: the side the car is on now
      const side = Math.sign((car.x - ax) * -dy + (car.y - ay) * dx) || 1;
      const x = ax + -dy * side * 4.5, y = ay + dx * side * 4.5;
      const head = Math.atan2(dy, dx) - side * angle * Math.PI / 180, v = mph / 2.23694;
      // (not game.reset: that holds the car for the start lights again)
      Object.assign(car, { x, y, heading: head, vx: Math.cos(head) * v, vy: Math.sin(head) * v,
        yawRate: 0, roll: null, _rideCool: 0 });
      if (game.renderer.snap) game.renderer.snap(car);
      window.__jr = { ax, ay, dx, dy, side, vx: car.vx, vy: car.vy, head };
      return { side };
    }, { mph, angle, attempt });
    if (!put) { console.log('no Jersey piece'); break; }
    // held at its speed until it is at the barrier (a still-wheeled car set going slows)
    let hitKmh = 0, early = false;
    for (let waited = 0; waited < shot; waited += 0.05) {
      hitKmh = Math.max(hitKmh, await page.evaluate(() => {
        const jr = window.__jr, car = window.__game.car;
        const off = Math.abs((car.x - jr.ax) * -jr.dy + (car.y - jr.ay) * jr.dx);
        // (our side of the median, by the road's own frame: + = left of it)
        const hq = window.__game.level._hw.q;
        if (hq && jr.ours == null) jr.ours = Math.sign(hq.off - window.__game.level._hw.geo.median);
        if (off < 1.6 && !jr.met) { jr.met = true; return jr.kmh; }
        if (!jr.met) {
          Object.assign(car, { vx: jr.vx, vy: jr.vy, heading: jr.head, yawRate: 0 });
          jr.kmh = Math.round(Math.hypot(car.vx, car.vy) * 3.6);
        }
        return 0;
      }));
      if (!early && hitKmh && waited > 0) {
        early = true;
        await page.waitForTimeout(500);
        await page.screenshot({ path: `tools/scratch/_jerseyroad-${attempt}a-${width}x${height}.png` });
      }
      await page.waitForTimeout(50);
    }
    const res = await page.evaluate(() => {
      const { ours } = window.__jr, car = window.__game.car, hw = window.__game.level._hw;
      // m past the median, the road's frame (a bend's line is not the barrier's first straight)
      return { rolled: !!car.roll, past: hw.q ? +((hw.geo.median - hw.q.off) * ours).toFixed(1) : NaN,
        theirs: (window.__game.traffic.list || []).filter((s) => !s.parked && (s.dir ?? 1) < 0)
          .length };
    });
    await page.screenshot({ path: `tools/scratch/_jerseyroad-${attempt}-${width}x${height}.png` });
    console.log(`try ${attempt}: met it at ${Math.round(hitKmh / 1.609)} mph; after ${shot} s`
      + ` ${res.rolled ? 'rolling/over' : 'on its wheels'}, ${res.past > 0 ? res.past + ' m past'
        + ' the barrier (their side)' : -res.past + ' m short of it (our side)'}`);
  }
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally { await browser.close(); server.stop(); }
