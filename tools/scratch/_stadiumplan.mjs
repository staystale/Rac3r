// _stadiumplan.mjs - A STADIUM'S WHOLE PLAN (scratch; _crossplan.mjs for the whole bowl): the race
// road's edges, the portals, every barrier (Armco grey, catch fence blue, wall brown) with its ends
// (red dots, numbered), the solid props' boxes (stands pale, the rest dark) and the loose objects
// that are not tyre stacks (orange), drawn as SVG and photographed:
// <OUT>/_stadiumplan-<level>.png. node tools/scratch/_stadiumplan.mjs <level> [half m] [cx] [cy]
// (OUT, default shots/plan; the lock: a browser run)
import fs from 'node:fs';
import * as L from '../../src/lab.ts';
import { launchBrowser } from '../lib/browser.mjs';
import { portalCorners } from '../../src/world/venuecross.ts';

const [levelId = 'wobbly', halfArg = '150', cxArg = '0', cyArg = '0'] = process.argv.slice(2);
const OUT = process.env.OUT || 'shots/plan';
fs.mkdirSync(OUT, { recursive: true });
L.setLevel(levelId);
const sub = L.LEVEL.subtrack, half = +halfArg, centre = { x: +cxArg, y: +cyArg };
const size = 1400, scale = size / (2 * half);
const px = ([x, y]) => [((x - centre.x + half) * scale).toFixed(1),
  ((y - centre.y + half) * scale).toFixed(1)];
const pathOf = (pts) => pts.map((point, i) => `${i ? 'L' : 'M'}${px(point).join(',')}`).join('');
const parts = [];
for (const side of [-6.5, 6.5]) {
  const run = [];
  for (let dist = 0; dist <= sub.totalDist; dist += 1) {
    const point = L.onTrack(sub, dist, side, {});
    run.push([point.x, point.y]);
  }
  parts.push(`<path d="${pathOf(run)}" stroke="#333" fill="none" stroke-width="1.2"/>`);
}
const box = (prop) => {
  const cosR = Math.cos(prop.rot || 0), sinR = Math.sin(prop.rot || 0);
  const w = (prop.w || prop.size || 2) / 2, h = (prop.h || prop.size || 2) / 2;
  return [[-w, -h], [w, -h], [w, h], [-w, h], [-w, -h]].map(([u, v]) =>
    [prop.x + cosR * u - sinR * v, prop.y + sinR * u + cosR * v]);
};
for (const prop of L.LEVEL.props) {
  if (prop.kind === 'tunnel') continue;
  const pale = prop.kind === 'grandstand' || prop.kind === 'block';
  parts.push(`<path d="${pathOf(box(prop))}" fill="${pale ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.5)'}"`
    + ` stroke="none"/>`);
}
for (const cone of L.LEVEL.cones) {
  if (cone.kind === 'tyrestack') continue;
  const [x, y] = px([cone.x, cone.y]);
  parts.push(`<circle cx="${x}" cy="${y}" r="2.5" fill="#e70"/>`);
}
for (const portal of L.LEVEL.props.filter((prop) => prop.kind === 'tunnel' && prop.track)) {
  const [openA, openB, lintelA, lintelB] = portalCorners(portal);
  parts.push(`<path d="${pathOf([openA, lintelA, lintelB, openB, openA])}" fill="rgba(0,0,0,0.3)"`
    + ` stroke="#000" stroke-width="1.5"/>`);
}
const colours = { armco: '#777', catchfence: '#36c', wall: '#a63' };
L.LEVEL.barriers.forEach((bar, index) => {
  parts.push(`<path d="${pathOf(bar.pts)}" stroke="${colours[bar.kind] || '#c0c'}" fill="none"`
    + ` stroke-width="2.5"/>`);
  for (const end of [bar.pts[0], bar.pts[bar.pts.length - 1]]) {
    const [x, y] = px(end);
    parts.push(`<circle cx="${x}" cy="${y}" r="3" fill="#d00"/><text x="${+x + 4}" y="${+y - 3}"`
      + ` font-size="10">${index}</text>`);
  }
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"`
  + ` style="background:#cfe3c0">${parts.join('')}</svg>`;
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: size, height: size } })).newPage();
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  const name = `${OUT}/_stadiumplan-${levelId}${process.env.TAG || ''}.png`;
  await page.screenshot({ path: name });
  console.log(`${name}: ${half * 2} m square round ${centre.x},${centre.y}; ${L.LEVEL.barriers.length}`
    + ' barriers');
} finally {
  await browser.close();
}
