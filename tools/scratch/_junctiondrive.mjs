// _junctiondrive.mjs - A CAR THROUGH A MOTORWAY JUNCTION (?junctions=1): the endless road (ROAD,
// SCENERY) driven by the autopilot until a junction is laid ahead, then the car set on the motorway
// before its off-slip and steered along a route of lane points - the off-slip, half the near
// roundabout, up the bridge's ramp and over the deck, round the far roundabout, back over, the
// rest of the near ring and down the on-slip to the motorway. Each step the highway guard
// (WRONG WAY / OFF THE MOTORWAY / EXIT TAKEN) must stay quiet; it prints the route's legs reached,
// the ground under the car (tarmac share), the crossing it was on and any reset.
// JUNCTIONS=1 [ROAD=motorway] [SCENERY=countryside] [SEED=4242] node tools/scratch/_junctiondrive.mjs
import { makeCar, step, reset, PHYSICS_STEP_SECONDS } from '../../src/vehicle.ts';
import * as L from '../../src/lab.ts';
import * as hw from '../../src/highway.ts';
import { createAutoDriver } from '../../src/ai/autodrive.ts';
import { solidClamp } from '../../src/world/barriers.ts';
import { clampWorld } from '../../src/world/crossings.ts';
import { ringCentre, RING_R } from '../../src/highway/ringgeo.ts';
hw.addHighwayLevel();
L.setLevel('highway');
const level = L.LEVEL;
level.seed = +(process.env.SEED || 4242);
hw.setHighwayPreset(level, process.env.ROAD || 'motorway', process.env.SCENERY || 'countryside');
hw.resetHighway(level);
const pilot = makeCar('hatch-rwd');
reset(pilot, level.spawn.x, level.spawn.y, level.spawn.heading);
let sub = level.subtrack, driver = createAutoDriver(sub), bridge = null;
for (let time = 0; time < 900 && !bridge; time += PHYSICS_STEP_SECONDS) {
  if (level.subtrack !== sub) { sub = level.subtrack; driver = createAutoDriver(sub); }
  L.applyGround(pilot, PHYSICS_STEP_SECONDS);
  step(pilot, driver.drive(pilot, PHYSICS_STEP_SECONDS), PHYSICS_STEP_SECONDS);
  solidClamp(pilot);
  hw.stepHighway(level, pilot, L.querySubtrack(sub, pilot.x, pilot.y).trackDist);
  bridge = level.props.find((prop) => prop.rings && prop._s > (level._hw.q?.s ?? 0) + 300);
}
if (!bridge) { console.log('no junction reached'); process.exit(1); }
// the route: the off-slip lane, the near ring's back half to its +axis side, the bridge's line
// over to the far ring, round it, back, the near ring's front, the on-slip
const near = ringCentre(bridge, -1), far = ringCentre(bridge, 1);
const axis = [Math.cos(bridge.rot), Math.sin(bridge.rot)], along = [axis[1], -axis[0]];
const ringPoint = (centre, angle) => [centre[0] + RING_R * (Math.cos(angle) * along[0]
  + Math.sin(angle) * axis[0]), centre[1] + RING_R * (Math.cos(angle) * along[1]
  + Math.sin(angle) * axis[1])];
const lanesNear = level.lanes.filter((lane) => lane.width === 6 && Math.abs(lane._s - bridge._s)
  < 400);
const [offSlip, onSlip] = lanesNear.slice(-2);
// the bridge's way: its road's middle line from end A (the near side) to end B
const way = level.crossings.find((item) => item.length > 0 && Math.hypot(item.ax + item.dirX
  * item.length / 2 - bridge.x, item.ay + item.dirY * item.length / 2 - bridge.y) < 5);
const mid = (way.minAcross + way.maxAcross) / 2;
const onWay = (dist) => [way.ax + way.dirX * dist - way.dirY * mid, way.ay + way.dirY * dist
  + way.dirX * mid];
// (end A is the near ring's side when it lies nearer it)
const isAnear = Math.hypot(way.ax - near[0], way.ay - near[1]) < Math.hypot(way.ax - far[0],
  way.ay - far[1]);
const nearEnd = isAnear ? 4 : way.length - 4, farEnd = isAnear ? way.length - 4 : 4;
// (lined up on the bridge's road before each ramp, in the straight between it and the ring)
const nearLine = isAnear ? -8 : way.length + 8, farLine = isAnear ? way.length + 8 : -8;
const over = (from, to, leg) => [0.2, 0.5, 0.8, 1].map((share) => ({ pt: onWay(from + (to - from)
  * share), leg }));
const route = [
  ...offSlip.pts.filter((_, i) => i % 3 === 0).map((pt) => ({ pt, leg: 'off-slip' })),
  ...[Math.PI, Math.PI / 2].map((angle) => ({ pt: ringPoint(near, angle), leg: 'near ring' })),
  { pt: onWay(nearLine), leg: 'near ramp' },
  { pt: onWay(nearEnd), leg: 'near ramp' },
  ...over(nearEnd, farEnd, 'over the bridge'),
  ...[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => ({ pt: ringPoint(far, angle),
    leg: 'far ring' })),
  { pt: onWay(farLine), leg: 'far ramp' },
  { pt: onWay(farEnd), leg: 'far ramp' },
  ...over(farEnd, nearEnd, 'back over'),
  ...[Math.PI / 2, 0].map((angle) => ({ pt: ringPoint(near, angle), leg: 'near ring again' })),
  ...onSlip.pts.filter((_, i) => i % 3 === 0).map((pt) => ({ pt, leg: 'on-slip' })),
];
const car = makeCar('hatch-rwd');
const [startX, startY] = offSlip.pts[0];
reset(car, startX, startY, Math.atan2(offSlip.pts[2][1] - startY, offSlip.pts[2][0] - startX));
let target = 0, steps = 0, tarmac = 0, resets = [], legs = [], onDeck = 0;
for (let time = 0; time < 120 && target < route.length; time += PHYSICS_STEP_SECONDS) {
  const [aimX, aimY] = route[target].pt;
  if (Math.hypot(aimX - car.x, aimY - car.y) < 6) {
    if (legs.at(-1) !== route[target].leg) legs.push(route[target].leg);
    target++;
    continue;
  }
  let err = Math.atan2(aimY - car.y, aimX - car.x) - car.heading;
  err = Math.atan2(Math.sin(err), Math.cos(err));
  const speed = Math.hypot(car.vx, car.vy);
  // (the slips at 8 m/s; the rings and ramps at a careful 6)
  const wanted = /slip/.test(route[target].leg) ? 8 : 6;
  clampWorld(car, PHYSICS_STEP_SECONDS);
  L.applyGround(car, PHYSICS_STEP_SECONDS);
  step(car, { steer: Math.max(-1, Math.min(1, err * 2.5)), throttle: speed < wanted ? 0.5 : 0,
    brake: speed > wanted + 2 ? 0.3 : 0, handbrake: 0 }, PHYSICS_STEP_SECONDS);
  hw.stepHighway(level, car, L.querySubtrack(level.subtrack, car.x, car.y).trackDist);
  const why = hw.highwayGuard(level, car, PHYSICS_STEP_SECONDS);
  if (why && !resets.length && process.env.WHY) { const q = level._hw.q; console.log('FIRST', why, 'leg', route[target].leg, 'off', q.off.toFixed(1), 'hw', level._hw.geo.hw, 's', q.s.toFixed(0), 'best', level._hw.best?.toFixed(0), 'backT', level._hw.backT?.toFixed(2), 'surface', L.zoneSurfaceAt(car.x, car.y).id, 'crossing', car.crossing, 'v', Math.hypot(car.vx,car.vy).toFixed(1)); }
  if (why) resets.push(`${why} at ${route[target].leg}`);
  if (process.env.PROBE && steps % 30 === 0 && target >= 9 && target <= 16) console.log(route[target].leg, 'along', ((car.x - way.ax) * way.dirX + (car.y - way.ay) * way.dirY).toFixed(1), 'across', ((car.y - way.ay) * way.dirX - (car.x - way.ax) * way.dirY).toFixed(2), 'v', speed.toFixed(1), 'on', car.crossing, car._hitKind || '');
  if (process.env.HIT && car._hitKind && !globalThis.__hit) { globalThis.__hit = 1; const near2 = [...level.props, ...level.barriers.map((b) => ({ kind: 'barrier:' + b.kind, x: b.pts[0][0], y: b.pts[0][1] }))].map((p) => ({ k: p.kind, d: Math.hypot(p.x - car.x, p.y - car.y) })).sort((a, b) => a.d - b.d).slice(0, 4); console.log('HIT', car._hitKind, 'at leg', route[target].leg, JSON.stringify(near2)); }
  car._hitKind = null;
  if (car.crossing >= 0) onDeck++;
  if (L.zoneSurfaceAt(car.x, car.y).id === 'tarmac') tarmac++;
  steps++;
}
console.log(`junction at ${(bridge._s / 1000).toFixed(2)} km: route ${target}/${route.length} points,`
  + ` legs ${legs.join(' > ')}; on tarmac ${(100 * tarmac / steps).toFixed(0)} %, on the deck`
  + ` ${(onDeck * PHYSICS_STEP_SECONDS).toFixed(1)} s; resets ${resets.length}`
  + (resets.length ? ': ' + [...new Set(resets)].join('; ') : ''));
