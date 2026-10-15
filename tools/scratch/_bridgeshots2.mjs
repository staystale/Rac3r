// scratch (v2 bridges / slips, 2026-10-06): PHOTOGRAPH each kind in the real game served on :8080 - the car is teleported short of it,
// the camera snapped, a photo at 390x844 + 844x390. Kinds: road / rail / foot bridge, river, short / long slip, the secret side road
// (photographed from the motorway AND from on it). Fails on page errors.
// node tools/_bridgeshots2.mjs [preset] [base]   base default '' (live) or 'shots/next/' (the copy) -> shots/look/b2-<kind>-<size>.png
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
  const want = ['road', 'rail', 'foot', 'river', 'short', 'long', 'side', 'sideon'], got = new Set();
  for (let hop = 0; hop < 90 && got.size < want.length; hop++) {
    const found = await p.evaluate(async ([want, got, base]) => {
      const g = window.__game, H = await import(`/${base}src/highway.js`), lv = g.level, car = g.car, P = lv._hw.pts, C = lv._hw.geo.centres;
      const f = H.roadFrame(lv, car.x, car.y, car._hwf ? car._hwf.s : null); if (!f) return null;
      const put = (s, off, v) => { const Q = H.roadPose(lv, s, off); car.x = Q.x; car.y = Q.y; car.heading = Q.h; car.vx = Math.cos(Q.h) * v; car.vy = Math.sin(Q.h) * v; if (g.renderer.snap) g.renderer.snap(car); };
      // the side road: the first point ahead that has one
      const sp = P.find((q) => q.sideOff > lv._hw.geo.hw + 8 && q.s > f.s + 30);
      if (sp && !got.includes('side')) { put(sp.s - 20, C[0], 6); return { k: 'side' }; }
      if (sp && !got.includes('sideon')) { put(sp.s, -sp.sideOff, 6); return { k: 'sideon' }; }
      let best = null;
      for (const pr of lv.props) { const k = pr.kind === 'bridge' ? pr.carries : pr.kind === 'river' ? 'river' : pr.kind === 'slip' ? pr.type : null; if (!k || !want.includes(k) || got.includes(k)) continue;
        const q = H.roadFrame(lv, pr.x, pr.y, null); if (!q || q.s < f.s + 20) continue; if (!best || q.s < best.s) best = { s: q.s, k }; }
      if (!best) { put(f.s + 250, C[1], 20); return { k: null }; }
      put(best.s - (best.k === 'short' || best.k === 'long' ? -20 : 15), C[0], 6);
      return { k: best.k };
    }, [want, [...got], base]);
    await p.waitForTimeout(900);
    if (found && found.k && !got.has(found.k)) { got.add(found.k); await p.screenshot({ path: `shots/look/b2-${found.k}-${tag}.png` }); }
  }
  const fps = await p.evaluate(() => window.__game.fps.toFixed(0));
  console.log(`${preset} ${tag}: photographed ${[...got].join(', ') || 'NOTHING'} | missing ${want.filter((k) => !got.has(k)).join(', ') || '-'} | fps ${fps} | page errors: ${errs.length ? errs.join(' / ') : 'none'}`);
  await ctx.close();
}
await b.close();
srv.stop();
