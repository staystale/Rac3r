// MARKS CUT OFF IN A CLEAN LINE (user, 2026-10-07: "top left corner of knob hill when multiple cars have passed it, it seems to forget /
// cut of tyre marks in a clean line, some stay but most go"). The real game on :8080, Knobhill: stamp a test mark at the BOTTOM-RIGHT, drive
// (teleport) to the TOP-LEFT corner, let marks.follow run, come back, and check whether the bottom-right mark is still in the layer.
// node tools/_markedge.mjs [base, e.g. shots/next/ | live]
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const base = (process.argv[2] || '').replace(/^live$/, '');
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })).newPage(), errs = [];
p.on('pageerror', (e) => errs.push(e.message));
let bad = 0;
// the LAB is 1000 m tall (S-B) and the layer 604 m, so it MUST still follow: expected there, reported as INFO
for (const level of ['knobhill', 'slidden-hill', 'lab']) {
  await p.goto(`http://localhost:8080/${base}index.html?touch=1&guide=0&menu=0&level=${level}`); await p.touchscreen.tap(422, 195); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => {
    const g = window.__game, m = g.marks, c = g.car, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const alphaAt = (wx, wy) => { const [ox, oy] = m.origin, E = m.size / 2 / 4.2, px = Math.round((wx - ox + E) * 4.2), py = Math.round((wy - oy + E) * 4.2);
      if (px < 0 || py < 0 || px >= m.size || py >= m.size) return -1; return m.canvas.getContext('2d').getImageData(px, py, 1, 1).data[3]; };
    // a fat test mark at the far bottom-right of the track area, as a car would leave it
    m.stamp([{ key: 'T', x: 200, y: 200, slip: 9, width: 0.3, heat: 90 }]);
    for (let i = 1; i <= 8; i++) m.stamp([{ key: 'T', x: 200 + i * 0.2, y: 200, slip: 9, width: 0.3, heat: 90 }]);
    const before = alphaAt(200.8, 200), o0 = [...m.origin];
    for (const [x, y] of [[-215, -215], [0, 0], [200, 200]]) { c.x = x; c.y = y; c.vx = 0; c.vy = 0; await wait(500); }
    return { before, after: alphaAt(200.8, 200), originBefore: o0, originAfter: [...m.origin] };
  });
  const ok = r.before > 0 && r.after >= r.before * 0.8;
  const info = level === 'lab';
  if (!ok && !info) bad++;
  console.log(`${level}: ${info ? 'INFO (follows by design)' : ok ? 'OK ' : 'BAD'} ${JSON.stringify(r)}`);
}
console.log(`page errors: ${errs.length ? errs.join(' / ') : 'none'}`);
console.log(bad ? `MARKEDGE: ${bad} BAD` : 'MARKEDGE: ALL OK');
await b.close();
