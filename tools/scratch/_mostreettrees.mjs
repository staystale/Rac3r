// _mostreettrees.mjs - Moanaco's street trees: rows of plane trees along the boulevards, the
// quays and round the squares - lines OFF real m off each side of the mapped lap (beyond the walls:
// the venue's trees keep 6 m past the run-off's rim), broken where they come within NEAR m of
// another stretch, none along the tunnel; written as natural=tree_row ways (lat / lon) for the
// config's "extra" (world/venuescenery.ts rowTrees lays a tree every 9 m along each, some gaps,
// none in the water, on a building, a lane or a barrier) (scratch)
import fs from 'node:fs';
const { MOANACO_VENUE: data } = await import('../../src/world/levels/venues/moanaco.ts');
const LAT0 = 43.7365, LON0 = 7.4255, ML = 111320, MO = 111320 * Math.cos(LAT0 * Math.PI / 180);
const OFF = +(process.env.OFF || 25), STEP = 8, NEAR = OFF - 1;
const line = [], skip = [];
for (const [name, way] of data.layouts.gp) {
  const piece = data.pieces.find((entry) => entry.name === name);
  const pts = way > 0 ? piece.pts : piece.pts.slice().reverse();
  for (const point of line.length ? pts.slice(1) : pts) { line.push(point); skip.push(/Tunnel/.test(name)); }
}
const dense = [], denseSkip = [];
for (let i = 0; i < line.length; i++) {
  const [ax, ay] = line[i], [bx, by] = line[(i + 1) % line.length], len = Math.hypot(bx - ax, by - ay);
  for (let t = 0; t < len; t += STEP) { dense.push([ax + (bx - ax) * t / len, ay + (by - ay) * t / len]); denseSkip.push(skip[i]); }
}
const distToLap = (x, y) => Math.min(...dense.map(([px, py]) => Math.hypot(px - x, py - y)));
const rows = [];
for (const side of [1, -1]) {
  let run = [];
  const close = () => { if (run.length > 2) rows.push(run); run = []; };
  for (let i = 0; i < dense.length; i++) {
    const [px, py] = dense[(i - 2 + dense.length) % dense.length], [qx, qy] = dense[(i + 2) % dense.length];
    const len = Math.hypot(qx - px, qy - py) || 1, nx = -(qy - py) / len, ny = (qx - px) / len;
    const x = dense[i][0] + nx * OFF * side, y = dense[i][1] + ny * OFF * side;
    if (denseSkip[i] || distToLap(x, y) < NEAR) { close(); continue; }
    run.push([x, y]);
  }
  close();
}
const toLL = ([x, y]) => [+(LAT0 - y / ML).toFixed(7), +(LON0 + x / MO).toFixed(7)];
fs.writeFileSync(process.argv[2], JSON.stringify(rows.map((pts) => ({ source: `street trees: a row ${OFF} real m off the lap (tools/scratch/_mostreettrees.mjs)`, tags: { natural: 'tree_row' }, pts: pts.map(toLL) }))));
console.log(rows.length, 'rows', rows.reduce((sum, row) => sum + row.length, 0), 'points');
