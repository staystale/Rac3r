// _linebrake.mjs - THE OWNER'S 11-21 BUG 6 (scratch, diagnosis, no change): the "LINE" cause of
// _fieldbrake.mjs (braking / lifting mid-straight with no car near) traced on ONE AI car alone, so
// nothing but its own speed plan can be the reason. Per 10 m of lap over a span: its speed, its
// target speed (state.vT), the pedals, the ground under it, the lap's centre-line radius and the
// next corner (radius under 150 m) ahead; lap 2 (a flying lap).
// node tools/scratch/_linebrake.mjs <level> <from m> <to m> [car] [diff] [seed]
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';

const [levelId = 'pembreezyrx', fromArg = '100', toArg = '350', carId = 'hatch-rwd', diff = '2',
  seedArg = '7'] = process.argv.slice(2);
const FROM = +fromArg, TO = +toArg;
L.setLevel(levelId);
L.clearWear();
const sub = L.LEVEL.subtrack, total = sub.totalDist;
const pointAt = (dist) => sub.pts[Math.floor((((dist % total) + total) % total) / total
  * sub.pts.length)];
/**
 * The lap's centre-line radius at a distance, from points 6 m either side.
 * @param dist lap m
 * @returns radius, m (Infinity when straight)
 */
function radiusAt(dist) {
  const [a, b, c] = [pointAt(dist - 6), pointAt(dist), pointAt(dist + 6)];
  const ax = b.x - a.x, ay = b.y - a.y, bx = c.x - b.x, by = c.y - b.y;
  const cross = Math.abs(ax * by - ay * bx);
  return cross < 1e-6 ? Infinity : Math.hypot(ax, ay) * Math.hypot(bx, by)
    * Math.hypot(c.x - a.x, c.y - a.y) / (2 * cross);
}
/**
 * The next stretch tighter than 150 m ahead of a distance.
 * @param dist lap m
 * @returns { ahead m, radius m }
 */
function nextCorner(dist) {
  for (let ahead = 0; ahead < 400; ahead += 5) {
    const radius = radiusAt(dist + ahead);
    if (radius < 150) return { ahead, radius: Math.round(radius) };
  }
  return { ahead: Infinity, radius: Infinity };
}
const car = makeCar(carId);
const spawn = L.LEVEL.spawn;
reset(car, spawn.x, spawn.y, spawn.heading);
const driver = createAIDriver(L.LEVEL, aiTraits(+diff, 0, 1, +seedArg));
let prog = null, lastQ = null, time = 0;
const rows = new Map();
while (time < 400) {
  const lap = prog == null ? 1 : Math.max(1, Math.floor(prog / total) + 1);
  L.barrierClamp(car);
  L.solidClamp(car);
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  const pedals = driver.drive(car, PHYSICS_STEP_SECONDS, { cars: [], lap, laps: 5 });
  step(car, pedals, PHYSICS_STEP_SECONDS);
  time += PHYSICS_STEP_SECONDS;
  const query = L.querySubtrack(sub, car.x, car.y);
  if (!Number.isFinite(query.trackDist) || !Number.isFinite(query.dist)) continue;
  if (prog == null) prog = query.trackDist > total / 2 ? query.trackDist - total : query.trackDist;
  else {
    let delta = query.trackDist - lastQ;
    if (delta > total / 2) delta -= total;
    if (delta < -total / 2) delta += total;
    prog += delta;
  }
  lastQ = query.trackDist;
  if (lap !== 2 || query.trackDist < FROM || query.trackDist >= TO) continue;
  const bin = Math.floor(query.trackDist / 10) * 10;
  const row = rows.get(bin) || { n: 0, v: 0, vT: 0, brake: 0, lift: 0, ground: new Set(),
    off: 0 };
  row.n++;
  row.v += Math.hypot(car.vx, car.vy);
  row.vT += Math.min(99, driver.state.vT);
  if (pedals.brake > 0.15) row.brake++;
  else if ((pedals.throttle ?? 1) < 0.3) row.lift++;
  row.ground.add(car.surface.id || car.surface.name || String(car.surface.mu));
  row.off = Math.max(row.off, query.dist);
  rows.set(bin, row);
  if (prog > total * 2 + 50) break;
}
console.log(`${levelId} ${carId} alone, lap 2, ${FROM}-${TO} m (lap ${Math.round(total)} m)`);
console.log('lap m | v m/s | vT m/s | brake s lift s | ground | off-centre m | radius m '
  + '| next corner');
for (const [bin, row] of [...rows].sort((a, b) => a[0] - b[0])) {
  const corner = nextCorner(bin + 5);
  const radius = radiusAt(bin + 5);
  console.log(`${bin} | ${(row.v / row.n).toFixed(1)} | ${(row.vT / row.n).toFixed(1)} | `
    + `${(row.brake * PHYSICS_STEP_SECONDS).toFixed(2)} ${(row.lift * PHYSICS_STEP_SECONDS)
      .toFixed(2)} | ${[...row.ground].join('/')} | ${row.off.toFixed(1)} | `
    + `${Number.isFinite(radius) ? Math.round(radius) : 'straight'} | ${corner.ahead} m ahead, `
    + `R ${corner.radius}`);
}
