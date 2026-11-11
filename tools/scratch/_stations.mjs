// _stations.mjs - THE OTHER ROADS' PETROL STATIONS AND SERVICES (?hwstations=1; owner 11-10:
// "petrol stations on other highway levels (also reset spots)"): the autopilot down a road (ROAD)
// for SECONDS at phone size; every half second the stations, canopies, services halls and their
// boards laid so far, counted once each with their road distance and brand / name; the scenery
// solids (trees, rocks, bales, signs), lamp posts and barriers standing on a station's forecourt
// or a services' yard (none wanted); and a phone photo of the first station and the first
// services as the car passes. STILL=1: no driving - the car put down, still, on the first
// station's forecourt (a roadside one: where a reset there puts it) or the services' side road by
// its yard, a phone photo once the camera has settled; and a RESET pressed 60 m past a roadside
// station: where it put the car.
// [ROAD=dual] [SECONDS=120] [STILL=1] [Q=] node tools/scratch/_stations.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const ROAD = process.env.ROAD || 'dual', SECONDS = +(process.env.SECONDS || 120);
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1`
    + `${process.env.STILL ? '' : '&autopilot=1'}&hwstations=1${process.env.Q || ''}`);
  await page.mouse.click(195, 422);
  await page.waitForTimeout(800);
  await page.evaluate((road) => window.__game.launch('highway', 'hatch-rwd', { ai: 0, road,
    scenery: 'countryside', traffic: 0.4 }), ROAD);
  await page.waitForTimeout(2000);
  if (process.env.STILL) {
    const put = await page.evaluate(async () => {
      const game = window.__game, level = game.level, car = game.car;
      const { roadPose, rehome } = await import('/src/highway.ts');
      const prop = level.props.find((item) => item.kind === 'services' && item.brand)
        || level.props.find((item) => item.kind === 'gasstation' && item.brand);
      if (!prop) return 'no station laid';
      const pts = level._hw.pts, near = pts.reduce((best, point) => (Math.abs(point.s - prop._s)
        < Math.abs(best.s - prop._s) ? point : best), pts[0]);
      // (the services: on its side road; a roadside station: its forecourt's front, either side)
      const side = Math.sign((prop.x - near.x) * -Math.sin(near.h ?? 0)
        + (prop.y - near.y) * Math.cos(near.h ?? 0)) || -1;
      const off = prop.kind === 'services' ? -(near.sideOff || 0) : (level._hw.geo.hw + 2.5)
        * (Math.hypot(...[roadPose(level, prop._s, -20)].map((pose) => [pose.x - prop.x,
          pose.y - prop.y]).flat()) < 15 ? -1 : 1);
      const pose = roadPose(level, prop._s - 12, off);
      car.x = pose.x; car.y = pose.y; car.heading = pose.h; car.vx = car.vy = 0; car.yawRate = 0;
      rehome(level, prop._s - 12);
      return `${prop.kind} ${prop.brand} ${prop.label || ''} at ${(prop._s / 1000).toFixed(2)} km,`
        + ` the car ${off.toFixed(1)} m off (${side})`;
    });
    console.log('put down:', put);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `tools/scratch/_stations-${ROAD}-still.png` });
  }
  const seen = new Map(), shot = new Set(), clashes = new Set();
  let km = 0;
  for (let t = 0; t < SECONDS; t += 0.5) {
    const got = await page.evaluate(async () => {
      const game = window.__game, car = game.car, level = game.level;
      const { activeLamps } = await import('/src/world/lamps.ts');
      const out = { items: [], near: null, clashes: [], km: (game.hwDist || 0) / 1000 };
      const stations = (level.props || []).filter((prop) => ['gasstation', 'services'].includes(
        prop.kind) && prop.brand);
      for (const prop of stations) {
        out.items.push([`${prop.kind}:${prop.x.toFixed(0)},${prop.y.toFixed(0)}`, prop.kind,
          prop.brand + (prop.label ? ' ' + prop.label : ''), prop._s]);
        const dist = Math.hypot(prop.x - car.x, prop.y - car.y);
        if (dist < 45 && !out.near) out.near = prop.kind;
        // (what stands within its lot: the station's 16 m round its middle, the hall's 18)
        const reach = prop.kind === 'services' ? 18 : 16;
        for (const other of level.props) {
          if (['gasstation', 'canopy', 'services', 'board', 'slip', 'slipcount'].includes(other.kind))
            continue;
          if (Math.hypot(other.x - prop.x, other.y - prop.y) < reach)
            out.clashes.push(`${other.kind}@${prop.kind}:${prop.x.toFixed(0)},${prop.y.toFixed(0)}`);
        }
        for (const lamp of activeLamps())
          if (Math.hypot(lamp.x - prop.x, lamp.y - prop.y) < reach)
            out.clashes.push(`lamp@${prop.kind}:${prop.x.toFixed(0)},${prop.y.toFixed(0)}`);
        for (const bar of level.barriers || [])
          for (const [x, y] of bar.pts)
            if (Math.hypot(x - prop.x, y - prop.y) < reach - 6) {
              out.clashes.push(`${bar.kind}@${prop.kind}:${prop.x.toFixed(0)},${prop.y.toFixed(0)}`);
              break;
            }
      }
      return out;
    });
    for (const [key, kind, name, dist] of got.items) if (!seen.has(key)) seen.set(key, { kind, name,
      dist });
    for (const clash of got.clashes) clashes.add(clash);
    if (got.near && !shot.has(got.near)) {
      shot.add(got.near);
      await page.screenshot({ path: `tools/scratch/_stations-${ROAD}-${got.near}.png` });
    }
    km = got.km;
    await page.waitForTimeout(500);
  }
  const list = [...seen.values()].sort((low, high) => low.dist - high.dist);
  console.log(`${ROAD}, ${km.toFixed(2)} km: ${list.map((rec) => `${rec.kind} ${rec.name} at`
    + ` ${(rec.dist / 1000).toFixed(2)} km`).join('; ') || 'none'}`);
  console.log(`  on a lot: ${clashes.size ? [...clashes].join(', ') : 'nothing'}; photos:`
    + ` ${[...shot].join(', ') || 'none'}`);
} finally {
  console.log('page errors:', errors.length ? errors.join(' || ') : 'none');
  await browser.close();
  server.stop();
}
