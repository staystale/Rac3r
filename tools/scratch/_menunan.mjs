// _menunan.mjs - THE MENU RACE'S NaN, HUNTED (scratch; TODO 4 WATCH, 11-04, again 11-14 at
// 390x844): opens the game's menu (?menu=1, as menucheck) RUNS times over the screen sizes in
// SIZES, each for SECONDS, and watches the menu race. A TRIPWIRE in the page: every animation
// frame the camera car's state (pose, velocity, yaw rate, steering, rpm, its tyre forces' inputs,
// its gear, air and roll, the surface under it) goes into a ring of the last RING frames;
// the game's own console.error "[car sim] car state went bad" (game/sim.ts recoverCar: the first
// non-finite value assertFinite meets after a step) dumps the ring - which value went bad, which
// car, after what. Each run prints its level, field, road / scenery (the highway), the camera
// car's speed, and any NaN with the frames before it.
// LEVEL=<id>: once the menu is up, its race is put on that track instead (as game/menuflow.ts
// enterMenu: the level switched, a new demo driver for the camera car); AI=<n> its field;
// AHEAD=<ms>: the game's last frame time set that far ahead of now, so the next frame's
// timestamp comes before it (as the first frame can when main.ts takes performance.now() after
// the frame began) - the demo driver's first drive then gets a negative frame time.
// RUNS=40 SECONDS=15 SIZES=844x390,390x844,360x780,412x915,1280x720 [LEVEL=id] [AI=n]
//   node tools/scratch/_menunan.mjs
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
    // (this frame's input - set before the sim's steps - and its frame time, from the sampler
    // that runs first in each frame)
    const game = window.__game, inp = game && game.in;
    if (text.includes('car state went bad') && window.__nan.hits.length < 5)
      window.__nan.hits.push({ text: text.slice(0, 400), ring: window.__nan.ring.slice(),
        input: inp && { steer: inp.steer, throttle: inp.throttle, brake: inp.brake,
          handbrake: inp.handbrake }, frameMs: window.__nan.frameMs });
    original(...args);
  };
  const round = (value) => (typeof value === 'number' ? Math.round(value * 1e4) / 1e4 : value);
  const sample = (now) => {
    window.__nan.frameMs = window.__nan.lastNow == null ? null : now - window.__nan.lastNow;
    window.__nan.lastNow = now;
    const game = window.__game;
    if (game && game.car && game.level) {
      const car = game.car, tyre = car.t || {};
      window.__nan.ring.push({ level: game.level.id, mode: game.mode, x: round(car.x),
        y: round(car.y), vx: round(car.vx), vy: round(car.vy), heading: round(car.heading),
        yawRate: round(car.yawRate), delta: round(car.delta), rpm: round(car.rpm),
        gear: car.gear, air: round(car.air || 0), z: round(car.z || 0),
        roll: car.roll ? car.roll.phase : null, vLong: round(tyre.vLong),
        vLat: round(tyre.vLat), FzF: round(tyre.FzF), FzR: round(tyre.FzR),
        surface: car.surface && car.surface.name, frameMs: round(window.__nan.frameMs),
        input: game.in && [game.in.steer, game.in.throttle, game.in.brake].map(round) });
      if (window.__nan.ring.length > window.__nan.keep) window.__nan.ring.shift();
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

/**
 * Page side: the menu race put on a chosen track, as menuflow.ts enterMenu does it.
 * @param {[string, number]} args the level and the field
 */
async function forceMenuLevel([levelId, aiCount, aheadMs]) {
  const { shared, game } = await import('/src/game/state.ts');
  const { selectLevel } = await import('/src/game/controls.ts');
  const { createAIDriver } = await import('/src/ai/circuit.ts');
  const { aiTraits } = await import('/src/ai/traits.ts');
  const lab = await import('/src/lab.ts');
  if (aiCount) shared.aiCount = aiCount;
  selectLevel(levelId);
  shared.demo = createAIDriver(lab.LEVEL, aiTraits(shared.DEMO_DIFF, 2, shared.aiCount + 1,
    1 + Math.floor(Math.random() * 1e6)));
  window.__nan.hits.length = 0;
  if (!aheadMs) return null;
  shared.last = performance.now() + aheadMs;
  // (the next frames: the input the demo driver gave and its clock)
  const seen = [];
  await new Promise((done) => {
    const watch = () => {
      seen.push({ steer: game.in && game.in.steer, clock: shared.demo.state.t });
      if (seen.length < 6) requestAnimationFrame(watch);
      else done();
    };
    requestAnimationFrame(watch);
  });
  return seen;
}

/**
 * Page side, after a NaN: the demo driver's state, its drive now, and a fresh driver's drive from
 * the same spot with no other cars and with the field (which part of the driver gives the NaN).
 * @returns {object} what was found
 */
async function probeDemo() {
  const { shared, game } = await import('/src/game/state.ts');
  const { createAIDriver } = await import('/src/ai/circuit.ts');
  const { aiTraits } = await import('/src/ai/traits.ts');
  const lab = await import('/src/lab.ts');
  const car = game.car, cars = game.ai.map((entry) => entry.car);
  const plain = (value) => JSON.parse(JSON.stringify(value, (key, item) => (typeof item
    === 'number' && !Number.isFinite(item) ? String(item) : key === 'path' || key === 'pts'
    || key === 'line' ? '...' : item)));
  const state = shared.demo && shared.demo.state;
  const summary = state ? Object.fromEntries(Object.entries(state).filter(([, value]) =>
    value === null || typeof value !== 'object').map(([key, value]) => [key, typeof value
    === 'number' && !Number.isFinite(value) ? String(value) : value])) : null;
  const near = cars.map((other) => Math.hypot(other.x - car.x, other.y - car.y))
    .sort((a, b) => a - b).slice(0, 3).map((gap) => Math.round(gap * 100) / 100);
  const fresh = createAIDriver(lab.LEVEL, aiTraits(shared.DEMO_DIFF, 2, cars.length + 1, 7));
  const fresh2 = createAIDriver(lab.LEVEL, aiTraits(shared.DEMO_DIFF, 2, cars.length + 1, 7));
  return { demoState: summary, steerHold: plain(state && state.steerHold),
    nearestCars: near, car: { x: car.x, y: car.y, heading: car.heading, crossing: car.crossing,
      prog: car._prog, surface: car.surface && car.surface.id, spec: car.spec.id },
    demoNow: plain(shared.demo.drive(car, 1 / 60, { cars, lap: 1, laps: 99 })),
    freshAlone: plain(fresh.drive(car, 1 / 60, { cars: [], lap: 1, laps: 99 })),
    freshField: plain(fresh2.drive(car, 1 / 60, { cars, lap: 1, laps: 99 })) };
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
    const forced = process.env.LEVEL ? await page.evaluate(forceMenuLevel, [process.env.LEVEL,
      Number(process.env.AI || 0), Number(process.env.AHEAD || 0)]) : null;
    if (forced) console.log(`   the next frames: steer ${forced.map((frame) => frame.steer)
      .join(', ')} | driver clock ${forced.map((frame) => frame.clock.toFixed(3)).join(', ')}`);
    await page.waitForTimeout(SECONDS * 1000);
    const seen = await page.evaluate(readMenu);
    if (seen.hits.length) nanRuns++;
    console.log(`run ${run} ${width}x${height} ${seen.level}${seen.road ? ` ${seen.road}/`
      + `${seen.scenery}` : ''} ai ${seen.ai} ${seen.car} ${seen.speed} m/s: `
      + `${seen.hits.length ? 'NaN x' + seen.hits.length : 'ok'}`
      + (errors.length ? ` | page errors: ${errors[0].slice(0, 120)}` : ''));
    if (seen.hits.length) console.log('   probe: ' + JSON.stringify(await page.evaluate(probeDemo)));
    for (const hit of seen.hits.slice(0, 1)) {
      console.log('   ' + hit.text);
      console.log('   the bad frame: input ' + JSON.stringify(hit.input) + ', frame ms '
        + hit.frameMs);
      for (const frame of hit.ring) console.log('   ' + JSON.stringify(frame));
    }
    await ctx.close();
  }
  console.log(`menunan: ${nanRuns} of ${RUNS} runs with a NaN`);
} finally {
  await browser.close();
  server.stop();
}
