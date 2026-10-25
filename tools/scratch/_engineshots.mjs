// _engineshots.mjs - car systems C3-C5 in the real game (?engine=1): your car on autopilot round
// a circuit, its radiator cracked by script (a fast leak) - logs the engine (C, water, power,
// seize) to the seize and photographs the moments: steam + drip, overheating smoke + the red
// light, seized, close-ups of the speed panel; the exhaust on a cold day (snow) and a hot one
// (the look photos at 25 km/h, framed); an AI cracked the same way
// must reset itself when it seizes. 844x390 and 390x844.
// node tools/scratch/_engineshots.mjs <out folder> [level]
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const out = process.argv[2] || '.';
const level = process.argv[3] || 'castle-cum';
mkdirSync(out, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
let errors = 0;

async function open(size, weather, ai = 0, autopilot = '1') {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => { errors++; console.log('PAGE ERROR ' + error.message); });
  await gotoGame(page,
    `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=${autopilot}&engine=1&dev=1`);
  await page.touchscreen.tap(size.width / 2, size.height / 2);
  await page.waitForTimeout(300);
  await page.evaluate(([id, wx, aiCount]) => window.__game.launch(id, 'hatch-rwd',
    { ai: aiCount, weather: wx }), [level, weather, ai]);
  await page.waitForTimeout(2000);
  return { context, page };
}

const zoom = (page, value) => page.evaluate((zoomTo) => window.__game.renderer.debugZoom(zoomTo),
  value);
const engine = (page) => page.evaluate(() => {
  const car = window.__game.car;
  return { t: +car.engT.toFixed(1), water: Math.round(car.engWater * 100),
    pow: +car.engPowerK.toFixed(2), seized: car.engSeized, seize: +car.seizeT.toFixed(1),
    kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6) };
});

async function crackRun(size, tag) {
  const { context, page } = await open(size, { mode: 'dry', season: 2, seed: 4 });
  await page.waitForTimeout(6000);
  await page.evaluate(() => { window.__game.car.engLeak = 1 / 40; });
  await zoom(page, 2);
  const shots = { steam: false, hot: false, seized: false };
  const start = Date.now();
  let last = '';
  while (Date.now() - start < 200000) {
    await page.waitForTimeout(1000);
    const state = await engine(page);
    const secs = Math.round((Date.now() - start) / 1000);
    const line = JSON.stringify(state);
    if (secs % 10 === 0 && line !== last) { console.log(`${tag} ${secs}s ${line}`); last = line; }
    if (!shots.steam && secs >= 4) {
      shots.steam = true;
      await page.screenshot({ path: join(out, `steam-${tag}.png`) });
    }
    if (!shots.hot && state.t >= 120) {
      shots.hot = true;
      console.log(`${tag} 120 C at ${secs}s ${line}`);
      await page.screenshot({ path: join(out, `hot-${tag}.png`) });
    }
    if (state.seized && !shots.seized) {
      shots.seized = true;
      console.log(`${tag} SEIZED at ${secs}s ${line}`);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: join(out, `seized-${tag}.png`) });
      break;
    }
  }
  await context.close();
}

/**
 * The look photos: the autopilot held at 25 km/h (the camera keeps the car framed), each state
 * set by script - all well, steam + water, overheating (amber, then red), the seize moment - with
 * a close-up of the speed panel (the lights) for each; then the exhaust on a cold and a hot day.
 * @param {{width: number, height: number}} size the viewport
 * @param {string} tag the file tag
 */
async function lookShots(size, tag) {
  const panel = { x: size.width - 12 - 120, y: 12, width: 120, height: 52 };
  const { context, page } = await open(size, { mode: 'dry', season: 2, seed: 4 }, 0, '25');
  await page.waitForTimeout(5000);
  await zoom(page, 2.2);
  const states = [
    ['well', {}],
    ['steam', { engLeak: 1 / 40, engWater: 0.7, engT: 92 }],
    ['amber', { engLeak: 1 / 40, engWater: 0, engT: 108 }],
    ['hot', { engLeak: 1 / 40, engWater: 0, engT: 124 }],
    ['seize', { engLeak: 1 / 40, engWater: 0, engT: 131, seizeT: 9.95 }],
  ];
  for (const [name, state] of states) {
    await page.evaluate((set) => Object.assign(window.__game.car, set), state);
    await page.waitForTimeout(name === 'seize' ? 700 : 2500);
    await page.screenshot({ path: join(out, `${name}-${tag}.png`) });
    await page.screenshot({ path: join(out, `panel-${name}-${tag}.png`), clip: panel });
    if (name === 'hot') {
      await page.waitForTimeout(260);
      await page.screenshot({ path: join(out, `panel-hot2-${tag}.png`), clip: panel });
    }
  }
  const wet = await page.evaluate(async () => {
    const { wearMap } = await import('/src/world/wear.ts');
    return [...wearMap.values()].filter((cell) => cell.cover === 'wet').length;
  });
  console.log(`${tag} wet cells after the leak: ${wet}`);
  await context.close();
  for (const [name, weather] of [['cold', { mode: 'snow', season: 0, seed: 4 }],
    ['hot', { mode: 'superhot', season: 2, seed: 4 }]]) {
    const run = await open(size, weather, 0, '25');
    await run.page.waitForTimeout(5000);
    await zoom(run.page, 2.4);
    await run.page.waitForTimeout(1500);
    await run.page.screenshot({ path: join(out, `exhaust-${name}-${tag}.png`) });
    await run.context.close();
  }
}

/**
 * The leaked water on the road: a fast leak at 25 km/h for 25 s, then stopped (it pools), the
 * camera pulled back to show the trail; logs the wet cells and what the car drives on there.
 * @param {{width: number, height: number}} size the viewport
 * @param {string} tag the file tag
 */
async function waterShots(size, tag) {
  const { context, page } = await open(size, { mode: 'dry', season: 2, seed: 4 }, 0, '25');
  await page.waitForTimeout(4000);
  await page.evaluate(() => Object.assign(window.__game.car, { engLeak: 1 / 40, engWater: 1 }));
  await page.waitForTimeout(25000);
  const res = await page.evaluate(async () => {
    const game = window.__game, car = game.car, { shared } = await import('/src/game/state.js');
    shared.settings.autopilot = false;
    car.vx = 0; car.vy = 0;
    game.renderer.debugZoom(1.3);
    const { wearMap } = await import('/src/world/wear.ts');
    return { wet: [...wearMap.values()].filter((cell) => cell.cover === 'wet').length,
      water: Math.round(car.engWater * 100) };
  });
  console.log(`${tag} water: ${res.wet} wet cells after 25 s at 25 km/h, radiator ${res.water} %`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, `water-${tag}.png`) });
  await page.evaluate(() => window.__game.renderer.debugZoom(2.4));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(out, `water-pool-${tag}.png`) });
  await context.close();
}

async function aiRun() {
  const { context, page } = await open({ width: 844, height: 390 },
    { mode: 'dry', season: 2, seed: 4 }, 2);
  await page.waitForTimeout(6000);
  await page.evaluate(() => {
    const rival = window.__game.ai[0].car;
    rival.engLeak = 1 / 40;
    window.__aiLog = [];
  });
  const start = Date.now();
  let seenSeized = false, mended = false;
  while (Date.now() - start < 200000 && !mended) {
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => {
      const rival = window.__game.ai[0].car;
      return { t: +(rival.engT || 0).toFixed(1), water: Math.round((rival.engWater ?? 1) * 100),
        seized: !!rival.engSeized };
    });
    if (state.seized) seenSeized = true;
    if (seenSeized && !state.seized && state.water === 100) mended = true;
    const secs = Math.round((Date.now() - start) / 1000);
    if (secs % 20 === 0) console.log(`AI ${secs}s ${JSON.stringify(state)}`);
  }
  console.log(`AI: seized ${seenSeized}, reset and mended ${mended}`);
  await context.close();
}

try {
  const which = process.argv[4] || 'all';
  if (which === 'all' || which === 'crack') {
    await crackRun({ width: 844, height: 390 }, 'land');
  }
  if (which === 'all' || which === 'ai') await aiRun();
  if (which === 'all' || which === 'water') {
    await waterShots({ width: 844, height: 390 }, 'land');
    await waterShots({ width: 390, height: 844 }, 'port');
  }
  if (which === 'all' || which === 'look') {
    await lookShots({ width: 844, height: 390 }, 'land');
    await lookShots({ width: 390, height: 844 }, 'port');
  }
  if (which === 'all' || which === 'crackport') {
    await crackRun({ width: 390, height: 844 }, 'port');
  }
  console.log(`page errors: ${errors}`);
} finally {
  await browser.close();
  server.stop();
}
