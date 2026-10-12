// tilestrips.mjs - does painting a ground tile in strips give the SAME pixels as painting it whole?
// Same set-up as tilediff.mjs (tiles round the spawn at zoom steps 0, -2, -3); compares render.ts debugTile
// vs debugTileStrips pixel by pixel and prints the cost: whole tile vs sum of strips vs worst strip.
// node tools/tilestrips.mjs [level ...]   (default: test-track killder stage-llanfairsheepdip highway)
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const LEVELS = process.argv.length > 2 ? process.argv.slice(2) : ['test-track', 'killder', 'stage-llanfairsheepdip', 'highway'];
const b = await chromium.launch({ channel: 'msedge' });
async function paint(LV) {
  const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  await p.goto(`http://localhost:8080/?touch=1&guide=0&menu=0&rules=0&level=${LV}&traffic=0&litter=0`); await p.waitForTimeout(1500);
  await p.touchscreen.tap(400, 200); await p.waitForTimeout(2500);
  const out = await p.evaluate(() => { const g = window.__game, r = g.renderer, c = g.car, T = [];
    for (const k of [0, -2, -3]) { const tw = 256 / (22 * Math.pow(2, k / 2)); const i0 = Math.floor(c.x / tw), j0 = Math.floor(c.y / tw);
      for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1], [1, -2]]) {
        const i = i0 + di, j = j0 + dj;
        const t0 = performance.now(), a = r.debugTile(k, i, j), tWhole = performance.now() - t0;
        const s = r.debugTileStrips(k, i, j, 4);
        let diff = 0;
        for (let n = 0; n < a.data.length; n += 4) if (a.data[n] !== s.data[n] || a.data[n + 1] !== s.data[n + 1] || a.data[n + 2] !== s.data[n + 2] || a.data[n + 3] !== s.data[n + 3]) diff++;
        T.push({ k, i, j, size: a.w === s.w, diff, tWhole, sum: s.stripMs.reduce((x, y) => x + y, 0), worst: Math.max(...s.stripMs) }); } }
    return T; });
  await p.close(); return out;
}
for (const LV of LEVELS) {
  const T = await paint(LV);
  const sum = (f) => T.reduce((x, t) => x + t[f], 0), n = T.length;
  console.log(`${LV}: tiles ${n} | differing pixels ${sum('diff')}${T.every((t) => t.size) ? '' : ' (SIZE MISMATCH)'} | ms whole ${(sum('tWhole') / n).toFixed(1)} vs strips ${(sum('sum') / n).toFixed(1)} vs worst strip ${Math.max(...T.map((t) => t.worst)).toFixed(1)}`);
  for (const t of T) if (t.diff) console.log(`  tile k${t.k} ${t.i},${t.j}: ${t.diff} px differ`);
}
await b.close();
