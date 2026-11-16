// _pbzoff.mjs - WHERE THE RACING AI LEAVES THE ROAD ON A LEVEL, alone (headless, as
// tools/aijokercheck.mjs drives it): one car from the grid for LAPS laps per seed, and every
// excursion past the road's edge + 1 m that is not on the joker lane - where along the lap it left
// (m), its speed then, how far out it got, how long it was off, the ground it left onto, and the
// racing line's own offset and the road's radius there - grouped by 50 m of lap.
// node tools/scratch/_pbzoff.mjs [level] [car] [difficulty 0-4] [seeds] [laps]
import * as L from '../../src/lab.ts';
import { makeCar, step, reset, PHYSICS_STEP_SECONDS as DT } from '../../src/vehicle.ts';
import { createAIDriver } from '../../src/ai/circuit.ts';
import { aiTraits } from '../../src/ai/traits.ts';
import { aiPaths } from '../../src/ai/line.ts';

const [level = 'pembreezyrx', carId = 'rx-super', diffArg = '2', seedsArg = '1,2,3,4,5',
  lapsArg = '5'] = process.argv.slice(2);
const seeds = seedsArg.split(',').map(Number), laps = +lapsArg;

/** m from a point to a polyline. */
function lineDist(pts, x, y) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const along = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(ax + dx * along - x, ay + dy * along - y));
  }
  return best;
}

L.setLevel(level);
const sub = L.LEVEL.subtrack, half = sub.width / 2, total = sub.totalDist, paths = aiPaths(L.LEVEL);
// (the joker loop: the level's wide lane - a rallycross venue's joker, world/venuejoker.ts)
const joker = L.LEVEL.joker ? (L.LEVEL.lanes || []).find((lane) => lane.width >= 9)?.pts : null;
// the road's radius at a lap metre (three points 6 m apart)
const radiusAt = (dist) => {
  const at = (d) => sub.pts[Math.floor((((d % total) + total) % total) / total * sub.pts.length)];
  const [a, b, c] = [at(dist - 6), at(dist), at(dist + 6)];
  const ax = b.x - a.x, ay = b.y - a.y, bx = c.x - b.x, by = c.y - b.y;
  const cross = Math.abs(ax * by - ay * bx);
  return cross < 1e-6 ? Infinity : Math.hypot(ax, ay) * Math.hypot(bx, by) * Math.hypot(c.x - a.x,
    c.y - a.y) / (2 * cross);
};
const episodes = [];
// the loose objects a car leaving the road meets: bales and tyre stacks
const bales = (L.LEVEL.cones || []).filter((cone) => cone.kind === 'bale' || cone.kind === 'tyrestack');
let offTotal = 0, timeTotal = 0;
for (const seed of seeds) {
  L.setLevel(level); L.clearWear();
  const spawn = L.LEVEL.spawn, car = makeCar(carId);
  reset(car, spawn.x, spawn.y, spawn.heading);
  const driver = createAIDriver(L.LEVEL, aiTraits(+diffArg, 0, 1, seed));
  let time = 0, prog = null, lastQ = null, ep = null;
  while (time < 900) {
    L.applyGround(car, DT);
    const lap = prog == null ? 1 : Math.max(1, Math.floor(prog / total) + 1);
    step(car, driver.drive(car, DT, { cars: [], lap, laps }), DT);
    time += DT;
    const q = L.querySubtrack(sub, car.x, car.y);
    if (!Number.isFinite(q.trackDist)) continue;
    if (prog == null) prog = q.trackDist > total / 2 ? q.trackDist - total : q.trackDist;
    else {
      let dq = q.trackDist - lastQ;
      if (dq > total / 2) dq -= total;
      if (dq < -total / 2) dq += total;
      prog += dq;
    }
    lastQ = q.trackDist;
    const onJoker = joker && lineDist(joker, car.x, car.y) < 8;
    const off = q.dist > half + 1 && !onJoker && time > 8;
    if (off) {
      offTotal += DT;
      if (!ep) ep = { seed, lap, from: q.trackDist, speed: Math.hypot(car.vx, car.vy) * 3.6,
        out: 0, s: 0, ground: String(L.groundAt(car.x, car.y)?.surface?.id || '?'), slowest: 999, bale: Infinity, path: driver.state.path === paths.line ? 'main' : 'branch',
        mist: !!driver.state.mist, signed: 0, x: 0, y: 0,
        side: q.side };
      if (q.dist - half > ep.out) Object.assign(ep, { signed: (q.side === 'left' ? -1 : 1) * q.dist, x: car.x, y: car.y });
      ep.out = Math.max(ep.out, q.dist - half);
      if (driver.state.mist) ep.mist = true;
      ep.slowest = Math.min(ep.slowest, Math.hypot(car.vx, car.vy) * 3.6);
      for (const bale of bales) ep.bale = Math.min(ep.bale, Math.hypot(bale.x - car.x, bale.y - car.y));
      ep.s += DT;
    } else if (ep) {
      episodes.push(ep);
      ep = null;
    }
    if (prog >= total * laps) break;
  }
  if (ep) episodes.push(ep);
  timeTotal += time;
}
console.log(`${level} ${carId} difficulty ${diffArg} seeds ${seedsArg} x ${laps} laps: off ${
  offTotal.toFixed(1)} s of ${timeTotal.toFixed(0)} s, ${episodes.length} excursions`);
const bins = new Map();
for (const ep of episodes) {
  const bin = Math.floor(ep.from / 50) * 50;
  if (!bins.has(bin)) bins.set(bin, []);
  bins.get(bin).push(ep);
}
if (process.env.EACH) for (const ep of episodes) console.log('   ', JSON.stringify({ ...ep, from: Math.round(ep.from), out: +ep.out.toFixed(1), signed: +ep.signed.toFixed(1), speed: Math.round(ep.speed), s: +ep.s.toFixed(1), x: Math.round(ep.x), y: Math.round(ep.y), bale: +ep.bale.toFixed(1), slowest: Math.round(ep.slowest) }));
for (const [bin, list] of [...bins].sort((one, two) => one[0] - two[0])) {
  const secs = list.reduce((sum, ep) => sum + ep.s, 0);
  const med = (key) => [...list].sort((a, b) => a[key] - b[key])[list.length >> 1][key];
  console.log(`  lap ${bin}-${bin + 50} m: ${list.length} out, ${secs.toFixed(1)} s, entry median ${
    med('speed').toFixed(0)} km/h, out median ${med('out').toFixed(1)} m (max ${Math.max(...list
    .map((ep) => ep.out)).toFixed(1)}), sides ${list.map((ep) => ep.side[0]).join('')}, slowest median ${med('slowest').toFixed(0)} km/h, nearest bale / tyre median ${med('bale').toFixed(1)} m (${list.filter((ep) => ep.bale < 1.5).length} within 1.5 m), ground ${
    [...new Set(list.map((ep) => ep.ground))].join('/')}, road radius ${radiusAt(bin + 25)
    .toFixed(0)} m`);
}
