// hwwobble.mjs — "it almost looks like a skip or like a camera issue" (user, 2026-10-06, the endless highway on a phone). Per frame, the
// player driven by the highway weaver: the camera, the car relative to the camera, the frame time, the zoom. A SKIP is a frame whose
// camera move differs from the one predicted by the last move (time-corrected): each one is put in a bucket by its cause —
//   SLOW  the frame itself took > 25 ms (the picture was late, the world jumped to catch up: drawing / sim cost)
//   AFTER the frame after a slow one (the catch-up step is uneven)
//   CAM   neither: a normal-length frame and the camera still jumped (a camera / interpolation fault)
// node tools/hwwobble.mjs [seconds 20] [cpu 1] [ai 0] [traffic 0] [extra query]
import { startServer, launchBrowser } from './lib/browser.mjs';
const SEC = +(process.argv[2] || 20), CPU = +(process.argv[3] || 1), AI = +(process.argv[4] || 0), TR = process.argv[5] || '0', extra = process.argv[6] || '';
const srv = await startServer();
let b;
try {
b = await launchBrowser();
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`${srv.url}/?touch=1&guide=0&menu=0&rules=0&level=highway&traffic=${TR}${extra}`); await p.waitForTimeout(1500);
await p.touchscreen.tap(400, 200); await p.waitForTimeout(800);
await p.evaluate((n) => window.__game.launch('highway', 'saloon-rwd', { ai: n, diff: 2, traffic: +new URLSearchParams(location.search).get('traffic') }), AI);
await p.waitForTimeout(2500);
await p.evaluate(async () => { const g = window.__game, H = await import('/src/hwrace.js'), A = await import('/src/aidriver.js');
  const drv = A.createAIDriver(g.level, A.aiTraits(4, 0, 1));
  g.input.update = () => { const others = [...g.ai.map((a) => a.car), ...g.traffic.cars]; H.hwFrames(g.level, [g.car, ...others]);
    return { ...drv.drive(g.car, 1 / 60, { cars: others }), reverse: 0, shiftUp: false, shiftDown: false }; }; });
await p.waitForTimeout(4000);   // up to speed
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
const rows = await p.evaluate((SEC) => new Promise((res) => {
  const g = window.__game, R = g.renderer, out = []; let last = performance.now(); const tEnd = last + SEC * 1000;
  (function f(now) {
    out.push({ dt: now - last, cx: R.cam.x, cy: R.cam.y, ppm: R.PPM, ox: g.drawn.x - R.cam.x, oy: g.drawn.y - R.cam.y, v: Math.hypot(g.car.vx, g.car.vy), N: R.drawnN, steps: g.stepsLastFrame, moved: g.level._hw.pts[0].s });
    last = now; if (now < tEnd) requestAnimationFrame(f); else res(out);
  })(performance.now());
}), SEC);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const R = rows.slice(5), pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(q * (s.length - 1))] : 0; };
const skips = { SLOW: 0, AFTER: 0, CAM: 0 }, camJ = [], carW = [], camEx = [], zEdge = [];
for (let i = 1; i < R.length; i++) zEdge.push(Math.abs(R[i].ppm - R[i - 1].ppm) / R[i - 1].ppm * 422);   // px the screen EDGE moves from a zoom change
for (let i = 2; i < R.length; i++) {
  const a = R[i - 2], b1 = R[i - 1], c = R[i];
  const v1x = (b1.cx - a.cx) / b1.dt, v1y = (b1.cy - a.cy) / b1.dt, px = b1.cx + v1x * c.dt, py = b1.cy + v1y * c.dt;
  const j = Math.hypot(c.cx - px, c.cy - py) * c.ppm; camJ.push(j);
  carW.push(Math.hypot(c.ox - b1.ox, c.oy - b1.oy) * c.ppm);
  if (j > 3) { const k = c.dt > 25 ? 'SLOW' : b1.dt > 25 ? 'AFTER' : 'CAM'; skips[k]++; if (k === 'CAM' && camEx.length < 6) camEx.push(`@${i} jerk ${j.toFixed(1)} px dt ${a.dt.toFixed(0)}/${b1.dt.toFixed(0)}/${c.dt.toFixed(0)} ms steps ${a.steps}/${b1.steps}/${c.steps} car-on-screen moved ${(Math.hypot(c.ox - b1.ox, c.oy - b1.oy) * c.ppm).toFixed(1)} px window ${c.moved !== b1.moved ? 'MOVED' : '-'}`); }
}
const dts = R.map((x) => x.dt);
console.log(`highway CPU x${CPU} ai ${AI} traffic ${TR}: ${R.length} frames, mean ${(R.reduce((s, x) => s + x.v, 0) / R.length * 3.6).toFixed(0)} km/h`);
console.log(`  frame ms: median ${pct(dts, 0.5).toFixed(1)} p95 ${pct(dts, 0.95).toFixed(1)} max ${Math.max(...dts).toFixed(1)} | > 25 ms: ${dts.filter((x) => x > 25).length}`);
console.log(`  CAMERA jerk px: median ${pct(camJ, 0.5).toFixed(2)} p95 ${pct(camJ, 0.95).toFixed(2)} max ${Math.max(...camJ).toFixed(1)}`);
console.log(`  SKIPS (> 3 px): ${skips.SLOW + skips.AFTER + skips.CAM} = slow frame ${skips.SLOW}, frame after a slow one ${skips.AFTER}, CAMERA with normal frames ${skips.CAM}`);
console.log(`  CAR on screen moves px/frame: median ${pct(carW, 0.5).toFixed(2)} p95 ${pct(carW, 0.95).toFixed(2)} max ${Math.max(...carW).toFixed(1)}`);
console.log(`  ZOOM moves the screen edge px/frame: median ${pct(zEdge, 0.5).toFixed(2)} p95 ${pct(zEdge, 0.95).toFixed(2)} max ${Math.max(...zEdge).toFixed(1)} | frames > 2 px: ${zEdge.filter((x) => x > 2).length}`);
// the DRAWN zoom (art px per tile, render.ts drawnN): every change rescales the whole picture by 1/N at once; a change straight back
// (N, N+1, N) within 10 frames = the zoom flickering on a rounding boundary
{ let ch = 0, back = 0; const at = [];
  for (let i = 1; i < R.length; i++) if (R[i].N !== R[i - 1].N) { ch++; at.push(i); }
  for (let k = 1; k < at.length; k++) if (at[k] - at[k - 1] <= 10 && R[at[k]].N === R[at[k - 1] - 1].N) back++;
  const N = R[R.length >> 1].N;
  console.log(`  DRAWN ZOOM steps: ${ch} in ${R.length} frames (one every ${(R.length / Math.max(1, ch)).toFixed(0)} frames), each ${(100 / N).toFixed(2)} % = ${(422 / N).toFixed(1)} px at the screen edge | flicker back within 10 frames: ${back}`); }
for (const e of camEx) console.log('   cam ' + e);
console.log('errors', errs.length ? errs.slice(0, 3).join(' || ') : 'none');
await b.close();
} finally {
  await b?.close();
  srv.stop();
}
