// _launchgame.mjs - A STANDING LAUNCH IN THE REAL GAME: a race on LEVEL with the car (no AI), the
// W key held from the start (the player's own input path, its throttle ramp included), the
// player car read every 6 frames for SECONDS of game time: wheelspin (telemetry spinF / spinR),
// the driven axle's slip speed, km/h, gear, rpm, the throttle the car got, the skid marks laid;
// a photo at 844x390 when the spin is at its worst. Nothing in the game is changed: it only reads.
// node tools/scratch/_launchgame.mjs <car> [level thruston] [seconds 8] [out.png]
// (RAC3R_QUERY for a car's switch; AI=n races n AI cars from a grid start; AIDS=on|off sets the
// car's ABS and TCS as the player's B / T keys do; PRESS_AT=s holds W from then; RELEASE_AT=s lets the first press go then - a race's countdown
// starts on the first press - so PRESS_AT presses again at the green)
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';
import { installDeterminism, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const [CAR = 'hatch-fwd', LEVEL = 'thruston', SECONDS = '8', OUT = ''] = process.argv.slice(2);
// s into the run the W key goes down (0: at once)
const pressAt = Number(process.env.PRESS_AT || 0), releaseAt = Number(process.env.RELEASE_AT || 0);
const server = await startServer();
let browser;
try {
  browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(installDeterminism);
  await gotoGame(page, `${server.url}/?guide=0&menu=0&rules=0&loadscreen=0&noaudio=1`
    + `&level=${LEVEL}${extraQuery()}`, 'window.__rt');
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(launchLevel, [LEVEL, { car: CAR, ai: Number(process.env.AI || 0) }]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(([aids, pressLater]) => {
    const car = window.__game.car;
    if (aids) car.absOn = car.tcsOn = aids === 'on';
    window.__game.marks && window.__game.marks.clear && window.__game.marks.clear();
    if (!pressLater) dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
  }, [process.env.AIDS || '', pressAt && !releaseAt]);
  const samples = [];
  let worst = 0;
  for (let frame = 0; frame < Number(SECONDS) * 60; frame += 6) {
    if (releaseAt && frame === Math.round(releaseAt * 10) * 6)
      await page.evaluate(() => dispatchEvent(new KeyboardEvent('keyup', { key: 'w' })));
    if (pressAt && frame === Math.round(pressAt * 10) * 6)
      await page.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'w' })));
    const one = await page.evaluate(() => {
      window.__rt.step(6);
      const game = window.__game, car = game.car, telem = car.t || {};
      return { id: car.spec.id, spinF: !!telem.spinF, spinR: !!telem.spinR,
        slip: +(telem.slipSpeedDriven || 0).toFixed(1),
        kph: +(Math.hypot(car.vx, car.vy) * 3.6).toFixed(0), gear: telem.gear,
        rpm: Math.round(telem.rpm || 0), tcs: !!car.tcsOn,
        throttle: +(car.throttleUsed ?? -1).toFixed(2),
        marks: game.marks ? game.marks.stamps : null };
    });
    one.time = +((frame + 6) / 60).toFixed(1);
    samples.push(one);
    if (OUT && one.slip > worst) {
      worst = one.slip;
      await page.screenshot({ path: OUT });
    }
  }
  const spinning = samples.filter((one) => one.spinF || one.spinR).length;
  const first = samples.find((one) => one.spinF || one.spinR);
  const moving = samples.find((one) => one.kph > 0);
  const at100 = samples.find((one) => one.kph >= 100);
  console.log(`  moves at ${moving ? moving.time : '-'} s, first spin ${first ? first.time : '-'} s, `
    + `100 km/h at ${at100 ? at100.time : '-'} s, ${samples.at(-1).kph} km/h at the end`);
  console.log(`${samples[0].id} on ${LEVEL} tcsOn ${samples[0].tcs}: ${spinning} of `
    + `${samples.length} samples spinning; peak slip ${Math.max(...samples.map((one) => one.slip))}`
    + ` m/s; marks ${samples.at(-1).marks}; errors ${errors.length ? errors.join(' | ') : 'none'}`);
  for (const one of samples.filter((each, at) => at % 3 === 0))
    console.log(`  ${String(one.time).padStart(4)} s ${String(one.kph).padStart(4)} km/h g${one.gear}`
      + ` ${String(one.rpm).padStart(5)} rpm thr ${one.throttle} spinF ${one.spinF ? 1 : 0}`
      + ` slip ${one.slip} marks ${one.marks}`);
} finally {
  await browser?.close();
  server.stop();
}
