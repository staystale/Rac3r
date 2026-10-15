// scratch: PHOTOGRAPH the roadside debris in the real game: hop up the road until a stretch with 4+ debris pieces near the car is on
// screen, park beside it, photo at 390x844 + 844x390. Fails on page errors.  -> shots/look/deb-<size>.png
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
process.on('exit', srv.stop);
const KINDS = ['pallet', 'box', 'crate', 'bin', 'sandbag', 'barrel', 'exhaust', 'bumper', 'tarp'];
const b = await launchBrowser();
for (const [w, h, tag] of [[390, 844, 'port'], [844, 390, 'land']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(srv.url + '/?touch=1&guide=0&menu=0&level=highway&car=saloon-rwd&traffic=0'); await p.touchscreen.tap(w / 2, h / 2); await p.waitForTimeout(3500);
  let res = null;
  for (let hop = 0; hop < 15 && !(res && res.n >= 4); hop++) {
    res = await p.evaluate(async (KINDS) => {
      const g = window.__game, H = await import('/src/highway.js'), lv = g.level, car = g.car, f = H.roadFrame(lv, car.x, car.y, null);
      const deb = g.cones.list.filter((k) => KINDS.includes(k.kind)).map((k) => ({ k, q: H.roadFrame(lv, k.x, k.y, f.s) })).filter((o) => o.q && o.q.s > f.s + 20);
      let best = null; for (const o of deb) { const n = deb.filter((d) => Math.abs(d.q.s - o.q.s) < 40).length; if (!best || n > best.n) best = { s: o.q.s, n, kinds: [...new Set(deb.filter((d) => Math.abs(d.q.s - o.q.s) < 40).map((d) => d.k.kind))] }; }
      const sT = best && best.n >= 4 ? best.s - 45 : f.s + 400;
      const P = H.roadPose(lv, sT, lv._hw.geo.centres[0]); car.x = P.x; car.y = P.y; car.heading = P.h; car.vx = Math.cos(P.h) * 28; car.vy = Math.sin(P.h) * 28;
      g.input.update = () => ({ steer: 0, throttle: 0.5, brake: 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false });
      if (g.renderer.snap) g.renderer.snap(car);
      return best ? { n: best.n, kinds: best.kinds } : { n: 0, kinds: [] };
    }, KINDS);
    await p.waitForTimeout(600);
  }
  await p.waitForTimeout(150); await p.screenshot({ path: `shots/look/deb-${tag}.png` });
  console.log(`${tag}: ${res ? res.n + ' debris near: ' + res.kinds.join(', ') : 'none'} | page errors: ${errs.length ? errs.join(' / ') : 'none'}`);
  await ctx.close();
}
await b.close();
srv.stop();
