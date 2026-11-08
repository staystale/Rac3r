import fs from 'node:fs';
function sub(path, a, b, all) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(a)) throw new Error(path + ': ' + a);
  s = all ? s.split(a).join(b) : s.replace(a, b);
  fs.writeFileSync(path, s);
}
const D = 'src/highway/dress.ts';
sub(D, '  const pointAt = (i, off) => {', '  const pointAt = (i: number, off: number): HwPose => {');
sub(D, '  const clear = (x, y, radius) => {', '  const clear = (x: number, y: number, radius: number) => {');
sub(D, '        (road[j].sideOff && dist2 < (road[j].sideOff + SLIP_W / 2 + radius) ** 2)',
  '        (road[j].sideOff && dist2 < (road[j].sideOff! + SLIP_W / 2 + radius) ** 2)');
sub(D, '  const freeAt = (j, off, radius) => {', '  const freeAt = (j: number, off: number, radius: number) => {');
sub(D, '  let run = null;\n  for (let i = firstIdx; i <= (level._cfg.walls ? -1 : endIdx); i++) {',
  '  let run: { a: number; side: number } | null = null;\n  for (let i = firstIdx; i <= (level._cfg.walls ? -1 : endIdx); i++) {');
sub(D, `      let pts = [];
      const flush = () => {
        if (pts.length > 2) level.barriers.push({ kind: "armco", pts, _s: road[run.a].s });`,
`      let pts: Point[] = [];
      const runNow = run;
      const flush = () => {
        if (pts.length > 2) level.barriers.push({ kind: "armco", pts, _s: road[runNow.a].s });`);
sub(D, `        if (run.side < 0 && road[j].gapL) {`, `        if (runNow.side < 0 && road[j].gapL) {`);
sub(D, `        const pos = pointAt(j, run.side * (halfWidth + 1.8));`, `        const pos = pointAt(j, runNow.side * (halfWidth + 1.8));`);
sub(D, `  const { level, halfWidth, road, firstIdx, endIdx, pointAt } = ctx, cfg = level._cfg;
  if (cfg.walls)`, `  const { level, halfWidth, road, firstIdx, endIdx, pointAt } = ctx, cfg = level._cfg;
  const walls = cfg.walls as BarrierKind | undefined, wallGap = cfg.wallGap || 0;
  if (walls)`);
sub(D, `        let pts = [];
        const flush = () => {
          if (pts.length > 1) level.barriers.push({ kind: cfg.walls, pts, _s: road[startIdx].s });`,
`        let pts: Point[] = [];
        const flush = () => {
          if (pts.length > 1) level.barriers.push({ kind: walls, pts, _s: road[startIdx].s });`);
sub(D, `              ? -Math.max(halfWidth + cfg.wallGap, sideOffset + SLIP_W / 2 + cfg.wallGap)
              : side * (halfWidth + cfg.wallGap)`, `              ? -Math.max(halfWidth + wallGap, sideOffset + SLIP_W / 2 + wallGap)
              : side * (halfWidth + wallGap)`);
fs.writeFileSync(D, fs.readFileSync(D, 'utf8'));
console.log('ok');
