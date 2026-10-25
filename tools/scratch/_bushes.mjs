// _bushes.mjs - bushes (?bushes=1): per level how many, how close to the road, photos at phone
// size (844x390 and 390x844); then on Killder a car coasting through bushes vs over grass (speed
// lost), and N fresh bushes driven through at 25 m/s (punctures, scratches, cells flattened).
// node tools/scratch/_bushes.mjs <out folder> [physics-runs]
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const out = process.argv[2] || '.';
const RUNS = +(process.argv[3] || 40);
const LEVELS = ['castle-cum', 'brands-snatch', 'knobhill', 'killder', 'sweaty-lamb',
  'stage-llanfairsheepdip', 'stage-pen-y-cowpatt', 'stage-col-de-fromage', 'stage-mont-brakefade'];
const server = await startServer();
const browser = await launchBrowser();

async function open(level, size, extra = '') {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&bushes=1${extra}`);
  await page.touchscreen.tap(size.width / 2, size.height / 2);
  await page.waitForTimeout(300);
  await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }), level);
  await page.waitForTimeout(2500);
  return { context, page };
}

// counts, and the road-edge distance of every bush's nearest point
const survey = (page) => page.evaluate(async () => {
  const state = await import('/src/world/state.ts');
  const tyrewall = await import('/src/world/tyrewall.ts');
  const level = state.LEVEL, sub = level.subtrack, list = level._bushes || [];
  let nearest = Infinity;
  for (const bush of list) {
    const edge = tyrewall.querySubtrack(sub, bush.x, bush.y).dist - sub.width / 2 - bush.w / 2;
    nearest = Math.min(nearest, edge);
  }
  return { count: list.length, nearestEdgeM: +nearest.toFixed(2),
    patches: (level.allPatches || []).length };
});

// moves the car beside the n-th bush nearest the road and frames it
const besideBush = (page, rank) => page.evaluate(async (which) => {
  const state = await import('/src/world/state.ts');
  const tyrewall = await import('/src/world/tyrewall.ts');
  const level = state.LEVEL, sub = level.subtrack;
  const ranked = [...(level._bushes || [])].map((bush) => ({ bush,
    edge: tyrewall.querySubtrack(sub, bush.x, bush.y).dist })).sort((a, b) => a.edge - b.edge);
  const pick = ranked[Math.min(which, ranked.length - 1)];
  if (!pick) return null;
  const hit = tyrewall.querySubtrack(sub, pick.bush.x, pick.bush.y);
  const pos = tyrewall.onTrack(sub, hit.trackDist, 0, {});
  // the car 7 m from the bush toward the road (on the road when the bush is closer than that)
  const toBushX = pick.bush.x - pos.x, toBushY = pick.bush.y - pos.y;
  const span = Math.hypot(toBushX, toBushY) || 1, back = Math.min(span, 7);
  const car = window.__game.car;
  car.x = pick.bush.x - (toBushX / span) * back; car.y = pick.bush.y - (toBushY / span) * back;
  car.heading = pos.rot; car.vx = 0; car.vy = 0; car.yawRate = 0;
  window.__game.renderer.debugZoom(0.9);
  return { x: +pick.bush.x.toFixed(1), y: +pick.bush.y.toFixed(1) };
}, rank);

async function photograph() {
  for (const level of LEVELS) {
    const { context, page } = await open(level, { width: 844, height: 390 });
    console.log(level, JSON.stringify(await survey(page)));
    for (const rank of [0, 6]) {
      await besideBush(page, rank);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: join(out, `bush-${level}-${rank}.png`) });
    }
    await context.close();
  }
  for (const level of ['killder', 'castle-cum']) {
    const { context, page } = await open(level, { width: 390, height: 844 });
    await besideBush(page, 2);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(out, `bush-${level}-portrait.png`) });
    await context.close();
  }
}

// one coast at speed from 12 m before a point, straight through it; returns the speed 12 m past
const coastThrough = (page, spot, speed, heading) => page.evaluate(async ([at, start, dir]) => {
  const car = window.__game.car;
  const run = 12;
  car.x = at.x - Math.cos(dir) * run; car.y = at.y - Math.sin(dir) * run;
  car.heading = dir; car.vx = Math.cos(dir) * start; car.vy = Math.sin(dir) * start;
  car.yawRate = 0;
  const startX = car.x, startY = car.y;
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  for (let i = 0; i < 400; i++) {
    await wait(10);
    if (Math.hypot(car.x - startX, car.y - startY) >= run * 2) break;
  }
  return Math.hypot(car.vx, car.vy);
}, [spot, speed, heading]);

async function physics() {
  const { context, page } = await open('killder', { width: 844, height: 390 });
  const spots = await page.evaluate(async () => {
    const state = await import('/src/world/state.ts');
    return (state.LEVEL._bushes || []).filter((bush) => bush.w >= 2.4)
      .map((bush) => ({ x: bush.x, y: bush.y, w: bush.w }));
  });
  console.log('killder bushes >= 2.4 m:', spots.length);
  for (const speed of [15, 25, 35]) {
    let through = 0, beside = 0;
    const tries = 6;
    for (let i = 0; i < tries; i++) {
      const spot = spots[i];
      await page.evaluate(async () => (await import('/src/world/wear.ts')).clearWear());
      through += speed - await coastThrough(page, spot, speed, 0);
      // the same coast 9 m to the side (grass, no bush), as the control
      beside += speed - await coastThrough(page, { x: spot.x, y: spot.y + 9 }, speed, 0);
    }
    console.log(`coast ${speed} m/s: lost ${(through / tries * 3.6).toFixed(1)} km/h through a`
      + ` bush vs ${(beside / tries * 3.6).toFixed(1)} beside`);
  }
  let punctures = 0, scratched = 0, flatCells = 0;
  for (let i = 0; i < Math.min(RUNS, spots.length); i++) {
    const result = await page.evaluate(async (spot) => {
      const damage = await import('/src/damage.ts');
      const wear = await import('/src/world/wear.ts');
      const car = window.__game.car;
      damage.repair(car);
      const before = car.dmg.reduce((sum, value) => sum + value, 0);
      return { before };
    }, spots[i]);
    await coastThrough(page, spots[i], 25, Math.PI / 2);
    const after = await page.evaluate(async (spot) => {
      const wear = await import('/src/world/wear.ts');
      const car = window.__game.car;
      const cell = wear.wearMap.get(wear.wearKey(Math.floor(spot.x / 1.5),
        Math.floor(spot.y / 1.5)));
      return { punct: (car.tyreLeak || []).map((leak) => leak > 0).filter(Boolean).length,
        dmg: car.dmg.reduce((sum, value) => sum + value, 0), base: cell ? cell.base : null };
    }, spots[i]);
    if (after.punct) punctures++;
    if (after.dmg > result.before + 1e-6) scratched++;
    if (after.base === 'grassLong') flatCells++;
  }
  console.log(`${Math.min(RUNS, spots.length)} bushes at 25 m/s: punctured ${punctures},`
    + ` scratched ${scratched}, centre cell flattened (1 pass) ${flatCells}`);
  // three passes over one bush flatten its middle to long grass
  const spot = spots[0];
  await page.evaluate(async () => (await import('/src/world/wear.ts')).clearWear());
  const bases = [];
  for (let pass = 0; pass < 4; pass++) {
    await coastThrough(page, spot, 12, 0);
    await page.waitForTimeout(500);
    bases.push(await page.evaluate(async () => {
      const wear = await import('/src/world/wear.ts');
      const counts = {};
      for (const cell of wear.wearMap.values()) {
        if (cell.orig !== 'bush') continue;
        counts[cell.base] = (counts[cell.base] || 0) + 1;
      }
      return JSON.stringify(counts);
    }));
  }
  console.log('bush cells driven over, by ground, after passes 1-4:', bases.join(' > '));
  await page.evaluate((at) => {
    const car = window.__game.car;
    car.x = at.x; car.y = at.y + 6; car.vx = 0; car.vy = 0; car.heading = 0;
  }, spot);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, 'bush-flattened.png') });
  await context.close();
}

try {
  if (process.argv[4] !== 'physics') await photograph();
  await physics();
} finally {
  await browser.close();
  server.stop();
}
