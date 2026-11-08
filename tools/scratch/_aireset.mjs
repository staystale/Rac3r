// _aireset.mjs - does an AI RESET stroke a mark from where the car was to where it is put back?
// A 3-AI race; one AI car is put rolling on the grass beside the road for 1 s (its wheels mark), then
// reset (game/ai.ts aiReset); the stamps in the next 0.3 s, and the longest single stroke the reset
// could have drawn (old wheel spot -> new). node tools/scratch/_aireset.mjs [query]
import { startServer, launchBrowser } from '../lib/browser.mjs';
const q = process.argv[2] || '';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + `/?touch=1&guide=0&menu=0&rules=0&level=thruston${q}`);
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.evaluate(() => window.__game.launch('thruston', 'hatch-rwd', { ai: 3, laps: 9 }));
  await page.waitForTimeout(1500); await page.touchscreen.tap(195, 422); await page.waitForTimeout(6000);
  const out = await page.evaluate(async () => {
    const game = window.__game, entry = game.ai[0], car = entry.car;
    const { aiReset } = await import('/src/game/ai.ts');
    const tyre = await import('/src/world/tyrewall.ts');
    // onto the grass, 20 m out from the road beside it, rolling at 8 m/s, for 1 s
    const sub = game.level.subtrack, qq = tyre.querySubtrack(sub, car.x, car.y);
    const p = tyre.onTrack(sub, qq.trackDist, sub.width / 2 + 20, {});
    car.x = p.x; car.y = p.y; car.heading = p.rot; car.vx = Math.cos(p.rot) * 8; car.vy = Math.sin(p.rot) * 8;
    car._p = null; car.prevWheels = null;
    await new Promise((r) => setTimeout(r, 1000));
    const before = { x: car.x, y: car.y }, s0 = game.marks.stamps;
    aiReset(entry);
    await new Promise((r) => setTimeout(r, 300));
    return { stamps: game.marks.stamps - s0, jump: Math.hypot(car.x - before.x, car.y - before.y) };
  });
  console.log(`${q || 'plain'}: AI reset moved it ${out.jump.toFixed(1)} m; mark stamps in the 0.3 s after ${out.stamps}`, errs[0] || '');
} finally { await browser.close(); srv.stop(); }
