// _stuckshot.mjs - BUG 8 (?stuckreset=1) PHOTOS in the real game, drawn: an AI racer made stuck
// in view (its engine's power taken away, put on the grass beside you after the green), photographed
// stuck (3 s), just after the game puts it back (its hazards on) and 2 s after (power given back);
// then a highway car wrecked in the next lane 25 m ahead of you (you stopped), photographed at 3 s
// and 7.5 s (with the switch it has gone after 6 s; without it, still there).
// SHOTS=<folder> VIEW=844x390 [LEVEL=thruston] [RAC3R_QUERY=stuckreset=1] node tools/scratch/_stuckshot.mjs
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const SHOTS = process.env.SHOTS || 'stuckshots';
const [VIEW_W, VIEW_H] = (process.env.VIEW || '844x390').split('x').map(Number);
const LEVEL = process.env.LEVEL || 'thruston';
const TAG = `${(process.env.RAC3R_QUERY || '').includes('stuckreset=1') ? 'on' : 'off'}-${VIEW_W}x${VIEW_H}`;

const wait = (page, ms) => page.waitForTimeout(ms);
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}-${TAG}.png` });

/** Page side: you held still; AI #0 on the grass beside you with no power. */
function strandAi() {
  const game = window.__game, car = game.car, rival = game.ai[0].car;
  game.input.update = () => ({ steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0,
    shiftUp: false, shiftDown: false });
  const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  Object.assign(rival, { x: car.x + cos * 2 + sin * 7, y: car.y + sin * 2 - cos * 7,
    heading: car.heading + 1.2, vx: 0, vy: 0, yawRate: 0, _p: null });
  rival.mods.power = 0;
  window.__strand = { x: rival.x, y: rival.y };
}

/** Page side: whether AI #0 has been put back (moved over 5 m from where it was stranded). */
function aiMoved() {
  const rival = window.__game.ai[0].car, from = window.__strand;
  return Math.hypot(rival.x - from.x, rival.y - from.y) > 5;
}

/** Page side: a traffic car 25 m ahead in the next lane, wrecked and stopped; you held still. */
function wreckAhead() {
  const game = window.__game, car = game.car;
  game.input.update = () => ({ steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0,
    shiftUp: false, shiftDown: false });
  car.vx = car.vy = 0;
  const slot = game.traffic.list.find((item) => !item.parked && !item.police && !item.broke
    && (item.dir ?? 1) > 0);
  const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  Object.assign(slot.car, { x: car.x + cos * 25 + sin * 3.6, y: car.y + sin * 25 - cos * 3.6,
    heading: car.heading, vx: 0, vy: 0, yawRate: 0, _p: null });
  slot.wreck = true;
  slot.kin = false;
  window.__wreck = slot;
  return true;
}

mkdirSync(SHOTS, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: VIEW_W, height: VIEW_H } });
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1&loadscreen=0`
    + extraQuery());
  await page.mouse.click(VIEW_W / 2, VIEW_H / 2);
  await wait(page, 800);
  await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd', { ai: 3 }), LEVEL);
  for (let tries = 0; tries < 40; tries++) {
    if (await page.evaluate(() => window.__game.start?.green)) break;
    await wait(page, 500);
  }
  await wait(page, 6000);
  await page.evaluate(strandAi);
  await wait(page, 3000);
  await shot(page, 'ai-1-stuck');
  let putBack = null;
  const watchLog = [];
  for (let tries = 0; tries < 120 && !putBack; tries++) {
    await wait(page, 100);
    if (await page.evaluate(aiMoved)) putBack = 3 + tries / 10;
    if (tries % 10 === 0) watchLog.push(await page.evaluate(() => {
      const entry = window.__game.ai[0];
      return `${(entry.stuckWatch?.t ?? 0).toFixed(1)}/${(entry.progressT ?? 0).toFixed(1)}`;
    }));
  }
  await shot(page, 'ai-2-putback');
  await page.evaluate(() => { window.__game.ai[0].car.mods.power = 1; });
  await wait(page, 2000);
  await shot(page, 'ai-3-after');
  console.log(`${TAG} ${LEVEL}: AI put back ${putBack === null ? 'NOT within 15 s'
    : `after ~${putBack.toFixed(1)} s`} (watch s / no-progress s each 1 s: ${watchLog.join(' ')})`);
  await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, traffic: 1, road: 'motorway' }));
  await wait(page, 4000);
  await page.evaluate(wreckAhead);
  await wait(page, 3000);
  await shot(page, 'traffic-1-wreck');
  await wait(page, 4500);
  const gone = await page.evaluate(() => window.__wreck.parked || !window.__wreck.wreck);
  await shot(page, 'traffic-2-later');
  console.log(`${TAG} highway: the wreck in view after 7.5 s ${gone ? 'GONE' : 'still there'}`);
} finally {
  await browser.close();
  server.stop();
}
console.log(errors.length ? 'PAGE ERRORS ' + [...new Set(errors)].slice(0, 3).join(' | ')
  : 'page errors none');
