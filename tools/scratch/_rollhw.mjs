// _rollhw.mjs - the HIGHWAY's rolling start (owner 11-04: "rolling starts seem not to hold
// formation on highways"): the real game, VS AI x5, sampled every 0.1 s until the green. Per car:
// how far it strays from its grid lane (m), how much its place up the road changes vs the pole,
// and the closest box gap between two cars.
// node tools/scratch/_rollhw.mjs [runs] [extra query, e.g. oneai=1&hwshare=1]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const runs = +(process.argv[2] || 2);
const srv = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, srv.url + '/?pc=1&guide=0&menu=0&noaudio=1'
    + (process.argv[3] ? '&' + process.argv[3] : ''));
  await page.mouse.click(400, 200);
  await page.waitForTimeout(2500);
  for (let run = 0; run < runs; run++) {
    const res = await page.evaluate(async () => {
      const game = window.__game;
      game.launch('highway', game.car.spec.id, { ai: 5, diff: 2, traffic: 1 });
      await new Promise((done) => setTimeout(done, 300));
      const cars = () => [game.car, ...game.ai.map((entry) => entry.car)];
      const gap = (a, b) => {
        const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1, ux = dx / dist,
          uy = dy / dist;
        const ext = (car) => Math.abs(Math.cos(car.heading) * ux + Math.sin(car.heading) * uy)
          * car.spec.len / 2 + Math.abs(-Math.sin(car.heading) * ux + Math.cos(car.heading) * uy)
          * car.spec.wid / 2;
        return dist - ext(a) - ext(b);
      };
      const first = cars().map((car) => car._hwf ? { off: car._hwf.off, s: car._hwf.s } : null);
      const drift = first.map(() => 0), slide = first.map(() => 0);
      let minGap = Infinity, ticks = 0, at = "";
      while (!game.start.green && ticks < 200) {
        await new Promise((done) => setTimeout(done, 100));
        ticks++;
        const all = cars(), lead = all[0]._hwf;
        all.forEach((car, i) => {
          if (!car._hwf || !first[i] || !lead) return;
          drift[i] = Math.max(drift[i], Math.abs(car._hwf.off - first[i].off));
          slide[i] = Math.max(slide[i], Math.abs((car._hwf.s - lead.s) - (first[i].s - first[0].s)));
        });
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
          const value = gap(all[i], all[j]);
          if (value < minGap) { minGap = value; at = i + '-' + j + ' at ' + game.start.t.toFixed(1) + ' s, lanes ' + all[i]._hwf.off.toFixed(1) + ' / ' + all[j]._hwf.off.toFixed(1) + ', apart ' + (all[j]._hwf.s - all[i]._hwf.s).toFixed(1) + ' m'; }
        }
      }
      return { at, t: game.start.t, drift, slide, minGap, slots: cars().map((car) => car._slot) };
    });
    console.log(`run ${run}: green at ${res.t.toFixed(1)} s | slots ${res.slots.join(',')} (car 0 = you)`
      + ` | closest pair ${res.minGap.toFixed(2)} m (${res.at})`);
    console.log('  lane drift m  ' + res.drift.map((v) => v.toFixed(2)).join(' '));
    console.log('  place slip m  ' + res.slide.map((v) => v.toFixed(1)).join(' '));
  }
  if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 5));
} finally {
  await browser.close();
  srv.stop();
}
