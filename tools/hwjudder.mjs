// hwjudder.mjs — JUDDER on the endless highway at phone-ish CPU (CDP throttle x4, phone landscape). The player's car is driven by
// the highway weaver (hwrace.js); every frame records: interval, sim / draw ms (un-smoothed from game.simMs / drawMs), ground tiles
// painted, whether the road window moved (stepHighway rebuild), loose objects spawned, the stand-in showing. Then it says which of
// those the SLOW frames (> 25 ms) coincide with. Built 2026-10-06 (user: "judder on mobile on infinite levels - guess thats as chunks load").
// node tools/hwjudder.mjs [seconds 20] [ai 5] [traffic 1] [cpu 4] [extra query]
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const SEC = +(process.argv[2] || 20), AI = +(process.argv[3] || 5), TR = process.argv[4] || '1', CPU = +(process.argv[5] || 4), extra = process.argv[6] || '';
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://localhost:8080/?touch=1&guide=0&menu=0&rules=0&level=highway&traffic=${TR}${extra}`); await p.waitForTimeout(1500);
await p.touchscreen.tap(400, 200); await p.waitForTimeout(800);
await p.evaluate((n) => window.__game.launch('highway', 'saloon-rwd', { ai: n, diff: 2, traffic: +new URLSearchParams(location.search).get('traffic') }), AI);
await p.waitForTimeout(2500);   // fly-in done
console.log('state', JSON.stringify(await p.evaluate(() => { const g = window.__game; return { on: g.start.on, green: g.start.green, rolling: g.start.rolling, menu: g.menu && g.menu.open, lvl: g.level.id }; })));
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
const r = await p.evaluate((SEC) => new Promise(async (res) => {
  const g = window.__game, H = await import('/src/hwrace.js'), A = await import('/src/aidriver.js');
  const drv = A.createAIDriver(g.level, A.aiTraits(4, 0, 1));
  g.input.update = () => { const others = [...g.ai.map((a) => a.car), ...g.traffic.cars]; H.hwFrames(g.level, [g.car, ...others]);
    return { ...drv.drive(g.car, 1 / 60, { cars: others }), reverse: 0, shiftUp: false, shiftDown: false }; };
  const F = []; let last = performance.now(), sim0 = g.simMs || 0, draw0 = g.drawMs || 0, tl0 = g.renderer.groundRenders, s0 = g.level._hw.pts[0].s, ms0 = g.renderer.tileMs;
  const cn0 = () => (g.cones.list || g.cones.items || []).length;
  let c0 = cn0(); const tEnd = last + SEC * 1000, st0 = g.renderer.staleRepaints || 0;
  function f(now) {
    const sim = g.simMs || 0, draw = g.drawMs || 0, tl = g.renderer.groundRenders, s = g.level._hw.pts[0].s, cn = cn0(), tm = g.renderer.tileMs;
    F.push({ dt: now - last, sim: (sim - 0.9 * sim0) / 0.1, draw: (draw - 0.9 * draw0) / 0.1, tiles: tl - tl0, tileMs: tm - ms0, moved: s !== s0 ? 1 : 0, cones: cn - c0,
      // bare = a stand-in frame where the CAR is outside the overview (so the road round it is missing, not just fields at the edge)
      stand: g.renderer.standInFrame ? 1 : 0, bare: (() => { const o = g.renderer.overviewBounds, c = g.car; return g.renderer.standInFrame && (!o || c.x < o[0] || c.y < o[1] || c.x > o[2] || c.y > o[3]) ? 1 : 0; })(), steps: g.stepsLastFrame, v: Math.hypot(g.car.vx, g.car.vy) * 3.6, z: g.renderer.zoom });
    last = now; sim0 = sim; draw0 = draw; tl0 = tl; s0 = s; c0 = cn; ms0 = tm;
    if (now < tEnd) requestAnimationFrame(f); else res({ F, km: g.hwDist / 1000, stale: g.renderer.staleRepaints - st0, alive: g.renderer.tileCount });
  }
  requestAnimationFrame(f);
}), SEC);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
// SHOT=1: photograph the first frame with bare ground showing (stand-in outside the overview), after the run
if (process.env.SHOT) { const got = await p.evaluate(() => new Promise((res) => { const g = window.__game; let n = 0;
  function f() { const o = g.renderer.overviewBounds, v = g.renderer.viewBounds;
    if (g.renderer.standInFrame && (!o || v[0] < o[0] || v[1] < o[1] || v[2] > o[2] || v[3] > o[3])) { g.paused = true; res(true); } else if (++n < 1200) requestAnimationFrame(f); else res(false); }
  requestAnimationFrame(f); }));
  if (got) await p.screenshot({ path: 'shots/look/hj-bare.png' }); console.log('bare shot', got); }
const F = r.F.slice(5), N = F.length, srt = F.map((x) => x.dt).sort((a, b) => a - b), pct = (q) => srt[Math.floor(q * (N - 1))].toFixed(1);
const avg = (a, k) => a.length ? (a.reduce((s, x) => s + x[k], 0) / a.length).toFixed(1) : '-';
const slow = F.filter((x) => x.dt > 25);
console.log(`${SEC}s, ${r.km.toFixed(2)} km, mean ${avg(F, 'v')} km/h, CPU x${CPU}, ai ${AI}, traffic ${TR}: ${N} frames | median ${pct(0.5)} p95 ${pct(0.95)} p99 ${pct(0.99)} worst ${srt[N - 1].toFixed(1)} ms | >25 ms ${slow.length} (${(100 * slow.length / N).toFixed(1)} %) >40 ms ${F.filter((x) => x.dt > 40).length}`);
console.log(`all frames : sim ${avg(F, 'sim')} draw ${avg(F, 'draw')} ms | tiles painted ${F.reduce((s, x) => s + x.tiles, 0)} (${(F.reduce((s, x) => s + x.tileMs, 0) / Math.max(1, F.reduce((s, x) => s + x.tiles, 0))).toFixed(1)} ms each) | of them wear repaints ${r.stale} | window moves ${F.reduce((s, x) => s + x.moved, 0)} | stand-in frames ${F.reduce((s, x) => s + x.stand, 0)}, of them with the car outside the overview (road missing) ${F.reduce((s, x) => s + x.bare, 0)}`);
console.log(`slow frames: sim ${avg(slow, 'sim')} draw ${avg(slow, 'draw')} ms | with a tile ${slow.filter((x) => x.tiles).length} | with a window move ${slow.filter((x) => x.moved).length} | with cones spawned ${slow.filter((x) => x.cones > 0).length} | steps>=3 ${slow.filter((x) => x.steps >= 3).length}`);
const fast = F.filter((x) => x.dt <= 25);
console.log(`ok frames  : sim ${avg(fast, 'sim')} draw ${avg(fast, 'draw')} ms | with a tile ${fast.filter((x) => x.tiles).length} | with a window move ${fast.filter((x) => x.moved).length}`);
const mv = F.map((x, i) => x.moved ? i : -1).filter((i) => i >= 0);
for (const i of mv.slice(0, 4)) console.log('  move @' + i + ': ' + F.slice(Math.max(0, i - 1), i + 3).map((x) => `${x.dt.toFixed(0)}ms(s${x.sim.toFixed(0)} d${x.draw.toFixed(0)} t${x.tiles})`).join(' '));
const worst = F.map((x, i) => [x, i]).sort((a, b) => b[0].dt - a[0].dt).slice(0, 8);
for (const [x, i] of worst) console.log(`  worst @${i}: ${x.dt.toFixed(0)} ms sim ${x.sim.toFixed(1)} draw ${x.draw.toFixed(1)} tiles ${x.tiles} (${x.tileMs.toFixed(0)} ms) moved ${x.moved} cones ${x.cones} steps ${x.steps} ${x.v.toFixed(0)} km/h`);
console.log(`zoom: median ${[...F].map((x) => x.z).sort((a, b) => a - b)[N >> 1]?.toFixed?.(3)}, tiles alive at the end ${r.alive}`);
console.log('errors', errs.length ? errs.slice(0, 3).join(' || ') : 'none');
await b.close();
