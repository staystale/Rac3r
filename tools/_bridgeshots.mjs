// scratch: PHOTOGRAPH each new highway prop in the real game (served on :8080): the car is teleported 40 m short of the first slip road,
// a road / rail / foot bridge and a river crossing in turn, the camera snapped, a photo taken at 390x844 and 844x390. Fails on page errors.
// node tools/_bridgeshots.mjs [preset]   -> shots/look/br-<kind>-<size>.png
import { startServer, launchBrowser } from './lib/browser.mjs';
const srv = await startServer();
process.on('exit', srv.stop);
const preset = process.argv[2] || 'motorway';
const b = await launchBrowser();
for (const [w, h, tag] of [[390, 844, 'port'], [844, 390, 'land']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${srv.url}/?touch=1&guide=0&menu=0&level=highway&car=saloon-rwd&hw=${preset}&traffic=0`); await p.touchscreen.tap(w / 2, h / 2); await p.waitForTimeout(3500);
  // drive (teleport) up the road until each kind has been found, photographing it
  const want = ['slip', 'road', 'rail', 'foot', 'river', 'solarfarm'], got = new Set();
  for (let hop = 0; hop < 60 && got.size < want.length; hop++) {
    const found = await p.evaluate(async (want) => {
      const g = window.__game, H = await import('/src/highway.js'), lv = g.level, car = g.car;
      const f = H.roadFrame(lv, car.x, car.y, car._hwf ? car._hwf.s : null); if (!f) return null;
      const keyOf = (pr) => (pr.kind === 'bridge' ? pr.carries : pr.kind);
      let best = null;
      for (const pr of lv.props) { const k = keyOf(pr); if (!want.includes(k) || pr._shot) continue; const q = H.roadFrame(lv, pr.x, pr.y, null); if (!q || q.s < f.s + 20) continue; if (!best || q.s < best.s) best = { pr, s: q.s, k }; }
      if (!best) { const P = H.roadPose(lv, f.s + 250, lv._hw.geo.centres[1]); car.x = P.x; car.y = P.y; car.heading = P.h; car.vx = Math.cos(P.h) * 20; car.vy = Math.sin(P.h) * 20; return { k: null }; }
      best.pr._shot = 1; const P = H.roadPose(lv, best.s - (best.k === 'slip' ? 10 : 25), lv._hw.geo.centres[1]);
      car.x = P.x; car.y = P.y; car.heading = P.h; car.vx = Math.cos(P.h) * 8; car.vy = Math.sin(P.h) * 8;
      if (g.renderer.snap) g.renderer.snap(car);
      return { k: best.k };
    }, want);
    await p.waitForTimeout(700);
    if (found && found.k && !got.has(found.k)) { got.add(found.k); await p.screenshot({ path: `shots/look/br-${found.k}-${tag}.png` }); }
  }
  const fps = await p.evaluate(() => window.__game.fps.toFixed(0));
  console.log(`${preset} ${tag}: photographed ${[...got].join(', ') || 'NOTHING'} | missing ${want.filter((k) => !got.has(k)).join(', ') || '-'} | fps ${fps} | page errors: ${errs.length ? errs.join(' / ') : 'none'}`);
  await ctx.close();
}
await b.close();
srv.stop();
