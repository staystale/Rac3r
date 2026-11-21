// _lampflash.mjs - ?lampflash in the real game (the motorway, traffic on; you on the autopilot at
// AP km/h): the lamps on the sim clock (physics/lampsim.ts) and the flicker's flashes
// (game/flashes.ts) - each case one launch:
//  you   - a traffic car put FRONT_M ahead of you in your lane (moving over, it may leave it:
//          then no more flashes reach it), your front-left corner hit to 0.25: how long your
//          lamp flickers (sim s) and how it settles; each flash it got from you, what it did, and
//          whether it got angry and at whom
//  racer - the same in front of an AI racer, the racer's corner hit: the flashes from the racer,
//          angry at whom, the angry car's gap to the racer over the chase; whether any racer is
//          ever angry
//  dead  - both your headlights smashed (0.4): your lights flashed by hand (G twice inside 1.2 s)
//          at a car ahead - whether it was flashed; then with them whole (the control)
// node tools/scratch/_lampflash.mjs [cases you,racer,dead] [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const CASES = (process.argv[2] || 'you,racer,dead').split(',');
const extra = process.argv[3] ?? '&lampflash=1';
const AP_KMH = 100, FRONT_M = 35;
const server = await startServer();
const browser = await launchBrowser();

/**
 * In the page: a traffic car of our way put `ahead` m in front of a driver's frame, in the lane
 * nearest that frame's offset (or the nearside), at the driver's speed.
 * @param page the page
 * @param who 'you' or the AI index
 * @param ahead m
 * @param nearside put it in the nearside lane (you: moved there first)
 * @returns the slot's index in the traffic list, or -1
 */
async function placeAhead(page, who, ahead, nearside) {
  return page.evaluate(async ([driver, gapM, isNear]) => {
    const game = window.__game, level = game.level, hw = await import('/src/highway.ts');
    const car = driver === 'you' ? game.car : game.ai[driver].car;
    const frame = driver === 'you' ? level._hw.q : car._hwf;
    if (!frame) return -1;
    const lanes = level._hw.geo.own;
    const laneIdx = isNear ? 0 : lanes.reduce((best, off, idx) => (Math.abs(off - frame.off)
      < Math.abs(lanes[best] - frame.off) ? idx : best), 0);
    const list = game.traffic.list;
    const idx = list.findIndex((slot) => !slot.parked && (slot.dir ?? 1) > 0 && !slot.police
      && !slot.broke && !slot.racer && Math.abs(slot.s - frame.s) > 80);
    if (idx < 0) return -1;
    const slot = list[idx], speed = Math.hypot(car.vx, car.vy) || 25;
    const pose = hw.roadPose(level, frame.s + gapM, lanes[laneIdx]);
    const { reset } = await import('/src/vehicle.ts');
    reset(slot.car, pose.x, pose.y, pose.h);
    Object.assign(slot, { s: frame.s + gapM, off: lanes[laneIdx], lane: laneIdx, laneT: laneIdx,
      laneOff: lanes[laneIdx], kOff: null, vAl: speed, vWant: speed, quick: true, yieldT: 0,
      edge: 0, flashes: [], flashBy: new Map() });
    slot.car.vx = Math.cos(pose.h) * speed;
    slot.car.vy = Math.sin(pose.h) * speed;
    return idx;
  }, [who, ahead, nearside]);
}

/**
 * In the page: what a traffic slot has had from a driver, and the driver's front-left lamp.
 * @param page the page
 * @param idx the slot
 * @param who 'you' or the AI index
 * @returns the state
 */
function readSlot(page, idx, who) {
  return page.evaluate(([slotIdx, driver]) => {
    const game = window.__game, slot = game.traffic.list[slotIdx];
    const car = driver === 'you' ? game.car : game.ai[driver].car;
    const times = slot.flashBy?.get(car) ?? [];
    const police = slot.police;
    return { flashes: times.length, yieldT: +(slot.yieldT ?? 0).toFixed(1),
      edge: +(slot.edge ?? 0).toFixed(1), angry: !!police?.angry,
      atWhom: police?.angry ? (police.target === game.car ? 'you'
        : game.ai.findIndex((entry) => entry.car === police.target)) : null,
      gap: Math.hypot(slot.car.x - car.x, slot.car.y - car.y).toFixed(0),
      lamp: car.lampSim ? { until: +car.lampSim.until[0].toFixed(2), dead: car.lampSim.dead[0],
        hits: car.lampSim.hits[0] } : null,
      racersAngry: game.ai.filter((entry) => entry.car.angry).length };
  }, [idx, who]);
}

/**
 * One case's launch: the motorway, traffic on, AI as the case needs; 4 s rolling.
 * @param page the page
 * @param ai the AI racers
 */
async function launch(page, ai) {
  await page.evaluate((count) => window.__game.launch('highway', 'hatch-rwd', { ai: count,
    road: 'motorway', weather: { mode: 'dry', season: 2, seed: 4 } }), ai);
  await page.waitForTimeout(1200);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(4000);
}

/**
 * A flicker case: a car put ahead of the driver, its corner hit, 12 s watched.
 * @param page the page
 * @param who 'you' or 0 (the first racer)
 */
async function flickerCase(page, who) {
  await launch(page, who === 'you' ? 0 : 1);
  const idx = await placeAhead(page, who, FRONT_M, false);
  if (idx < 0) {
    console.log(`${who}: no car to put ahead`);
    return;
  }
  await page.evaluate((driver) => {
    const game = window.__game, car = driver === 'you' ? game.car : game.ai[driver].car;
    car.dmg[0] = 0.25;
  }, who);
  const lines = [];
  for (let second = 1; second <= 12; second++) {
    await page.waitForTimeout(1000);
    const now = await readSlot(page, idx, who);
    lines.push(`${second}s: flashes ${now.flashes}, yieldT ${now.yieldT}, edge ${now.edge}, `
      + `angry ${now.angry}${now.angry ? ' at ' + now.atWhom : ''}, gap ${now.gap} m, lamp `
      + `${JSON.stringify(now.lamp)}, racers angry ${now.racersAngry}`);
  }
  console.log(`${who === 'you' ? 'you' : 'racer'}:\n  ` + lines.join('\n  '));
}

/**
 * The dead-headlight case: a hand flash at a car ahead, smashed lamps then whole.
 * @param page the page
 */
async function deadCase(page) {
  for (const smashed of [true, false]) {
    await launch(page, 0);
    const idx = await placeAhead(page, 'you', 25, false);
    await page.evaluate((isSmashed) => {
      const car = window.__game.car;
      car.dmg[0] = car.dmg[1] = isSmashed ? 0.4 : 0;
    }, smashed);
    await page.waitForTimeout(300);
    await page.keyboard.press('g');
    await page.waitForTimeout(300);
    await page.keyboard.press('g');
    await page.waitForTimeout(400);
    const now = await readSlot(page, idx, 'you');
    console.log(`dead: headlights ${smashed ? 'smashed (0.4)' : 'whole'} - flashed by hand: `
      + `the car ahead got ${now.flashes} flash(es), yieldT ${now.yieldT}`);
  }
}

try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1`
    + `&autopilot=${AP_KMH}${extra}`);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(1000);
  for (const name of CASES) {
    if (name === 'you') await flickerCase(page, 'you');
    if (name === 'racer') await flickerCase(page, 0);
    if (name === 'dead') await deadCase(page);
  }
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}
