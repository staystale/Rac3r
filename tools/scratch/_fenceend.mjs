// _fenceend.mjs - DRIVEN AT A CENTRAL BARRIER'S END ON THE ROAD (?barrierends=1; owner 11-09: "it
// doesn't slow you with multiple hits on a wooden fence going straight and armco can go thru the
// car"): on a road (ROAD) the start of a KIND stretch of the central reservation (a piece no
// other of its kind leads into), the player's car put 20 m short of it on its line, held at KMH
// until it is 3 m off; its speed and how far down the line it gets each 0.25 s, photos at 0.5 s
// and 1.5 s after.
// (the stretch before it taken away: a true end, as after an open stretch)
// [ROAD=dual] [KIND=woodfence] [KMH=100] [QUERY=barrierends=1] node _fenceend.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const road = process.env.ROAD || 'dual', kind = process.env.KIND || 'woodfence';
const kmh = +(process.env.KMH || 100), query = process.env.QUERY ?? 'barrierends=1';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&${query}`);
  await page.mouse.click(195, 422);
  await page.waitForTimeout(800);
  await page.evaluate((preset) => window.__game.launch('highway', 'hatch-rwd', { ai: 0,
    road: preset }), road);
  await page.waitForTimeout(2500);
  const put = await page.evaluate(([want, speed]) => {
    const game = window.__game, level = game.level, car = game.car;
    const pieces = level.barriers.filter((bar) => bar.kind === want && bar._s != null
      && bar._s > (level._hw.q?.s ?? 0) + 40);
    const start = pieces.sort((a, b) => a._s - b._s).find((bar) => !pieces.some((other) =>
      other !== bar && Math.hypot(other.pts[other.pts.length - 1][0] - bar.pts[0][0],
        other.pts[other.pts.length - 1][1] - bar.pts[0][1]) < 1));
    if (!start) return null;
    // (the stretch before it, of another kind, taken away: a true end, as after an open stretch)
    const before = level.barriers.filter((other) => other !== start && Math.hypot(
      other.pts[other.pts.length - 1][0] - start.pts[0][0],
      other.pts[other.pts.length - 1][1] - start.pts[0][1]) < 1);
    for (const other of before) level.barriers.splice(level.barriers.indexOf(other), 1);
    const [ax, ay] = start.pts[0], [bx, by] = start.pts[1], len = Math.hypot(bx - ax, by - ay);
    const dx = (bx - ax) / len, dy = (by - ay) / len, v = speed / 3.6;
    Object.assign(car, { x: ax - dx * 20, y: ay - dy * 20, heading: Math.atan2(dy, dx),
      vx: dx * v, vy: dy * v, yawRate: 0, roll: null });
    window.__fe = { ax, ay, dx, dy, vx: dx * v, vy: dy * v, head: Math.atan2(dy, dx) };
    return { s: Math.round(start._s) };
  }, [kind, kmh]);
  if (!put) throw new Error('no stretch start of ' + kind);
  const lines = [];
  let met = -1;
  for (let step = 0; step < 60; step++) {
    const res = await page.evaluate(() => {
      const fe = window.__fe, car = window.__game.car;
      const down = (car.x - fe.ax) * fe.dx + (car.y - fe.ay) * fe.dy;
      if (!fe.met && down > -3 - 2.1) fe.met = true;
      if (!fe.met) Object.assign(car, { vx: fe.vx, vy: fe.vy, heading: fe.head, yawRate: 0 });
      const level = window.__game.level, torn = level.barriers.filter((bar) => bar.kind === 'woodfence'
        && bar._segs && bar._segs.some((seg) => seg.torn)).length;
      return { met: !!fe.met, down: +down.toFixed(1), torn,
        side: +(-(car.x - fe.ax) * fe.dy + (car.y - fe.ay) * fe.dx).toFixed(2),
        kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6), roll: !!car.roll };
    });
    if (res.met && met < 0) met = step;
    if (met >= 0 && (step - met) % 5 === 0) lines.push(`  ${((step - met) * 0.05).toFixed(2)} s:`
      + ` ${res.kmh} km/h, ${res.down} m down the line, ${res.side} m off it, torn pieces ${res.torn}${res.roll ? ' (rolling)' : ''}`);
    if (met >= 0 && step - met === 10) await page.screenshot({ path: 'tools/scratch/_fenceend-a.png' });
    if (met >= 0 && step - met === 30) { await page.screenshot({ path: 'tools/scratch/_fenceend-b.png' }); break; }
    await page.waitForTimeout(50);
  }
  console.log(`${road} ${kind} stretch at ${put.s} m, at ${kmh} km/h${query ? ' (' + query + ')' : ''}:`
    + `\n${lines.join('\n')}`);
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 2).join(' | ') : 'errors none');
} finally { await browser.close(); server.stop(); }
