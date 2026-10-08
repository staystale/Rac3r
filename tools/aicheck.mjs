// aicheck.mjs — AI stage 1 through the REAL menu (user flow): Test Mode -> track -> VS AI -> n -> LAUNCH. Checks: n AI cars, each its own
// livery, held still on the grid until the GREEN light (start lights, 2026-10-04), then driving; no page errors. Photos at phone size.
// node tools/aicheck.mjs [track name] [n]
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const [trackName = 'Thruston', n = '3'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:8080/?touch=1&guide=0&menu=1'); await p.waitForTimeout(1500);
const click = async (txt) => { await p.locator('button', { hasText: txt }).first().click(); await p.waitForTimeout(450); };
// (ALL TRACKS: the category layer, 2026-10-05)
await click('TEST MODE'); await click('ALL TRACKS'); await click(trackName); await click('VS AI'); await click(n);
await p.screenshot({ path: 'shots/look/ai-setup-390.png' });
await click('LAUNCH');
await p.waitForTimeout(2500);
const held = await p.evaluate(() => ({ n: window.__game.ai.length, hold: !window.__game.start.green, v: window.__game.ai.map((a) => +Math.hypot(a.car.vx, a.car.vy).toFixed(2)), ids: window.__game.ai.map((a) => a.car.spec.id) }));
await p.evaluate(() => { window.__game.input.update = () => ({ steer: 0, throttle: 1, brake: 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false }); });
await p.waitForTimeout(6000);   // lights: green at 4 s
const going = await p.evaluate(() => ({ hold: !window.__game.start.green, v: window.__game.ai.map((a) => +(Math.hypot(a.car.vx, a.car.vy) * 3.6).toFixed(0)) }));
await p.screenshot({ path: 'shots/look/ai-race-390.png' });
const ok = held.n === +n && held.hold && held.v.every((v) => v < 0.2) && new Set(held.ids).size === +n && !going.hold && going.v.every((v) => v > 10) && !errs.length;
console.log('on the grid:', JSON.stringify(held)); console.log('after the player goes:', JSON.stringify(going)); if (errs.length) console.log('ERRORS', errs);
console.log(ok ? 'AI stage 1: all OK' : 'FAILED');
await b.close();
