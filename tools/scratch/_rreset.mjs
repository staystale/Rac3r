// _rreset.mjs - THE R KEY ON THE ENDLESS ROAD (?shoulder=1): the autopilot drives the motorway to
// 500 m in its lanes, then R; where the car is put across the road (and its speed), against the
// hard shoulder. [QUERY=shoulder=1] [ROAD=motorway] node tools/scratch/_rreset.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const road = process.env.ROAD || 'motorway', query = process.env.QUERY ?? 'shoulder=1';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = []; page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1&${query}`);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(800);
  await page.evaluate((kind) => window.__game.launch('highway', 'hatch-rwd', { ai: 0, road: kind }), road);
  for (let waited = 0; waited < 60; waited++) {
    if (await page.evaluate(() => (window.__game.level._hw?.q?.s ?? 0) > 500)) break;
    await page.waitForTimeout(500);
  }
  const before = await page.evaluate(() => window.__game.level._hw.q.off);
  await page.keyboard.press('r');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => {
    const g = window.__game, lv = g.level, geo = lv._hw.geo;
    return { off: +lv._hw.q.off.toFixed(2), kmh: Math.round(Math.hypot(g.car.vx, g.car.vy) * 3.6),
      shoulder: [-geo.hw, -geo.hw + lv._cfg.shoulder].map((v) => +v.toFixed(2)) };
  });
  console.log(road, query || '(plain)', 'before R', before.toFixed(2), '-> after', JSON.stringify(after));
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 2).join(' | ') : 'errors none');
} finally { await browser.close(); server.stop(); }
