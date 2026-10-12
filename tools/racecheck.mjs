// racecheck.mjs — the RX RACE on a joker level (user, 2026-10-04: 5 laps from the grid, joker once, missed = +5 s). Two races in the
// live game, driven by the autodriver at 4x sim speed-up: (A) never takes the joker -> FINISH with +10 s; (B) the car is put through
// the joker gate on lap 2 -> JOKER DONE, no penalty. Also: the arrow hides after the joker; practice mode never starts a race.
// Starts its own server. node tools/racecheck.mjs [level]
import { startServer, launchBrowser } from './lib/browser.mjs';
const lv = process.argv[2] || 'slidden-hill';
const srv = await startServer();
let b;
try {
b = await launchBrowser();
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(srv.url + '/?pc=1&guide=0&menu=0'); await p.mouse.click(400, 200); await p.waitForTimeout(800);
const fails = [];
const run = (takeJoker) => p.evaluate(([lv, takeJoker]) => new Promise(async (res) => {
  const g = window.__game; g.launch(lv, 'rally-4x4', { rx: true });
  const A = await import('/src/ai/autodrive.js'); const drv = A.createAutoDriver(g.level.subtrack);
  g.input.update = () => ({ ...drv.drive(g.car), reverse: 0, shiftUp: false, shiftDown: false });
  let jumped = false; const t0 = performance.now();
  (function f() {
    const r = g.race;
    if (takeJoker && !jumped && g.lap.lap === 2) { const gt = g.level.joker.gate; g.car.x = gt.x; g.car.y = gt.y; jumped = true; }
    if (takeJoker === 2 && jumped && jumped !== 2 && g.lap.lap === 3) { const gt = g.level.joker.gate; g.car.x = gt.x; g.car.y = gt.y; jumped = 2; }
    if (r.done || performance.now() - t0 > 480000) return res({ on: r.on, done: r.done, joker: r.joker, jokers: r.jokers, penalty: r.penalty, total: r.total, t: r.t, lap: g.lap.lap });
    requestAnimationFrame(f);
  })();
}), [lv, takeJoker]);
// speed the sim up: the game steps on the wall clock, so give it time; 5 laps of ~60 s each
const A = await run(false);
console.log('A (no joker):', JSON.stringify(A));
if (!(A.done && !A.joker && A.penalty === 30 && Math.abs(A.total - A.t - 30) < 1e-6)) fails.push('A');
const B = await run(true);
console.log('B (joker on lap 2):', JSON.stringify(B));
if (!(B.done && B.joker && B.penalty === 0)) fails.push('B');
const C = await run(2);
console.log('C (joker on laps 2 AND 3):', JSON.stringify(C));
if (!(C.done && C.penalty === 30)) fails.push('C');
const prac = await p.evaluate((lv) => { const g = window.__game; g.launch(lv, 'rally-4x4', {}); return g.race.on; }, lv);
console.log('practice starts a race?', prac); if (prac) fails.push('practice');
if (errs.length) { console.log('PAGE ERRORS', errs); fails.push('errors'); }
console.log(fails.length ? 'FAILED: ' + fails.join(' ') : 'RX race: all OK');
await b.close();
} finally {
  await b?.close();
  srv.stop();
}
