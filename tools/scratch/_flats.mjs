// _flats.mjs - car systems C1-C2 (?flats=1): the real game, your car on autopilot round a
// circuit. MEASURES: a slow and a fast puncture's time to flat, the grip / pull / drag the flat
// gives (car.wreck), metres driven flat until the rim, and on the rim how many wear cells break
// a grade per km (world/metalscrape.ts). PHOTOS: a parked car with one wheel at each state, the
// gouged ground, a rim sparking at speed - 844x390 and 390x844.
// node tools/scratch/_flats.mjs physics [level]   (the autopilot is made at launch: ?autopilot=1)
// node tools/scratch/_flats.mjs photos <out folder> [level]
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const mode = process.argv[2] || 'physics';
const server = await startServer();
const browser = await launchBrowser();

async function open(level, size) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&flats=1&autopilot=1`);
  await page.touchscreen.tap(size.width / 2, size.height / 2);
  await page.waitForTimeout(300);
  await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }), level);
  await page.waitForTimeout(2000);
  return { context, page };
}

/**
 * Page side: autopilot, a puncture of the given kind on the front +y tyre, then sample.
 * @param {[boolean, number]} args slow or fast, seconds to watch after it goes
 */
async function puncture([slow, secs]) {
  const game = window.__game, { shared } = await import('/src/game/state.js');
  const wear = await import('/src/world/wear.ts');
  shared.settings.autopilot = true;
  await new Promise((done) => setTimeout(done, 8000));
  const car = game.car, corner = 1;
  const cellsBefore = new Set([...wear.wearMap.values()].filter((cell) => cell.base !== cell.orig)
    .map((cell) => cell.cx + ',' + cell.cy));
  car.burstTyre = 0;
  car.burstSlow = slow;
  const start = performance.now(), out = { flatAt: null, rimAt: null, rimRunM: null,
    speedBefore: Math.hypot(car.vx, car.vy), samples: [] };
  let rimMetres = 0, lastX = car.x, lastY = car.y, lastT = start;
  while (performance.now() - start < secs * 1000) {
    await new Promise((done) => setTimeout(done, 100));
    const now = performance.now(), t = (now - start) / 1000;
    const pressure = car.tyreP ? car.tyreP[corner] : 1;
    if (out.flatAt === null && pressure <= 0.05) out.flatAt = t;
    if (out.rimAt === null && car.onRim && car.onRim[corner]) {
      out.rimAt = t;
      out.rimRunM = car.flatRun[corner];
    }
    if (car.onRim && car.onRim[corner]) rimMetres += Math.hypot(car.x - lastX, car.y - lastY);
    lastX = car.x; lastY = car.y; lastT = now;
    if (out.samples.length < 400 && (t < 1.2 || Math.round(t * 10) % 10 === 0)) {
      out.samples.push({ t: +t.toFixed(1), air: +pressure.toFixed(2),
        speed: +Math.hypot(car.vx, car.vy).toFixed(1),
        gripF: +car.wreck.gripF.toFixed(3), toe: +car.wreck.toe.toFixed(4),
        roll: +car.wreck.roll.toFixed(2), run: Math.round(car.flatRun[corner]),
        sparks: car.rimSparks ? car.rimSparks.filter(Boolean).length : 0 });
    }
  }
  const broken = [...wear.wearMap.values()].filter((cell) => cell.base !== cell.orig
    && !cellsBefore.has(cell.cx + ',' + cell.cy) && ['tarmac', 'broken'].includes(cell.base));
  out.rimKm = rimMetres / 1000;
  out.broken = broken.length;
  out.brokenKinds = broken.map((cell) => cell.orig + '>' + cell.base);
  out.lastT = (lastT - start) / 1000;
  return out;
}

try {
  const level = process.argv[mode === 'photos' ? 4 : 3] || 'castle-cum';
  if (mode === 'body') {
    // a rolled body sliding (car.sparks) 150 m along the start straight, and 40 rollover impacts
    const { context, page } = await open(level, { width: 844, height: 390 });
    const res = await page.evaluate(async () => {
      const game = window.__game, car = game.car, { shared } = await import('/src/game/state.js');
      const damage = await import('/src/damage.ts'), wear = await import('/src/world/wear.ts');
      shared.settings.autopilot = false;
      const broken = () => [...wear.wearMap.values()].filter((cell) => cell.base !== cell.orig)
        .length;
      // a rolled car has always been hit (the roll is a hit): its damage state exists
      damage.repair(car);
      const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
      const before = broken(), startX = car.x, startY = car.y;
      const surfaces = {}, hardCells = new Set();
      for (const offset of [0, 1.5, 3, 4.5, 6]) for (let metres = 0; metres < 150; metres += 0.25) {
        // the body slides on lines to one side of the car's start line, impacts to the other
        car.x = startX + cosH * metres - sinH * offset;
        car.y = startY + sinH * metres + cosH * offset;
        const under = wear.groundSurfaceAt(car.x, car.y).id;
        surfaces[under] = (surfaces[under] || 0) + 1;
        if (under === 'racetarmac' || under === 'tarmac') {
          hardCells.add(Math.floor(car.x / 1.5) + ',' + Math.floor(car.y / 1.5));
        }
        car.vx = Math.cos(car.heading) * 15; car.vy = Math.sin(car.heading) * 15;
        car.sparks = true;
        damage.stepDamage(car, 1 / 120);
      }
      const slid = broken() - before;
      for (let i = 0; i < 40; i++) {
        car.x = startX + cosH * i * 3.5 + sinH * 2.5;
        car.y = startY + sinH * i * 3.5 - cosH * 2.5;
        damage.hitRoll(car, 'side', 1, 5);
      }
      car.sparks = false; car.vx = 0; car.vy = 0;
      return { slid, impacts: broken() - before - slid, surfaces, hard: hardCells.size };
    });
    console.log('BODY: sliding broke ' + res.slid + ' of ' + res.hard + ' tarmac cells crossed; 40 impacts broke '
      + res.impacts + '; ground slid over ' + JSON.stringify(res.surfaces));
    await context.close();
  } else if (mode === 'physics') {
    for (const [slow, secs] of [[true, 40], [false, 150]]) {
      const { context, page } = await open(level, { width: 844, height: 390 });
      const res = await page.evaluate(puncture, [slow, secs]);
      console.log(`${slow ? 'SLOW' : 'FAST'} on ${level}: flat at ${res.flatAt} s, rim at`
        + ` ${res.rimAt} s after ${res.rimRunM && Math.round(res.rimRunM)} m flat; on the rim`
        + ` ${res.rimKm.toFixed(2)} km, broken cells ${res.broken}`
        + ` ${JSON.stringify(res.brokenKinds.slice(0, 12))}; speed before ${res.speedBefore.toFixed(1)}`);
      for (const sample of res.samples.filter((s, i) => i < 14 || i % 10 === 0)) {
        console.log('  ' + JSON.stringify(sample));
      }
      await context.close();
    }
  } else {
    const out = process.argv[3] || '.';
    for (const size of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
      const { context, page } = await open(level, size);
      const tag = size.width > size.height ? 'land' : 'port';
      // parked: corner 0 at 60 %, 1 at 30 %, 2 flat, 3 on its rim
      await page.evaluate(async () => {
        const game = window.__game, car = game.car;
        const { shared } = await import('/src/game/state.js');
        shared.settings.autopilot = false;
        car.vx = 0; car.vy = 0; car.yawRate = 0; car.heading = 0.25;
        car.tyreP = [0.6, 0.3, 0.02, 0]; car.onRim = [false, false, false, true];
        car.tyreLeak = [0, 0, 0, 0];
        game.renderer.debugZoom(2.2);
      });
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(out, `flats-parked-${tag}.png`) });
      await page.screenshot({ path: join(out, `flats-parked-close-${tag}.png`), clip: {
        x: size.width / 2 - 110, y: size.height / 2 - 70, width: 220, height: 140 } });
      // the ground broken in a row of cells ahead of the car
      await page.evaluate(async () => {
        const scrape = await import('/src/world/metalscrape.ts');
        const car = window.__game.car;
        for (let i = 2; i < 10; i++) {
          scrape.gougeCell(car.x + Math.cos(car.heading) * i * 1.5,
            car.y + Math.sin(car.heading) * i * 1.5);
          if (i % 2) scrape.gougeCell(car.x + Math.cos(car.heading) * i * 1.5,
            car.y + Math.sin(car.heading) * i * 1.5);
        }
        window.__game.renderer.debugZoom(1.2);
      });
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(out, `flats-gouge-${tag}.png`) });
      await context.close();
      // driving on the rim at race speed: sparks and the scored line (a fresh launch, the
      // autopilot up to speed first)
      const fresh = await open(level, size);
      await fresh.page.waitForTimeout(9000);
      await fresh.page.evaluate(() => {
        const car = window.__game.car;
        car.tyreP = [1, 0, 1, 1]; car.onRim = [false, true, false, false];
        car.tyreLeak = [0, 0, 0, 0];
      });
      for (const wait of [700, 600]) {
        await fresh.page.waitForTimeout(wait);
        await fresh.page.screenshot({ path: join(out, `flats-rim-${wait}-${tag}.png`) });
      }
      await fresh.context.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}
