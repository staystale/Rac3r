// scratch (SCENERY v2, 2026-10-06): PHOTOGRAPH the farm scenery in the real game on :8080 - the car is teleported beside a wheat /
// rapeseed / ploughed / pasture field, a farmyard and a village, the camera snapped (and zoomed out a touch for the wide view).
// node tools/_sceneryshots.mjs [preset] [base]  -> shots/look/sc-<kind>-<size>.png. Fails on page errors.
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
process.on('exit', srv.stop);
const preset = process.argv[2] || 'motorway', base = process.argv[3] || '';
const b = await launchBrowser();
for (const [w, h, tag] of [[390, 844, 'port'], [844, 390, 'land']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${srv.url}/${base}index.html?touch=1&guide=0&menu=0&level=highway&car=saloon-rwd&hw=${preset}&traffic=0`); await p.touchscreen.tap(w / 2, h / 2); await p.waitForTimeout(3500);
  const want = ['wheat', 'rapeseed', 'plough', 'pasture', 'yard', 'village'], got = new Set();
  for (let hop = 0; hop < 120 && got.size < want.length; hop++) {
    const found = await p.evaluate(async ([want, got, base]) => {
      const g = window.__game, H = await import(`/${base}src/highway.js`), lv = g.level, car = g.car, C = lv._hw.geo.centres;
      const f = H.roadFrame(lv, car.x, car.y, car._hwf ? car._hwf.s : null); if (!f) return null;
      const put = (s, off, v) => { const Q = H.roadPose(lv, s, off); car.x = Q.x; car.y = Q.y; car.heading = Q.h; car.vx = Math.cos(Q.h) * v; car.vy = Math.sin(Q.h) * v; if (g.renderer.snap) g.renderer.snap(car); };
      let best = null;
      const cand = [];
      const LOOK = { wheat: 'wheat', rapeseed: 'rapeseed', plough: 'plough', pastureG: 'pasture' };
      for (const z of lv.zones) if (z.field != null && !z.hedge) cand.push([LOOK[z.art] || (z.surface.id === 'gravel' ? 'yard' : 'meadow'), z.x, z.y]);
      for (const pr of lv.props) if (pr.church) cand.push(['village', pr.x, pr.y]);
      for (const [k, x, y] of cand) { if (!want.includes(k) || got.includes(k)) continue; const q = H.roadFrame(lv, x, y, null); if (!q || q.s < f.s + 30) continue; if (!best || q.s < best.s) best = { s: q.s, k, off: q.off }; }
      if (g.renderer.debugZoom) g.renderer.debugZoom(0.4);
      if (!best) { put(f.s + 300, C[1], 25); return { k: null }; }
      put(best.s, best.off < 0 ? C[0] : C[C.length - 1], 4);
      return { k: best.k };
    }, [want, [...got], base]);
    await p.waitForTimeout(900);
    if (found && found.k && !got.has(found.k)) { got.add(found.k); await p.screenshot({ path: `shots/look/sc-${found.k}-${tag}.png` }); }
  }
  const fps = await p.evaluate(() => window.__game.fps.toFixed(0));
  console.log(`${preset} ${tag}: photographed ${[...got].join(', ') || 'NOTHING'} | missing ${want.filter((k) => !got.has(k)).join(', ') || '-'} | fps ${fps} | page errors: ${errs.length ? errs.join(' / ') : 'none'}`);
  await ctx.close();
}
await b.close();
srv.stop();
