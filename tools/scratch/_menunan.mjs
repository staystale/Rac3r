// _menunan.mjs - THE MENU RACE'S NaN, HUNTED (scratch; TODO 4 WATCH, 11-04, again 11-14 at
// 390x844): opens the game's menu (?menu=1, as menucheck) RUNS times over the screen sizes in
// SIZES, each for SECONDS, and watches the menu race. A TRIPWIRE in the page: every animation
// frame the camera car's state (pose, velocity, yaw rate, steering, rpm, its tyre forces' inputs,
// its gear, air and roll, the surface under it) goes into a ring of the last RING frames;
// the game's own console.error "[car sim] car state went bad" (game/sim.ts recoverCar: the first
// non-finite value assertFinite meets after a step) dumps the ring - which value went bad, which
// car, after what. Each run prints its level, field, road / scenery (the highway), the camera
// car's speed, and any NaN with the frames before it.
// RUNS=40 SECONDS=15 SIZES=844x390,390x844,360x780,412x915,1280x720 node tools/scratch/_menunan.mjs
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const RUNS = Number(process.env.RUNS || 40);
const SECONDS = Number(process.env.SECONDS || 15);
const SIZES = (process.env.SIZES || '844x390,390x844,360x780,412x915,1280x720').split(',')
  .map((size) => size.split('x').map(Number));
// frames kept before a NaN
const RING = 8;

/** Page side, before the game: the console.error hook and the per-frame ring of the camera car. */
function installTripwire(keep) {
  window.__nan = { hits: [], ring: [], keep };
  const original = console.error.bind(console);
  console.error = (...args) => {
    const text = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(' ');
    if (text.includes('car state went bad') && window.__nan.hits.length < 5)
      window.__nan.hits.push({ text: text.slice(0, 400), ring: window.__nan.ring.slice() });
    original(...args);
  };
  const round = (value) => (typeof value === 'number' ? Math.round(value * 1e4) / 1e4 : value);
  const sample = () => {
    const game = window.__game;
    if (game && game.car && game.level) {
      const car = game.car, tyre = car.t || {};
      window.__nan.ring.push({ level: game.level.id, mode: game.mode, x: round(car.x),
        y: round(car.y), vx: round(car.vx), vy: round(car.vy), heading: round(car.heading),
        yawRate: round(car.yawRate), delta: round(car.delta), rpm: round(car.rpm),
        gear: car.gear, air: round(car.air || 0), z: round(car.z || 0),
        roll: car.roll ? car.roll.phase : null, vLong: round(tyre.vLong),
        vLat: round(tyre.vLat), FzF: round(tyre.FzF), FzR: round(tyre.FzR),
        surface: car.surface && car.surface.name, wheelW: (car.wheelW || []).map(round) });
      if (window.__nan.ring.length > window.__nan.keep) window.__nan.ring.shift();
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

/**
 * Page side: the menu race now.
 * @returns {object} its level, field, highway road and scenery, the camera car's speed
 */
function readMenu() {
  const game = window.__game, level = game.level;
  return { level: level.id, ai: game.ai.length, road: level.roadType || null,
    scenery: level.scenery || null, car: game.car.spec.id,
    speed: Math.round(Math.hypot(game.car.vx, game.car.vy) * 10) / 10,
    hits: window.__nan.hits };
}

const server = await startServer();
const browser = await launchBrowser();
let nanRuns = 0;
try {
  for (let run = 0; run < RUNS; run++) {
    const [width, height] = SIZES[run % SIZES.length];
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.addInitScript(installTripwire, RING);
    await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0${extraQuery()}`);
    await page.waitForFunction(() => window.__game.mode === 'menu', null,
      { timeout: 60000, polling: 250 });
    await page.waitForTimeout(SECONDS * 1000);
    const seen = await page.evaluate(readMenu);
    if (seen.hits.length) nanRuns++;
    console.log(`run ${run} ${width}x${height} ${seen.level}${seen.road ? ` ${seen.road}/`
      + `${seen.scenery}` : ''} ai ${seen.ai} ${seen.car} ${seen.speed} m/s: `
      + `${seen.hits.length ? 'NaN x' + seen.hits.length : 'ok'}`
      + (errors.length ? ` | page errors: ${errors[0].slice(0, 120)}` : ''));
    for (const hit of seen.hits.slice(0, 1)) {
      console.log('   ' + hit.text);
      for (const frame of hit.ring) console.log('   ' + JSON.stringify(frame));
    }
    await ctx.close();
  }
  console.log(`menunan: ${nanRuns} of ${RUNS} runs with a NaN`);
} finally {
  await browser.close();
  server.stop();
}
