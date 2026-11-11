// _servicesshot.mjs - A SERVICES ON THE WALLED ROAD IN THE REAL GAME: the autopilot drives the road
// (ROAD, SCENERY; Q more switches) until a services hall or a petrol station is within 500 m ahead,
// then the car is stopped on the motorway's left edge opposite its way in and photographed zoomed
// out (ZOOM) - the wall, the side road, the yard; and the walls' gaps near it printed.
// [ROAD=walled] [SCENERY=countryside] [VIEW=390x844] [ZOOM=0.45] [Q=] node tools/scratch/_servicesshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const ROAD = process.env.ROAD || 'walled', SCENERY = process.env.SCENERY || 'countryside';
const tag = `${SCENERY}-${ROAD}-${process.env.TAG || 'plain'}-${width}x${height}`;
const server = await startServer();
const browser = await launchBrowser();
try {
  const errors = [];
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + `&zoom=${process.env.ZOOM || 0.45}${process.env.Q || ''}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(800);
  await page.evaluate(([road, scenery]) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road, scenery, traffic: 0 }), [ROAD, SCENERY]);
  let found = null;
  for (let waited = 0; waited < 300 && !found; waited += 0.5) {
    found = await page.evaluate(() => {
      const game = window.__game, car = game.car;
      const hall = game.level.props.find((prop) => (prop.kind === 'services'
        || prop.kind === 'gasstation') && Math.hypot(prop.x - car.x, prop.y - car.y) < 500
        && (prop.x - car.x) * car.vx + (prop.y - car.y) * car.vy > 0);
      return hall ? { kind: hall.kind, x: hall.x, y: hall.y, s: hall._s } : null;
    });
    if (!found) await page.waitForTimeout(500);
  }
  if (!found) throw new Error('no services reached');
  // stopped on the road nearest the hall, 120 m before it (its way in)
  const placed = await page.evaluate((hall) => {
    const game = window.__game, car = game.car, pts = game.level._hw.pts;
    let best = 0;
    for (let i = 0; i < pts.length; i++)
      if (Math.hypot(pts[i].x - hall.x, pts[i].y - hall.y)
        < Math.hypot(pts[best].x - hall.x, pts[best].y - hall.y)) best = i;
    const at = pts[Math.max(0, best - 30)], next = pts[Math.max(1, best - 29)];
    game.setAutopilot(false);
    // (AT=hall: at the station itself)
    car.x = hall.atHall ? hall.x : at.x;
    car.y = hall.atHall ? hall.y : at.y;
    car.heading = Math.atan2(next.y - at.y, next.x - at.x);
    car.vx = car.vy = car.yawRate = 0;
    const gaps = pts.slice(Math.max(0, best - 45), best + 15).map((pt) => (pt.sideOff ? 'S'
      : pt.gapL ? 'g' : '.')).join('');
    return { gaps };
  }, { ...found, atHall: process.env.AT === 'hall' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `tools/scratch/_services-${tag}.png` });
  console.log(`${tag}: ${found.kind} at ${Math.round(found.s)} m; left verge (S side road, g gap)`
    + ` ${placed.gaps}; errors ${errors.length ? errors.join(' | ') : 'none'}`);
} finally {
  await browser.close();
  server.stop();
}
