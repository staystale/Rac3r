// _junkseen.mjs - DEAF VALLEY'S SMALL JUNK AS THE PLAYER SEES IT (?desertjunk=1): the autopilot
// down the canyon road (ROAD, default twisty - the menu's DEAF VALLEY) with traffic for SECONDS at
// phone size; every quarter second each skull and tumbleweed in the view counted: how many came on
// screen at all, seconds on screen, and their size on screen in CSS px (the drawn width at the
// camera's px per m), and how many tumbleweed crossed the road in front of the car on screen (on
// the road ahead of it). The camera's px per m and the km printed.
// [SECONDS=120] [ROAD=twisty] [Q=extra query] node tools/scratch/_junkseen.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const SECONDS = +(process.env.SECONDS || 120), ROAD = process.env.ROAD || 'twisty',
  QUERY = process.env.Q || '';
// each kind's drawn width, m (render/props/desertjunk.ts drawSkull: the face 0.3 m and the horns;
// render/props/tumbleweed.ts: BALL_M a side)
const WIDE = { skull: +(process.env.SKULL_M || 0.75), tumbleweed: +(process.env.WEED_M || 1.4) };
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + '&desertjunk=1' + QUERY);
  await page.mouse.click(195, 422);
  await page.waitForTimeout(800);
  await page.evaluate((road) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road, scenery: 'canyon' }), ROAD);
  await page.waitForTimeout(1500);
  const seen = { skull: new Map(), tumbleweed: new Map() }, ppms = [], crossed = new Set();
  let km = 0;
  for (let t = 0; t < SECONDS; t += 0.25) {
    const got = await page.evaluate(() => {
      const game = window.__game, [x0, y0, x1, y1] = game.renderer.viewBounds;
      const inView = (obj) => obj.x > x0 && obj.x < x1 && obj.y > y0 && obj.y < y1;
      const ids = (list, kind) => list.filter((obj) => obj.kind === kind && inView(obj))
        .map((obj) => obj._n ?? `${obj.x.toFixed(1)},${obj.y.toFixed(1)}`);
      // the tumbleweed on the road in front of the car (by the nearest road point: its m off the
      // line, and ahead of the car along it)
      const car = game.car, pts = game.level._hw.pts, hw = game.level._hw.geo.hw;
      const nearest = (x, y) => {
        let best = Infinity, at = 0;
        for (let i = 0; i < pts.length; i++) {
          const dd = (x - pts[i].x) ** 2 + (y - pts[i].y) ** 2;
          if (dd < best) { best = dd; at = i; }
        }
        return { pt: pts[at], off: Math.sqrt(best) };
      };
      const carS = nearest(car.x, car.y).pt.s;
      const ahead = game.cones.list.filter((obj) => obj.kind === 'tumbleweed' && inView(obj))
        .filter((obj) => { const got = nearest(obj.x, obj.y); return got.off < hw && got.pt.s
          > carS + 3; }).map((obj) => obj._n);
      return { ppm: game.renderer.PPM, km: (game.hwDist || 0) / 1000, ahead,
        skull: ids(game.level.props, 'skull'), tumbleweed: ids(game.cones.list, 'tumbleweed') };
    });
    ppms.push(got.ppm);
    for (const id of got.ahead) crossed.add(id);
    km = got.km;
    for (const kind of ['skull', 'tumbleweed']) for (const id of got[kind]) {
      const rec = seen[kind].get(id) || { secs: 0, px: [] };
      rec.secs += 0.25;
      rec.px.push(WIDE[kind] * got.ppm);
      seen[kind].set(id, rec);
    }
    await page.waitForTimeout(250);
  }
  ppms.sort((low, high) => low - high);
  console.log(`${km.toFixed(2)} km in ${SECONDS} s on ${ROAD}; camera ${ppms[0].toFixed(1)}-`
    + `${ppms[ppms.length - 1].toFixed(1)} CSS px per m (median ${ppms[ppms.length >> 1]
      .toFixed(1)})`);
  console.log(`tumbleweed on the road in front of the car: ${crossed.size} (${(crossed.size
    / Math.max(0.1, km)).toFixed(1)} per km)`);
  for (const kind of ['skull', 'tumbleweed']) {
    const recs = [...seen[kind].values()], px = recs.flatMap((rec) => rec.px)
      .sort((low, high) => low - high);
    console.log(`${kind}: ${recs.length} on screen (${(recs.length / Math.max(0.1, km))
      .toFixed(1)} per km), ${recs.length ? (recs.reduce((sum, rec) => sum + rec.secs, 0)
      / recs.length).toFixed(1) : 0} s each; ${px.length ? `${px[0].toFixed(1)}-${px[px.length
      - 1].toFixed(1)} CSS px wide` : '-'}`);
  }
} finally {
  console.log('page errors:', errors.length ? errors.join(' || ') : 'none');
  await browser.close();
  server.stop();
}
