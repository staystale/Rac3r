// _planjson.mjs - venueplan.mjs's plan WITHOUT A BROWSER (the laptop short of memory): writes the
// level's plan as draw commands in pixels for tools/scratch/_planpng.ps1 (System.Drawing) to paint.
// node tools/scratch/_planjson.mjs <level> <x0> <y0> <w> <h> <out.json> [px wide, 1200]
//   then: powershell -File tools/scratch/_planpng.ps1 <out.json> <out.png>
import fs from 'node:fs';
import { LEVELS } from '../../src/world/levels/index.ts';
import { buildLevel } from '../../src/world/load.ts';
const [levelId, x0, y0, w, h, out, pxArg = '1200'] = process.argv.slice(2);
const level = buildLevel(LEVELS.find((entry) => entry.id === levelId));
const X0 = +x0, Y0 = +y0, W = +w, H = +h, Z = +pxArg / W;
const px = ([x, y]) => [Math.round((x - X0) * Z * 10) / 10, Math.round((y - Y0) * Z * 10) / 10];
const cmds = [];
const line = (pts, col, width) => cmds.push({ t: 'line', pts: pts.map(px), col, w: width });
for (const zone of (level.zones || []).filter((entry) => entry.poly)) {
  const id = zone.surface?.id;
  cmds.push({ t: 'poly', pts: zone.poly.map(px),
    col: id === 'gravel' ? '#e0cf9a' : id === 'tarmac' ? '#8a8f99' : id === 'wet' ? '#7fa6c9' : '#b9c7ae' });
}
const track = level.subtrack.pts.map((point) => [point.x, point.y]);
line([...track, track[0]], '#333333', level.subtrack.width * Z);
level.lanes.forEach((lane, i) => {
  line(lane.pts, lane.width === 9 ? '#b8b4ad' : lane.surface.id === 'racetarmac' ? '#555555'
    : '#6b6f7a', lane.width * Z);
  cmds.push({ t: 'text', at: px(lane.pts[0]), s: `L${i}w${lane.width}`, col: '#0000ff' });
});
const BCOL = { armco: '#1e5fd0', catchfence: '#cc00ff', pitwall: '#ee2222', wall: '#ee8800' };
for (const rail of level.barriers) line(rail.pts, BCOL[rail.kind] || '#000000', 2);
for (const cone of level.cones || []) cmds.push({ t: 'dot', at: px([cone.x, cone.y]), col: '#000000' });
const PCOL = { tunnel: '#ff0000', bridge: '#ff8800', footbridge: '#ffaa00', gantry: '#00aaaa',
  grandstand: '#aa00aa', garagerow: '#660000', parkedcar: '#0088ff', truck: '#884400', board: '#cccc00',
  tree: '#006600', block: '#444444', tower: '#000000', sculpture: '#ff4400' };
for (const prop of level.props) {
  if (prop.kind === 'tree') continue;
  const col = PCOL[prop.kind] || '#444444';
  if (prop.front && prop.back) { line([...prop.front, ...prop.back.slice().reverse(), prop.front[0]], col, 2); continue; }
  const pw = prop.w || prop.wid || prop.size || 2, ph = prop.h || prop.size || (prop.kind === 'gantry' ? 1 : 2);
  const cosR = Math.cos(prop.rot || 0), sinR = Math.sin(prop.rot || 0);
  const corner = (along, across) => [prop.x + cosR * along * pw / 2 - sinR * across * ph / 2,
    prop.y + sinR * along * pw / 2 + cosR * across * ph / 2];
  line([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), corner(-1, -1)], col, 2);
  if (prop.kind !== 'parkedcar' && prop.kind !== 'marshal') cmds.push({ t: 'text', at: px([prop.x, prop.y]), s: prop.kind, col });
}
for (const mark of process.env.EXTRA ? JSON.parse(fs.readFileSync(process.env.EXTRA, 'utf8')) : [])
  line(mark.pts, mark.col || '#ff6600', 3);
const grid = [];
for (let gx = Math.ceil(X0 / 50) * 50; gx < X0 + W; gx += 50) grid.push({ t: 'line', pts: [px([gx, Y0]), px([gx, Y0 + H])], col: '#ff8080', w: 1 }, { t: 'text', at: px([gx, Y0 + 2]), s: String(gx), col: '#ff0000' });
for (let gy = Math.ceil(Y0 / 50) * 50; gy < Y0 + H; gy += 50) grid.push({ t: 'line', pts: [px([X0, gy]), px([X0 + W, gy])], col: '#ff8080', w: 1 }, { t: 'text', at: px([X0 + 1, gy]), s: String(gy), col: '#ff0000' });
fs.writeFileSync(out, JSON.stringify({ w: Math.round(W * Z), h: Math.round(H * Z), cmds: [...cmds, ...grid] }));
console.log(`wrote ${out}: ${cmds.length} draw commands`);
