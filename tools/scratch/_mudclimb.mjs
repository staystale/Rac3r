// _mudclimb.mjs - Knobhill's dirt climb, dry vs rain: a car on the demo driver; per 0.5 s on the
// dirt section: speed, slip, the surface under it, height. node tools/scratch/_mudclimb.mjs car mode
import { startServer, launchBrowser } from '../lib/browser.mjs';
const [car = 'wrz-awd', mode = 'rain'] = process.argv.slice(2);
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + '/?touch=1&guide=0&menu=0&rules=0&level=knobhill' + (process.env.Q || ''));
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.evaluate(([c, m]) => window.__game.launch('knobhill', c, { ai: 0, weather: { mode: m, season: 1 } }), [car, mode]);
  await page.waitForTimeout(1500); await page.mouse.click(422, 195);
  await page.evaluate(async () => {
    const game = window.__game, auto = await import('/src/ai/autodrive.ts');
    const driver = auto.createAutoDriver(game.level.subtrack);
    game.input.update = () => (window.__inp = { ...driver.drive(game.car), reverse: 0, shiftUp: false, shiftDown: false });
    window.__log = []; const tq = await import('/src/world/tyrewall.ts');
    setInterval(() => { const c = game.car, q = tq.querySubtrack(game.level.subtrack, c.x, c.y);
      window.__log.push({ d: Math.round(q.distAlong ?? q.d ?? 0), v: +(Math.hypot(c.vx, c.vy) * 3.6).toFixed(0), slipR: +c.t.slipSpeedR.toFixed(1), slipF: +c.t.slipSpeedF.toFixed(1), surf: c.surface && c.surface.id, z: +(c.z || c.h || 0).toFixed(1), gear: c.gear, thr: +((window.__inp || {}).throttle || 0).toFixed(2), brk: +((window.__inp || {}).brake || 0).toFixed(2), plough: +((c.surface && c.surface.plough) || 0).toFixed(2) }); }, 500);
  });
  await page.waitForTimeout(75000);
  const log = await page.evaluate(() => window.__log);
  const lap = await page.evaluate(() => ({ lap: window.__game.lap, best: window.__game.bestLap, last: window.__game.lastLap }));
  const dirt = log.filter((e) => /dirt|mud|gravel/i.test(e.surf || ''));
  console.log(car, mode, 'samples', log.length, 'on dirt/mud', dirt.length, 'lap', JSON.stringify(lap));
  console.log(dirt.slice(0, 50).map((e) => `${e.v}kmh g${e.gear} thr${e.thr} brk${e.brk} sR${e.slipR} ${e.surf} plough${e.plough}`).join('\n'));
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }
