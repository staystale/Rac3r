// mapgrid.mjs — renders a ZOOMED, GRIDDED crop of a reference map so centreline points can be read off in map pixels (10 px minor,
// 50 px major lines, labelled). node tools/mapgrid.mjs <map.png> <x0> <y0> <w> <h> <out.png>   (output 1000 px wide)
// Built 2026-10-04 (Thruston re-trace; reused for Castle Cum).
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
import fs from 'fs';
const [map, x0, y0, w, h, out] = process.argv.slice(2); const X0 = +x0, Y0 = +y0, Wm = +w, Hm = +h, z = 1000 / Wm;
const img = 'data:image/png;base64,' + fs.readFileSync(map).toString('base64');
const b = await chromium.launch({ channel: 'msedge' });
const pg = await b.newPage({ viewport: { width: 1000, height: Math.round(Hm * z) } });
await pg.setContent(`<canvas id=c width=1000 height=${Math.round(Hm * z)}></canvas>`);
await pg.evaluate(async ({ img, X0, Y0, Wm, Hm, z }) => {
  const c = document.getElementById('c').getContext('2d'); const im = new Image(); im.src = img; await im.decode();
  c.fillStyle = '#fff'; c.fillRect(0, 0, 1000, Hm * z); c.drawImage(im, X0, Y0, Wm, Hm, 0, 0, 1000, Hm * z);
  c.font = '12px sans-serif';
  for (let gx = Math.ceil(X0 / 10) * 10; gx < X0 + Wm; gx += 10) { c.strokeStyle = gx % 50 ? 'rgba(0,120,255,.25)' : 'rgba(255,0,0,.6)'; c.beginPath(); c.moveTo((gx - X0) * z, 0); c.lineTo((gx - X0) * z, Hm * z); c.stroke(); if (gx % 50 === 0) { c.fillStyle = 'red'; c.fillText(gx, (gx - X0) * z + 2, 12); } }
  for (let gy = Math.ceil(Y0 / 10) * 10; gy < Y0 + Hm; gy += 10) { c.strokeStyle = gy % 50 ? 'rgba(0,120,255,.25)' : 'rgba(255,0,0,.6)'; c.beginPath(); c.moveTo(0, (gy - Y0) * z); c.lineTo(1000, (gy - Y0) * z); c.stroke(); if (gy % 50 === 0) { c.fillStyle = 'red'; c.fillText(gy, 2, (gy - Y0) * z - 2); } }
}, { img, X0, Y0, Wm, Hm, z });
await pg.screenshot({ path: out }); await b.close();
