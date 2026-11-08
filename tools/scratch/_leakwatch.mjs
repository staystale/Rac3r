// _leakwatch.mjs - do damaged cars leak in a race (owner 11-03: "it just didn't seem to be
// happening in the report link")? Every second of an N-AI race: how many cars have a cracked
// radiator / sump, the water and oil they have lost, how long each leak lasted before a reset
// mended it (repair -> engineInit), and the 'wet' / 'oil' covers on the ground (wear cells).
// node tools/scratch/_leakwatch.mjs [level] [n] [secs]
import { startServer, launchBrowser } from '../lib/browser.mjs';
const level = process.argv[2] || 'knobhill', n = +(process.argv[3] || 20), secs = +(process.argv[4] || 60);
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + `/?touch=1&guide=0&menu=0&rules=0&level=${level}`);
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.evaluate(([lv, c]) => window.__game.launch(lv, 'hatch-fwd', { ai: c, laps: 9 }), [level, n]);
  await page.waitForTimeout(1500); await page.mouse.click(422, 195); await page.waitForTimeout(500);
  const out = await page.evaluate(async (S) => {
    const game = window.__game, auto = await import('/src/ai/autodrive.ts');
    const wear = await import('/src/world/wear.ts');
    const driver = auto.createAutoDriver(game.level.subtrack);
    game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false, shiftDown: false });
    const open = new Map(), lives = [], rows = [];
    let cracks = 0, sumps = 0;
    for (let t = 1; t <= S; t++) {
      await new Promise((r) => setTimeout(r, 1000));
      const cars = [game.car, ...game.ai.map((e) => e.car)];
      let rad = 0, sump = 0, water = 0, oil = 0;
      cars.forEach((car, i) => {
        const leaking = car.engLeak > 0 || car.oilLeak > 0;
        if (car.engLeak > 0) rad++;
        if (car.oilLeak > 0) sump++;
        water += 1 - (car.engWater ?? 1); oil += 1 - (car.engOil ?? 1);
        const was = open.get(i);
        if (leaking && !was) { open.set(i, { t, sump: car.oilLeak > 0 }); cracks++; }
        if (leaking && was && !was.sump && car.oilLeak > 0) { was.sump = true; sumps++; }
        if (!leaking && was) { lives.push(t - was.t); open.delete(i); }
      });
      let wet = 0, oilCells = 0;
      for (const cell of wear.wearMap.values()) { if (cell.cover === 'wet') wet++; else if (cell.cover === 'oil') oilCells++; }
      if (t % 5 === 0) rows.push(`t ${t}s: cracked radiators ${rad}, sumps ${sump}; fluid lost now water ${water.toFixed(2)} oil ${oil.toFixed(2)}; ground wet ${wet} oil ${oilCells} cells`);
    }
    for (const [, was] of open) lives.push(`${S + 1 - was.t}+`);
    return { rows, cracks, lives };
  }, secs);
  console.log(`${level}, ${n} AI, ${secs} s:`);
  for (const r of out.rows) console.log('  ' + r);
  console.log(`  leaks started ${out.cracks}; how long each lasted (s, + = still going): ${out.lives.join(' ')}`);
  if (errs.length) console.log('page errors:', errs.slice(0, 3));
} finally { await browser.close(); srv.stop(); }
