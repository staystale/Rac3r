// _skullhit.mjs - DEAF VALLEY'S SKULLS HIT (?desertjunk=1; owner 11-10: "cow skulls should be
// collidable objects with a puncture risk"): on the canyon road (ROAD) the car set TRIES times 15 m
// short of the next loose skull ahead and sent straight at it at SPEED m/s; after 1.5 s whether
// the skull broke (its bones), whether a tyre went (burst or going down), and the car's speed
// lost. A phone shot of the first hit (the bones) and the shards' puncture rolls are the game's.
// [TRIES=30] [SPEED=20] [ROAD=twisty] node tools/scratch/_skullhit.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const TRIES = +(process.env.TRIES || 30), SPEED = +(process.env.SPEED || 20),
  ROAD = process.env.ROAD || 'twisty';
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
  const tally = { tries: 0, broke: 0, tyre: 0, lost: [], missed: 0, whole: [] };
  const done = new Set();
  for (let go = 0; go < TRIES; go++) {
    const got = await page.evaluate(async ({ speed, skip }) => {
      const game = window.__game, level = game.level, pts = level._hw.pts;
      const carS = level._hw.q?.s ?? 0;
      // the next loose skull ahead not tried yet (on up the road until one is in the window)
      for (let hop = 0; hop < 30; hop++) {
        const skull = game.cones.list.find((obj) => obj.kind === 'skull' && !skip.includes(obj._n)
          && (() => {
            let best = Infinity, at = 0;
            for (const pt of pts) {
              const dd = (pt.x - obj.x) ** 2 + (pt.y - obj.y) ** 2;
              if (dd < best) { best = dd; at = pt.s; }
            }
            return at > carS + 20;
          })());
        if (skull) {
          const car = game.car, index = game.cones.list.indexOf(skull);
          // a fresh car each go: the tyres whole (a reset), then 15 m short, straight at it
          game.reset?.();
          await new Promise((wait) => setTimeout(wait, 300));
          const away = Math.random() * Math.PI * 2;
          const heading = away + Math.PI;
          Object.assign(car, { x: skull.x + Math.cos(away) * 15, y: skull.y + Math.sin(away) * 15,
            heading, yawRate: 0, vx: Math.cos(heading) * speed, vy: Math.sin(heading) * speed });
          // (the nearest the car's centre came to it: a miss, or a hit that did not break it)
          let closest = Infinity;
          for (let tick = 0; tick < 30; tick++) {
            await new Promise((wait) => setTimeout(wait, 50));
            const obj = game.cones.list[index];
            if (obj) closest = Math.min(closest, Math.hypot(obj.x - car.x, obj.y - car.y));
          }
          const now = game.cones.list[index];
          // (a puncture: a tyre leaking - physics/tyrepressure.ts startLeak)
          return { n: skull._n, broke: now?.kind === 'bones', tyre: (car.tyreLeak || [])
            .some((leak) => leak > 0), v: Math.hypot(car.vx, car.vy), closest };
        }
        const ahead = pts.find((pt) => pt.s > carS + 400) || pts[pts.length - 1];
        Object.assign(game.car, { x: ahead.x, y: ahead.y, vx: 0, vy: 0 });
        await new Promise((wait) => setTimeout(wait, 400));
      }
      return null;
    }, { speed: SPEED, skip: [...done] });
    if (!got) break;
    done.add(got.n);
    tally.tries++;
    if (got.broke) tally.broke++;
    else if (got.closest > 2) tally.missed++;
    else tally.whole.push(+got.closest.toFixed(1));
    if (got.tyre) tally.tyre++;
    tally.lost.push(SPEED - got.v);
    if (tally.tries === 1) await page.screenshot({ path: 'tools/scratch/_skullhit.png' });
  }
  const lost = tally.lost.sort((low, high) => low - high);
  console.log(`${tally.tries} skulls hit at ${SPEED} m/s: broke ${tally.broke}, a tyre gone `
    + `${tally.tyre} (${(tally.tyre / Math.max(1, tally.tries) * 100).toFixed(0)} %), speed lost `
    + `median ${(lost[lost.length >> 1] || 0).toFixed(1)} m/s; missed (never within 2 m) `
    + `${tally.missed}, reached but whole ${tally.whole.length} (closest ${tally.whole.join(', ')}`
    + ' m)');
} finally {
  console.log('page errors:', errors.length ? errors.join(' || ') : 'none');
  await browser.close();
  server.stop();
}
