// wobblecheck.mjs — WHAT moves on screen when "the track shakes / wiggles as I drive" (user, 2026-10-04, after the tile fix). Phone size,
// autodrive lap at CPU x1 and x4. Per frame: the camera (= where the world is drawn), the car relative to the camera, the car's heading,
// the zoom, the frame time. Reports, in SCREEN pixels: camera jerk (how far each frame's camera move differs from the previous frame's,
// time-corrected — a smooth pan is 0), the car's wobble on screen, heading jitter (deg per frame, second difference), and frame times.
// node tools/wobblecheck.mjs [level] [car] [cpuRate]
import { startServer, launchBrowser } from './lib/browser.mjs';
const [lv = 'brands-snatch', carId = 'hatch-rwd', rate = '1', extra = ''] = process.argv.slice(2);
const srv = await startServer();
let b;
try {
b = await launchBrowser();
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +rate });
await p.goto(`${srv.url}/?touch=1&guide=0&menu=0&level=${lv}&car=${carId}${extra}`); await p.touchscreen.tap(400, 200); await p.waitForTimeout(4500);
const r = await p.evaluate(() => new Promise(async (res) => {
  const g = window.__game, R = g.renderer; const A = await import('/src/ai/autodrive.ts'); const drv = A.createAutoDriver(g.level.subtrack);
  g.input.update = () => ({ ...drv.drive(g.car), reverse: 0, shiftUp: false, shiftDown: false });
  const rows = []; let last = performance.now();
  (function f(now) {
    rows.push({ t: now, dt: now - last, cx: R.cam.x, cy: R.cam.y, ppm: R.PPM, ox: g.drawn.x - R.cam.x, oy: g.drawn.y - R.cam.y, h: g.car.heading, v: Math.hypot(g.car.vx, g.car.vy) });
    last = now; if (rows.length < 900) requestAnimationFrame(f); else res(rows);
  })(performance.now());
}));
const rows = r.slice(20), sd = (a) => { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))]; };
const jerk = [], carW = [], hj = [], fast = [], zEdge = [];
for (let i = 2; i < rows.length; i++) {
  const a = rows[i - 2], b1 = rows[i - 1], c = rows[i];
  if (c.v < 15) continue; fast.push(c.v);
  const v1x = (b1.cx - a.cx) / b1.dt, v1y = (b1.cy - a.cy) / b1.dt, px = b1.cx + v1x * c.dt, py = b1.cy + v1y * c.dt;   // predicted from the last move
  jerk.push(Math.hypot(c.cx - px, c.cy - py) * c.ppm);
  zEdge.push(Math.abs(c.ppm - b1.ppm) / b1.ppm * 422);   // how far the screen EDGE moves from a zoom change this frame
  carW.push(Math.hypot(c.ox - b1.ox, c.oy - b1.oy) * c.ppm);
  let d1 = b1.h - a.h, d2 = c.h - b1.h; d1 = Math.atan2(Math.sin(d1), Math.cos(d1)); d2 = Math.atan2(Math.sin(d2), Math.cos(d2));
  hj.push(Math.abs(d2 / c.dt - d1 / b1.dt) * c.dt * 180 / Math.PI);
}
const dts = rows.map((q) => q.dt);
console.log(`${lv} / ${carId} CPU x${rate}: ${jerk.length} fast frames (> 54 km/h, mean ${(fast.reduce((s, x) => s + x, 0) / fast.length * 3.6).toFixed(0)} km/h)`);
console.log(`  frame ms: median ${pct(dts, 0.5).toFixed(1)}  p95 ${pct(dts, 0.95).toFixed(1)}  max ${Math.max(...dts).toFixed(1)}  | over 20 ms: ${dts.filter((x) => x > 20).length}`);
console.log(`  CAMERA jerk px: median ${pct(jerk, 0.5).toFixed(2)}  p95 ${pct(jerk, 0.95).toFixed(2)}  max ${Math.max(...jerk).toFixed(1)}  | frames > 2 px: ${jerk.filter((x) => x > 2).length}`);
console.log(`  CAR on screen moves px/frame: median ${pct(carW, 0.5).toFixed(2)}  p95 ${pct(carW, 0.95).toFixed(2)}  max ${Math.max(...carW).toFixed(1)}`);
console.log(`  ZOOM moves the screen edge px/frame: median ${pct(zEdge, 0.5).toFixed(2)}  p95 ${pct(zEdge, 0.95).toFixed(2)}  max ${Math.max(...zEdge).toFixed(1)}`);
console.log(`  HEADING jitter deg/frame: median ${pct(hj, 0.5).toFixed(3)}  p95 ${pct(hj, 0.95).toFixed(3)}  max ${Math.max(...hj).toFixed(2)}`);
await b.close();
} finally {
  await b?.close();
  srv.stop();
}
