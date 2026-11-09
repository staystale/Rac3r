// _resetspots.mjs - EVERY RESET ON THE ENDLESS ROADS LANDS ON OUR HARD SHOULDER (owner 11-09:
// "reset still can leave me on the opposite carriage way ! All resets should put the player or ai
// back on the hard shoulder for highways", "there is some forced resets for off road and wrong way
// make sure they also reset to a approved reset point"): the autopilot drives each road to 500 m,
// then each way a reset comes - the R key from the other carriageway (or the oncoming lane), R
// from 40 m off the road, the off-road guard (90 m off), the wrong-way guard - and where it put
// the car: across the road against the hard shoulder, and its heading off the road's.
// [ROADS=motorway,dual,walled,canyon] [QUERY=] node tools/scratch/_resetspots.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const roads = (process.env.ROADS || 'motorway,interstate,dual,walled,canyon').split(',');
const query = process.env.QUERY ?? '';
const server = await startServer();
const browser = await launchBrowser();
try {
  const errors = [];
  for (const road of roads) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1&${query}`);
    await page.mouse.click(422, 195);
    await page.waitForTimeout(800);
    await page.evaluate((kind) => window.__game.launch('highway', 'hatch-rwd', { ai: 0, road: kind }),
      road);
    const lines = [];
    for (const how of ['R, the other side', 'R, 40 m off', 'guard, 90 m off', 'guard, wrong way']) {
      for (let waited = 0; waited < 80; waited++) {
        if (await page.evaluate(() => (window.__game.level._hw?.q?.s ?? 0) > 500)) break;
        await page.waitForTimeout(500);
      }
      // moved across the road from where it is (the road's right: + off)
      const moved = await page.evaluate((kind) => {
        const game = window.__game, level = game.level, q = level._hw.q, car = game.car;
        const geo = level._hw.geo, far = geo.oncoming.length ? geo.oncoming[0] : geo.hw - 1;
        const to = kind.startsWith('R, the other') ? far : kind.startsWith('R, 40') ? geo.hw + 40
          : kind.startsWith('guard, 90') ? geo.hw + 90 : null;
        game.notice = null;
        if (to === null) { level._hw.best = q.s + 300; return { from: q.off }; }
        const by = to - q.off;
        car.x += -q.dy * by; car.y += q.dx * by;
        return { from: +to.toFixed(1) };
      }, how);
      if (how.startsWith('R')) {
        await page.waitForTimeout(150);
        await page.keyboard.press('r');
      }
      let res = null;
      for (let waited = 0; waited < 40 && !res; waited++) {
        await page.waitForTimeout(100);
        res = await page.evaluate(() => {
          const game = window.__game, level = game.level, q = level._hw.q, car = game.car;
          if (!q) return null;
          const geo = level._hw.geo, cfg = level._cfg;
          const off = q.off, head = Math.atan2(q.dy, q.dx) - car.heading;
          return { off: +off.toFixed(2), shoulder: [-geo.hw, -geo.hw + cfg.shoulder]
            .map((value) => +value.toFixed(2)), lane: +geo.centres[0].toFixed(2),
          turned: Math.round(Math.abs(Math.atan2(Math.sin(head), Math.cos(head))) * 180 / Math.PI),
          why: game.notice?.text ?? '-' };
        });
        if (res && how.startsWith('guard') && res.why === '-') res = null;
      }
      lines.push(`  ${how.padEnd(17)} from ${String(moved.from).padStart(6)}: `
        + (res ? `-> ${res.off} (shoulder ${res.shoulder.join('..')}, left lane ${res.lane}),`
          + ` ${res.turned} deg off the road's way, "${res.why}"` : 'no reset seen'));
      await page.waitForTimeout(1500);
    }
    console.log(road + ':\n' + lines.join('\n'));
    await page.close();
  }
  console.log(errors.length ? 'ERRORS ' + [...new Set(errors)].slice(0, 3).join(' | ')
    : 'errors none');
} finally { await browser.close(); server.stop(); }
