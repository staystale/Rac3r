// _policebust.mjs - A BUST OFF THE ROAD (?police=1) in the real game: the autopilot down the
// motorway with traffic, the heat held at 2 stars until a chaser is close; then the autopilot off,
// the car put 12 m past the left edge (on the verge, as if pushed off) with the handbrake on until
// the bust; the off-road countdown (the notice line, the guard's warning and time) sampled every
// 100 ms before it and for 3 s after the BUSTED reset.
// [VIEW=390x844] [NIGHT=0.9] node tools/scratch/_policebust.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + `&police=1${process.env.NIGHT ? '&night=' + process.env.NIGHT : ''}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road: 'motorway', scenery: 'countryside', traffic: 0.6 }));
  await page.waitForTimeout(4000);
  // the heat held at 2 (no escape) until the bust
  await page.evaluate(() => {
    window.__holder = setInterval(() => {
      const game = window.__game, orders = game.traffic.police(), heat = orders.heats.get(game.car);
      if (!heat || game.busted) return;
      heat.stars = Math.max(heat.stars, 2);
      heat.escapeT = 0;
    }, 50);
  });
  for (let waited = 0; waited < 80; waited++) {
    const close = await page.evaluate(() => {
      const game = window.__game, car = game.car;
      return game.traffic.list.some((slot) => !slot.parked && slot.police?.mode === 'chase'
        && Math.hypot(slot.car.x - car.x, slot.car.y - car.y) < 40);
    });
    if (close) break;
    await page.waitForTimeout(500);
  }
  // off the road: 12 m past the left edge, stopped, the handbrake on
  await page.evaluate(() => {
    const game = window.__game, car = game.car, level = game.level, here = level._hw.q;
    game.setAutopilot(false);
    const half = level._hw.geo.hw, heading = Math.atan2(here.dy, here.dx);
    const out = half + 12;
    car.x += here.dy * (out + here.off);
    car.y -= here.dx * (out + here.off);
    car.heading = heading;
    car.vx = car.vy = car.yawRate = 0;
  });
  await page.keyboard.down('Space');
  const sample = () => page.evaluate(() => {
    const game = window.__game, state = game.level._hw;
    const notice = game.notice && performance.now() - game.notice.at < 2200 ? game.notice.text
      : '';
    return { busted: !!game.busted, notice, warn: state.warn, offT: +(state.offT || 0)
      .toFixed(2), out: state.q ? Math.round(-state.q.off - state.geo.hw) : null };
  });
  let before = 0, countdownBefore = 0, after = [];
  for (let tick = 0; tick < 900; tick++) {
    const row = await sample();
    if (!row.busted) {
      before++;
      if (row.notice.startsWith('BACK TO THE ROAD')) countdownBefore++;
    } else after.push(row);
    if (after.length >= 30) break;
    await page.waitForTimeout(100);
  }
  await page.keyboard.up('Space');
  const shown = after.filter((row) => row.notice.startsWith('BACK TO THE ROAD') || row.warn);
  console.log(`before the bust: ${before} samples, the countdown shown in ${countdownBefore}`);
  console.log(`after the bust (3 s): the countdown shown in ${shown.length} of ${after.length}`
    + ` samples; first ${JSON.stringify(after[0])}, last ${JSON.stringify(after[after.length
    - 1])}`);
  await page.screenshot({ path: `tools/scratch/_police-bustoff-${width}x${height}.png` });
} finally {
  await browser.close();
  server.stop();
  console.log(errors.length ? 'PAGE ERRORS:\n  ' + errors.join('\n  ') : 'no page errors');
}
