// scratch: the REAL game on Highway to Hull with traffic, driven by a held throttle + the bench autodriver steering via __game hooks.
// Prints traffic stats, fps-ish step cost, page errors; photographs portrait.  node tools/_tfgame.mjs [density]
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const dens = process.argv[2] || '1';
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const AI = +(process.argv[3] || 0);
await p.goto(`http://localhost:8080/?touch=1&guide=0&menu=0&level=highway&traffic=${dens}`); await p.waitForTimeout(1500);
await p.touchscreen.tap(195, 400); await p.waitForTimeout(1200);
if (AI) { await p.evaluate((n) => window.__game.launch('highway', 'saloon-rwd', { ai: n, diff: 2, traffic: +new URLSearchParams(location.search).get('traffic') }), AI); await p.waitForTimeout(3000);
  console.log('lights', JSON.stringify(await p.evaluate(() => ({ on: window.__game.start.on, rolling: window.__game.start.rolling, tGreen: window.__game.start.tGreen, t: +window.__game.start.t.toFixed(2), ai: window.__game.ai.length, v: window.__game.ai.map((a) => Math.round(Math.hypot(a.car.vx, a.car.vy) * 3.6)), flow: !!window.__game.flow })))); }
const s0 = await p.evaluate(() => ({ lvl: window.__game.level.id, tr: window.__game.traffic.stats(), n: window.__game.traffic.cars.length }));
console.log('start', JSON.stringify(s0));
await p.screenshot({ path: 'shots/look/tf-game-0.png' });
// hold GAS (keyboard: ArrowUp) for 25 s, a few steering wiggles
await p.keyboard.down('ArrowUp');
for (let k = 0; k < 5; k++) { await p.waitForTimeout(5000);
  const s = await p.evaluate(() => { const g = window.__game, c = g.car; return { km: (g.hwDist / 1000).toFixed(2), v: Math.round(Math.hypot(c.vx, c.vy) * 3.6), tr: g.traffic.stats(), dmg: c.dmg ? c.dmg.map((d) => +d.toFixed(2)) : null, fps: Math.round(g.fps), steps: g.stepsLastFrame, simMs: +(g.simMs || 0).toFixed(1), drawMs: +(g.drawMs || 0).toFixed(1), tiles: g.renderer.groundRenders, notice: g.notice && g.notice.text,
    near: g.traffic.cars.filter((t) => Math.hypot(t.x - c.x, t.y - c.y) < 80).length, dmgd: g.traffic.cars.filter((t) => t.dmg && t.dmg.some((d) => d > 0.02)).length,
    race: g.flow ? { st: g.flow.state, cd: g.flow.cdKind, t: +(g.flow.cd || 0).toFixed(1), pos: g.position, ai: g.ai.map((a) => Math.round((a.car._hwf ? a.car._hwf.s : 0) - (c._hwf ? c._hwf.s : 0))) } : null, menuOpen: g.menu && g.menu.open }; });
  console.log(`t ${(k + 1) * 5}s`, JSON.stringify(s));
  await p.screenshot({ path: `shots/look/tf-game-${k + 1}.png` });
}
await p.keyboard.up('ArrowUp');
console.log('errors', errs.length ? errs.slice(0, 5).join(' || ') : 'none');
await b.close();
