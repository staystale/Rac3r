// _trafficsides.mjs - THE TRAFFIC EACH WAY AS THE PLAYER MEETS IT (owner 11-10: "not enough cars on
// my side of the road and too many on the oncoming side"): the autopilot down a two-way road (ROAD)
// with the setup's traffic (TRAFFIC) for SECONDS; every half second the traffic cars on the road
// within NEAR m ahead and behind, by way (yours, the other), and the distinct cars of each way seen
// within VIEW m; the cars in each way's list; km driven.
// [CAP=m/s] [ROAD=twisty] [SCENERY=countryside] [TRAFFIC=0.6] [SECONDS=90] [Q=] node tools/scratch/_trafficsides.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const ROAD = process.env.ROAD || 'twisty', SCENERY = process.env.SCENERY || 'countryside',
  TRAFFIC = +(process.env.TRAFFIC || 0.6), SECONDS = +(process.env.SECONDS || 90),
  NEAR = 300, VIEW = 90;
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1`
    + (process.env.Q || ''));
  await page.mouse.click(195, 422);
  await page.waitForTimeout(800);
  await page.evaluate(([road, scenery, traffic]) => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road, scenery, traffic }), [ROAD, SCENERY, TRAFFIC]);
  await page.waitForTimeout(2000);
  await page.evaluate((cap) => { window.__cap = cap; }, +(process.env.CAP || 0));
  const near = { own: [], other: [] }, seen = { own: new Set(), other: new Set() };
  let km = 0, listed = null, passedMe = 0;
  for (let t = 0; t < SECONDS; t += 0.5) {
    const got = await page.evaluate(([nearM, viewM]) => {
      const game = window.__game, car = game.car, cars = game.traffic.cars || [];
      // (CAP: your speed held under it, m/s - the autopilot's own is ~35)
      const cap = +(window.__cap || 0), speed = Math.hypot(car.vx, car.vy);
      if (cap && speed > cap) { car.vx *= cap / speed; car.vy *= cap / speed; }
      const list = game.traffic.list || game.traffic._ctx?.list || [];
      const out = { own: 0, other: 0, ownIds: [], otherIds: [], rel: [], km: (game.hwDist || 0) / 1000,
        listed: { own: 0, other: 0, parked: 0 } };
      for (const slot of list) {
        if (slot.parked) { out.listed.parked++; continue; }
        if ((slot.dir ?? 1) < 0) out.listed.other++; else out.listed.own++;
      }
      cars.forEach((other, i) => {
        const dist = Math.hypot(other.x - car.x, other.y - car.y);
        // its way: by its heading against the player's
        const same = Math.cos(other.heading - car.heading) > 0;
        if (dist < nearM) { if (same) out.own++; else out.other++; }
        if (dist < viewM) (same ? out.ownIds : out.otherIds).push(other._id ?? i);
        // (your way's: ahead of you along your heading, m - one that goes from behind to ahead
        // overtook you)
        if (same && dist < 60) out.rel.push([other, (other.x - car.x) * Math.cos(car.heading)
          + (other.y - car.y) * Math.sin(car.heading)]);
      });
      game._relOf = game._relOf || new WeakMap();
      out.passedMe = 0;
      for (const [other, rel] of out.rel) {
        const was = game._relOf.get(other);
        if (was !== undefined && was < -4 && rel > 4) out.passedMe++;
        game._relOf.set(other, rel);
      }
      delete out.rel;
      return out;
    }, [NEAR, VIEW]);
    near.own.push(got.own); near.other.push(got.other); passedMe += got.passedMe;
    for (const id of got.ownIds) seen.own.add(id);
    for (const id of got.otherIds) seen.other.add(id);
    km = got.km; listed = got.listed;
    await page.waitForTimeout(500);
  }
  const mean = (list) => (list.reduce((sum, value) => sum + value, 0) / list.length).toFixed(1);
  console.log(`${ROAD} (${SCENERY}), traffic ${TRAFFIC}, ${km.toFixed(2)} km in ${SECONDS} s:`
    + ` within ${NEAR} m - yours ${mean(near.own)}, the other way ${mean(near.other)} on average;`
    + ` seen within ${VIEW} m - yours ${seen.own.size}, the other way ${seen.other.size};`
    + ` overtook you ${passedMe}; listed at the end ${JSON.stringify(listed)}`);
} finally {
  console.log('page errors:', errors.length ? errors.join(' || ') : 'none');
  await browser.close();
  server.stop();
}
