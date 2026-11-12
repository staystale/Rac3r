// _crossplan.mjs - A CROSSOVER'S PLAN (scratch): the race road's edges, the underpass portals'
// walls, every barrier (Armco grey, catch fence blue, wall brown) and its ends (red dots) in a
// box round the crossing, drawn as SVG and photographed: tools/scratch/_crossplan-<level>.png.
// node tools/scratch/_crossplan.mjs <level> [half m]   (CHECK_PORT, the lock: a browser run)
import fs from 'node:fs';
import * as L from '../../src/lab.ts';
import { launchBrowser } from '../lib/browser.mjs';
import { portalCorners } from '../../src/world/venuecross.ts';

const [levelId = 'wobbly', halfArg = '55'] = process.argv.slice(2);
L.setLevel(levelId);
const sub = L.LEVEL.subtrack, half = +halfArg;
const span = sub.under.find((item) => item.over !== undefined);
const cross = L.onTrack(sub, span.over, 0, {});
const scale = 900 / (2 * half), size = 900;
const px = ([x, y]) => [((x - cross.x + half) * scale).toFixed(1), ((y - cross.y + half) * scale)
  .toFixed(1)];
const pathOf = (pts) => pts.map((point, i) => `${i ? 'L' : 'M'}${px(point).join(',')}`).join('');
const near = (x, y) => Math.abs(x - cross.x) < half + 20 && Math.abs(y - cross.y) < half + 20;
const parts = [];
// the road: its edges, sampled every metre near the crossing
for (const side of [-6.5, 6.5]) {
  let run = [];
  for (let dist = 0; dist <= sub.totalDist; dist += 1) {
    const point = L.onTrack(sub, dist, side, {});
    if (near(point.x, point.y)) run.push([point.x, point.y]);
    else if (run.length) { parts.push(`<path d="${pathOf(run)}" stroke="#333" fill="none" stroke-width="1.5"/>`); run = []; }
  }
  if (run.length) parts.push(`<path d="${pathOf(run)}" stroke="#333" fill="none" stroke-width="1.5"/>`);
}
// the portals: their walls' outer outline
for (const portal of L.LEVEL.props.filter((prop) => prop.kind === 'tunnel' && prop.track)) {
  const [openA, openB, lintelA, lintelB] = portalCorners(portal);
  parts.push(`<path d="${pathOf([openA, lintelA, lintelB, openB, openA])}" fill="rgba(0,0,0,0.25)" stroke="#000" stroke-width="2"/>`);
  parts.push(`<circle cx="${px(openA)[0]}" cy="${px(openA)[1]}" r="4" fill="#0a0"/><circle cx="${px(openB)[0]}" cy="${px(openB)[1]}" r="4" fill="#0a0"/>`);
}
const colours = { armco: '#888', catchfence: '#36c', wall: '#a63' };
L.LEVEL.barriers.forEach((bar, index) => {
  if (!bar.pts.some(([x, y]) => near(x, y))) return;
  parts.push(`<path d="${pathOf(bar.pts)}" stroke="${colours[bar.kind] || '#c0c'}" fill="none" stroke-width="3"/>`);
  for (const end of [bar.pts[0], bar.pts[bar.pts.length - 1]]) {
    const [x, y] = px(end);
    parts.push(`<circle cx="${x}" cy="${y}" r="3.5" fill="#d00"/><text x="${+x + 5}" y="${+y - 4}" font-size="11">${index}</text>`);
  }
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" style="background:#cfe3c0">${parts.join('')}</svg>`;
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: size, height: size } })).newPage();
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.screenshot({ path: `tools/scratch/_crossplan-${levelId}.png` });
  console.log(`tools/scratch/_crossplan-${levelId}.png: ${half * 2} m square round the crossing at`
    + ` ${cross.x.toFixed(1)},${cross.y.toFixed(1)}`);
} finally {
  await browser.close();
}
