// startcheck.mjs — START LIGHTS (user, 2026-10-04): standing start = reds 1-2-3 then GREEN, every car (player + AI) held until green;
// rolling start (ovals) = the game drives ALL cars at pace, green as the front car crosses the line, then released. Timing starts at green.
// Photos of the lights at phone size. node tools/startcheck.mjs
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const fails = [];
for (const [lv, rolling] of [['thruston', false], ['naffcar', true]]) {
  const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8080/?touch=1&guide=0&menu=0'); await p.touchscreen.tap(400, 200); await p.waitForTimeout(800);
  // the player FLOORS it the whole time: held cars must not move before green
  await p.evaluate((lv) => { const g = window.__game; g.launch(lv, 'hatch-rwd', { ai: 3 }); window.__orig = g.input.update; g.input.update = () => ({ steer: 0, throttle: 1, brake: 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false }); }, lv);
  const samples = [];
  for (let i = 0; i < (rolling ? 24 : 12); i++) {
    await p.waitForTimeout(500);
    samples.push(await p.evaluate(() => { const g = window.__game, s = g.start; return { t: +s.t.toFixed(1), green: s.green, held: s.on && !s.green && s.t < s.tGreen - 0.12, v: +(Math.hypot(g.car.vx, g.car.vy) * 3.6).toFixed(0), ai: g.ai.map((a) => +(Math.hypot(a.car.vx, a.car.vy) * 3.6).toFixed(0)), lap: g.lap.started }; }));
    if (i === 5) await p.screenshot({ path: `shots/look/lights-${lv}-red.png` });
    if (samples.at(-1).green && !samples.at(-2)?.green) await p.screenshot({ path: `shots/look/lights-${lv}-green.png` });
  }
  const before = samples.filter((q) => q.held), after = samples.filter((q) => q.green);
  // the lights must be GONE 2 s after green (user bug: they stayed)
  const gone = await p.evaluate(() => new Promise((res) => setTimeout(() => { const s = window.__game.start; res(s.green && s.t - s.tGreen > 1.2); }, 2200)));
  const ok = gone && (rolling
    ? before.length > 2 && before.filter((q) => q.t > 4).every((q) => q.v > 20 && q.v < 75 && q.ai.every((v) => v > 20 && v < 75) && !q.lap) && after.length > 0 && after.at(-1).lap
    : before.length > 2 && before.every((q) => q.v < 1 && q.ai.every((v) => v < 1) && !q.lap) && after.length > 0 && after.at(-1).v > 20 && after.at(-1).lap);
  if (!ok || errs.length) fails.push(lv);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${lv} (${rolling ? 'rolling' : 'standing'}):`, samples.map((q) => `${q.t}${q.green ? 'G' : 'R'} ${q.v}/${q.ai.join(',')}${q.lap ? ' L' : ''}`).join(' | '));
  if (errs.length) console.log('ERRORS', errs);
}
console.log(fails.length ? 'FAILED: ' + fails.join(' ') : 'start lights: all OK');
await b.close();
