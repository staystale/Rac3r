// _aiprof.mjs - where the AI frame cost goes with N AI (the cap lifted locally): per frame raw sim ms
// (un-smoothed from game.simMs), physics steps a frame, ms a step, and a CPU profile's self time per
// function. CPU x RATE (default 4, a phone stand-in). node tools/scratch/_aiprof.mjs [level] [n,n..] [rate]
import { startServer, launchBrowser } from '../lib/browser.mjs';
const level = process.argv[2] || 'thruston';
const counts = (process.argv[3] || '10,15,20').split(',').map(Number);
const rate = +(process.argv[4] || 4);
const srv = await startServer();
const browser = await launchBrowser();
try {
  for (const n of counts) {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(srv.url + `/?touch=1&guide=0&menu=0&rules=0&level=${level}${process.env.Q || ""}`);
    await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
    await page.evaluate(([lv, count]) => window.__game.launch(lv, 'hatch-fwd', { ai: count, laps: 5 }), [level, n]);
    await page.waitForTimeout(1500); await page.mouse.click(422, 195); await page.waitForTimeout(500);
    await page.evaluate(async () => {
      const game = window.__game, auto = await import('/src/ai/autodrive.ts');
      const driver = auto.createAutoDriver(game.level.subtrack);
      game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false, shiftDown: false });
    });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.waitForTimeout(3000);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
    const s = await page.evaluate(() => new Promise((res) => {
      const g = window.__game, rows = []; let prev = g.simMs || 0; const t0 = performance.now();
      const tick = () => {
        const cur = g.simMs || 0, raw = (cur - 0.9 * prev) / 0.1; prev = cur;
        rows.push([raw, g.stepsLastFrame || 0]);
        if (performance.now() - t0 < 15000) requestAnimationFrame(tick); else res(rows);
      };
      requestAnimationFrame(tick);
    }));
    const { profile } = await cdp.send('Profiler.stop');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const raws = s.map((r) => r[0]).sort((a, b) => a - b), steps = s.reduce((a, r) => a + r[1], 0);
    const pct = (q) => raws[Math.min(raws.length - 1, Math.floor(q * raws.length))].toFixed(1);
    const sumRaw = raws.reduce((a, x) => a + x, 0), maxed = s.filter((r) => r[1] >= 5).length;
    const ai = await page.evaluate(() => window.__game.ai.length);
    console.log(`\n${level} ${n} AI (${ai} on track), CPU x${rate}, ${s.length} frames: sim ms median ${pct(0.5)} p95 ${pct(0.95)} max ${pct(0.999)}; ` +
      `steps/frame ${(steps / s.length).toFixed(2)}; ms/step ${(sumRaw / Math.max(1, steps)).toFixed(2)}; frames with 5+ steps ${maxed}`, errs[0] || '');
    const dt = {}; const byId = new Map(profile.nodes.map((nd) => [nd.id, nd]));
    for (let i = 0; i < profile.samples.length; i++) {
      const nd = byId.get(profile.samples[i]);
      const k = (nd.callFrame.functionName || '(anon)') + ' ' + (nd.callFrame.url.split('/').pop() || '') + ':' + nd.callFrame.lineNumber;
      dt[k] = (dt[k] || 0) + (profile.timeDeltas[i] || 0);
    }
    const tot = Object.values(dt).reduce((a, x) => a + x, 0);
    for (const [k, v] of Object.entries(dt).sort((a, c) => c[1] - a[1]).slice(0, 8))
      console.log((100 * v / tot).toFixed(1).padStart(5) + '%  ' + k);
    // INCLUSIVE time per subsystem (a function and all it calls), ms per physics step
    const TRACK = ['runSimSteps', 'stepWorld', 'stepCarPhysics', 'stepAI', 'stepAICar', 'aiWant', 'drive',
      'carsStep', 'refreshAIObstacles', 'stepAIPhysics', 'step', 'stepDamage', 'applyGround', 'fenceClamp',
      'obstacleClamp', 'barrierClamp', 'solidClamp', 'hit', 'stepAIInjury', 'stepAIStuck', 'stepRaceFlow',
      'stepRace', 'stepTyreMarks', 'stepTrafficContacts', 'carContact', 'stepLooseCones', 'stepObject',
      'stir', 'stepCoverField', 'stepWeather'];
    const parent = new Map();
    for (const nd of profile.nodes) for (const c of nd.children || []) parent.set(c, nd.id);
    const inc = {};
    for (let i = 0; i < profile.samples.length; i++) {
      const d = profile.timeDeltas[i] || 0, seen = new Set();
      for (let id = profile.samples[i]; id != null; id = parent.get(id)) {
        const f = byId.get(id).callFrame.functionName;
        if (TRACK.includes(f) && !seen.has(f)) { seen.add(f); inc[f] = (inc[f] || 0) + d; }
      }
    }
    const stir = Object.keys(dt).filter((k) => k.startsWith('stir ')).map((k) => k.split(' ')[1]);
    console.log(`  inclusive ms per physics step (${steps} steps; stir in ${stir.join(', ')}):`);
    for (const f of TRACK) if (inc[f]) console.log('   ' + f.padEnd(20) + (inc[f] / 1000 / Math.max(1, steps)).toFixed(3));
    // FOCUS=fnA,fnB: the self time of every function called under each, ms per step (top 10)
    for (const focus of (process.env.FOCUS || '').split(',').filter(Boolean)) {
      const under = {};
      for (let i = 0; i < profile.samples.length; i++) {
        let hit = false;
        for (let id = profile.samples[i]; id != null; id = parent.get(id))
          if (byId.get(id).callFrame.functionName === focus) { hit = true; break; }
        if (!hit) continue;
        const nd = byId.get(profile.samples[i]);
        const k = (nd.callFrame.functionName || '(anon)') + ' ' + (nd.callFrame.url.split('/').pop() || '') + ':' + nd.callFrame.lineNumber;
        under[k] = (under[k] || 0) + (profile.timeDeltas[i] || 0);
      }
      console.log(`  under ${focus}:`);
      for (const [k, v] of Object.entries(under).sort((a, c) => c[1] - a[1]).slice(0, 10))
        console.log('     ' + (v / 1000 / Math.max(1, steps)).toFixed(3) + '  ' + k);
    }
    await ctx.close();
  }
} finally { await browser.close(); srv.stop(); }
