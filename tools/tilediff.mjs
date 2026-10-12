// tilediff.mjs — do two builds paint the SAME ground tiles? Paints tiles round the spawn of a level at a few zoom steps in build A
// (http://localhost:8080/) and build B (default /shots/next/, a copy of index.html + src/), then compares pixel by pixel.
// Both builds need render.ts debugTile(). Built 2026-10-06 for the tile-painting speed-up (render.ts paintTileInner / hillShade).
// node tools/tilediff.mjs [level highway] [B path /shots/next/]
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const LV = process.argv[2] || 'highway', BP = process.argv[3] || '/shots/next/index.html', AQ = process.argv[4] || '';
const b = await chromium.launch({ channel: 'msedge' });
async function paint(path, q = '') {
  const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:8080${path}?touch=1&guide=0&menu=0&rules=0&level=${LV}&traffic=0&litter=0${q}`); await p.waitForTimeout(1500);
  await p.touchscreen.tap(400, 200); await p.waitForTimeout(2500);
  const out = await p.evaluate(() => { const g = window.__game, r = g.renderer, c = g.car, T = [];
    for (const k of [0, -2, -3]) { const tw = 256 / (22 * Math.pow(2, k / 2)); const i0 = Math.floor(c.x / tw), j0 = Math.floor(c.y / tw);
      for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1], [1, -2]]) T.push({ k, i: i0 + di, j: j0 + dj, ...r.debugTile(k, i0 + di, j0 + dj) }); }
    return T; });
  await p.close(); return { T: out, errs };
}
const A = await paint('/', AQ), B = await paint(BP);
let worst = 0, totalDiff = 0, totalPx = 0;
for (let n = 0; n < A.T.length; n++) {
  const a = A.T[n], q = B.T[n];
  if (a.w !== q.w) { console.log(`tile ${a.k}|${a.i}|${a.j}: SIZE ${a.w} vs ${q.w}`); continue; }
  let diff = 0, big = 0, maxD = 0;
  for (let p = 0; p < a.data.length; p += 4) { const d = Math.max(Math.abs(a.data[p] - q.data[p]), Math.abs(a.data[p + 1] - q.data[p + 1]), Math.abs(a.data[p + 2] - q.data[p + 2]));
    if (d > 0) diff++; if (d > 24) big++; maxD = Math.max(maxD, d); }
  const px = a.data.length / 4; totalDiff += diff; totalPx += px; worst = Math.max(worst, diff / px);
  console.log(`tile k${a.k} ${a.i},${a.j} (${a.w}px): ${(100 * diff / px).toFixed(2)} % px differ, ${(100 * big / px).toFixed(2)} % by > 24, max ${maxD}`);
}
console.log(`ALL: ${(100 * totalDiff / totalPx).toFixed(2)} % px differ, worst tile ${(100 * worst).toFixed(2)} % | errors A ${A.errs.length ? A.errs[0] : 'none'} B ${B.errs.length ? B.errs[0] : 'none'}`);
await b.close();
