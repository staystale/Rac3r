// _hwboot.mjs - load ?level=<id> with an extra query the way framecheck does, let the autodriver
// drive 8 s, report page errors, distance moved and tiles painted.
// node tools/scratch/_hwboot.mjs <level> [extra query]
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
const b = await launchBrowser();
try {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(srv.url + '/?touch=1&guide=0&level=' + process.argv[2] + '&car=track-rwd' + (process.argv[3] || ''));
  await p.touchscreen.tap(400, 200); await p.waitForTimeout(4000);
  const r = await p.evaluate(async () => {
    const g = window.__game, A = await import('/src/ai/autodrive.ts');
    const drv = A.createAutoDriver(g.level.subtrack);
    g.input.update = () => ({ ...drv.drive(g.car), reverse: 0, shiftUp: false, shiftDown: false });
    const x0 = g.car.x, y0 = g.car.y, t0 = g.renderer.groundRenders;
    await new Promise((done) => setTimeout(done, 8000));
    return { moved: Math.hypot(g.car.x - x0, g.car.y - y0), tiles: g.renderer.groundRenders - t0,
      level: g.level.id, speed: Math.hypot(g.car.vx, g.car.vy) };
  });
  console.log(JSON.stringify(r), 'errors', errors.slice(0, 3));
} finally { await b.close(); srv.stop(); }
