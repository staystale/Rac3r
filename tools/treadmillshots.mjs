// treadmillshots.mjs — HIGHWAY v2 in a REAL browser at phone sizes: the bench driver drives ~25 s; every frame records where the car
// is ON SCREEN (fraction of W / H) — the treadmill promise is it never leaves; photos along the way; then a scripted REVERSE must
// show the WRONG WAY notice. node tools/treadmillshots.mjs [preset]   -> shots/look/tm-<preset>-<size>-<n>.png
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const preset = process.argv[2] || 'motorway';
const b = await chromium.launch({ channel: 'msedge' });
for (const [w, h, tag] of [[390, 844, 'port'], [844, 390, 'land']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:8080/?touch=1&guide=0&menu=0&level=highway&car=saloon-rwd&hw=${preset}`); await p.touchscreen.tap(w / 2, h / 2); await p.waitForTimeout(3500);
  await p.evaluate(async () => {
    const g = window.__game, A = await import('/src/ai/autodrive.js'); let sub = null, drv = null;
    window.__tm = { fx0: 1, fx1: 0, fy0: 1, fy1: 0, n: 0, mode: 'drive' };
    g.input.update = () => { if (window.__tm.mode === 'reverse') return { steer: 0, throttle: 0, brake: 0, handbrake: 0, reverse: 1, shiftUp: false, shiftDown: false };
      if (g.level.subtrack !== sub) { sub = g.level.subtrack; drv = A.createAutoDriver(sub); } return { ...drv.drive(g.car), reverse: 0, shiftUp: false, shiftDown: false }; };
    const R = g.renderer;
    (function f() { const t = window.__tm; if (t.mode === 'drive' && !R.flying) { const fx = R.sx(g.car.x) / R.W, fy = R.sy(g.car.y) / R.H;
      t.fx0 = Math.min(t.fx0, fx); t.fx1 = Math.max(t.fx1, fx); t.fy0 = Math.min(t.fy0, fy); t.fy1 = Math.max(t.fy1, fy); t.n++; } requestAnimationFrame(f); })();
  });
  for (let k = 1; k <= 3; k++) { await p.waitForTimeout(8000); await p.screenshot({ path: `shots/look/tm-${preset}-${tag}-${k}.png` }); }
  const r = await p.evaluate(() => ({ ...window.__tm, km: (window.__game.hwDist / 1000).toFixed(2), kmh: (Math.hypot(window.__game.car.vx, window.__game.car.vy) * 3.6).toFixed(0), fps: window.__game.fps.toFixed(0) }));
  console.log(`${preset} ${tag} ${w}x${h}: ${r.km} km, now ${r.kmh} km/h, fps ${r.fps} | car on screen over ${r.n} frames: x ${(r.fx0 * 100).toFixed(0)}-${(r.fx1 * 100).toFixed(0)} % of W, y ${(r.fy0 * 100).toFixed(0)}-${(r.fy1 * 100).toFixed(0)} % of H`);
  // REVERSE: stop and back down the road
  await p.evaluate(() => { const c = window.__game.car; c.vx = 0; c.vy = 0; window.__tm.mode = 'reverse'; });
  let seen = null; for (let i = 0; i < 40 && !seen; i++) { await p.waitForTimeout(100); seen = await p.evaluate(() => { const n = window.__game.notice; return n && performance.now() - n.at < 2200 ? n.text : null; }); }
  await p.waitForTimeout(150); await p.screenshot({ path: `shots/look/tm-${preset}-${tag}-reverse.png` });
  console.log(`  reverse -> notice: ${seen || 'NONE (FAIL)'} | page errors: ${errs.length ? errs.join(' / ') : 'none'}`);
  await ctx.close();
}
await b.close();
