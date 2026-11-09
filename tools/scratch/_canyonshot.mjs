// _canyonshot.mjs - DEAF VALLEY (?canyon=1: Highway to Hull's DEAF VALLEY theme, highway/canyon.ts
// + gorge.ts) on the autopilot: a phone-size photo at each road distance in SHOTS as it drives the
// canyon, the HIGH road (its gorges) and the open desert; at each the speed, the car's offset off
// the centre line, what is laid (rock walls, cliff faces, Armco, sand zones, formations, cacti),
// the frame rate; the worst offset, page errors.
// [VIEW=390x844] [SHOTS=600,1100,...] [ZOOM=] node tools/scratch/_canyonshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const shots = (process.env.SHOTS || '600,1000,1150,1400,1650,1950,2150,2350').split(',')
  .map(Number);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = []; page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&canyon=1&autopilot=1`
    + (process.env.ZOOM ? `&zoom=${process.env.ZOOM}` : ''));
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd', { ai: 0, road: 'canyon' }));
  let worst = 0, worstAt = 0;
  for (const target of shots) {
    for (let waited = 0; waited < 90; waited += 0.25) {
      const now = await page.evaluate(() => {
        const q = window.__game.level._hw?.q;
        return { dist: q?.s ?? 0, off: q?.off ?? 0 };
      });
      if (Math.abs(now.off) > worst) { worst = Math.abs(now.off); worstAt = now.dist; }
      if (now.dist >= target) break;
      await page.waitForTimeout(250);
    }
    const res = await page.evaluate(() => {
      const game = window.__game, level = game.level, q = level._hw?.q, car = game.car;
      const count = (list, kind) => list.filter((item) => item.kind === kind).length;
      const loose = game.cones?.list || game.cones?.objs || [];
      return { dist: Math.round(q?.s ?? 0), off: +(q?.off ?? 0).toFixed(1),
        kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6), rock: count(level.barriers, 'rock'),
        drop: count(level.barriers, 'drop'), armco: count(level.barriers, 'armco'),
        sand: level.zones.filter((zone) => zone.surface?.id === 'sand').length,
        butte: count(level.props, 'butte'), hoodoo: count(level.props, 'hoodoo'),
        arch: count(level.props, 'arch'),
        cacti: loose.filter((obj) => /cactus/.test(obj.kind)).length,
        fps: game.fps ? Math.round(game.fps) : undefined };
    });
    await page.screenshot({ path: `tools/scratch/_canyon-${target}-${width}x${height}.png` });
    console.log(target, JSON.stringify(res));
  }
  console.log('worst offset', worst.toFixed(1), 'at', Math.round(worstAt));
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally { await browser.close(); server.stop(); }
