// _barrierside.mjs - HOW FAR OFF THE ROAD THE BARRIERS STAND round a stretch of lap (the start
// crash review, owner 11-09: "a lot of crashes on silver stone"): every STEP m from FROM to TO m
// along the lap from the start line, each side's nearest barrier along the road's normal - its kind
// and its distance past the road's edge - and the road's bend there (radius, the side it turns to).
// [SILLYSTONE=1] node tools/scratch/_barrierside.mjs [level] [from] [to] [step]
import * as L from '../../src/lab.ts';

const [lv = 'sillystone', fromArg = '-150', toArg = '400', stepArg = '5'] = process.argv.slice(2);
L.setLevel(lv);
const sub = L.LEVEL.subtrack, total = sub.totalDist, half = sub.width / 2, spawn = L.LEVEL.spawn;
const spawnDist = L.querySubtrack(sub, spawn.x, spawn.y).trackDist;
// where a ray from (x, y) along (dx, dy) first meets a barrier's line, m (Infinity: none in reach)
const cast = (x, y, dx, dy, reach) => {
  let best = { dist: Infinity, kind: '-' };
  for (const barrier of L.LEVEL.barriers || []) for (let i = 0; i < barrier.pts.length - 1; i++) {
    const [ax, ay] = barrier.pts[i], [bx, by] = barrier.pts[i + 1], ex = bx - ax, ey = by - ay;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - x) * ey - (ay - y) * ex) / den, u = ((ax - x) * dy - (ay - y) * dx) / den;
    if (t > 0 && t < reach && u >= 0 && u <= 1 && t < best.dist) best = { dist: t, kind: barrier.kind };
  }
  return best;
};
const pos = (dist) => L.onTrack(sub, ((spawnDist + dist) % total + total) % total, 0, {});
for (let dist = +fromArg; dist <= +toArg; dist += +stepArg) {
  const p = pos(dist), nx = Math.cos(p.rot + Math.PI / 2), ny = Math.sin(p.rot + Math.PI / 2);
  const before = pos(dist - 5), after = pos(dist + 5);
  const turn = Math.atan2(Math.sin(after.rot - before.rot), Math.cos(after.rot - before.rot));
  const radius = Math.abs(turn) > 1e-3 ? 10 / Math.abs(turn) : Infinity;
  const sides = [1, -1].map((side) => {
    const hit = cast(p.x + nx * side * half, p.y + ny * side * half, nx * side, ny * side, 40);
    return `${side > 0 ? '+' : '-'} ${hit.kind.padEnd(10)} ${Number.isFinite(hit.dist)
      ? hit.dist.toFixed(1).padStart(5) : '    -'}`;
  });
  const bend = Number.isFinite(radius) && radius < 400
    ? `R${radius.toFixed(0)} to ${turn > 0 ? '+' : '-'}` : '';
  console.log(`${String(dist).padStart(5)} m  ${sides.join('   ')}   ${bend}`);
}
