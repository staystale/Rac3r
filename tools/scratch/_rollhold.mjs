// _rollhold.mjs - BUG 7, THE ROLLING START'S HOLD (?rollhold=1): gaps, bumps and speeds in the
// formation before the green, every level with a rolling start (the ovals and Dieatona; the
// highway's grid), in the real game, 5 AI, the AI's cars of your class ('class': a mixed field)
// or the same model. Every frame from the launch to 5 s after the green, every pair of cars:
// the gap between their bodies (oriented boxes); a BUMP is a pair coming within 0.05 m (counted
// once until they part by 0.5 m). Per run, before the green: the closest gap, the bumps (and who:
// the car behind the faster one?), the widest spread of speeds across the field once moving
// (max - min, m/s), the time to the green; after the green (0-5 s): the bumps.
// [LEVELS=naffcar,stock-car,dieatona,highway] [CARS=saloon-rwd,naffcar,banger-f2] [RUNS=2]
// [RAC3R_QUERY=rollhold=1] node tools/scratch/_rollhold.mjs
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const LEVELS = (process.env.LEVELS || 'naffcar,stock-car,dieatona,highway').split(',');
const CARS = (process.env.CARS || 'saloon-rwd,naffcar,banger-f2').split(',');
const RUNS = Number(process.env.RUNS || 2);
// SHOTS=<folder>: photo mode - each level and car once, a photo SHOT_AT s into the formation
// (VIEW=WxH), no measuring
const SHOTS = process.env.SHOTS || '', SHOT_AT = Number(process.env.SHOT_AT || 4.5);
const [VIEW_W, VIEW_H] = (process.env.VIEW || '844x390').split('x').map(Number);
const SWITCH = (process.env.RAC3R_QUERY || '').includes('rollhold=1') ? 'on' : 'off';

/**
 * Photo mode: one launch, a photo as the formation's clock passes SHOT_AT.
 * @returns {Promise<void>}
 */
async function photo(page, levelId, carId) {
  await page.evaluate(([id, car]) => window.__game.launch(id, car, { ai: 5, diff: 2,
    aiCars: 'class', traffic: 0 }), [levelId, carId]);
  for (let tries = 0; tries < 100; tries++) {
    await page.waitForTimeout(100);
    if (await page.evaluate(() => window.__game.start.on && !window.__game.start.green
      && window.__game.start.t < 1.5)) break;
  }
  for (let tries = 0; tries < 200; tries++) {
    if (await page.evaluate((at) => window.__game.start.t >= at, SHOT_AT)) break;
    await page.waitForTimeout(50);
  }
  await page.screenshot({ path: `${SHOTS}/_rollhold-${levelId}-${carId}-switch${SWITCH}-`
    + `${VIEW_W}x${VIEW_H}.png` });
}

/** Page side: one run, sampled every frame; returns its numbers. */
async function sampleRun([levelId, carId]) {
  const game = window.__game;
  game.launch(levelId, carId, { ai: 5, diff: 2, aiCars: 'class', traffic: 0 });
  // (the launch's stages run over the next frames: wait for the new start, lights not yet green)
  for (let tries = 0; tries < 100; tries++) {
    await new Promise((done) => setTimeout(done, 100));
    if (game.start.on && !game.start.green && game.start.t < 1.5) break;
  }
  const boxGap = (first, second) => {
    let best = -Infinity;
    for (const angle of [first.heading, first.heading + Math.PI / 2, second.heading,
      second.heading + Math.PI / 2]) {
      const ax = Math.cos(angle), ay = Math.sin(angle);
      const reach = (car) => car.spec.len / 2 * Math.abs(Math.cos(car.heading) * ax
        + Math.sin(car.heading) * ay) + car.spec.wid / 2 * Math.abs(-Math.sin(car.heading) * ax
        + Math.cos(car.heading) * ay);
      best = Math.max(best, Math.abs((second.x - first.x) * ax + (second.y - first.y) * ay)
        - reach(first) - reach(second));
    }
    return best;
  };
  const touching = new Set(), out = { pre: { minGap: Infinity, bumps: [], spread: 0 },
    post: { minGap: Infinity, bumps: [] }, greenAt: null, ids: [] };
  const start = performance.now();
  await new Promise((done) => {
    const frame = () => {
      const cars = [game.car, ...game.ai.map((entry) => entry.car)];
      out.ids = cars.map((car) => String(car.spec.id).split('#')[0]);
      const green = !!game.start.green;
      if (green && out.greenAt === null) out.greenAt = game.start.t;
      const part = green ? out.post : out.pre;
      for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
        const gap = boxGap(cars[i], cars[j]), key = i + '-' + j;
        part.minGap = Math.min(part.minGap, gap);
        if (gap < 0.05 && !touching.has(key)) {
          touching.add(key);
          const speedI = Math.hypot(cars[i].vx, cars[i].vy);
          const speedJ = Math.hypot(cars[j].vx, cars[j].vy);
          part.bumps.push(`${out.ids[i]}${i ? '' : '(you)'}/${out.ids[j]} at `
            + `${game.start.t.toFixed(1)} s, ${speedI.toFixed(1)}/${speedJ.toFixed(1)} m/s`);
        } else if (gap > 0.5) touching.delete(key);
      }
      if (!green) {
        const speeds = cars.map((car) => Math.hypot(car.vx, car.vy));
        if (Math.min(...speeds) > 3) part.spread = Math.max(part.spread,
          Math.max(...speeds) - Math.min(...speeds));
      }
      const elapsed = (performance.now() - start) / 1000;
      if ((out.greenAt !== null && game.start.t > out.greenAt + 5) || elapsed > 90) done();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  return out;
}

const server = await startServer();
const browser = await launchBrowser();
let total = { pre: 0, post: 0 };
try {
  const errors = [];
  const page = await browser.newPage({ viewport: { width: VIEW_W, height: VIEW_H } });
  page.on('pageerror', (err) => errors.push(err.message));
  // (the autopilot drives your car after the green: a car left standing would be hit)
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&loadscreen=0`
    + `&autopilot=1${extraQuery()}`);
  await page.mouse.click(VIEW_W / 2, VIEW_H / 2);
  await page.waitForTimeout(800);
  for (const levelId of LEVELS) {
    for (const carId of CARS) {
      if (SHOTS) {
        await photo(page, levelId, carId);
        continue;
      }
      for (let run = 0; run < RUNS; run++) {
        const res = await page.evaluate(sampleRun, [levelId, carId]);
        total.pre += res.pre.bumps.length;
        total.post += res.post.bumps.length;
        console.log(`${levelId} ${carId} run ${run} [${res.ids.join(',')}]: green at `
          + `${res.greenAt?.toFixed(1)} s; BEFORE closest ${res.pre.minGap.toFixed(2)} m, `
          + `${res.pre.bumps.length} bumps, speed spread ${res.pre.spread.toFixed(1)} m/s; `
          + `AFTER 5 s closest ${res.post.minGap.toFixed(2)} m, ${res.post.bumps.length} bumps`);
        for (const bump of res.pre.bumps) console.log(`    before: ${bump}`);
        for (const bump of res.post.bumps) console.log(`    after:  ${bump}`);
      }
    }
  }
  console.log(errors.length ? 'PAGE ERRORS ' + [...new Set(errors)].slice(0, 3).join(' | ')
    : 'page errors none');
} finally {
  await browser.close();
  server.stop();
}
console.log(`TOTAL bumps before the green ${total.pre}, after it (5 s) ${total.post}`);
