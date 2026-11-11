// _morails.mjs - Moanaco's walls as rails seen (real m): a line 10 real m off each side of the
// mapped lap (the aerial photographs: walls and Armco both sides all round, hard by the road),
// points nearer another stretch of the lap than 9.5 m left out, the tunnel's covered piece left out
// (its walls are the tunnel's). Prints the runs as TypeScript for moanaco-venue.ts (scratch).
const { MOANACO_VENUE: data } = await import('../../src/world/levels/venues/moanaco.ts');
const OFF = 10, STEP = 4, NEAR = 9.5;
const line = [], skip = [];
for (const [name, way] of data.layouts.gp) {
  const piece = data.pieces.find((entry) => entry.name === name);
  const pts = way > 0 ? piece.pts : piece.pts.slice().reverse();
  for (const point of line.length ? pts.slice(1) : pts) { line.push(point); skip.push(name === 'Tunnel'); }
}
// resampled every STEP m
const dense = [], denseSkip = [];
for (let i = 0; i < line.length; i++) {
  const [ax, ay] = line[i], [bx, by] = line[(i + 1) % line.length], len = Math.hypot(bx - ax, by - ay);
  for (let t = 0; t < len; t += STEP) { dense.push([ax + (bx - ax) * t / len, ay + (by - ay) * t / len]); denseSkip.push(skip[i] && skip[(i + 1) % line.length]); }
}
const distToLine = (x, y) => {
  let best = Infinity;
  for (let i = 0; i < dense.length; i++) {
    const [ax, ay] = dense[i], [bx, by] = dense[(i + 1) % dense.length], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return best;
};
const runs = [];
for (const side of [1, -1]) {
  let run = [];
  const close = () => { if (run.length > 3) runs.push({ side, pts: run }); run = []; };
  for (let i = 0; i < dense.length; i++) {
    const [px, py] = dense[(i - 2 + dense.length) % dense.length], [nx2, ny2] = dense[(i + 2) % dense.length];
    const len = Math.hypot(nx2 - px, ny2 - py) || 1, nx = -(ny2 - py) / len, ny = (nx2 - px) / len;
    const x = dense[i][0] + nx * OFF * side, y = dense[i][1] + ny * OFF * side;
    if (denseSkip[i] || distToLine(x, y) < NEAR) { close(); continue; }
    run.push([Math.round(x), Math.round(y)]);
  }
  close();
}
const out = ['const MO_RAILS: Point[][] = ['];
for (const run of runs) {
  out.push(`  // the ${run.side > 0 ? 'left' : 'right'} of the lap`, '  [');
  let row = '   ';
  for (const [x, y] of run.pts) {
    const item = ` [${x}, ${y}],`;
    if (row.length + item.length > 98) { out.push(row); row = '   '; }
    row += item;
  }
  out.push(row, '  ],');
}
out.push('];');
console.log(out.join('\n'));
console.error(runs.length, 'runs', runs.reduce((sum, run) => sum + run.pts.length, 0), 'points');
