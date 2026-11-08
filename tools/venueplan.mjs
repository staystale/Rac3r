// venueplan.mjs - a venue level as a PLAN (no game render): the raced road, every lane (by width,
// labelled with its index), zones, barriers by kind, props' footprints by kind, on a metre grid.
// node tools/venueplan.mjs <level> <x0> <y0> <w> <h> <out.png>   (game m; built 11-07)
// EXTRA=<file.json> also draws [{ pts: [[x, y], ...], col: '#rrggbb' }] over it (game m)
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { startServer, launchBrowser } from './lib/browser.mjs';
const imp = (path) => import(pathToFileURL(process.cwd() + path).href);
const { LEVELS } = await imp('/src/world/levels/index.ts');
const [levelId, x0, y0, w, h, out] = process.argv.slice(2);
// (a venue's level is built on first use: world/load.ts buildLevel)
const { buildLevel } = await imp('/src/world/load.ts');
const found = LEVELS.find((entry) => entry.id === levelId);
const level = found && buildLevel(found);
const X0 = +x0, Y0 = +y0, W = +w, H = +h, Z = 1200 / W;
const data = {
  track: level.subtrack.pts.map((p) => [p.x, p.y]), half: level.subtrack.width / 2,
  lanes: level.lanes.map((lane) => ({ pts: lane.pts, w: lane.width, s: lane.surface.id })),
  zones: (level.zones || []).filter((z) => z.poly).map((z) => ({ poly: z.poly, s: z.surface?.id })),
  barriers: level.barriers.map((b) => ({ pts: b.pts, kind: b.kind })),
  props: level.props.map((p) => ({ kind: p.kind, x: p.x, y: p.y, w: p.w || p.wid || 0, h: p.h || 0,
    rot: p.rot || 0, front: p.front, back: p.back })),
  cones: (level.cones || []).map((c) => [c.x, c.y]),
  extra: process.env.EXTRA ? JSON.parse(fs.readFileSync(process.env.EXTRA, 'utf8')) : [],
};
const srv = await startServer();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: Math.round(H * Z) } });
  await page.setContent(`<canvas id=c width=1200 height=${Math.round(H * Z)}></canvas>`);
  await page.evaluate(({ data, X0, Y0, W, H, Z }) => {
    const ctx = document.getElementById('c').getContext('2d');
    const sx = (x) => (x - X0) * Z, sy = (y) => (y - Y0) * Z;
    ctx.fillStyle = '#cfe3c0'; ctx.fillRect(0, 0, W * Z, H * Z);
    const line = (pts, col, width, closed) => {
      ctx.strokeStyle = col; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
      if (closed) ctx.closePath(); ctx.stroke();
    };
    for (const zone of data.zones) {
      ctx.fillStyle = zone.s === 'gravel' ? '#e0cf9a' : zone.s === 'tarmac' ? '#8a8f99' : '#b9c7ae';
      ctx.beginPath(); zone.poly.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
      ctx.closePath(); ctx.fill();
    }
    line(data.track, '#333', data.half * 2 * Z, false);
    data.lanes.forEach((lane, i) => {
      line(lane.pts, lane.w === 9 ? '#b8b4ad' : lane.s === 'racetarmac' ? '#555' : '#6b6f7a', lane.w * Z);
      line(lane.pts, 'rgba(255,255,255,.6)', 1);
      const [x, y] = lane.pts[0], [ex, ey] = lane.pts[lane.pts.length - 1];
      ctx.fillStyle = '#00f'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`L${i}w${lane.w}`, sx(x) + 3, sy(y) - 3);
      ctx.fillStyle = '#00f'; ctx.fillRect(sx(ex) - 2, sy(ey) - 2, 4, 4);
    });
    const BCOL = { armco: '#1e5fd0', catchfence: '#c0f', pitwall: '#e22', wall: '#e80' };
    for (const b of data.barriers) line(b.pts, BCOL[b.kind] || '#000', 2);
    ctx.fillStyle = '#000';
    for (const [x, y] of data.cones) ctx.fillRect(sx(x) - 1.5, sy(y) - 1.5, 3, 3);
    const PCOL = { tunnel: '#f00', bridge: '#f80', footbridge: '#fa0', gantry: '#0aa', grandstand: '#a0a',
      garagerow: '#600', parkedcar: '#08f', truck: '#840', board: '#ff0', tree: '#060' };
    for (const p of data.props) {
      if (p.kind === 'tree') continue;
      ctx.strokeStyle = PCOL[p.kind] || '#444'; ctx.lineWidth = 2;
      if (p.front && p.back) { line([...p.front, ...p.back.slice().reverse()], PCOL[p.kind] || '#444', 2, true); continue; }
      const pw = p.w || 2, ph = p.h || (p.kind === 'gantry' ? 1 : 2);
      ctx.save(); ctx.translate(sx(p.x), sy(p.y)); ctx.rotate(p.rot);
      ctx.strokeRect(-pw / 2 * Z, -ph / 2 * Z, pw * Z, ph * Z);
      if (p.kind === 'tunnel') { ctx.fillStyle = 'rgba(255,0,0,.3)'; ctx.fillRect(-pw / 2 * Z, -ph / 2 * Z, pw * Z, ph * Z);
        ctx.fillStyle = '#f00'; ctx.fillRect(pw / 2 * Z - 4, -3, 4, 6); }
      ctx.restore();
      ctx.fillStyle = PCOL[p.kind] || '#444'; ctx.font = '10px sans-serif';
      if (p.kind !== 'parkedcar') ctx.fillText(p.kind, sx(p.x) + 2, sy(p.y) + 10);
    }
    for (const mark of data.extra) line(mark.pts, mark.col || '#f60', 3);
    ctx.font = '11px sans-serif';
    for (let gx = Math.ceil(X0 / 10) * 10; gx < X0 + W; gx += 10) {
      ctx.strokeStyle = gx % 50 ? 'rgba(0,0,0,.08)' : 'rgba(255,0,0,.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx(gx), 0); ctx.lineTo(sx(gx), H * Z); ctx.stroke();
      if (gx % 50 === 0) { ctx.fillStyle = 'red'; ctx.fillText(gx, sx(gx) + 2, 12); }
    }
    for (let gy = Math.ceil(Y0 / 10) * 10; gy < Y0 + H; gy += 10) {
      ctx.strokeStyle = gy % 50 ? 'rgba(0,0,0,.08)' : 'rgba(255,0,0,.4)';
      ctx.beginPath(); ctx.moveTo(0, sy(gy)); ctx.lineTo(W * Z, sy(gy)); ctx.stroke();
      if (gy % 50 === 0) { ctx.fillStyle = 'red'; ctx.fillText(gy, 2, sy(gy) - 2); }
    }
  }, { data, X0, Y0, W, H, Z });
  await page.screenshot({ path: out });
} finally {
  await browser.close();
  srv.stop();
}
