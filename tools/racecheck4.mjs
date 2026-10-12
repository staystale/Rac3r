// racecheck4.mjs — AI STAGE 4 end to end in the real game: launch a race (VS AI / RX), the player PARKED or DRIVEN by the racing AI
// (imported in the page), wait for the end; checks flow states, the flag, the results (sorted on total, the player's row, estimates,
// penalties, DNF) and that the podium then the table show; photos at the given size into shots/look/race4-*.png.
// node tools/racecheck4.mjs [level] [ai n] [laps] [park|drive] [rx 0|1] [W] [H]
import { startServer, launchBrowser } from './lib/browser.mjs';
const [lv = 'thruston', n = '5', laps = '1', how = 'drive', rx = '0', W = '844', H = '390'] = process.argv.slice(2);
const srv = await startServer();
let b;
try {
b = await launchBrowser();
const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(srv.url + '/?menu=1&guide=0'); await p.waitForTimeout(3000);
await p.evaluate(async ([lv, n, laps, how, rx]) => {
  const g = window.__game; g.menu.hide(); g.launch(lv, 'hatch-rwd', { ai: n, diff: 2, laps, rx: !!rx });
  if (how === 'drive') {
    const A = { ...await import('/src/ai/circuit.js'), ...await import('/src/ai/traits.ts') }; const L = await import('/src/lab.js');
    const drv = A.createAIDriver(L.LEVEL, A.aiTraits(3, 0, 1, 99));
    g.input.update = () => ({ ...drv.drive(g.car, 1 / 60, { cars: g.ai.map((a) => a.car), lap: 1, laps }), reverse: 0, shiftUp: false, shiftDown: false });
  } else g.input.update = () => ({ steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false });
}, [lv, +n, +laps, how, +rx]);
const slug = `${lv}-${how}-${W}`;
let flagShot = false, t0 = Date.now(), st = null;
while (Date.now() - t0 < 60000 + 75000 * +laps) {
  await p.waitForTimeout(250);
  st = await p.evaluate(() => { const f = window.__game.flow; return f && { state: f.state, flags: f.flags.length, t: +f.t.toFixed(1), shown: !!window.__game.flowShown, home: f.entries.filter((e) => e.finish != null).length, lapsAI: f.entries.map((e) => e.lapDone) }; });
  if (!st) { console.log('NO FLOW'); break; }
  if (st.flags && !flagShot) { flagShot = true; await p.waitForTimeout(450); await p.screenshot({ path: `shots/look/race4-flag-${slug}.png` }); await p.waitForTimeout(350); await p.screenshot({ path: `shots/look/race4-flag2-${slug}.png` }); }
  if (st.shown) break;
  if (process.env.STAGEDBG && Math.random() < 0.04) console.log('dbg', await p.evaluate(() => JSON.stringify({ t: window.__game.flow.t.toFixed(0), cars: window.__game.flow.entries.map((e) => [e.car.num, Math.round(e.car._prog), e.start == null ? null : +e.start.toFixed(0), e.finish == null ? null : +e.finish.toFixed(0)]) })));
}
await p.waitForTimeout(600); await p.screenshot({ path: `shots/look/race4-podium-${slug}.png` });
await p.waitForTimeout(2600); await p.screenshot({ path: `shots/look/race4-table-${slug}.png` });
const res = await p.evaluate(() => { const f = window.__game.flow; return f && f.results && f.results.map((r) => ({ pos: r.pos, who: r.player ? 'YOU' : '#' + r.num, total: +r.total.toFixed(2), est: r.est, dnf: r.dnf, pen: r.penalty, best: r.best && +r.best.toFixed(2), laps: r.laps, j: r.jokers, cuts: (r.car._cutLog || []).length, dmgResets: r.car._dmgResets || 0, bill: r.bill, wheels: (r.car.wheelOff || []).filter(Boolean).length, rolls: r.car._rolls || 0 })); });
const txt = await p.evaluate(() => document.getElementById('menu') && document.getElementById('menu').innerText.replace(/\s+/g, ' ').slice(0, 300));
console.log(`${lv} ${how} ai ${n} laps ${laps} rx ${rx}:`, JSON.stringify(st));
console.log('results', JSON.stringify(res));
console.log('menu text:', txt);
const sorted = res && res.every((r, i) => i === 0 || r.dnf || res[i - 1].total <= r.total || res[i - 1].dnf === r.dnf && res[i - 1].dnf);
const ok = st && st.state === 'done' && st.shown && res && res.length === +n + 1 && res.some((r) => r.who === 'YOU') && sorted && !errs.length;
console.log(ok ? 'STAGE 4 RACE: OK' : 'FAILED', errs.length ? errs : '');
await b.close();
} finally {
  await b?.close();
  srv.stop();
}
