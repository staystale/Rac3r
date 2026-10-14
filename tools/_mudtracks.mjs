// MUD TRACKS (user, 2026-10-07: "Tyre tracks on mud seem to vanish or morph weirdly as the surface gets degraded to thick mud - the
// vector change should darken if anything and make it a dip"). The real game on :8080: drive the SAME line down the lab's mud crash lane
// (y 464) pass after pass, and after passes 1, 2, 4, 6 MEASURE, on the game canvas, how much darker the rear-wheel track is than the mud
// 2 m beside it (contrast, 0-255 luminance), what the cells under it have worn to, and their rut depth; photograph each.
// Wrong = contrast falling to ~0 once the cells are thick mud. node tools/_mudtracks.mjs [base, e.g. shots/next/] [tag]
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const base = (process.argv[2] || '').replace(/^live$/, ''), tag = process.argv[3] || 'live';
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const p = await ctx.newPage(), errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://localhost:8080/${base}index.html?touch=1&guide=0&menu=0&level=lab&car=saloon-rwd`); await p.touchscreen.tap(422, 195); await p.waitForTimeout(3000);
const Y = 464;
const put = (x, y, hd, v) => p.evaluate(([x, y, hd, v]) => { const g = window.__game, c = g.car; c.x = x; c.y = y; c.heading = hd; c.vx = v; c.vy = 0; c.yawRate = 0; c._p = null; c.prevWheels = null;
  if (g.renderer.debugZoom) g.renderer.debugZoom(1.4); if (g.renderer.snap) g.renderer.snap(c); }, [x, y, hd, v]);
const out = [];
for (let pass = 1; pass <= 6; pass++) {
  await put(-120, Y, 0, 12); await p.keyboard.down('w'); await p.waitForTimeout(2600); await p.keyboard.up('w');
  if (![1, 2, 4, 6].includes(pass)) continue;
  // park the car OFF the line (in the next lane up) and look at x -95..-80, where the car was rolling straight
  await put(-101, Y, 0, 0); await p.waitForTimeout(900);
  const r = await p.evaluate(async ([Y, base]) => {
    const g = window.__game, c = g.car, hw = c.spec.trackWidth / 2, cv = document.getElementById('c'), k = cv.getContext('2d');
    const R = g.renderer, sc = cv.width / cv.clientWidth;
    const lum = (wx, wy) => { const sx = R.toScreenX(wx), sy = R.toScreenY(wy); if (sx < 0 || sy < 0 || sx >= cv.clientWidth || sy >= cv.clientHeight) return null; const d = k.getImageData(Math.round(sx * sc), Math.round(sy * sc), 1, 1).data; return 0.3 * d[0] + 0.59 * d[1] + 0.11 * d[2]; };
    let tr = 0, side = 0, n = 0; const L = await import('/' + base + 'src/lab.js');
    for (let x = -97; x <= -89; x += 0.25) { const a = lum(x, Y + hw), s = lum(x, Y + hw + 1.6); if (a == null || s == null) return { err: 'off screen', x, sx: R.toScreenX(x), sy: R.toScreenY(Y + hw), ppm: R.PPM }; tr += a; side += s; n++; }
    const cells = {}; let rut = 0, rn = 0;
    if (L) for (let x = -97; x <= -89; x += 1.5) { const cl = L.wearMap.get(Math.floor(x / L.WEAR_CELL) + ',' + Math.floor((Y + hw) / L.WEAR_CELL)); if (cl) { cells[cl.current] = (cells[cl.current] || 0) + 1; rut += cl.rut || 0; rn++; } }
    return { track: +(tr / n).toFixed(1), beside: +(side / n).toFixed(1), contrast: +((side - tr) / n).toFixed(1), cells, rutCm: rn ? +((rut / rn) * 100).toFixed(1) : null };
  }, [Y, base]);
  await p.screenshot({ path: `shots/look/mud-${tag}-pass${pass}.png` });
  // THE MEASURE THAT MATTERS: the same wheel-line pixels with the marks layer, then without it. markDark = how much darker the tracks
  // make the ground they lie on (0 = the tracks are invisible on it, whatever the ground has worn to).
  const sample = () => p.evaluate(([Y]) => {
    const g = window.__game, c = g.car, hw = c.spec.trackWidth / 2, R = g.renderer, cv = document.getElementById('c'), k = cv.getContext('2d'), sc = cv.width / cv.clientWidth;
    let s = 0, n = 0; for (let x = -97; x <= -89; x += 0.25) for (const y of [Y + hw, Y - hw]) { const d = k.getImageData(Math.round(R.toScreenX(x) * sc), Math.round(R.toScreenY(y) * sc), 1, 1).data; s += 0.3 * d[0] + 0.59 * d[1] + 0.11 * d[2]; n++; }
    return s / n;
  }, [Y]);
  const withM = await sample();
  await p.evaluate(() => { const m = window.__game.marks, k = m.canvas.getContext('2d'); window.__keepMarks = k.getImageData(0, 0, m.size, m.size); k.clearRect(0, 0, m.size, m.size); });
  await p.waitForTimeout(300);
  const noM = await sample();
  await p.screenshot({ path: `shots/look/mud-${tag}-pass${pass}-nomarks.png` });
  await p.evaluate(() => { const m = window.__game.marks; m.canvas.getContext('2d').putImageData(window.__keepMarks, 0, 0); window.__keepMarks = null; });
  const tm = +(noM - withM).toFixed(1);
  r.markDark = tm;
  out.push(`pass ${pass}: ${JSON.stringify(r)}`); console.log(`pass ${pass}: ${JSON.stringify(r)}`);
}
console.log(`page errors: ${errs.length ? errs.join(' / ') : 'none'}`);
await b.close();
