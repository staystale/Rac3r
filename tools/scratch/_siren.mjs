// _siren.mjs - THE POLICE SIREN (?siren=1) in the real game, the highway with the autopilot driving
// and your heat held at 3 stars (chasers sent, their light bars going), the sound on (no ?noaudio).
//   PART=live    with ?siren=1 and the menu (so P pauses): each 0.5 s for 6 s the chasers lit near
//                you and the siren voices sounding (audio.sirensOn); then P (pause) - the voices
//                after 0.5 s; P's menu RESUME - the voices again; the heat cleared (the chase given
//                up) - the voices after the chasers stop; a chase again, then the pause menu's MAIN
//                MENU - the voices after 0.5 s; the audio context's state
//   PART=frames  frame work at CPU x4 for 15 s once 2 chasers are lit within 120 m (as
//                _hwframes.mjs; CPU=1 for x1): run it once plain and once with "&siren=1" as the
//                argument; then the siren step itself timed (stepSirens, 5000 calls)
// CHECK_PORT=8092 [PART=live|frames] node tools/scratch/_siren.mjs [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const PART = process.env.PART || 'live', EXTRA = process.argv[2] || '';
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
// the heat held at 3 stars (no escape while measuring), until __holdStars is set to null
const holdStars = (page) => page.evaluate(() => {
  window.__holdStars = 3;
  window.__holder = setInterval(() => {
    const orders = window.__game.traffic.police(), heat = orders.heats.get(window.__game.car);
    if (!heat || window.__holdStars == null || window.__game.busted) return;
    heat.stars = Math.max(heat.stars, window.__holdStars);
    heat.escapeT = 0;
  }, 50);
});
// the police cars lit (chasing) and their distances from you, m; the siren voices sounding
const sample = (page) => page.evaluate(() => {
  const game = window.__game, car = game.car;
  const lit = game.traffic.list.filter((slot) => !slot.parked && slot.car.police && slot.car.blues)
    .map((slot) => Math.round(Math.hypot(slot.car.x - car.x, slot.car.y - car.y)));
  return { lit, voices: game.audio.sirensOn, paused: game.paused, mode: game.mode,
    audio: game.audio.state };
});
const show = (label, got) => console.log(`${label}: lit chasers at [${got.lit.join(', ')}] m,`
  + ` voices ${got.voices}, paused ${got.paused}, mode ${got.mode}, audio ${got.audio}`);

/**
 * Waits (up to ~40 s) until `count` chasers are lit within `nearM` of you.
 * @param {import('playwright').Page} page the page
 * @param {number} count chasers
 * @param {number} nearM m
 */
async function waitForChasers(page, count, nearM) {
  for (let waited = 0; waited < 80; waited++) {
    const got = await sample(page);
    if (got.lit.filter((gap) => gap < nearM).length >= count) return got;
    await page.waitForTimeout(500);
  }
  return sample(page);
}

/** The live check: the voices against the chase, the pause and the chase's end. */
async function live(page) {
  await gotoGame(page, `${server.url}/?pc=1&menu=1&guide=0&rules=0&autopilot=1&siren=1${EXTRA}`);
  await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road: 'motorway', scenery: 'countryside', traffic: 0.6 }));
  // (the menu's own launch hides it; a tool's launch hides it here)
  await page.evaluate(() => window.__game.menu.hide());
  // (a click: the gesture that lets the audio context run)
  await page.mouse.click(422, 120);
  await page.waitForTimeout(5000);
  show('before the heat', await sample(page));
  await holdStars(page);
  show('chasers near', await waitForChasers(page, 1, 120));
  for (let i = 0; i < 12; i++) {
    show(`  t+${(i * 0.5).toFixed(1)} s`, await sample(page));
    await page.waitForTimeout(500);
  }
  await page.keyboard.press('p');
  await page.waitForTimeout(500);
  show('paused 0.5 s', await sample(page));
  await page.getByText('RESUME', { exact: false }).first().click();
  await page.waitForTimeout(500);
  show('resumed 0.5 s', await sample(page));
  await page.evaluate(() => {
    window.__holdStars = null;
    const heat = window.__game.traffic.police().heats.get(window.__game.car);
    if (heat) heat.stars = 0;
  });
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    show(`heat cleared +${((i + 1) * 0.5).toFixed(1)} s`, await sample(page));
  }
  // a chase again, then the pause's MAIN MENU
  await page.evaluate(() => {
    window.__holdStars = 3;
  });
  show('chase again', await waitForChasers(page, 1, 120));
  await page.keyboard.press('p');
  await page.waitForTimeout(300);
  await page.getByText('MAIN MENU', { exact: false }).first().click();
  await page.waitForTimeout(500);
  show('main menu 0.5 s', await sample(page));
}

/** The frame A/B: our rAF work at CPU x4 with chasers lit near. */
async function frames(page, context) {
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.__work = [];
    window.requestAnimationFrame = (cb) => raf((time) => {
      const t0 = performance.now();
      try { cb(time); } finally { window.__work.push(performance.now() - t0); }
    });
  });
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&autopilot=110${EXTRA}`);
  await page.touchscreen.tap(400, 200);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, road: 'motorway', scenery: 'countryside', traffic: 0.6,
      weather: { mode: 'dry', season: 2, seed: 4 } }));
  await page.waitForTimeout(5000);
  await holdStars(page);
  show('chasers near', await waitForChasers(page, 2, 120));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU || 4) });
  const result = await page.evaluate(async () => {
    const start = window.__work.length;
    await new Promise((done) => setTimeout(done, 15000));
    return window.__work.slice(start);
  });
  // the siren's whole per-frame step (game/sirens.ts: the nearest chasers, the voices' params),
  // timed over 5000 calls with the chasers lit (with ?siren=1 its voices are live)
  const stepUs = await page.evaluate(async () => {
    const { stepSirens } = await import('/src/game/sirens.ts');
    const t0 = performance.now();
    for (let i = 0; i < 5000; i++) stepSirens();
    return (performance.now() - t0) / 5000 * 1000;
  });
  console.log(`stepSirens: ${stepUs.toFixed(2)} us a call (CPU x${process.env.CPU || 4})`);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  show('after', await sample(page));
  const work = result.sort((first, second) => first - second);
  const at = (share) => work[Math.floor(share * (work.length - 1))].toFixed(2);
  console.log(`[${EXTRA || 'plain'}] frames ${work.length}, work median ${at(0.5)} p95 ${at(0.95)}`
    + ` worst ${work[work.length - 1].toFixed(1)} ms, over 14 ms`
    + ` ${work.filter((ms) => ms > 14).length}`);
}

try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: PART === 'frames' ? 3 : 1, isMobile: PART === 'frames',
    hasTouch: PART === 'frames' });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  if (PART === 'frames') await frames(page, context);
  else await live(page);
} finally {
  await browser.close();
  server.stop();
  console.log(errors.length ? 'PAGE ERRORS:\n  ' + errors.join('\n  ') : 'no page errors');
}
