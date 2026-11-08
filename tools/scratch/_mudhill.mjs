// _mudhill.mjs - The Rough Patch with ?k12: each car from a standstill at the foot of the MUD hill
// (west, centre -60,688, r 28) and the THICK MUD hill (centre 60,690, r 22), straight east over
// the top: throttle 1 and 0.6; whether it crests (gets past the far foot) and how long it takes.
import { startServer, launchBrowser } from '../lib/browser.mjs';
const cars = (process.argv[2] || 'wrz-awd,estate-4x4,hatch-fwd,hatch-rwd,muscle-rwd').split(',');
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + '/?touch=1&guide=0&menu=0&rules=0&level=rough-patch' + (process.env.Q || ''));
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  for (const car of cars) {
    await page.evaluate((c) => window.__game.launch('rough-patch', c, { ai: 0 }), car);
    await page.waitForTimeout(1200); await page.mouse.click(422, 195); await page.waitForTimeout(300);
    const row = [];
    for (const [name, cx, r] of [['mud', -60, 28], ['thick', 60, 22]]) {
      for (const thr of [1, 0.6]) {
        const res = await page.evaluate(async ([cx2, r2, th]) => {
          const game = window.__game;
          Object.assign(game.car, { x: cx2 - r2 - 4, y: cx2 < 0 ? 688 : 690, heading: 0, vx: 0, vy: 0, yawRate: 0 });
          game.input.update = () => ({ steer: 0, throttle: th, brake: 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false });
          const t0 = performance.now(); let top = -1e9;
          while (performance.now() - t0 < 12000) {
            await new Promise((ok) => setTimeout(ok, 100));
            top = Math.max(top, game.car.x);
            if (game.car.x > cx2 + r2 + 2) return { ok: true, s: ((performance.now() - t0) / 1000).toFixed(1) };
          }
          return { ok: false, got: Math.round(top - (cx2 - r2 - 4)) };
        }, [cx, r, thr]);
        row.push(`${name}@${thr}: ${res.ok ? 'over in ' + res.s + 's' : 'stuck after ' + res.got + ' m'}`);
      }
    }
    console.log(car.padEnd(11), row.join(' | '));
  }
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }
