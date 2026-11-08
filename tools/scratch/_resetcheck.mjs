// _resetcheck.mjs - Brands Snatch Indy, the Formula Won driven off into the gravel 8 times at
// different places; RESET; what is under the four wheels, and the speed 3 s of full throttle later.
import { startServer, launchBrowser } from '../lib/browser.mjs';
const q = process.argv[2] || '';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + '/?touch=1&guide=0&menu=0&rules=0&level=brands-snatch-indy' + q);
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.evaluate(() => window.__game.launch('brands-snatch-indy', 'track-rwd', { ai: 0 }));
  await page.waitForTimeout(1500); await page.mouse.click(422, 195); await page.waitForTimeout(500);
  const out = [];
  for (let k = 0; k < 8; k++) {
    const r = await page.evaluate(async (kk) => {
      const game = window.__game, sub = game.level.subtrack;
      const tw = await import('/src/world/tyrewall.ts');
      // a point on the track, then drive off sideways at 15 m/s
      const p = tw.onTrack(sub, 120 + kk * 210, 0, {});
      const side = kk % 2 ? 1 : -1, nx = Math.cos(p.rot + side * Math.PI / 2), ny = Math.sin(p.rot + side * Math.PI / 2);
      Object.assign(game.car, { x: p.x, y: p.y, heading: Math.atan2(ny, nx), vx: nx * 15, vy: ny * 15, yawRate: 0 });
      game.input.update = () => ({ steer: 0, throttle: 0, brake: 0.3, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false });
      await new Promise((ok) => setTimeout(ok, 2500));
      game.reset();
      await new Promise((ok) => setTimeout(ok, 300));
      game.input.update = () => ({ steer: 0, throttle: 1, brake: 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false });
      await new Promise((ok) => setTimeout(ok, 400));
      const surf = (game.car.wheelSurf || []).map((w) => (w ? w.id : '?')).join(',');
      await new Promise((ok) => setTimeout(ok, 2600));
      return { surf, kmh: Math.round(Math.hypot(game.car.vx, game.car.vy) * 3.6) };
    }, k);
    out.push(`${r.surf} -> ${r.kmh} km/h`);
  }
  console.log((q || 'switch off') + ':\n  ' + out.join('\n  '));
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }
