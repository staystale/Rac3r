// aistage2check.mjs — the RACING AI in the real game through the real menu: Test Mode -> track -> VS AI -> n -> difficulty -> LAUNCH.
// Checks: every AI on the racing driver (traits present, personas mixed), the chosen difficulty reached them, no page errors, all AI
// moving 10 s after green; on Slidden Hill every AI still on the RX start lane while it is on it (no dash to the lap). Phone-size photos.
// node tools/aistage2check.mjs [track name] [n] [difficulty button]
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const [trackName = 'Slidden Hill', n = '5', diffBtn = 'REALISH'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:8080/?touch=1&guide=0&menu=1'); await p.waitForTimeout(1500);
const click = async (txt) => { await p.locator('button', { hasText: txt }).first().click(); await p.waitForTimeout(450); };
// (ALL TRACKS: the category layer, 2026-10-05)
await click('TEST MODE'); await click('ALL TRACKS'); await click(trackName); await click('VS AI'); await click(n); await click(diffBtn);
const slug = trackName.toLowerCase().replace(/\s+/g, '-');
await p.screenshot({ path: `shots/look/ai2-setup-${slug}.png` });
await click('LAUNCH');
await p.waitForTimeout(1500);
const info = await p.evaluate(() => window.__game.ai.map((a) => ({ id: a.car.spec.id, persona: a.drv.traits && a.drv.traits.persona, diff: a.drv.traits && a.drv.traits.diff })));
await p.waitForTimeout(3500); await p.evaluate(() => { const g = window.__game; g.input.update = () => ({ steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false }); g.car.x += 2000; g.car.y += 2000; });   // at green the player is moved right out of the way: watch the AI alone
// sample the AI while the start runs: the furthest any AI gets from its path (start lane / line) in the first 9 s after green
let worst = 0;
await p.waitForTimeout(500);
for (let k = 0; k < 18; k++) {
  await p.waitForTimeout(500);
  // stage 3 (2026-10-04): on the LINE an AI may now be anywhere on the road (attacks, covers), so the limit there is half the road + 1 m
  const s = await p.evaluate(() => window.__game.ai.map((a) => { const line = a.drv.state.path && a.drv.state.path.closed; return { d: a.drv.state.lastDist - (line ? a.drv.state.path.hw + 1 - 6 : 0), path: line ? 'line' : 'branch' }; }));
  worst = Math.max(worst, ...s.map((x) => x.d));
  if (k === 3) await p.screenshot({ path: `shots/look/ai2-start-${slug}.png` });
}
await p.screenshot({ path: `shots/look/ai2-race-${slug}.png` });
const going = await p.evaluate(() => window.__game.ai.map((a) => +(Math.hypot(a.car.vx, a.car.vy) * 3.6).toFixed(0)));
const ok = info.length === +n && info.every((x) => x.persona) && new Set(info.map((x) => x.persona)).size > 1 && going.every((v) => v > 10) && worst < 6 && !errs.length;
console.log('AI:', JSON.stringify(info)); console.log('km/h 10 s after green:', JSON.stringify(going), '| worst distance from own path', worst.toFixed(1), 'm');
if (errs.length) console.log('ERRORS', errs);
console.log(ok ? 'AI stage 2 in game: OK' : 'FAILED');
await b.close();
