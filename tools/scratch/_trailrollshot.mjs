// _trailrollshot.mjs - ?trailroll IN THE REAL GAME: the Scanyah and its curtainsider on the Lab,
// driven flat out to SPEED km/h then held in a hard turn until the trailer goes over; a photo at the
// game's zoom as it lifts (two wheels), as it rolls, lying where it stops, and after RESET (both
// righted); at each the trailer's phase and lean, the pin, the tractor's phase.
// [VIEW=390x844] [SPEED=75] [STEER=0.22] [Q=&night=0.8] [TAG=] [LEVEL=lab]
// node tools/scratch/_trailrollshot.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const SPEED = +(process.env.SPEED || 75), STEER = +(process.env.STEER || 0.22);
const LEVEL = process.env.LEVEL || 'lab';

/** Page side: the rig now. */
function readRig() {
  const car = window.__game.car, trailer = car.trailer;
  return { kmh: Math.round(Math.hypot(car.vx, car.vy) * 3.6),
    tractor: car.roll?.phase ?? 'none', trailer: trailer?.roll?.phase ?? 'none',
    lean: +(trailer?.roll?.phi ?? 0).toFixed(2), pinFree: !!trailer?.pinFree };
}

const server = await startServer();
const browser = await launchBrowser();
// (the page, for driveToRoll)
let page = null;
try {
  page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&trailroll=1`
    + `${process.env.Q || ''}`);
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(1200);
  await page.evaluate(async ([level, speed, steer]) => {
    const game = window.__game;
    game.launch(level, 'scanyah-r450', { ai: 0, traffic: 0,
      weather: { mode: 'dry', season: 2, seed: 4 } });
    await new Promise((done) => setTimeout(done, 2500));
    window.__rollPlan = { speed, steer, turning: false };
    game.input.update = () => {
      const plan = window.__rollPlan, car = game.car;
      if (!plan.turning && Math.hypot(car.vx, car.vy) * 3.6 >= plan.speed) plan.turning = true;
      const off = plan.done;
      return { steer: plan.turning && !off ? plan.steer : 0, throttle: off ? 0 : plan.turning
        ? 0.8 : 1, brake: off ? 1 : 0, handbrake: 0, reverse: 0, shiftUp: false,
      shiftDown: false };
    };
  }, [LEVEL, SPEED, STEER]);
  await page.keyboard.press('ArrowUp');
  const shoot = async (stage) => {
    const rig = await page.evaluate(`(${readRig.toString()})()`);
    await page.screenshot({ path: `tools/scratch/_trailroll-${width}x${height}`
      + `${process.env.TAG || ''}-${stage}.png` });
    console.log(stage, JSON.stringify(rig));
    return rig;
  };
  const waitFor = async (test, seconds) => {
    for (let waited = 0; waited < seconds; waited += 0.05) {
      const rig = await page.evaluate(`(${readRig.toString()})()`);
      if (test(rig)) return true;
      await page.waitForTimeout(50);
    }
    return false;
  };
  // (POSE=1: the roll pictures checked - the rig stopped, the trailer put in each roll state)
  if (process.env.POSE) {
    await page.evaluate(() => { window.__rollPlan.speed = 1e9; });
    await page.waitForTimeout(4000);
    await page.evaluate(() => { window.__rollPlan.done = true; });
    await page.waitForTimeout(3000);
    // (turned round where it stands: its trailer ahead of the camera's view, not off its edge)
    await page.evaluate(async () => {
      const { reset } = await import('/src/vehicle.ts');
      const car = window.__game.car;
      reset(car, car.x, car.y, car.heading + Math.PI);
    });
    await page.waitForTimeout(1500);
    for (const [name, phase, phi] of [['lean', 'tipping', 0.35], ['side', 'side', Math.PI / 2],
      ['roof', 'roof', Math.PI]]) {
      await page.evaluate(([state, angle]) => {
        const trailer = window.__game.car.trailer;
        trailer.pinFree = true;
        trailer.roll = { phase: state, phi: angle, w: 0, still: 1 };
      }, [phase, phi]);
      await page.waitForTimeout(400);
      await shoot('pose-' + name);
    }
    await page.keyboard.press('r');
    await page.waitForTimeout(800);
    await shoot('pose-after-reset');
  } else await driveToRoll(shoot, waitFor);
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}

/**
 * Drives the rig until its trailer goes over: a photo as it lifts, rolls, lies, after RESET.
 * @param shoot takes a photo
 * @param waitFor waits for the rig to pass a test
 */
async function driveToRoll(shoot, waitFor) {
  // (either lifting first: the cab or the trailer - step 3 takes the other over with it)
  if (await waitFor((rig) => rig.trailer !== 'none' || rig.tractor !== 'none', 40))
    await shoot('1-lifts');
  else await shoot('1-never-lifted');
  if (await waitFor((rig) => rig.trailer !== 'none' && rig.trailer !== 'tipping', 6)) {
    await shoot('2-rolls');
    await page.evaluate(() => { window.__rollPlan.done = true; });
    await waitFor((rig) => rig.trailer === 'side' || rig.trailer === 'roof', 6);
    await page.waitForTimeout(1500);
    await shoot('3-lying');
  } else await shoot('2-did-not-roll');
  await page.keyboard.press('r');
  await page.waitForTimeout(800);
  await shoot('4-after-reset');
}
