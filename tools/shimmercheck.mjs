// shimmercheck.mjs — does the GROUND quiver at speed? (user, 2026-10-04: "tracks seem to quiver and shake at speed"). Phone-size,
// autodrive lap; wraps drawImage to record every GROUND TILE blit in ART pixels (the pixel canvas): (1) tiles drawn at a fractional art-
// pixel position, (2) frames where tiles of one step are drawn at DIFFERENT widths (each edge rounded separately -> the texture inside
// stretches by a pixel, frame to frame = shimmer). Also the zoom change per frame. node tools/shimmercheck.mjs [level]
import { startServer, launchBrowser } from './lib/browser.mjs';
const lv = process.argv[2] || 'brands-snatch';
const srv = await startServer();
let b;
try {
b = await launchBrowser();
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(srv.url + '/?touch=1&guide=0&menu=0&level=' + lv + '&car=track-rwd'); await p.touchscreen.tap(400, 200); await p.waitForTimeout(4000);
const r = await p.evaluate(() => new Promise(async (res) => {
  const g = window.__game; const A = await import('/src/ai/autodrive.js'); const drv = A.createAutoDriver(g.level.subtrack);
  g.input.update = () => ({ ...drv.drive(g.car), reverse: 0, shiftUp: false, shiftDown: false });
  const proto = CanvasRenderingContext2D.prototype, orig = proto.drawImage; let rec = [];
  proto.drawImage = function (img, ...a) {
    if (a.length === 4 && img && img.width === img.height && img.width > 100 && img.width < 600) {   // a ground tile
      const t = this.getTransform(); rec.push({ x: a[0] * t.a + t.e, w: a[2] * t.a });
    }
    return orig.call(this, img, ...a);
  };
  let frames = 0, fracFrames = 0, mixFrames = 0, tiles = 0, fracTiles = 0;
  (function f() {
    if (rec.length) {
      tiles += rec.length; const ws = new Set(rec.map((q) => Math.round(q.w * 1000)));
      const frac = rec.filter((q) => Math.abs(q.x - Math.round(q.x)) > 0.01 || Math.abs(q.w - Math.round(q.w)) > 0.01).length; fracTiles += frac;
      if (frac) fracFrames++; if (ws.size > 1) mixFrames++; frames++;
    }
    rec = [];
    if (frames < 500) requestAnimationFrame(f); else { proto.drawImage = orig; res({ frames, tiles, fracTiles, fracFrames, mixFrames, speed: Math.hypot(g.car.vx, g.car.vy) * 3.6 }); }
  })();
}));
console.log(JSON.stringify(r));
console.log(`frames with a tile at a FRACTIONAL art pixel: ${r.fracFrames}/${r.frames}; frames with tiles at MIXED widths: ${r.mixFrames}/${r.frames}`);
await b.close();
} finally {
  await b?.close();
  srv.stop();
}
