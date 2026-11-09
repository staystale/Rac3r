// _roadshot.mjs - AN ENDLESS ROAD on the autopilot (owner 11-09: "give all levels an apposing road
// with oncoming traffic"): a phone-size photo at each road distance in SHOTS, and at each the
// speed, the car's offset off the centre line, the traffic live each way, the central barrier's
// pieces, the frame rate; page errors.
// [ROAD=motorway] [QUERY=oncoming=1] [VIEW=390x844] [SHOTS=300,700] [ZOOM=] node _roadshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const road = process.env.ROAD || 'motorway', query = process.env.QUERY ?? 'oncoming=1';
const shots = (process.env.SHOTS || '300,700,1100').split(',').map(Number);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = []; page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1&${query}`
    + (process.env.ZOOM ? `&zoom=${process.env.ZOOM}` : ''));
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate((kind) => window.__game.launch('highway', 'hatch-rwd', { ai: 0, road: kind }),
    road);
  for (const target of shots) {
    for (let waited = 0; waited < 90; waited += 0.25) {
      const dist = await page.evaluate(() => window.__game.level._hw?.q?.s ?? 0);
      if (dist >= target) break;
      await page.waitForTimeout(250);
    }
    const res = await page.evaluate(() => {
      const game = window.__game, level = game.level, q = level._hw?.q, car = game.car;
      const slots = (game.traffic.list || []).filter((slot) => !slot.parked);
      return { dist: Math.round(q?.s ?? 0), off: +(q?.off ?? 0).toFixed(1),
        kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6),
        ours: slots.filter((slot) => (slot.dir ?? 1) > 0).length,
        theirs: slots.filter((slot) => (slot.dir ?? 1) < 0).length,
        width: +level._hw.geo.width.toFixed(1), median: level._hw.geo.median,
        barriers: level.barriers.filter((bar) => bar.kind === level._cfg.median).length,
        fps: game.fps ? Math.round(game.fps) : undefined };
    });
    await page.screenshot({ path: `tools/scratch/_road-${road}-${target}-${width}x${height}.png` });
    console.log(target, JSON.stringify(res));
  }
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally { await browser.close(); server.stop(); }
