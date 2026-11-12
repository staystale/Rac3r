// _portalcheck.mjs - A CROSSOVER'S PORTALS against their road (scratch; foreman 11-11 acceptance):
// (1) each portal's axis against the under-lane's heading at its open end (deg), its centre's
// offset from the lane's centre line (m) and the lane's turn along the portal; (2) cars driven at
// 15 m/s along the under lane through the tunnel both ways (on its centre and 5 m either side),
// and along the over-road past the bridge (its centre and 5 m either side) - every barrier and
// solid hit counted, the least speed after the first second, and the most the heading strays from
// the road's (a snag: a stop or a spin) - stepped as the game steps a car (world/crossings.ts
// clampWorld: the ground's barriers and solids, or the crossing's walls). node
// tools/scratch/_portalcheck.mjs <level>
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import { clampWorld } from '../../src/world/crossings.ts';

const levelId = process.argv[2] || 'wobbly';
L.setLevel(levelId);
const sub = L.LEVEL.subtrack, total = sub.totalDist;
const wrap = (dist) => ((dist % total) + total) % total;
const at = (dist, off = 0) => L.onTrack(sub, wrap(dist), off, {});
const degOf = (radians) => radians * 180 / Math.PI;
const turnBetween = (first, second) => Math.atan2(Math.sin(first - second), Math.cos(first - second));
const portals = L.LEVEL.props.filter((prop) => prop.kind === 'tunnel' && prop.track);
const span = (sub.under || []).find((item) => item.over !== undefined);
if (!span || portals.length !== 2) throw new Error(`${levelId}: no crossover`);
console.log(`${levelId}: underpass ${span.d0.toFixed(1)}-${span.d1.toFixed(1)} m, the road over at`
  + ` ${span.over.toFixed(1)} m`);
// (1) the portals: the first at the span's start (its open end there), the second at its end
portals.forEach((portal, index) => {
  const mouthDist = index === 0 ? span.d0 : span.d1, inward = index === 0 ? 1 : -1;
  const mouth = at(mouthDist), middle = at(mouthDist + inward * portal.w / 2);
  const inner = at(mouthDist + inward * portal.w);
  // (a portal's rot runs down its ramp: the road's heading the first's way, the reverse the
  // second's - its axis taken either way)
  const axisOff = Math.abs(turnBetween(2 * portal.rot, 2 * mouth.rot)) / 2;
  const across = -(portal.x - middle.x) * Math.sin(middle.rot)
    + (portal.y - middle.y) * Math.cos(middle.rot);
  const laneTurn = Math.abs(turnBetween(inner.rot, mouth.rot));
  console.log(`portal ${index + 1} at ${portal.x.toFixed(1)},${portal.y.toFixed(1)}: axis`
    + ` ${degOf(axisOff).toFixed(2)} deg off the lane at its mouth, centre ${across.toFixed(2)} m`
    + ` off the lane's centre line, the lane turns ${degOf(laneTurn).toFixed(2)} deg along it`);
});
/**
 * Drives a car along the lap from one road m to another at an offset, at 15 m/s.
 * @param from road m to start (on the ground: 40 m out from the stretch)
 * @param to road m to end
 * @param offset m across the road (left +)
 * @returns what it met
 */
function driveAlong(from, to, offset) {
  const sign = Math.sign(to - from), car = makeCar('hatch-rwd'), start = at(from, offset);
  reset(car, start.x, start.y, start.rot + (sign < 0 ? Math.PI : 0));
  const speed0 = 15;
  car.vx = Math.cos(car.heading) * speed0;
  car.vy = Math.sin(car.heading) * speed0;
  let along = from, hits = 0, solids = 0, least = Infinity, stray = 0, time = 0;
  const kinds = new Set();
  while ((to - along) * sign > 0 && time < 30) {
    // the car's own road m: the nearest of the stretch just round where it was (never the road
    // across it)
    let best = along, bestGap = Infinity;
    for (let probe = along - 4; probe <= along + 8; probe += 0.5) {
      const point = at(sign > 0 ? probe : along - (probe - along), offset);
      const gap = Math.hypot(point.x - car.x, point.y - car.y);
      if (gap < bestGap) { bestGap = gap; best = sign > 0 ? probe : along - (probe - along); }
    }
    along = best;
    const target = at(along + sign * 8, offset), road = at(along, 0);
    const want = Math.atan2(target.y - car.y, target.x - car.x);
    const now = Math.hypot(car.vx, car.vy);
    const control = { steer: Math.max(-1, Math.min(1, turnBetween(want, car.heading) * 2.5)),
      throttle: now < speed0 ? 0.7 : 0, brake: now > speed0 + 1 ? 0.3 : 0, handbrake: 0,
      reverse: 0 };
    clampWorld(car, PHYSICS_STEP_SECONDS);
    L.applyGround(car, PHYSICS_STEP_SECONDS);
    step(car, control, PHYSICS_STEP_SECONDS);
    if (process.env.PORTALDBG === `${Math.round(from)}:${offset}` && (car._hitKind
      || Math.round(time * 120) % 30 === 0)) {
      console.log('  t', time.toFixed(2), 'along', along.toFixed(1), 'at', car.x.toFixed(1),
        car.y.toFixed(1), 'level', car.crossing, 'v', Math.hypot(car.vx, car.vy).toFixed(1),
        'hit', car._hitKind || '');
    }
    if (car._hitKind) {
      if (car._hitKind === 'tunnel' || car._hitKind === 'slat' || car._hitKind === 'block') solids++;
      else hits++;
      kinds.add(car._hitKind);
      car._hitKind = null;
    }
    time += PHYSICS_STEP_SECONDS;
    if (time > 1) least = Math.min(least, Math.hypot(car.vx, car.vy));
    const roadHead = road.rot + (sign < 0 ? Math.PI : 0);
    stray = Math.max(stray, Math.abs(turnBetween(car.heading, roadHead)));
  }
  const done = (to - along) * sign <= 0;
  return { hits, solids, kinds: [...kinds].join(',') || '-', least: least.toFixed(1),
    strayDeg: degOf(stray).toFixed(1), through: done, seconds: time.toFixed(1) };
}
// m: the under lane's run out from each mouth (on the lane's straight: further back lies a hairpin
// no car takes at 15 m/s), the over road's either side of the bridge; m off the centre an edge
// drive holds (a car's half width and a little inside the 6.5 m edge)
const UNDER_OUT_M = 14, OVER_OUT_M = 40, EDGE_M = 5;
const runs = [
  ['under lane, A->B', span.d0 - UNDER_OUT_M, span.d1 + UNDER_OUT_M],
  ['under lane, B->A', span.d1 + UNDER_OUT_M, span.d0 - UNDER_OUT_M],
  ['over road, forward', span.over - OVER_OUT_M, span.over + OVER_OUT_M],
  ['over road, back', span.over + OVER_OUT_M, span.over - OVER_OUT_M],
];
let snags = 0;
for (const [name, from, to] of runs) {
  for (const offset of [0, EDGE_M, -EDGE_M]) {
    const met = driveAlong(from, to, offset);
    const snag = !met.through || met.hits + met.solids > 0 || +met.least < 10 || +met.strayDeg > 25;
    if (snag) snags++;
    console.log(`${snag ? 'SNAG' : 'OK  '} ${name} at ${offset >= 0 ? '+' : ''}${offset} m: wall hits`
      + ` ${met.hits}, solid hits ${met.solids} (${met.kinds}), least ${met.least} m/s, strays`
      + ` ${met.strayDeg} deg, through ${met.through} in ${met.seconds} s`);
  }
}
console.log(snags ? `portals: ${snags} drives snagged` : 'portals: every drive clean');
