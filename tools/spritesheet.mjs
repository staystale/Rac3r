// spritesheet.mjs — photographs every car's PIXEL sprite in the real game (wheels, shadow and all) and lays them
// out on one review sheet. Needs the dev server on :8080 (serve.mjs).
//
//   node tools/spritesheet.mjs [out.png]      default: art/sprite-sheet.png
//
// Added 2026-10-03 for the pixel-art pass: every sprite change is reviewed on this sheet before it ships.
import { startServer, launchBrowser } from './lib/browser.mjs';
import { CAR_IDS } from '../src/cars.ts';
import { fileURLToPath } from 'node:url';
const srv = await startServer();
process.on('exit', srv.stop);

// fileURLToPath, not .pathname: the folder has a space, and .pathname kept it as %20 (wrote to a literal "car%20sim")
const out = process.argv[2] || fileURLToPath(new URL('../art/sprite-sheet.png', import.meta.url));
const b = await launchBrowser();
const shots = [], errs = [];
for (const id of CAR_IDS) {
  const p = await (await b.newContext({ viewport: { width: 520, height: 300 }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errs.push(id + ': ' + e.message));
  await p.goto(`${srv.url}/?pc=1&car=${id}`); await p.keyboard.press('x'); await p.waitForTimeout(2300);
  // park on the pale lab floor, nose to the right, wheels slightly steered so steering reads
  await p.evaluate(() => { const g = window.__game, c = g.car; c.x = -20; c.y = -10; c.heading = 0; c.vx = c.vy = 0; c.delta = 0.25; g.renderer.snap(c); });
  await p.waitForTimeout(600);
  shots.push([id, (await p.screenshot({ clip: { x: 160, y: 90, width: 200, height: 120 } })).toString('base64')]);
  await p.close();
}
// RAW sprites, 6x, no wheels / shadow — for judging pixel detail
const raw = await (async () => {
  const p = await (await b.newContext({ viewport: { width: 400, height: 300 } })).newPage();
  await p.goto(srv.url + '/?pc=1'); await p.waitForTimeout(500);
  const res = await p.evaluate(async (ids) => {
    const { spec } = await import('/src/cars.ts'); const R = window.__game.renderer;
    return ids.map((id) => { const s = R.pixelCar(spec(id)), k = 6, c = document.createElement('canvas'); c.width = s.c.width * k; c.height = s.c.height * k;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#7f9f62'; g.fillRect(0, 0, c.width, c.height); g.drawImage(s.c, 0, 0, c.width, c.height); return [id, c.toDataURL()]; });
  }, CAR_IDS);
  await p.close(); return res;
})();
const html = `<body style="margin:0;background:#1b1d22;color:#e8e8ee;font:600 16px system-ui;display:flex;flex-wrap:wrap;width:1680px">
${shots.map(([id, b64]) => `<figure style="margin:8px"><img src="data:image/png;base64,${b64}" width="400"><figcaption>${id}</figcaption></figure>`).join('')}
<div style="width:100%;padding:8px">RAW SPRITES x6</div>${raw.map(([id, u]) => `<figure style="margin:8px"><img src="${u}" style="image-rendering:pixelated"><figcaption>${id}</figcaption></figure>`).join('')}</body>`;
const q = await b.newPage({ viewport: { width: 1680, height: 900 } });
await q.setContent(html); await q.screenshot({ path: out, fullPage: true });
await b.close();
console.log('sheet ->', out, errs.length ? 'ERRORS ' + errs.join(' | ') : 'no page errors');
srv.stop();
