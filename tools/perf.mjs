// Frame cost with the marks layer HEAVILY USED, not empty (CLAUDE.md §3: match real counts).
import { startServer, launchBrowser } from './lib/browser.mjs';
const srv = await startServer();
let b;
try {
b = await launchBrowser();
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(srv.url + '/?car=muscle-rwd');
await p.mouse.click(422, 195);
async function sample(label) {
  const r = await p.evaluate(() => new Promise((res) => {
    const t = []; let n = 0; let last = performance.now();
    function tick() { const now = performance.now(); t.push(now - last); last = now; if (++n < 180) requestAnimationFrame(tick);
      else { t.sort((a,b)=>a-b); res({ median: +t[90].toFixed(2), p95: +t[171].toFixed(2), marks: window.__game.marks.stamps }); } }
    requestAnimationFrame(tick);
  }));
  console.log(label.padEnd(26), `median ${r.median} ms   p95 ${r.p95} ms   marks ${r.marks}`);
}
await sample('empty floor');
// lay a LOT of rubber: repeated donuts
for (let i = 0; i < 6; i++) {
  await p.keyboard.down('w'); await p.keyboard.down('d'); await p.waitForTimeout(2500);
  await p.keyboard.up('d'); await p.waitForTimeout(400); await p.keyboard.up('w');
  await p.keyboard.down('s'); await p.waitForTimeout(300); await p.keyboard.up('s');
}
await sample('after heavy rubber');
await b.close();
} finally {
  await b?.close();
  srv.stop();
}
