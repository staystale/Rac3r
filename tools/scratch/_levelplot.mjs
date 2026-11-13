// _levelplot.mjs - A LEVEL'S PLAN AS A PICTURE, no browser (scratch): the race road (grey; dirt
// brown), the lanes (the joker: tan), every barrier (Armco white, catch fence cyan, others
// yellow), every solid's box (blocks and stands dark blue, the rest orange), the lights (pylons
// and street lamps: yellow dots), the loose objects (bales and tyres: dots), the bumps (the jump:
// red), a grid line every 50 m. Built as the game builds it (set switches by env, e.g.
// XGAYMSLOOSE=1). node tools/scratch/_levelplot.mjs <level> <out.png> [px per m, default 2]
import fs from 'node:fs';
import * as L from '../../src/lab.ts';
import { encodePng } from '../lib/png.mjs';

const [levelId = 'xgayms', outFile = 'shots/plot.png', scaleArg = '2'] = process.argv.slice(2);
const PX_PER_M = +scaleArg;
L.setLevel(levelId);
const level = L.LEVEL, sub = level.subtrack;
const bounds = level.bounds || { x0: -300, y0: -300, x1: 300, y1: 300 };
const width = Math.ceil((bounds.x1 - bounds.x0) * PX_PER_M);
const height = Math.ceil((bounds.y1 - bounds.y0) * PX_PER_M);
const rgba = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) rgba.set([168, 166, 160, 255], i * 4);
const toPx = (x, y) => [Math.round((x - bounds.x0) * PX_PER_M), Math.round((y - bounds.y0) * PX_PER_M)];
const dot = (x, y, col, radiusPx = 1) => {
  const [px, py] = toPx(x, y);
  for (let dy = -radiusPx; dy <= radiusPx; dy++) for (let dx = -radiusPx; dx <= radiusPx; dx++) {
    const qx = px + dx, qy = py + dy;
    if (qx >= 0 && qy >= 0 && qx < width && qy < height) rgba.set([...col, 255], (qy * width + qx) * 4);
  }
};
const line = (ax, ay, bx, by, col, radiusPx = 0) => {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * PX_PER_M));
  for (let i = 0; i <= steps; i++) dot(ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps, col, radiusPx);
};
const box = (solid, col) => {
  const cosR = Math.cos(solid.rot || 0), sinR = Math.sin(solid.rot || 0);
  const step = 1 / PX_PER_M;
  for (let a = -solid.w / 2; a <= solid.w / 2; a += step) for (let b = -solid.h / 2; b <= solid.h / 2; b += step)
    dot(solid.x + a * cosR - b * sinR, solid.y + a * sinR + b * cosR, col, 0);
};
// the grid
for (let x = Math.ceil(bounds.x0 / 50) * 50; x <= bounds.x1; x += 50) line(x, bounds.y0, x, bounds.y1, [150, 148, 142]);
for (let y = Math.ceil(bounds.y0 / 50) * 50; y <= bounds.y1; y += 50) line(bounds.x0, y, bounds.x1, y, [150, 148, 142]);
// the road: every sample's cross line, the road's width
const roadCol = (dist) => {
  const sector = sub.sectorAt ? sub.sectorAt(dist) : null;
  return sector && sector.surface && sector.surface.id === 'dirt' ? [139, 110, 78] : [58, 61, 70];
};
for (let i = 0; i < sub.pts.length; i++) {
  const point = sub.pts[i], next = sub.pts[(i + 1) % sub.pts.length], half = sub.width / 2;
  for (let t = 0; t <= 1; t += 0.25) {
    const x = point.x + (next.x - point.x) * t, y = point.y + (next.y - point.y) * t;
    line(x - point.nx * half, y - point.ny * half, x + point.nx * half, y + point.ny * half, roadCol(point.dist));
  }
}
for (const lane of level.lanes || []) {
  for (let i = 0; i + 1 < lane.pts.length; i++) {
    const [ax, ay] = lane.pts[i], [bx, by] = lane.pts[i + 1];
    line(ax, ay, bx, by, [196, 160, 110], Math.max(1, Math.round(lane.width * PX_PER_M / 2)));
  }
}
for (const bump of level.bumps || []) dot(bump.x, bump.y, [200, 40, 40], 3);
for (const solid of level.solids || []) {
  const blockish = solid.kind === 'block' || solid.kind === 'grandstand';
  box(solid, blockish ? [52, 64, 96] : [222, 120, 40]);
}
const barrierCol = { armco: [245, 245, 245], catchfence: [80, 220, 230] };
for (const barrier of level.barriers || []) {
  for (let i = 0; i + 1 < barrier.pts.length; i++) {
    const [ax, ay] = barrier.pts[i], [bx, by] = barrier.pts[i + 1];
    line(ax, ay, bx, by, barrierCol[barrier.kind] || [230, 210, 60]);
  }
}
for (const cone of level.cones || []) dot(cone.x, cone.y, cone.kind === 'bale' ? [214, 180, 70] : [30, 30, 30], 0);
for (const prop of level.props || []) {
  if (prop.kind === 'pylon' || prop.kind === 'flag') dot(prop.x, prop.y, prop.kind === 'pylon' ? [255, 230, 0] : [240, 120, 26], 2);
}
for (const lamp of level.lamps || []) dot(lamp.x, lamp.y, [255, 255, 120], 1);
// the start: a red cross
const start = sub.pts[0];
line(start.x - start.nx * 7, start.y - start.ny * 7, start.x + start.nx * 7, start.y + start.ny * 7, [220, 0, 0], 1);
fs.writeFileSync(outFile, encodePng(width, height, rgba));
console.log(`${levelId}: ${width}x${height} px (${PX_PER_M} px/m), lap ${sub.totalDist.toFixed(1)} m, bounds`,
  JSON.stringify(bounds), '->', outFile);
