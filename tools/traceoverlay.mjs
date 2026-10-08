// traceoverlay.mjs — draws a level's centreline + road edges over its reference map, to check a trace against the real shape.
// node tools/traceoverlay.mjs <level> <map.png> <metresPerPx> [cx cy] -> shots/look/<level>-trace.png. (Thruston: art/ref/thruxton-map.png
// 0.47 480 338 — game (0,0) = map centre.) Built 2026-10-04 for the Thruston re-lay.
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
import fs from 'fs';
import * as L from '../src/lab.js';
const [lv = 'thruston', map = 'art/ref/thruxton-map.png', mpp = '0.47', cx = '480', cy = '338'] = process.argv.slice(2);
L.setLevel(lv);
const st = L.LEVEL.subtrack, hw = st.width / 2;
const P = (x, y) => [+cx + x / +mpp, +cy + y / +mpp];
const centre = st.pts.map(p => P(p.x, p.y)), left = st.pts.map(p => P(p.x + p.nx * hw, p.y + p.ny * hw)), right = st.pts.map(p => P(p.x - p.nx * hw, p.y - p.ny * hw));
const marks = st.pts.filter((p, i) => i % 1 === 0).reduce((a, p) => { const d = Math.floor(p.dist / 100); if (!a.seen.has(d)) { a.seen.add(d); a.out.push([...P(p.x, p.y), d * 100]); } return a; }, { seen: new Set(), out: [] }).out;
// the map's own size (PNG header), not Thruston's 960 x 676 — Castle Cum's 1280 x 1080 map was squashed (2026-10-04)
const buf = fs.readFileSync(map), MW = buf.readUInt32BE(16), MH = buf.readUInt32BE(20);
const b = await chromium.launch({ channel: 'msedge' });
const pg = await b.newPage({ viewport: { width: MW, height: MH }, deviceScaleFactor: MW > 1000 ? 1.5 : 2 });
const img = 'data:image/png;base64,' + fs.readFileSync(map).toString('base64');
await pg.setContent(`<canvas id=c width=${MW} height=${MH}></canvas>`);
await pg.evaluate(async ({ img, centre, left, right, marks, MW, MH }) => {
  const c = document.getElementById('c').getContext('2d'); const im = new Image(); im.src = img; await im.decode();
  c.globalAlpha = 0.55; c.drawImage(im, 0, 0, MW, MH); c.globalAlpha = 1;
  const line = (pts, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.stroke(); };
  line(left, '#e33', 1); line(right, '#e33', 1); line(centre, '#06f', 1);
  c.font = '10px sans-serif'; c.fillStyle = '#000'; for (const [x, y, d] of marks) { c.fillRect(x - 1.5, y - 1.5, 3, 3); c.fillText(d, x + 3, y - 3); }
}, { img, centre, left, right, marks, MW, MH });
await pg.screenshot({ path: `shots/look/${lv}-trace.png` });
await b.close();
console.log('lap', st.totalDist.toFixed(0), 'm, points', st.pts.length);
