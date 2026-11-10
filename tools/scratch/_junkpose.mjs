// _junkpose.mjs - DEAF VALLEY'S JUNK UP CLOSE (?desertjunk=1): on the canyon road (ROAD), the car
// set still on the road beside the first of each kind ahead of it - a shack, an oil drum, a tyre
// pile, a lying tyre, a tumbleweed - and a phone shot centred on it (2x). Then a tumbleweed hit:
// the car driven at one blowing, what it bursts into.
// [ROAD=dual] [KINDS=shack,barrel,...] node tools/scratch/_junkpose.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const ROAD = process.env.ROAD || 'dual';
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&desertjunk=1`);
  await page.mouse.click(195, 422);
  await page.waitForTimeout(800);
  await page.evaluate((road) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road, scenery: 'canyon', traffic: 0 }), ROAD);
  await page.waitForTimeout(1500);
  for (const kind of (process.env.KINDS || 'shack,barrel,tyrestack,tyre,tumbleweed').split(',')) {
    // step the car up the road (still) until one is in the window, then beside it
    const got = await page.evaluate(async (want) => {
      const game = window.__game, level = game.level;
      for (let hop = 0; hop < 40; hop++) {
        const car = game.car, pts = level._hw.pts;
        const all = [...level.props, ...game.cones.list].filter((item) => item.kind === want);
        let best = null;
        for (const item of all) {
          let near = null, nd = Infinity;
          for (const pt of pts) {
            const dd = (pt.x - item.x) ** 2 + (pt.y - item.y) ** 2;
            if (dd < nd) { nd = dd; near = pt; }
          }
          // ahead of the car only (the guard resets a car put behind its best)
          if (near && near.s > (level._hw.q?.s ?? 0) + 10 && (!best || near.s < best.pt.s))
            best = { item, pt: near };
        }
        if (best) {
          const idx = pts.indexOf(best.pt), next = pts[Math.min(pts.length - 1, idx + 1)];
          const head = Math.atan2(next.y - best.pt.y, next.x - best.pt.x);
          // (beside it, 8 m toward the road: in the middle of the shot)
          const toward = Math.atan2(best.pt.y - best.item.y, best.pt.x - best.item.x);
          car.x = best.item.x + Math.cos(toward) * 8; car.y = best.item.y + Math.sin(toward) * 8;
          car.vx = 0; car.vy = 0; car.heading = head;
          car.yawRate = 0;
          return { found: true, off: Math.round(Math.hypot(best.item.x - best.pt.x,
            best.item.y - best.pt.y)), at: Math.round(best.pt.s) };
        }
        // none in the window yet: on up the road
        const ahead = pts[Math.min(pts.length - 1, pts.findIndex((pt) => pt.s > (level._hw.q?.s
          ?? 0) + 400))];
        car.x = ahead.x; car.y = ahead.y; car.vx = 0; car.vy = 0;
        await new Promise((done) => setTimeout(done, 400));
      }
      return { found: false };
    }, kind);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `tools/scratch/_junkpose-${kind}.png` });
    console.log(kind, JSON.stringify(got));
  }
  // a tumbleweed hit: drive straight at the nearest blowing one
  const hit = await page.evaluate(async () => {
    const game = window.__game, car = game.car;
    const weed = game.cones.list.find((obj) => obj.kind === 'tumbleweed' && obj.blowing);
    if (!weed) return { weed: false };
    const at = game.cones.list.indexOf(weed);
    // 12 m back along its way, then at it at 25 m/s (where it will be in half a second)
    const dir = Math.atan2(weed.vy, weed.vx), aimX = weed.x + weed.vx * 0.5, aimY = weed.y
      + weed.vy * 0.5;
    car.x = weed.x - Math.cos(dir) * 12; car.y = weed.y - Math.sin(dir) * 12;
    car.heading = Math.atan2(aimY - car.y, aimX - car.x);
    car.vx = Math.cos(car.heading) * 25; car.vy = Math.sin(car.heading) * 25;
    await new Promise((done) => setTimeout(done, 1000));
    return { weed: true, now: game.cones.list[at]?.kind };
  });
  await page.screenshot({ path: 'tools/scratch/_junkpose-hit.png' });
  console.log('tumbleweed hit:', JSON.stringify(hit));
} finally {
  console.log('page errors:', errors.length ? errors.join(' || ') : 'none');
  await browser.close();
  server.stop();
}
