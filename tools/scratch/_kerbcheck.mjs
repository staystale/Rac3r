// _kerbcheck.mjs - render/kerbs.ts against the whole-lap kerb loop it replaced (road.ts in another
// worktree, BASE): both draw into a recording canvas for tile-sized views along the lap and the
// overview; the new log must be the old log less the teeth wholly off the canvas, and leave the
// canvas state (fill, stroke, line width, path) as the old one did.
// BASE=<worktree> node tools/scratch/_kerbcheck.mjs [level,level,...]
import * as L from '../../src/lab.ts';
import { drawCurvedKerbs } from '../../src/render/kerbs.ts';

const base = (process.env.BASE || '../rac3r-base').replace(/\/$/, '');
const OL = await import(`../../${base}/src/lab.ts`);
const { createRoad } = await import(`../../${base}/src/render/road.ts`);
const ids = (process.argv[2] || 'spa,nordschlep,brands-snatch,knobhill').split(',');

/** a canvas 2D stand-in: logs each fill / stroke with its path and style */
function recorder() {
  const log = [];
  let path = [];
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    beginPath() { path = []; },
    moveTo(x, y) { path.push(['M', x, y]); },
    lineTo(x, y) { path.push(['L', x, y]); },
    closePath() { path.push(['Z']); },
    fill() { log.push(['fill', ctx.fillStyle, JSON.stringify(path)]); },
    stroke() { log.push(['stroke', ctx.strokeStyle, ctx.lineWidth, JSON.stringify(path)]); },
  };
  const state = () => JSON.stringify([ctx.fillStyle, ctx.strokeStyle, ctx.lineWidth, path]);
  return { ctx, log, state };
}
// a log entry's points all left / right / above / below the canvas by more than the margin
const offCanvas = (entry, W, H, margin) => {
  const pts = JSON.parse(entry[entry.length - 1]).filter((p) => p[0] !== 'Z');
  return pts.every((p) => p[1] < -margin) || pts.every((p) => p[1] > W + margin)
    || pts.every((p) => p[2] < -margin) || pts.every((p) => p[2] > H + margin);
};
let bad = 0;
for (const id of ids) {
  L.setLevel(id); OL.setLevel(id);
  const sub = L.LEVEL.subtrack;
  let views = 0, drawn = 0, kept = 0;
  const one = (cam, ppm, W, H) => {
    const view = { W, H, PPM: ppm, zoom: 1 };
    const helpers = { PPMz: () => ppm, toScreenX: (x) => (x - cam.x) * ppm + W / 2,
      toScreenY: (y) => (y - cam.y) * ppm + H / 2 };
    const was = recorder(), now = recorder();
    view.ctx = was.ctx;
    createRoad(view, cam, { ...helpers, paintLayers() {}, artBase: () => '' }).drawCurvedKerbs();
    view.ctx = now.ctx;
    drawCurvedKerbs({ view, ...helpers });
    const margin = Math.max(1, 0.08 * ppm) + 1;
    // the old log less the teeth (3 entries each) wholly off the canvas, but for the last one
    const want = [];
    for (let t = 0; t < was.log.length; t += 3) {
      const tooth = was.log.slice(t, t + 3);
      if (t + 3 < was.log.length && tooth.every((entry) => offCanvas(entry, W, H, margin))) {
        continue;
      }
      want.push(...tooth);
    }
    // the new log may keep extra off-canvas teeth (a kerb drawn whole) - drop those too
    const got = [];
    for (let t = 0; t < now.log.length; t += 3) {
      const tooth = now.log.slice(t, t + 3);
      if (t + 3 < now.log.length && tooth.every((entry) => offCanvas(entry, W, H, margin))) {
        continue;
      }
      got.push(...tooth);
    }
    views++; drawn += was.log.length / 3; kept += now.log.length / 3;
    if (JSON.stringify(want) !== JSON.stringify(got) || was.state() !== now.state()) {
      if (bad++ < 5) console.log(id, 'DIFFERENT at', cam, ppm, want.length, got.length);
    }
  };
  for (let k = 0; k < sub.pts.length; k += 5) {
    for (const ppm of [3, 9, 20]) one({ x: sub.pts[k].x, y: sub.pts[k].y }, ppm, 512, 512);
  }
  // the overview: the whole lap on one canvas
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of sub.pts) {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  one({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, 2048 / (x1 - x0 + 40), 2048,
    Math.round(2048 * (y1 - y0 + 40) / (x1 - x0 + 40)));
  console.log(`${id}: ${sub.curvedKerbs.length} kerbs, ${views} views, teeth drawn ${
    (drawn / views).toFixed(0)} -> ${(kept / views).toFixed(0)} a view`);
}
console.log(bad ? `kerbcheck: ${bad} DIFFERENT` : 'kerbcheck: OK');
