// menurace.mjs — the MENU RACE (2026-10-04): ?menu=1 at 844x390 + 390x844, waits, photographs shots/look/menu-race-<W>.png, reports
// the cars (count, km/h), the fps, slow frames (> 25 ms) and page errors. CPU=4 env: throttle the CPU x4 (slow phone).
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
for (const [W, H] of [[844, 390], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  if (process.env.CPU) { const c = await ctx.newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: +process.env.CPU }); }
  await p.goto('http://localhost:8080/?menu=1&guide=0' + (process.env.MENUAI ? '&menuai=' + process.env.MENUAI : '')); await p.waitForTimeout(6000);
  await p.evaluate(() => { window.__ft = []; let l = performance.now(); const f = (t) => { window.__ft.push(t - l); l = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await p.waitForTimeout(8000);
  const r = await p.evaluate(() => { const g = window.__game, ft = window.__ft.slice(1), s = [...ft].sort((a, b) => a - b);
    return { mode: g.mode, cars: 1 + g.ai.length, kmh: [g.car, ...g.ai.map((a) => a.car)].map((c) => Math.round(Math.hypot(c.vx, c.vy) * 3.6)),
      fps: +g.fps.toFixed(0), median: +s[s.length >> 1].toFixed(1), slow: ft.filter((x) => x > 25).length, frames: ft.length }; });
  await p.screenshot({ path: `shots/look/menu-race-${W}.png` });
  console.log(`${W}x${H}`, JSON.stringify(r), '| errors', errs.length ? errs.join(' / ') : 'none');
  await ctx.close();
}
await b.close();
