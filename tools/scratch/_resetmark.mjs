// _resetmark.mjs - a mark drawn by a RESET (owner 11-04: "a rim mark appeared after I reset my car /
// on soft surfaces like it shouldn't")? The player laps on the demo driver for 8 s, then RESET
// (key r: half on the edge, wheels on the grass) and the car held still: the mark stamps drawn in
// the next half second (none should be), and a phone shot. node tools/scratch/_resetmark.mjs [query]
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
  await page.evaluate(() => window.__game.launch('thruston', 'hatch-rwd', { ai: 0, laps: 9 }));
  await page.waitForTimeout(1500); await page.touchscreen.tap(195, 422); await page.waitForTimeout(500);
  await page.evaluate(async () => {
    const auto = await import('/src/ai/autodrive.ts');
    const driver = auto.createAutoDriver(window.__game.level.subtrack);
    window.__drive = () => ({ ...driver.drive(window.__game.car), reverse: 0, shiftUp: false, shiftDown: false });
    window.__game.input.update = window.__drive;
  });
  await page.waitForTimeout(6000);
  // RIM=1: two tyres to the rim for 3 s of driving first (a crashed car's)
  if (process.env.RIM) { await page.evaluate(() => { const c = window.__game.car; c.onRim = [true, true, false, false]; }); await page.waitForTimeout(3000); }
  const out = await page.evaluate(async () => {
    const game = window.__game;
    const before = { x: game.car.x, y: game.car.y };
    const { doReset } = await import('/src/game/session.ts');
    const wear = await import('/src/world/wear.ts');
    doReset();
    // after the reset: rolling gently 2 s; the marks drawn and the ground worn near the reset spot
    game.input.update = () => ({ steer: 0, throttle: 0.25, brake: 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false });
    const at = { x: game.car.x, y: game.car.y }, s0 = game.marks.stamps;
    const cells = new Map();
    for (let dx = -8; dx <= 8; dx += 1.5) for (let dy = -8; dy <= 8; dy += 1.5) { const c = wear.wearMap.get(wear.wearKey(Math.floor((at.x + dx) / wear.WEAR_CELL), Math.floor((at.y + dy) / wear.WEAR_CELL))); cells.set(c || (at.x + dx) + ',' + (at.y + dy), c ? c.base : null); }
    await new Promise((r) => setTimeout(r, 2000));
    let worn = 0; for (const [c, base] of cells) if (typeof c === 'object' && c.base !== base) worn++;
    const newCells = [...wear.wearMap.values()].filter((c) => Math.hypot((c.cx + 0.5) * wear.WEAR_CELL - at.x, (c.cy + 0.5) * wear.WEAR_CELL - at.y) < 8 && !cells.has(c) && c.base !== c.orig).length;
    return { stamps: game.marks.stamps - s0, moved: Math.hypot(at.x - before.x, at.y - before.y), worn: worn + newCells, onRim: JSON.stringify(game.car.onRim), off: JSON.stringify(game.car.wheelOff) };
  });
  await page.screenshot({ path: `tools/scratch/_resetmark${q ? '-on' : '-plain'}.png` });
  console.log(`${q || 'plain'}${process.env.RIM ? ' RIM' : ''}: reset moved the car ${out.moved.toFixed(1)} m; after it (2 s rolling): mark stamps ${out.stamps}, ground cells worn near ${out.worn}; onRim ${out.onRim} wheelOff ${out.off}`, errs[0] || '');
} finally { await browser.close(); srv.stop(); }
