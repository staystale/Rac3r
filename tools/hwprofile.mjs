// hwprofile.mjs — WHERE the time goes on the endless highway at phone-ish CPU: the CDP sampling profiler over a drive by the highway
// weaver (as tools/hwjudder.mjs), self + total time per function, top N. Built 2026-10-06 for the highway judder.
// node tools/hwprofile.mjs [seconds 12] [ai 0] [traffic 0] [cpu 4] [extra query] [top 30]
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const SEC = +(process.argv[2] || 12), AI = +(process.argv[3] || 0), TR = process.argv[4] || '0', CPU = +(process.argv[5] || 4), extra = process.argv[6] || '', TOP = +(process.argv[7] || 30);
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(`http://localhost:8080/?touch=1&guide=0&menu=0&rules=0&level=highway&traffic=${TR}${extra}`); await p.waitForTimeout(1500);
await p.touchscreen.tap(400, 200); await p.waitForTimeout(800);
await p.evaluate((n) => window.__game.launch('highway', 'saloon-rwd', { ai: n, diff: 2, traffic: +new URLSearchParams(location.search).get('traffic') }), AI);
await p.waitForTimeout(2500);
await p.evaluate(async () => { const g = window.__game, H = await import('/src/hwrace.js'), A = await import('/src/aidriver.js');
  const drv = A.createAIDriver(g.level, A.aiTraits(4, 0, 1));
  g.input.update = () => { const others = [...g.ai.map((a) => a.car), ...g.traffic.cars]; H.hwFrames(g.level, [g.car, ...others]);
    return { ...drv.drive(g.car, 1 / 60, { cars: others }), reverse: 0, shiftUp: false, shiftDown: false }; }; });
await p.waitForTimeout(3000);   // up to speed
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
await p.waitForTimeout(SEC * 1000);
const { profile } = await cdp.send('Profiler.stop');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const km = await p.evaluate(() => window.__game.hwDist / 1000);
// self time per node from the samples, then per function (name + file:line), and TOTAL (inclusive) via the tree
const byId = new Map(profile.nodes.map((n) => [n.id, n])), self = new Map();
const dts = profile.timeDeltas; for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) || 0) + (dts[i] || 0) / 1000);
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const key = (n) => { const f = n.callFrame; return `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`; };
const S = new Map(), T = new Map(); let all = 0;
for (const [id, ms] of self) { all += ms; const n = byId.get(id); S.set(key(n), (S.get(key(n)) || 0) + ms);
  const seen = new Set(); for (let q = id; q != null; q = parent.get(q)) { const k = key(byId.get(q)); if (!seen.has(k)) { seen.add(k); T.set(k, (T.get(k) || 0) + ms); } } }
const idle = (S.get('(idle) :0') || 0) + (S.get('(program) :0') || 0);
console.log(`${SEC}s at CPU x${CPU}, ai ${AI}, traffic ${TR}, ${km.toFixed(2)} km: sampled ${all.toFixed(0)} ms, idle+program ${idle.toFixed(0)} ms`);
const pr = (m, title) => { console.log(title); for (const [k, ms] of [...m].sort((a, b) => b[1] - a[1]).slice(0, TOP)) console.log(`  ${ms.toFixed(0).padStart(6)} ms ${(100 * ms / all).toFixed(1).padStart(5)} %  ${k}`); };
pr(S, 'SELF'); pr(T, 'TOTAL (inclusive)');
await b.close();
